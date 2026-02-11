/**
 * A6 Validator Agent Graph
 *
 * LangGraph implementation of the recursive validation loop that:
 * 1. Identifies gaps in generated responses (Phase 1)
 * 2. Improves responses to fix gaps (Phase 2)
 * 3. Validates improvements (Phase 3)
 * 4. Loops until no gaps remain or max iterations reached
 *
 * This ensures our responses don't commit the same gaps we identify in user workflows.
 */

import { StateGraph, END } from '@langchain/langgraph';
import { z } from 'zod';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import { withTimeout } from '../../../core/retry-utils.js';
import {
  GAP_IDENTIFICATION_SYSTEM_PROMPT,
  GapTypes,
  GapSeverity,
  type GapType,
  type GapSeverityType,
} from '../prompts/gap-identification-prompt.js';
import { RESPONSE_IMPROVEMENT_SYSTEM_PROMPT } from '../prompts/response-improvement-prompt.js';
import { repairAndParseJson } from '../utils/json-repair.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const LLM_TIMEOUT_MS = 60000; // 60 seconds per LLM call
const MAX_VALIDATION_ITERATIONS = 1; // Reduced from 2 - single pass is sufficient

// ============================================================================
// TYPES
// ============================================================================

export interface ValidatorGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

// Gap identified in a response
export interface IdentifiedGap {
  id: string;
  type: GapType;
  location: string;
  description: string;
  severity: GapSeverityType;
  evidence: string;
}

// Validation result (uses generic gap type for state compatibility)
export interface ValidationResult {
  gaps: Array<{
    id: string;
    type: string;
    location: string;
    description: string;
    severity: string;
    evidence: string;
  }>;
  passed: boolean;
  iterationCount: number;
}

// ============================================================================
// SCHEMAS
// ============================================================================

// Use lenient string types to avoid parsing failures when LLM returns slight variations
const gapSchema = z.object({
  id: z.string(),
  type: z.string(), // Lenient: accept any string, normalize later if needed
  location: z.string(),
  description: z.string(),
  severity: z.string().transform((s) => s.toLowerCase()), // Normalize to lowercase
  evidence: z.string(),
});

const gapIdentificationSchema = z.object({
  gaps: z.array(gapSchema).default([]),
}).passthrough(); // Allow extra fields LLM might return

const improvedResponseSchema = z.object({
  improvedResponse: z.string(),
  fixedGapIds: z.array(z.string()).default([]),
});

// ============================================================================
// A6 VALIDATOR SYSTEM PROMPT
// ============================================================================

export const A6_VALIDATOR_SYSTEM_PROMPT = `
You are a senior quality engineer performing recursive self-validation on workflow optimization responses.

## Your Core Mission
Apply the SAME quality standards to our generated responses that we apply when analyzing user workflows. If we identify gaps in user behavior, our response must not commit those same gaps.

## The Recursive Principle
Before approving any response, ask: "Does this response commit the gaps it identifies?"

Example violation:
- Response says: "User spent 3 minutes manually reading logs - automate this"
- But then suggests: "Use Ctrl+R to find commands faster"
- VIOLATION: User's friction was INTERPRETATION, not RECALL. The shortcut doesn't solve the identified problem.

## Bottleneck Type Classification (CRITICAL)

Every user friction falls into one of these categories:

### 1. INTERPRETATION Bottleneck
Workflow friction: The output/interface doesn't surface key signals clearly
- Symptoms: Long pauses, repeated reading, searching for patterns
- Solution type: Parsers, grep patterns, checklists of what to look for
- WRONG solution: Navigation shortcuts (doesn't help interpretation)

### 2. EXECUTION Bottleneck
Workflow friction: Task requires tedious repetitive mechanical actions
- Symptoms: Same keystroke sequences, copy-paste patterns
- Solution type: Automation, scripts, macros, aliases
- WRONG solution: "Read the docs" (they know what to do, doing it is the problem)

### 3. RECALL Bottleneck
Workflow friction: Commands, files, and locations aren't easily accessible
- Symptoms: History searching, tab-switching, asking for help
- Solution type: Shortcuts, fuzzy finders, bookmarks, cheat sheets
- CORRECT use of Ctrl+R, Cmd+K, etc.

### 4. DECISION Bottleneck
Workflow friction: Decision criteria aren't evident from context
- Symptoms: Pausing, backtracking, consulting references
- Solution type: Decision trees, rubrics, pre-defined criteria
- WRONG solution: Faster navigation (they're not slow, they're uncertain)

## Shortcut Pairing Rule (MANDATORY)

When ANY shortcut is included in a response, it MUST be paired with a cognitive solution:

### WRONG (Shortcut Only)
"Use Ctrl+R to search your bash history for previous commands"

### CORRECT (Shortcut + Cognitive Solution)
"Use Ctrl+R to find previous commands, then create this alias to automate the interpretation:
\`alias check-deploy='grep -E \"(error|success|initialized|failed)\" logs.txt | head -10'\`
This gives you faster recall (shortcut) AND faster interpretation (pattern matching)."

### WRONG (Feature Suggestion Only)
"Open Chrome DevTools with Cmd+Option+J to see console logs"

### CORRECT (Feature + What to Look For)
"Open Chrome DevTools (Cmd+Option+J), then look for these 3 patterns:
1. Red errors containing 'failed' or 'timeout' = deployment issue
2. Yellow warnings with 'deprecated' = tech debt, not urgent
3. Network tab showing 500s = backend problem, not frontend"

## Metric Methodology Requirements

### Time Estimates MUST Include Source

WRONG:
"Save 2.0 min per deployment"
"80% efficiency gain"

CORRECT:
"Based on 5 of your sessions, you spend 120-180 seconds on log review. Peers with automated parsing spend 30 seconds. Potential savings: 90-150 seconds per deployment."

### Reject Metrics That:
- Have no source citation
- Use suspiciously round numbers (exactly 2.0 min, exactly 80%)
- Compare to unspecified "peers" without sample size
- Make percentage claims without numerator/denominator

## Artifact Generation Requirements

Every response MUST include at least ONE of:
1. Checklist (copyable markdown with [ ] syntax)
2. Template (reusable structure with placeholders)
3. Script/Alias (executable automation)
4. Decision Framework (criteria for choices)

## Validation Output

Return:
- **APPROVE**: All criteria pass, no gaps found
- **REVISE**: Return list of gaps for correction
- **REJECT**: Fundamental issues requiring complete rewrite

Remember: We are the quality standard. Our responses must exemplify the rigor we expect from users.
`;

// ============================================================================
// NODE FUNCTIONS
// ============================================================================

/**
 * Phase 1: Identify gaps in the generated response
 */
async function identifyGaps(
  state: InsightState,
  deps: ValidatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A6: Starting gap identification (Phase 1)', {
    iterationCount: state.validationIterationCount || 0,
  });

  // Skip if no answer to validate
  if (!state.generatedAnswer) {
    logger.warn('A6: No generated answer to validate');
    return {
      identifiedGaps: [],
      validationPassed: true,
    };
  }

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: GAP_IDENTIFICATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Analyze this response for gaps:

## User's Original Workflow Context
${JSON.stringify(state.userWorkflows || [], null, 2)}

## Generated Response to Validate
${state.generatedAnswer}

Identify all gaps following the gap types defined. Output JSON with the gaps array.`,
          },
        ],
        gapIdentificationSchema
      ),
      LLM_TIMEOUT_MS,
      'A6 gap identification timed out'
    );

    const gaps = response.content.gaps as StateGap[];

    logger.info('A6: Gap identification complete', {
      gapsFound: gaps.length,
      gapTypes: gaps.map((g) => g.type),
    });

    return {
      identifiedGaps: gaps,
      validationPassed: gaps.length === 0,
    };
  } catch (err) {
    logger.error('A6: Gap identification failed', err instanceof Error ? err : new Error(String(err)));
    // On error, pass through without blocking
    return {
      identifiedGaps: [],
      validationPassed: true,
    };
  }
}

/**
 * Phase 2: Improve response to fix identified gaps
 */
async function improveResponse(
  state: InsightState,
  deps: ValidatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  const gaps = state.identifiedGaps || [];

  // Skip if no gaps to fix
  if (gaps.length === 0) {
    logger.info('A6: No gaps to fix, skipping improvement');
    return {};
  }

  logger.info('A6: Starting response improvement (Phase 2)', {
    gapsToFix: gaps.length,
  });

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: RESPONSE_IMPROVEMENT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Fix these gaps in the response:

## Identified Gaps
${JSON.stringify(gaps, null, 2)}

## Original Response
${state.generatedAnswer}

## User Workflow Context
${JSON.stringify(state.userWorkflows || [], null, 2)}

Return the improved response with all gaps fixed.`,
          },
        ],
        improvedResponseSchema,
        { maxTokens: 10000 } // Explicit limit to prevent truncation
      ),
      LLM_TIMEOUT_MS,
      'A6 response improvement timed out'
    );

    const improvedResponse = response.content.improvedResponse;
    const originalLength = state.generatedAnswer?.length || 0;
    const newLength = improvedResponse?.length || 0;

    logger.info('A6: Response improved', {
      newAnswerLength: newLength,
      iteration: (state.validationIterationCount || 0) + 1,
    });

    // SAFEGUARD: Reject truncated responses
    // If the "improved" response is less than 50% of the original length,
    // it's likely truncated due to JSON parsing issues - keep the original
    const MIN_LENGTH_RATIO = 0.3; // Lowered from 0.5 — shorter but complete responses are valid
    if (originalLength > 0 && newLength < originalLength * MIN_LENGTH_RATIO) {
      logger.warn('A6: Rejecting truncated response, keeping original', {
        originalLength,
        newLength,
        ratio: (newLength / originalLength).toFixed(2),
        minRatio: MIN_LENGTH_RATIO,
      });
      return {
        validationIterationCount: (state.validationIterationCount || 0) + 1,
        // Don't update generatedAnswer - keep the original
      };
    }

    return {
      generatedAnswer: improvedResponse,
      validationIterationCount: (state.validationIterationCount || 0) + 1,
    };
  } catch (err) {
    logger.error('A6: Response improvement failed', err instanceof Error ? err : new Error(String(err)));
    // On error, keep original response
    return {
      validationIterationCount: (state.validationIterationCount || 0) + 1,
    };
  }
}

/**
 * Phase 3: Validate that improvements fixed the gaps
 */
async function validateImprovement(
  state: InsightState,
  deps: ValidatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A6: Starting validation (Phase 3)', {
    iterationCount: state.validationIterationCount || 0,
  });

  // Re-run gap identification on the improved response
  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: GAP_IDENTIFICATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Validate this IMPROVED response for remaining gaps:

## User's Original Workflow Context
${JSON.stringify(state.userWorkflows || [], null, 2)}

## Improved Response to Validate
${state.generatedAnswer}

Identify any remaining gaps. Output JSON with the gaps array.`,
          },
        ],
        gapIdentificationSchema
      ),
      LLM_TIMEOUT_MS,
      'A6 validation timed out'
    );

    const remainingGaps = response.content.gaps as StateGap[];

    logger.info('A6: Validation complete', {
      remainingGaps: remainingGaps.length,
      passed: remainingGaps.length === 0,
    });

    return {
      identifiedGaps: remainingGaps,
      validationPassed: remainingGaps.length === 0,
    };
  } catch (err) {
    logger.error('A6: Validation failed', err instanceof Error ? err : new Error(String(err)));
    // On error, assume validation passed to avoid infinite loops
    return {
      identifiedGaps: [],
      validationPassed: true,
    };
  }
}

/**
 * Determine next step in the validation loop
 */
function shouldContinueLoop(state: InsightState): 'identify_gaps' | 'finalize' {
  const iterationCount = state.validationIterationCount || 0;
  const passed = state.validationPassed || false;
  const gaps = state.identifiedGaps || [];

  // Exit if passed validation
  if (passed || gaps.length === 0) {
    return 'finalize';
  }

  // Exit if max iterations reached
  if (iterationCount >= MAX_VALIDATION_ITERATIONS) {
    return 'finalize';
  }

  // Continue loop
  return 'identify_gaps';
}

/**
 * Finalize validation results
 */
async function finalizeValidation(
  state: InsightState,
  deps: ValidatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger } = deps;

  const result: ValidationResult = {
    gaps: state.identifiedGaps || [],
    passed: state.validationPassed || false,
    iterationCount: state.validationIterationCount || 0,
  };

  logger.info('A6: Validation finalized', {
    passed: result.passed,
    remainingGaps: result.gaps.length,
    iterations: result.iterationCount,
  });

  return {
    validationResult: result,
  };
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A6 Validator Agent graph with recursive validation loop
 */
export function createValidatorGraph(deps: ValidatorGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A6 Validator Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('identify_gaps', (state) => identifyGaps(state, deps))
    .addNode('improve_response', (state) => improveResponse(state, deps))
    .addNode('validate_improvement', (state) => validateImprovement(state, deps))
    .addNode('finalize', (state) => finalizeValidation(state, deps))

    // Define edges - recursive loop
    .addEdge('__start__', 'identify_gaps')
    .addEdge('identify_gaps', 'improve_response')
    .addEdge('improve_response', 'validate_improvement')
    .addConditionalEdges('validate_improvement', shouldContinueLoop)
    .addEdge('finalize', END);

  return graph.compile();
}

// ============================================================================
// STANDALONE FUNCTIONS (for use outside graph context)
// ============================================================================

// Generic gap type for state storage
type StateGap = {
  id: string;
  type: string;
  location: string;
  description: string;
  severity: string;
  evidence: string;
};

/**
 * Extract JSON from text that may contain markdown code blocks or other wrapping
 */
function extractJsonFromText(text: string): string {
  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find JSON object directly
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return text;
}

/**
 * Identify gaps in a response (standalone function)
 * Uses structured output with fallback to text generation + manual parsing
 */
export async function identifyResponseGaps(
  response: string,
  userWorkflows: unknown[],
  deps: ValidatorGraphDeps
): Promise<StateGap[]> {
  const { logger, llmProvider } = deps;

  const userPrompt = `Analyze this response for gaps:

## User's Original Workflow Context
${JSON.stringify(userWorkflows, null, 2)}

## Generated Response to Validate
${response}

Identify all gaps following the gap types defined. Output JSON with the gaps array.`;

  // First try structured output
  try {
    const result = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: GAP_IDENTIFICATION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        gapIdentificationSchema
      ),
      LLM_TIMEOUT_MS,
      'Gap identification timed out'
    );

    logger.info('A6: Gap identification succeeded with structured output', {
      gapsFound: result.content.gaps.length,
    });

    return result.content.gaps as StateGap[];
  } catch (structuredErr) {
    logger.warn('A6: Structured output failed, trying text generation fallback', {
      error: structuredErr instanceof Error ? structuredErr.message : String(structuredErr),
    });

    // Fallback: Use text generation and parse JSON manually
    try {
      const textResult = await withTimeout(
        llmProvider.generateText(
          [
            { role: 'system', content: GAP_IDENTIFICATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          { temperature: 0.1 }
        ),
        LLM_TIMEOUT_MS,
        'Gap identification text fallback timed out'
      );

      const jsonText = extractJsonFromText(textResult.content);
      // Use repairAndParseJson for robust handling of truncated LLM output
      const repairResult = repairAndParseJson<{ gaps: unknown[] }>(jsonText);
      const parsed = repairResult.success ? repairResult.data : JSON.parse(jsonText);
      const validated = gapIdentificationSchema.parse(parsed);

      logger.info('A6: Gap identification succeeded with text fallback', {
        gapsFound: validated.gaps.length,
      });

      return validated.gaps as StateGap[];
    } catch (textErr) {
      logger.error(
        'A6: Gap identification failed (both methods)',
        new Error(`Structured: ${structuredErr instanceof Error ? structuredErr.message : String(structuredErr)}, Text: ${textErr instanceof Error ? textErr.message : String(textErr)}`)
      );
      return [];
    }
  }
}

/**
 * Improve response to fix gaps (standalone function)
 */
export async function regenerateWithGapFixes(
  response: string,
  gaps: StateGap[],
  userWorkflows: unknown[],
  deps: ValidatorGraphDeps
): Promise<string> {
  const { logger, llmProvider } = deps;

  if (gaps.length === 0) {
    return response;
  }

  try {
    const result = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: RESPONSE_IMPROVEMENT_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Fix these gaps in the response:

## Identified Gaps
${JSON.stringify(gaps, null, 2)}

## Original Response
${response}

## User Workflow Context
${JSON.stringify(userWorkflows, null, 2)}

Return the improved response with all gaps fixed.`,
          },
        ],
        improvedResponseSchema,
        { maxTokens: 10000 } // Explicit limit to prevent truncation
      ),
      LLM_TIMEOUT_MS,
      'Response improvement timed out'
    );

    const improvedResponse = result.content.improvedResponse;
    const originalLength = response?.length || 0;
    const newLength = improvedResponse?.length || 0;

    // SAFEGUARD: Reject truncated responses
    // If the "improved" response is less than 30% of the original length,
    // it's likely truncated due to JSON parsing issues - keep the original
    const MIN_LENGTH_RATIO = 0.3; // Lowered from 0.5 — shorter but complete responses are valid
    if (originalLength > 0 && newLength < originalLength * MIN_LENGTH_RATIO) {
      logger.warn('regenerateWithGapFixes: Rejecting truncated response, keeping original', {
        originalLength,
        newLength,
        ratio: (newLength / originalLength).toFixed(2),
      });
      return response;
    }

    return improvedResponse;
  } catch (err) {
    logger.error('Response improvement failed', err instanceof Error ? err : new Error(String(err)));
    return response;
  }
}
