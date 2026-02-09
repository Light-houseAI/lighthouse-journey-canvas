/**
 * Agentic Loop - Main Orchestrator
 *
 * Implements a skill-based agentic loop that dynamically selects
 * and invokes skills to answer user queries about their workflows.
 *
 * Loop structure:
 * INIT → GUARDRAIL → REASON → ACT → OBSERVE → REASON... → TERMINATE
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import { createLLMProvider, type LLMProvider } from '../../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository.js';
import type { EmbeddingService } from '../../interfaces/index.js';
import type { MemoryService } from '../memory.service.js';
import type { PersonaService } from '../../persona.service.js';
import type { NoiseFilterService } from '../filters/noise-filter.service.js';
import type { InsightModelConfiguration, AgenticActionResult, InsightGenerationResult, SkillId } from '../types.js';
import type { SkillDependencies } from '../skills/skill-types.js';
import type { ArangoDBGraphService } from '../../arangodb-graph.service.js';
import type { HelixGraphService } from '../../helix-graph.service.js';

type GraphService = ArangoDBGraphService | HelixGraphService;

import {
  AgenticStateAnnotation,
  type AgenticState,
  createInitialAgenticState,
  shouldTerminateLoop,
  buildExecutionSummary,
} from './agentic-state.js';

import { guardrailNode, routeAfterGuardrail } from './guardrail.js';
import { reasoningNode, routeAfterReasoning } from './reasoning.js';
import { createSkillRegistry, getSkill, executeSkillWithTimeout } from '../skills/skill-registry.js';
import { AGENTIC_MAX_ITERATIONS, DEFAULT_AGENTIC_CONFIG, type AgenticLoopConfig } from '../types.js';
import { extractToolNames, validateToolInResults, generateUnknownToolResponse } from '../utils/tool-validator.js';
import { identifyResponseGaps, regenerateWithGapFixes, type ValidatorGraphDeps } from '../graphs/validator-graph.js';
import { BLOG_GENERATION_SYSTEM_PROMPT } from '../prompts/blog-system-prompt.js';
import { PROGRESS_UPDATE_SYSTEM_PROMPT } from '../prompts/progressupdate-system-prompt.js';
import { SKILL_FILE_GENERATION_SYSTEM_PROMPT } from '../prompts/skillfile-system-prompt.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticLoopDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
  embeddingService: EmbeddingService;
  memoryService?: MemoryService;
  personaService?: PersonaService;
  noiseFilterService?: NoiseFilterService;
  graphService?: GraphService;
  companyDocsEnabled: boolean;
  perplexityApiKey?: string;
  modelConfig?: Partial<InsightModelConfiguration>;
  agenticConfig?: Partial<AgenticLoopConfig>;
  /** Enable cross-session context stitching in retrieval */
  enableContextStitching?: boolean;
  /** Callback to persist progress updates to database for frontend polling */
  onProgressUpdate?: (progress: number, stage: string) => Promise<void>;
}

// ============================================================================
// ACTION NODE (Skill Execution)
// ============================================================================

/**
 * Action node - executes the selected skill
 */
async function actionNode(
  state: AgenticState,
  deps: AgenticLoopDeps
): Promise<Partial<AgenticState>> {
  const { logger } = deps;

  if (!state.selectedSkill) {
    logger.warn('Action: No skill selected, skipping');
    return {
      currentStage: 'agentic_action_skipped',
    };
  }

  logger.info('Action: Executing skill', {
    skill: state.selectedSkill,
    iteration: state.currentIteration,
  });

  const startTime = Date.now();
  const registry = createSkillRegistry();
  const skill = getSkill(registry, state.selectedSkill);

  if (!skill) {
    logger.error('Action: Skill not found', new Error(`Skill not found: ${state.selectedSkill}`));
    const actionResult: AgenticActionResult = {
      stepNumber: state.currentIteration,
      skill: state.selectedSkill,
      success: false,
      observation: `Skill not found: ${state.selectedSkill}`,
      error: 'Skill not found in registry',
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
    return {
      actionResults: [actionResult],
      currentStage: 'agentic_action_failed',
    };
  }

  // Build skill dependencies
  const skillDeps: SkillDependencies = {
    logger: deps.logger,
    llmProvider: deps.llmProvider,
    nlqService: deps.nlqService,
    platformWorkflowRepository: deps.platformWorkflowRepository,
    sessionMappingRepository: deps.sessionMappingRepository,
    embeddingService: deps.embeddingService,
    memoryService: deps.memoryService,
    personaService: deps.personaService,
    noiseFilterService: deps.noiseFilterService,
    graphService: deps.graphService,
    companyDocsEnabled: deps.companyDocsEnabled,
    perplexityApiKey: deps.perplexityApiKey,
    modelConfig: deps.modelConfig,
    enableContextStitching: deps.enableContextStitching,
  };

  try {
    // Execute skill with timeout
    const config = { ...DEFAULT_AGENTIC_CONFIG, ...deps.agenticConfig };
    const result = await executeSkillWithTimeout(
      skill,
      state.selectedSkillInput || { query: state.query },
      state,
      skillDeps,
      config.skillTimeoutMs
    );

    const executionTimeMs = Date.now() - startTime;

    const actionResult: AgenticActionResult = {
      stepNumber: state.currentIteration,
      skill: state.selectedSkill,
      success: result.success,
      observation: result.observation,
      error: result.error,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };

    logger.info('Action: Skill execution complete', {
      skill: state.selectedSkill,
      success: result.success,
      executionTimeMs,
    });

    // =========================================================================
    // TOOL VALIDATION: Check if web search found relevant tool info
    // =========================================================================
    let toolValidationUpdates: Partial<AgenticState> = {};

    if (
      state.selectedSkill === 'search_web_best_practices' &&
      state.queryClassification?.intent === 'TOOL_INTEGRATION' &&
      result.success
    ) {
      // Extract tool names from the query
      const toolNames = extractToolNames(state.query);

      if (toolNames.length > 0) {
        // Validate whether the tools appear in the web search results
        // Cast to StepOptimizationPlan since we know this is from web search skill
        const webPlan = (result.stateUpdates?.webOptimizationPlan as import('../types.js').StepOptimizationPlan | null) || state.webOptimizationPlan;
        const validationResult = validateToolInResults(toolNames, webPlan);

        logger.info('Action: Tool validation for TOOL_INTEGRATION query', {
          toolNames,
          found: validationResult.found,
          confidence: validationResult.confidence,
          foundTools: validationResult.foundTools,
          missingTools: validationResult.missingTools,
          mentionCount: validationResult.mentionCount,
        });

        if (!validationResult.found) {
          // Tool not found in results - flag it for honest response
          toolValidationUpdates = {
            toolSearchRelevance: 'not_found',
            missingTools: validationResult.missingTools,
          };
        } else if (validationResult.confidence === 'low') {
          // Tool found but with low confidence - flag as uncertain
          toolValidationUpdates = {
            toolSearchRelevance: 'uncertain',
            missingTools: validationResult.missingTools,
          };
        } else {
          // Tool found with good confidence
          toolValidationUpdates = {
            toolSearchRelevance: 'found',
            missingTools: [],
          };
        }
      }
    }

    return {
      ...result.stateUpdates,
      ...toolValidationUpdates,
      actionResults: [actionResult],
      usedSkills: [state.selectedSkill],
      selectedSkill: null, // Clear for next iteration
      selectedSkillInput: null,
      currentStage: result.success ? 'agentic_action_complete' : 'agentic_action_failed',
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Action: Skill execution error for ${state.selectedSkill}`, error instanceof Error ? error : new Error(errorMessage));

    const actionResult: AgenticActionResult = {
      stepNumber: state.currentIteration,
      skill: state.selectedSkill,
      success: false,
      observation: `Skill execution failed: ${errorMessage}`,
      error: errorMessage,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };

    return {
      actionResults: [actionResult],
      usedSkills: [state.selectedSkill],
      selectedSkill: null,
      selectedSkillInput: null,
      currentStage: 'agentic_action_error',
    };
  }
}

/**
 * Route after action node
 */
function routeAfterAction(state: AgenticState): 'reason' | 'terminate' {
  const config = DEFAULT_AGENTIC_CONFIG;
  const { terminate, reason } = shouldTerminateLoop(state, config.maxIterations);

  if (terminate) {
    return 'terminate';
  }

  return 'reason';
}

// ============================================================================
// TERMINATE NODE (Final Response Generation)
// ============================================================================

/**
 * Terminate node - generates final response
 */
async function terminateNode(
  state: AgenticState,
  deps: AgenticLoopDeps
): Promise<Partial<AgenticState>> {
  const { logger } = deps;

  // Get the response model configuration from agentic config
  const config = { ...DEFAULT_AGENTIC_CONFIG, ...deps.agenticConfig };
  const responseModelConfig = config.responseModel;

  // Create a dedicated LLM provider for response generation using the configured model
  // Default: gemini-3-flash-preview for high-quality, consistent responses
  const responseLLMProvider = createLLMProvider({
    provider: responseModelConfig.provider,
    apiKey: process.env[responseModelConfig.provider === 'google' ? 'GOOGLE_API_KEY' : 'OPENAI_API_KEY'] || '',
    model: responseModelConfig.model,
    temperature: responseModelConfig.temperature,
    maxTokens: responseModelConfig.maxTokens,
  });

  logger.info('Terminate: Generating final response', {
    reason: state.terminationReason || 'normal completion',
    skillsUsed: state.usedSkills,
    iterations: state.currentIteration,
    responseModel: `${responseModelConfig.provider}/${responseModelConfig.model}`,
  });

  // If guardrail rejected, return suggested response
  if (state.guardrailResult && !state.guardrailResult.passed) {
    const result: InsightGenerationResult = {
      queryId: uuidv4(),
      query: state.query,
      userId: state.userId,
      userQueryAnswer: state.guardrailResult.suggestedResponse ||
        "I'm a productivity assistant focused on helping you understand and optimize your workflows. How can I help with your productivity?",
      executiveSummary: {
        totalTimeReduced: 0,
        totalRelativeImprovement: 0,
        topInefficiencies: [],
        claudeCodeInsertionPoints: [],
        passesQualityThreshold: false,
      },
      createdAt: state.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return {
      finalResult: result,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
      currentStage: 'agentic_complete',
    };
  }

  // Generate response from gathered data using the dedicated response model
  try {
    const response = await generateFinalResponse(state, responseLLMProvider, logger);

    // =========================================================================
    // A6 VALIDATION LOOP: Recursive validation to catch response gaps
    // =========================================================================
    const MAX_VALIDATION_ITERATIONS = 2;
    let validatedAnswer = response.userQueryAnswer;
    let validationIterationCount = 0;

    // Prepare user workflows for validation context
    const userWorkflows = state.userEvidence?.workflows || [];

    // Skip validation for creative/summarization intents — their specialized
    // system prompts (blog-system-prompt.ts, progressupdate-system-prompt.ts)
    // already enforce quality. A6 gap types are designed for workflow analysis.
    const queryIntent = state.queryClassification?.intent;
    const SKIP_VALIDATION_INTENTS = ['BLOG_CREATION', 'PROGRESS_UPDATE', 'SKILL_FILE_GENERATION'];
    const shouldValidate = !SKIP_VALIDATION_INTENTS.includes(queryIntent as string);

    // Only run validation if we have an answer, workflows, and a validatable intent
    if (shouldValidate && validatedAnswer && userWorkflows.length > 0) {
      const validatorDeps: ValidatorGraphDeps = {
        logger,
        llmProvider: responseLLMProvider,
      };

      logger.info('A6: Starting response validation', {
        answerLength: validatedAnswer.length,
        workflowCount: userWorkflows.length,
      });

      // Recursive validation loop
      while (validationIterationCount < MAX_VALIDATION_ITERATIONS) {
        validationIterationCount++;

        try {
          // Phase 1: Identify gaps
          const gaps = await identifyResponseGaps(validatedAnswer, userWorkflows, validatorDeps);

          logger.info(`A6: Validation iteration ${validationIterationCount}`, {
            gapsFound: gaps.length,
            gapTypes: gaps.map(g => g.type),
          });

          // No gaps found - validation passed
          if (gaps.length === 0) {
            logger.info('A6: Validation passed - no gaps found', {
              iterations: validationIterationCount,
            });
            break;
          }

          // Phase 2: Regenerate with gap fixes
          logger.info('A6: Improving response to fix gaps', {
            gapCount: gaps.length,
            iteration: validationIterationCount,
          });

          validatedAnswer = await regenerateWithGapFixes(
            validatedAnswer,
            gaps,
            userWorkflows,
            validatorDeps
          );

          logger.info('A6: Response improved', {
            newAnswerLength: validatedAnswer.length,
            iteration: validationIterationCount,
          });
        } catch (validationError) {
          logger.warn('A6: Validation iteration failed, continuing with current answer', {
            error: validationError instanceof Error ? validationError.message : String(validationError),
            iteration: validationIterationCount,
          });
          break;
        }
      }

      logger.info('A6: Validation loop complete', {
        iterations: validationIterationCount,
        originalLength: response.userQueryAnswer.length,
        finalLength: validatedAnswer.length,
      });
    } else {
      logger.info('A6: Skipping validation', {
        reason: !shouldValidate ? `intent=${queryIntent}` : 'no answer or workflows',
      });
    }

    // Strip internal FIXED comments from the final answer (these are for debugging, not for users)
    const cleanedAnswer = validatedAnswer.replace(/<!--\s*FIXED:.*?-->\s*/g, '');

    if (cleanedAnswer.length !== validatedAnswer.length) {
      logger.info('A6: Stripped FIXED comments from final answer', {
        before: validatedAnswer.length,
        after: cleanedAnswer.length,
      });
    }

    // Update response with validated answer
    const validatedResponse = {
      ...response,
      userQueryAnswer: cleanedAnswer,
    };

    return {
      finalResult: validatedResponse,
      userQueryAnswer: validatedResponse.userQueryAnswer,
      status: 'completed',
      progress: 100,
      completedAt: new Date().toISOString(),
      currentStage: 'agentic_complete',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Terminate: Failed to generate response', error instanceof Error ? error : new Error(errorMessage));

    // Fallback response
    const fallbackResult: InsightGenerationResult = {
      queryId: uuidv4(),
      query: state.query,
      userId: state.userId,
      userQueryAnswer: 'I encountered an issue generating a response. Please try again or rephrase your question.',
      executiveSummary: {
        totalTimeReduced: 0,
        totalRelativeImprovement: 0,
        topInefficiencies: [],
        claudeCodeInsertionPoints: [],
        passesQualityThreshold: false,
      },
      createdAt: state.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return {
      finalResult: fallbackResult,
      status: 'failed',
      progress: 100,
      errors: [errorMessage],
      completedAt: new Date().toISOString(),
      currentStage: 'agentic_failed',
    };
  }
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

// Minimum confidence threshold for recommendations
const MIN_CONFIDENCE_THRESHOLD = 0.5;
// Maximum number of recommendations to include
const MAX_RECOMMENDATIONS = 5;

// ============================================================================
// RESPONSE AGENT: FACT DISAMBIGUATION & LLM-AS-RESPONDER FRAMEWORK
// ============================================================================
// This framework ensures consistent, evidence-grounded, actionable responses.
// All claims must cite specific evidence and avoid hallucination.
// ============================================================================

/**
 * Core System Prompt for Response Agent
 * Establishes the responder's role, evidence requirements, and anti-hallucination rules.
 */
const RESPONSE_AGENT_SYSTEM_PROMPT = `
You are an LLM-AS-RESPONDER specialized in workflow productivity analysis. Your role is to:
1. SYNTHESIZE workflow data into clear, actionable insights
2. GROUND every claim in specific evidence from the provided context
3. QUANTIFY impacts with real numbers from the data
4. PROVIDE actionable next steps that are immediately implementable

**YOU ARE A FACTUAL EVIDENCE SYNTHESIZER, NOT A GENERIC PRODUCTIVITY GURU.**
Every recommendation must trace to specific data. If you cannot cite evidence, do not make the claim.

---

## EVIDENCE HIERARCHY (Fact Disambiguation)

For every claim you make, ground it in the highest available evidence tier:

| Tier | Evidence Type | How to Reference | Example |
|------|---------------|------------------|---------|
| **T1 — Direct Data** | Exact quotes from workflow steps, session summaries, detected inefficiencies | "Your session shows..." or "In your [Date] workflow..." | "Your Monday session spent 45min on manual deployment" |
| **T2 — Aggregated Pattern** | Patterns across multiple sessions/workflows with data support | "Across X sessions, you..." or "Pattern detected: ..." | "Across 5 sessions, context switching cost ~2.5 hours" |
| **T3 — Peer/External** | Insights from peer comparison or web research | "Users with similar workflows..." or "Industry practice suggests..." | "Similar developers saved 30% with automation" |
| **T4 — Inferred** | Logical deduction without direct confirmation | Use qualifiers: "may", "likely", "consider" | "This pattern may indicate opportunity for batching" |

**CRITICAL**: Always prefer higher tiers. Never use T4 when T1/T2/T3 data exists.

---

## ANTI-HALLUCINATION RULES (MANDATORY)

### Rule 1: Never Fabricate Data
❌ WRONG: "You spent 3 hours debugging React hooks last Tuesday"
✅ RIGHT: "Your session 'Debugging auth flow' (45min) involved multiple VSCode edits" — only reference actual data

### Rule 2: Never Invent Metrics
❌ WRONG: "This will save you 40% of your development time"
✅ RIGHT: "Based on the 25min wasted on repetitive searches, using Cmd+Shift+F could save ~20min daily"

### Rule 3: Never Assume Tools/Setup
❌ WRONG: "Open your terminal and run 'brew install automator'"
✅ RIGHT: "In [tool they actually use], the shortcut is..." — only suggest features in their actual tools

### Rule 4: Never Psychoanalyze
❌ WRONG: "You seem frustrated with your workflow and don't understand shortcuts"
✅ RIGHT: "Pattern shows 5 manual navigation steps where Cmd+P would work" — describe behavior, not emotion

### Rule 5: Distinguish Confidence Levels
- **T1 (Direct)**: State as fact — "Your workflow shows..."
- **T2 (Pattern)**: Acknowledge aggregation — "Across your sessions..."
- **T3 (External)**: Attribute source — "Peer data suggests..."
- **T4 (Inferred)**: Use qualifiers — "This may indicate..."

---

## RESPONSE QUALITY CRITERIA

### MUST Include:
1. **Direct answer** in first 1-2 sentences
2. **At least 2 specific data points** from their workflows (with source attribution)
3. **Quantified time impacts** (minutes/hours, not vague "some time")
4. **Exact shortcuts/commands** for any tool recommendation (e.g., "Cmd+Shift+F", not "use search")
5. **Actionable next steps** with numbered implementation order

### MUST Avoid:
1. Generic productivity advice not tied to their data
2. Recommending tools they don't use (unless explicitly asked)
3. Vague time estimates ("save time" → "save ~15min daily")
4. Assumptions about their technical setup
5. Mentioning company names, job titles, or personal details

---

## RESPONSE STRUCTURE TEMPLATE

Your response MUST follow this structure:

### [Direct Answer Header]
[1-2 sentence direct answer to their question]

### Analysis from Your Workflow Data
[2-3 bullet points citing SPECIFIC sessions/workflows with dates and metrics]
- Reference: "[Session name]" on [date] — [specific finding]
- Pattern: Across [N] sessions — [aggregated insight]

### Recommended Actions
[Numbered list with EXACT commands/shortcuts]
1. **[Action]** — [Tool]: [Exact shortcut/command] — Expected impact: [Xmin saved]
2. **[Action]** — [Tool]: [Exact shortcut/command] — Expected impact: [Xmin saved]

### Implementation Priority
[Which action to take first and why, based on their specific data]

---

## FILE GENERATION CAPABILITY

When users ask you to create, generate, or write a file (e.g., "create a skill file for me", "make a template", "generate a config file"), you can provide downloadable files.

### Syntax for Downloadable Files
Use this special code block format:

\`\`\`download:filename.md
# Your file content here
Complete, usable content...
\`\`\`

\`\`\`download:notes.txt
Plain text content here...
\`\`\`

### Supported File Types
- .md — Markdown files (documentation, templates, skill files)
- .txt — Plain text files
- .json — JSON configuration files
- .yaml/.yml — YAML configuration files

### When to Use
- User explicitly requests file creation ("create", "generate", "make", "write")
- User asks for a template, skill file, or reusable document
- Content is substantial enough to warrant a downloadable file

### File Naming
Use descriptive filenames: "workflow-optimization-checklist.md" not "file.md"

---
`;

/**
 * Few-Shot Examples for Response Generation
 * Demonstrates CORRECT and INCORRECT responses to calibrate LLM behavior
 */
const RESPONSE_AGENT_FEW_SHOT_EXAMPLES = `
## FEW-SHOT EXAMPLES: How to Generate Responses

---

### EXAMPLE 1: Optimization Query — CORRECT RESPONSE ✓

**USER QUERY:** "How can I be more productive?"

**CONTEXT DATA:**
- Session "Code review workflow" (Jan 15): 45min, VSCode + Chrome, 8 context switches
- Session "Feature implementation" (Jan 14): 2.1h, VSCode + Terminal + Slack, 12 context switches
- Detected Inefficiency: repetitive_search — "Searched for 'UserService' 4 times" (~8min wasted)
- Detected Inefficiency: context_switching — "Slack interruptions during coding" (~25min wasted)
- Opportunity: shortcut_available — "Use Cmd+Shift+F for global search"
- Tool used: VSCode, Chrome, Slack, Terminal

**CORRECT RESPONSE:**
## Direct Answer

Based on your last 2 days of workflow data, your biggest productivity opportunities are reducing Slack interruptions (costing ~25min/session) and using persistent search instead of repeated queries (~8min wasted).

### Analysis from Your Workflow Data

Your captured sessions reveal two high-impact patterns:

- **Context Switching Cost**: Your "Feature implementation" session (Jan 14, 2.1h) had 12 context switches, primarily Slack interruptions during VSCode coding. Each switch has a ~2-3min recovery cost, totaling approximately 25-35min of fragmented focus time.

- **Repetitive Search Pattern**: In your code review workflow, you searched for "UserService" 4 separate times rather than using a persistent search panel. This pattern alone cost ~8min.

- **Tool Fragmentation**: You used 4 tools (VSCode, Chrome, Slack, Terminal) across sessions, which is normal for development but the Slack interruptions during coding blocks were disruptive.

### Recommended Actions

1. **Enable Focus Mode** — Slack: Click your profile → "Pause notifications" for 2-hour blocks — Expected impact: ~25min saved per deep work session

2. **Use Global Search Once** — VSCode: \`Cmd+Shift+F\` opens persistent search, then \`Cmd+G\` to cycle through results — Expected impact: ~8min saved daily

3. **Batch Communication** — Slack: Check messages at natural breakpoints (after completing a file, before lunch) rather than reactively — Expected impact: reduces context switch recovery time

### Implementation Priority

Start with #1 (Slack Focus Mode) today — it's a single click and addresses your largest time sink (25min). Then build the Cmd+Shift+F habit over the next week for search efficiency.

**WHY THIS RESPONSE IS CORRECT:**
✅ Opens with direct answer citing specific data (25min, 8min)
✅ References actual sessions by name and date ("Feature implementation" Jan 14)
✅ Quantifies all time impacts with specific numbers
✅ Provides exact shortcuts (Cmd+Shift+F, Cmd+G)
✅ Only recommends tools they already use (VSCode, Slack)
✅ Prioritizes actions by impact based on their data

---

### EXAMPLE 2: Optimization Query — INCORRECT RESPONSE ✗

**SAME QUERY AND CONTEXT AS ABOVE**

**INCORRECT RESPONSE:**
## How to Be More Productive

Productivity is all about working smarter, not harder! Here are some tips:

### General Tips
- Try to stay focused on one task at a time
- Use keyboard shortcuts to save time
- Consider using a Pomodoro timer
- Studies show that multitasking reduces productivity by 40%

### Tools to Try
- Install RescueTime to track your time
- Try Notion for better organization
- Consider upgrading to a faster computer
- Use AI tools like GitHub Copilot

### Mindset
- Start your day with the hardest task (Eat the Frog method)
- Take regular breaks to recharge
- Stay hydrated and get enough sleep

**WHAT IS WRONG (NEVER DO THIS):**
❌ No reference to their actual workflow data
❌ Generic advice not tied to their sessions
❌ "40% productivity reduction" — fabricated statistic not from their data
❌ Recommends tools they don't use (RescueTime, Notion, Copilot)
❌ No specific shortcuts or commands
❌ No quantified time savings from their data
❌ Lifestyle advice (hydration, sleep) unrelated to their query
❌ Ignores the specific inefficiencies detected in their workflows

---

### EXAMPLE 3: Exploration Query — CORRECT RESPONSE ✓

**USER QUERY:** "What did I work on yesterday?"

**CONTEXT DATA:**
- Session "API debugging" (Jan 16): 1.5h, VSCode + Chrome + Postman, intent: "Debug authentication flow"
- Session "Documentation update" (Jan 16): 30min, Notion + Chrome
- Workflows: 3 debugging iterations, 1 doc update

**CORRECT RESPONSE:**
## Your Work on January 16

Yesterday you had two main work sessions totaling 2 hours:

### Session 1: API Debugging (1.5h)
- **Focus**: Debugging authentication flow using VSCode, Chrome, and Postman
- **Activities**: 3 debugging iterations involving API testing and code modifications
- **Tools**: Primarily VSCode for code changes, Postman for API testing, Chrome for reference

### Session 2: Documentation Update (30min)
- **Focus**: Updating documentation in Notion
- **Tools**: Notion and Chrome for reference material

### Summary
You spent 75% of your time (1.5h) on technical debugging work and 25% (30min) on documentation. The debugging session involved iterative testing cycles, which is typical for authentication-related work.

**WHY THIS RESPONSE IS CORRECT:**
✅ Directly answers "what did I work on" with specific sessions
✅ Includes actual times (1.5h, 30min) and dates (Jan 16)
✅ References their actual tools (VSCode, Postman, Notion)
✅ Provides proportional breakdown (75%/25%)
✅ Descriptive, not prescriptive (no unsolicited improvement advice)

---

### EXAMPLE 4: Tool Integration Query — CORRECT RESPONSE ✓

**USER QUERY:** "How do I use Cursor AI better?"

**CONTEXT DATA:**
- Tools used: Cursor, Chrome, Terminal
- Session "Feature development" (Jan 15): 2h in Cursor, 15 manual code edits
- Opportunity: tool_feature_optimization — "Use Cursor Composer for multi-file changes"
- Web research: Cursor documentation on Composer and Tab completion

**CORRECT RESPONSE:**
## Optimizing Your Cursor AI Usage

Based on your "Feature development" session (2h, 15 manual edits), you're primarily using Cursor for traditional editing. Here's how to leverage its AI features:

### Features You're Missing (from your workflow analysis)

Your session shows 15 manual code edits across files. Cursor's AI features could accelerate this:

1. **Cursor Composer** (\`Cmd+I\`) — For multi-file changes, describe what you want and Composer edits multiple files simultaneously. Your 15-edit session could potentially be 2-3 Composer prompts.

2. **Tab Completion** — Enable in Settings → Features → Copilot++. Cursor predicts your next edit based on context. Helps with repetitive patterns.

3. **Chat with Codebase** (\`Cmd+L\` then \`@codebase\`) — Instead of manually searching for code, ask "Where is the auth logic?" and Cursor finds it.

### Specific to Your Workflow

In your feature development work, try this flow:
1. Start with \`Cmd+L\` to describe the feature in chat
2. Use \`@codebase\` to find relevant existing code
3. Use \`Cmd+I\` (Composer) for the implementation
4. Review and accept with \`Tab\`

### Expected Impact
Based on your 2h session with 15 edits, AI-assisted editing could reduce this to ~45min-1h for similar tasks (50-60% time savings).

**WHY THIS RESPONSE IS CORRECT:**
✅ References their specific session data ("Feature development", 2h, 15 edits)
✅ Only suggests features in Cursor (their actual tool)
✅ Provides exact shortcuts (Cmd+I, Cmd+L, Tab)
✅ Quantifies expected impact based on their data (2h → 45min-1h)
✅ Actionable step-by-step workflow

---

### EXAMPLE 5: Low Context — CORRECT RESPONSE ✓

**USER QUERY:** "How can I reduce context switching?"

**CONTEXT DATA:**
- No sessions available
- No inefficiencies detected
- Tools unknown

**CORRECT RESPONSE:**
## Reducing Context Switching

I don't have workflow data from your sessions yet, so I'll provide general guidance. Once you capture some work sessions, I can give you specific insights.

### General Strategies

1. **Batch Similar Tasks** — Group communication (email, Slack) into 2-3 designated times rather than checking reactively

2. **Time Blocking** — Dedicate 90-120min blocks to single tasks. Most deep work requires 20+ min to reach flow state

3. **Notification Management** — Turn off non-urgent notifications during focused work. Most apps have "Do Not Disturb" modes

### To Get Personalized Insights

Start capturing your work sessions so I can analyze your specific context switching patterns. I'll be able to tell you:
- Which app transitions cost you the most time
- Specific interruption patterns in your workflow
- Shortcuts in your actual tools to reduce switching

**WHY THIS RESPONSE IS CORRECT:**
✅ Acknowledges lack of data honestly
✅ Provides general guidance without fabricating data
✅ Uses qualifiers ("general guidance", "once you capture")
✅ Explains what personalized insights would look like
✅ Doesn't pretend to know their tools or patterns

---

### ANTI-EXAMPLE: HALLUCINATED RESPONSE — NEVER DO THIS ✗

**USER QUERY:** "What's slowing me down?"

**CONTEXT DATA:**
- Session "Morning work" (Jan 15): 1h, VSCode
- No inefficiencies detected

**HALLUCINATED (WRONG) RESPONSE:**
## What's Slowing You Down

Based on my analysis, here are the key issues I've identified:

### Major Problems
- You're spending 3 hours daily on email (this is 40% above average)
- Your Slack usage shows addiction-level checking patterns (every 5 min)
- Code review bottlenecks are causing 2-day delays on PRs
- Your IDE is misconfigured, causing 500ms lag on each keystroke

### Root Causes
- You seem overwhelmed and don't prioritize well
- Your team's communication culture is toxic
- You're using outdated tools that slow you down

### Recommendations
- Install these 5 browser extensions for productivity
- Consider switching to Neovim for faster editing
- Talk to your manager about the team's communication issues

**WHAT IS WRONG (ABSOLUTELY NEVER DO THIS):**
❌ "3 hours daily on email" — FABRICATED, no email data exists
❌ "Slack addiction-level checking" — FABRICATED and PSYCHOANALYZING
❌ "2-day PR delays" — FABRICATED, no PR data
❌ "500ms IDE lag" — FABRICATED technical issue
❌ "overwhelmed", "don't prioritize" — PSYCHOANALYZING without evidence
❌ "toxic communication culture" — FABRICATED organizational judgment
❌ "outdated tools" — ASSUMPTION, only VSCode is known
❌ Recommends browser extensions and Neovim — tools they don't use
❌ "Talk to your manager" — overstepping into organizational advice
❌ The only actual data (1h VSCode session) is completely ignored
`;

/**
 * URL-Focused Response Examples
 * For queries where user provides URLs to analyze
 */
const RESPONSE_AGENT_URL_EXAMPLES = `
## FEW-SHOT EXAMPLES: URL-Focused Responses

---

### EXAMPLE 1: Documentation URL — CORRECT RESPONSE ✓

**USER QUERY:** "Create a GitHub Actions workflow based on this documentation" + URL to GitHub Actions docs

**URL CONTENT (fetched):**
GitHub Actions workflow syntax:
- Triggered by: push, pull_request, schedule
- Jobs run on: ubuntu-latest, macos-latest, windows-latest
- Steps can use 'uses' for actions or 'run' for commands
- Example: checkout action v4, setup-node action

**CONTEXT DATA:**
- User workflows show: Node.js development, VSCode, Terminal
- Tools: npm, git

**CORRECT RESPONSE:**
## GitHub Actions Workflow for Your Node.js Project

Based on the GitHub Actions documentation you provided and your Node.js development workflow, here's a CI pipeline:

### Generated Workflow (from URL documentation)

\`\`\`yaml
name: Node.js CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
\`\`\`

### Key Elements (from the documentation)

1. **Triggers**: Runs on push/PR to main (from docs: "push, pull_request" events)
2. **Runner**: Uses ubuntu-latest (most common, per docs)
3. **Actions**: Uses checkout@v4 and setup-node@v4 (current versions from docs)
4. **Caching**: Enabled npm caching for faster builds

### Applying to Your Workflow

Based on your captured development sessions using npm and git:
- Add this file to \`.github/workflows/ci.yml\`
- Commit and push — GitHub will automatically run on your next PR

### Sources
- GitHub Actions Workflow Syntax: [provided URL]

**WHY THIS RESPONSE IS CORRECT:**
✅ Primary content comes from the URL documentation
✅ Generates actual code (the requested output)
✅ Cites specific elements from the URL content
✅ Tailors to their workflow (Node.js, npm — from their data)
✅ Provides clear implementation steps

---

### EXAMPLE 2: URL Query — INCORRECT RESPONSE ✗

**SAME QUERY AND URL CONTENT AS ABOVE**

**INCORRECT RESPONSE:**
## GitHub Actions

GitHub Actions is a CI/CD platform that helps automate your workflow. Here's what I know about it:

### General Overview
- GitHub Actions can automate builds, tests, and deployments
- It's integrated into GitHub repositories
- You define workflows in YAML files

### Tips for CI/CD
- Always run tests before merging
- Use caching to speed up builds
- Consider using Docker for reproducibility
- Set up branch protection rules

### Learning Resources
- Check out the GitHub Actions documentation
- Watch YouTube tutorials on CI/CD
- Consider taking a course on DevOps

**WHAT IS WRONG:**
❌ Ignores the actual URL content provided
❌ Gives generic CI/CD overview instead of generating the requested workflow
❌ Doesn't create the YAML file they asked for
❌ "Check out the documentation" — they PROVIDED the documentation!
❌ No reference to their Node.js/npm workflow data
❌ Suggests generic learning resources instead of answering the question
`;

/**
 * Final Validation Checklist for Response Generation
 */
const RESPONSE_AGENT_VALIDATION_CHECKLIST = `
## OUTPUT VALIDATION CHECKLIST

Before returning your response, verify EACH item:

### Evidence Grounding:
□ Does EVERY claim cite specific data from the context?
□ Are session/workflow names and dates accurate (from input)?
□ Are all time estimates derived from actual durations in the data?
□ Have I avoided fabricating any metrics, tools, or behaviors?

### Actionability:
□ Are there at least 2 specific, numbered action items?
□ Does each action include the EXACT shortcut/command?
□ Are all recommended tools ones the user ACTUALLY uses?
□ Is there a clear implementation priority?

### Quantification:
□ Are time savings expressed in specific minutes/hours (not "some time")?
□ Do time estimates come from actual data or clearly state they're projections?
□ Is the projected impact reasonable (not > 100% of detected waste)?

### Appropriate Scope:
□ Did I answer what they ACTUALLY asked (not what I think they should ask)?
□ For EXPLORATION queries: Am I being descriptive, not prescriptive?
□ For OPTIMIZATION queries: Am I providing actionable improvements?
□ For URL queries: Is my response primarily based on the URL content?

### Privacy & Professionalism:
□ Did I avoid mentioning company names, job titles, or personal details?
□ Did I avoid psychoanalyzing their emotions or motivations?
□ Did I avoid organizational/team commentary?

### Structure:
□ Is there a direct answer in the first 1-2 sentences?
□ Are sections clearly organized with headers?
□ Is the response appropriately detailed (4+ paragraphs for optimization)?

### False Positive Check:
□ Did I avoid giving generic productivity advice not tied to their data?
□ Did I avoid recommending tools they don't use?
□ If data is limited, did I acknowledge this honestly?
`;

/**
 * Convert snake_case inefficiency types to human-readable format
 * e.g., 'manual_automation' -> 'Manual Automation'
 */
function formatInefficiencyType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Build rich, source-attributed context from all gathered data
 * Ported from orchestrator-graph.ts for consistent output quality
 */
function buildStructuredContext(state: AgenticState): string {
  const sections: string[] = [];

  // -------------------------------------------------------------------------
  // CONVERSATION MEMORY (HIGHEST PRIORITY for follow-ups)
  // -------------------------------------------------------------------------
  if (state.conversationMemory && state.conversationMemory.memories.length > 0) {
    sections.push(`PREVIOUS CONVERSATION CONTEXT:\n${state.conversationMemory.formattedContext}`);
  }

  // -------------------------------------------------------------------------
  // URL FETCHED CONTENT (HIGH PRIORITY - user explicitly provided these links)
  // -------------------------------------------------------------------------
  if (state.urlFetchedContent) {
    const urlList = state.userProvidedUrls?.length
      ? `URLs analyzed: ${state.userProvidedUrls.join(', ')}\n\n`
      : '';
    sections.push(`CONTENT FROM USER-PROVIDED URLs [Source: Web Fetch]:\n${urlList}${state.urlFetchedContent}`);
  }

  // -------------------------------------------------------------------------
  // USER-ATTACHED SESSIONS (user explicitly selected these)
  // -------------------------------------------------------------------------
  if (state.attachedSessionContext && state.attachedSessionContext.length > 0) {
    const attachedDetails = state.attachedSessionContext.map(session => {
      const workflowDetails = session.workflows.map(w => {
        const steps = w.semantic_steps
          .slice(0, 5)
          .map(s => `      - ${s.step_name}: ${s.description} (${Math.round(s.duration_seconds / 60)}m, tools: ${s.tools_involved.join(', ')})`)
          .join('\n');
        const duration = w.timestamps?.duration_ms
          ? `${Math.round(w.timestamps.duration_ms / 60000)}m`
          : 'unknown duration';
        return `    **${w.workflow_summary}** (${duration}):\n${steps}`;
      }).join('\n\n');

      return `**${session.title}** (${Math.round(session.totalDurationSeconds / 60)}m total, apps: ${session.appsUsed.join(', ')}):
${session.highLevelSummary ? `  Summary: ${session.highLevelSummary}\n` : ''}
  Workflows:
${workflowDetails}`;
    }).join('\n\n');

    sections.push(`USER-SELECTED SESSIONS FOR ANALYSIS (${state.attachedSessionContext.length} session${state.attachedSessionContext.length > 1 ? 's' : ''} — FOCUS ON THESE):\n${attachedDetails}`);
  }

  // -------------------------------------------------------------------------
  // USER PERSONA CONTEXT (internal - don't expose)
  // -------------------------------------------------------------------------
  if (state.activePersonaContext) {
    sections.push(`USER CONTEXT (internal only - do not mention in responses):\n${state.activePersonaContext}`);
  } else if (state.userPersonas && state.userPersonas.length > 0) {
    const personaSummary = state.userPersonas
      .map(p => `- ${p.displayName} (${p.type})`)
      .join('\n');
    sections.push(`USER'S ACTIVE ROLES (internal only - do not mention):\n${personaSummary}`);
  }

  // -------------------------------------------------------------------------
  // SESSION SUMMARIES from retrieval
  // -------------------------------------------------------------------------
  if (state.userEvidence?.sessions && state.userEvidence.sessions.length > 0) {
    const sessionSummaries = state.userEvidence.sessions
      .slice(0, 5)
      .map(s => {
        const summary = s.highLevelSummary || s.startActivity;
        const intent = s.intent ? ` | Intent: ${s.intent}` : '';
        const approach = s.approach ? ` | Approach: ${s.approach}` : '';
        return `- ${summary}${intent}${approach}`;
      })
      .join('\n');
    sections.push(`USER'S RECENT ACTIVITY SUMMARIES:\n${sessionSummaries}`);
  }

  // -------------------------------------------------------------------------
  // USER WORKFLOWS with step-level details
  // -------------------------------------------------------------------------
  if (state.userEvidence?.workflows && state.userEvidence.workflows.length > 0) {
    const workflowDetails = state.userEvidence.workflows
      .slice(0, 8)
      .map(w => {
        const tools = w.tools?.join(', ') || 'various tools';
        const title = w.title || 'Untitled workflow';
        const summary = w.summary && w.summary !== w.title ? `\n    Summary: ${w.summary}` : '';
        const intent = w.intent && w.intent !== 'Extracted from session' && w.intent !== w.summary
          ? `\n    Intent: ${w.intent}` : '';

        const stepDetails = w.steps?.slice(0, 5).map(s => {
          const duration = s.durationSeconds ? `${Math.round(s.durationSeconds / 60)}m` : '';
          const app = s.app || 'unknown';
          const stepTitle = `      - ${s.description} (${app}${duration ? `, ${duration}` : ''})`;
          const stepSummaryLine = s.stepSummary ? `\n        Summary: ${s.stepSummary}` : '';
          return `${stepTitle}${stepSummaryLine}`;
        }).join('\n') || '';

        const stepsSection = stepDetails ? `\n    Steps:\n${stepDetails}` : '';
        return `- **${title}** (using ${tools})${summary}${intent}${stepsSection}`;
      })
      .join('\n');
    sections.push(`USER'S RECENT WORKFLOWS (from captured sessions):\n${workflowDetails}`);
  }

  // =========================================================================
  // SOURCE-LABELED CONTEXT SECTIONS
  // =========================================================================

  // A2: Identified inefficiencies (PRIORITY)
  if (state.userDiagnostics?.inefficiencies && state.userDiagnostics.inefficiencies.length > 0) {
    const ineffSummary = state.userDiagnostics.inefficiencies
      .slice(0, MAX_RECOMMENDATIONS)
      .map(i => {
        const wastedTime = i.estimatedWastedSeconds ? ` (~${Math.round(i.estimatedWastedSeconds / 60)}min wasted)` : '';
        return `- **${formatInefficiencyType(i.type)}**: ${i.description}${wastedTime}`;
      })
      .join('\n');
    sections.push(`DETECTED INEFFICIENCIES [Source: Workflow Analysis]:\nThese patterns were identified in YOUR captured sessions:\n${ineffSummary}`);
  }

  // Repetitive patterns
  if (state.userEvidence?.repetitivePatterns && state.userEvidence.repetitivePatterns.length > 0) {
    const patternSummary = state.userEvidence.repetitivePatterns
      .slice(0, 5)
      .map(p => {
        const hours = Math.round(p.totalTimeSpentSeconds / 3600 * 10) / 10;
        const sequence = p.sequence.join(' → ');
        const frequency = p.occurrenceCount;
        return `- **"${sequence}"** - ${frequency} times (${hours}h total)\n  Optimization: ${p.optimizationOpportunity}`;
      })
      .join('\n');
    sections.push(`REPETITIVE PATTERNS [Source: Session Analysis]:\nThese recurring patterns represent automation opportunities:\n${patternSummary}`);
  }

  // A2: Opportunities
  if (state.userDiagnostics?.opportunities && state.userDiagnostics.opportunities.length > 0) {
    const oppSummary = state.userDiagnostics.opportunities
      .slice(0, MAX_RECOMMENDATIONS)
      .map(o => {
        const tool = o.suggestedTool ? ` → Use ${o.suggestedTool}` : '';
        const shortcut = o.shortcutCommand ? ` (${o.shortcutCommand})` : '';
        const feature = o.featureSuggestion ? ` - ${o.featureSuggestion}` : '';
        return `- **${o.type}**: ${o.description}${tool}${shortcut}${feature}`;
      })
      .join('\n');
    sections.push(`IMPROVEMENT OPPORTUNITIES [Source: Workflow Analysis]:\n${oppSummary}`);
  }

  // A2: EFFECTIVENESS ANALYSIS (Step-by-step quality critique)
  if (state.userDiagnostics?.effectivenessAnalysis) {
    const eff = state.userDiagnostics.effectivenessAnalysis;
    const effectivenessParts: string[] = [];

    // Overall summary
    effectivenessParts.push(`**Overall Effectiveness Score**: ${eff.overallEffectivenessScore}/100`);
    effectivenessParts.push(`**Summary**: ${eff.effectivenessSummary}`);

    // Top priorities
    if (eff.topPriorities && eff.topPriorities.length > 0) {
      effectivenessParts.push(`\n**Top Priorities for Improvement**:\n${eff.topPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    }

    // Step-by-step quality analysis
    if (eff.stepAnalysis && eff.stepAnalysis.length > 0) {
      const stepDetails = eff.stepAnalysis.slice(0, 5).map(s => {
        const rating = s.qualityRating.toUpperCase();
        return `- **[${s.stepId}]** ${s.whatUserDid}\n    Quality: ${rating}\n    Could improve: ${s.couldHaveDoneDifferently}\n    Why better: ${s.whyBetter}`;
      }).join('\n');
      effectivenessParts.push(`\n**Step-by-Step Quality Analysis**:\n${stepDetails}`);
    }

    // Missed activities
    if (eff.missedActivities && eff.missedActivities.length > 0) {
      const missedDetails = eff.missedActivities.map(m => {
        const impact = m.impactLevel.toUpperCase();
        return `- **${m.activity}** (Impact: ${impact})\n    When: After ${m.shouldOccurAfter}\n    Why important: ${m.whyImportant}\n    Recommendation: ${m.recommendation}`;
      }).join('\n');
      effectivenessParts.push(`\n**Activities You Missed**:\n${missedDetails}`);
    }

    // Content quality critiques
    if (eff.contentCritiques && eff.contentCritiques.length > 0) {
      const critiqueDetails = eff.contentCritiques.map(c => {
        const rating = c.rating.toUpperCase();
        return `- **${c.aspect}** (${rating}): ${c.observation}\n    Suggestion: ${c.improvementSuggestion}`;
      }).join('\n');
      effectivenessParts.push(`\n**Content Quality Observations**:\n${critiqueDetails}`);
    }

    sections.push(`EFFECTIVENESS ANALYSIS [Source: Quality Assessment]:\nThis evaluates the QUALITY and OUTCOMES of your work, not just efficiency:\n\n${effectivenessParts.join('\n')}`);
  }

  // A5: Feature Adoption Tips
  if (state.featureAdoptionTips && state.featureAdoptionTips.length > 0) {
    const tipsSummary = state.featureAdoptionTips
      .map(t => `- **${t.toolName} - ${t.featureName}** (${t.triggerOrShortcut}): ${t.message}`)
      .join('\n');
    sections.push(`TOOL FEATURE RECOMMENDATIONS [Source: Feature Adoption]:\nFeatures in tools you already use:\n${tipsSummary}`);
  }

  // A3: Peer comparison insights
  if (state.peerOptimizationPlan?.blocks && state.peerOptimizationPlan.blocks.length > 0) {
    const peerInsights = state.peerOptimizationPlan.blocks
      .map(b => {
        const savedTime = b.timeSaved ? ` (saves ~${Math.round(b.timeSaved / 60)}min)` : '';
        return `- ${b.whyThisMatters}${savedTime} (${Math.round(b.relativeImprovement)}% improvement)`;
      })
      .join('\n');
    sections.push(`PEER WORKFLOW INSIGHTS [Source: Similar Users]:\nHow others with similar workflows optimized:\n${peerInsights}`);
  }

  // A4-Company: Internal documentation
  if (state.companyOptimizationPlan?.blocks && state.companyOptimizationPlan.blocks.length > 0) {
    const companyInsights = state.companyOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => `${c.title}${c.pageNumber ? ` (p.${c.pageNumber})` : ''}`).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [Doc: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`INTERNAL DOCUMENTATION [Source: Company Docs]:\nRelevant practices from your organization:\n${companyInsights}`);
  }

  // A4-Web: External best practices
  if (state.webOptimizationPlan?.blocks && state.webOptimizationPlan.blocks.length > 0) {
    const webInsights = state.webOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => c.url || c.title).filter(Boolean).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [Source: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`EXTERNAL BEST PRACTICES [Source: Industry Knowledge]:\nSupplementary recommendations from web research:\n${webInsights}`);
  }

  // Fallback if no context
  if (sections.length === 0) {
    return 'No specific workflow context available. Provide general guidance based on the question.';
  }

  return sections.join('\n\n');
}

async function generateFinalResponse(
  state: AgenticState,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<InsightGenerationResult> {
  const intent = state.queryClassification?.intent || 'GENERAL';

  // =========================================================================
  // EARLY EXIT: Handle unknown tool for TOOL_INTEGRATION queries
  // =========================================================================
  // If web search didn't find info about the queried tool, return an honest
  // response instead of letting the LLM hallucinate.
  if (
    intent === 'TOOL_INTEGRATION' &&
    state.toolSearchRelevance === 'not_found' &&
    state.missingTools &&
    state.missingTools.length > 0
  ) {
    logger.info('generateFinalResponse: Returning honest response for unknown tool', {
      missingTools: state.missingTools,
      toolSearchRelevance: state.toolSearchRelevance,
    });

    const honestResponse = generateUnknownToolResponse(state.query, state.missingTools);
    // Set the userId from state
    honestResponse.userId = state.userId;
    return honestResponse;
  }

  // Build rich, source-attributed context using the ported function
  const aggregatedContext = buildStructuredContext(state);

  // Build session references for citations
  const sessionReferences = state.userEvidence?.sessions?.slice(0, 5).map((s, i) => {
    const summary = s.highLevelSummary || s.startActivity || 'Work Session';
    const date = s.startTime ? new Date(s.startTime).toLocaleDateString() : '';
    return `- Session ${i + 1}: "${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"${date ? ` (${date})` : ''}`;
  }).join('\n') || 'No sessions found';

  // Build persona-aware instructions
  const personaInstructions = state.userPersonas && state.userPersonas.length > 0
    ? `- Consider user's roles: ${state.userPersonas.map(p => p.displayName).join(', ')} (do not mention specific company/track names in response)`
    : '';

  // Build intent-specific instructions
  const intentInstructions = getIntentSpecificInstructions(intent, state.query);

  // Check if this is a follow-up question
  const isFollowUp = state.conversationMemory && state.conversationMemory.memories.length > 0;
  const followUpInstructions = isFollowUp
    ? `\n\nIMPORTANT: This appears to be a follow-up question. You have context from previous conversations with this user. Use that context to provide a more personalized and relevant answer.`
    : '';

  // Check if this is a URL-focused query (user provided URLs to analyze)
  const hasUrlContent = state.urlFetchedContent && state.userProvidedUrls && state.userProvidedUrls.length > 0;
  const urlInstructions = hasUrlContent
    ? `\n\nCRITICAL - URL CONTENT IS PRIMARY SOURCE: The user provided ${state.userProvidedUrls?.length} URL(s) to analyze. The content from these URLs (in the "CONTENT FROM USER-PROVIDED URLs" section) is your PRIMARY source of information. Your response MUST be based primarily on this URL content, NOT on generic workflow analysis. Use the actual information, examples, code snippets, and documentation from the fetched URL content.`
    : '';

  // =========================================================================
  // ENHANCED PROMPT WITH FACT DISAMBIGUATION & FEW-SHOT EXAMPLES
  // =========================================================================

  // Select appropriate few-shot examples based on query type
  const fewShotExamples = hasUrlContent
    ? RESPONSE_AGENT_URL_EXAMPLES
    : RESPONSE_AGENT_FEW_SHOT_EXAMPLES;

  // Build the structured user prompt
  const prompt = `${followUpInstructions}${urlInstructions}

---

## USER'S QUESTION

"${state.query}"

---

## QUERY CLASSIFICATION

**Intent**: ${intent} — ${getIntentDescription(intent)}
${personaInstructions ? `**User Context**: ${personaInstructions}` : ''}

---

## WORKFLOW DATA (Your Primary Evidence Source)

${aggregatedContext}

---

## USER'S SESSIONS (Reference these throughout)

${sessionReferences}

---

${fewShotExamples}

---

## INTENT-SPECIFIC INSTRUCTIONS

${intentInstructions}

---

${hasUrlContent ? `
## URL-FOCUSED RESPONSE REQUIREMENTS

The user provided ${state.userProvidedUrls?.length} URL(s) to analyze. Follow these requirements STRICTLY:

1. **PRIMARY SOURCE**: The URL content is your main source — use it extensively
2. **EXTRACT INFORMATION**: Pull actual examples, code, documentation from the URL content
3. **GENERATE OUTPUT**: If asked to create something, generate it based on the URL content
4. **CITE SOURCES**: Reference the URLs analyzed

### Required Structure for URL Queries:

## [Topic Based on URL Content]
[1-2 sentence direct answer using URL information]

### Key Information from the URL(s)
- Main concepts/features extracted from the URL
- Code examples or templates found
- Documentation or step-by-step instructions

### Applying to Your Workflow
[How the URL content applies to their specific workflow data]

### Generated Content (if requested)
\`\`\`[language]
[Actual generated code/config/template based on URL content]
\`\`\`

### Implementation Steps
1. [Step based on URL documentation]
2. [Next step]
3. [Additional steps]

### Sources
- [URL 1]: [What was extracted]
- [URL 2]: [What was extracted]

` : `
## STANDARD RESPONSE REQUIREMENTS

Follow these requirements STRICTLY for workflow analysis responses:

1. **DIRECT ANSWER FIRST**: Start with 1-2 sentences directly answering their question
2. **CITE SPECIFIC DATA**: Every claim must reference actual session/workflow data with names and dates
3. **QUANTIFY IMPACTS**: Use specific minutes/hours, not vague terms like "save time"
4. **EXACT SHORTCUTS**: Include complete keyboard shortcuts (e.g., \`Cmd+Shift+F\`, not "use search")
5. **THEIR TOOLS ONLY**: Only recommend features in tools they actually use
6. **SKIP EMPTY SECTIONS**: If no data exists for a section (peer insights, company docs), omit it entirely

### Required Structure for Workflow Queries:

## [Direct Answer Title]
[1-2 sentence direct answer citing specific data]

### Analysis from Your Workflow Data
[2-3 bullet points with SPECIFIC sessions/workflows referenced by name and date]
- **[Session Name]** ([Date]): [Specific finding with time/metrics]
- **Pattern across [N] sessions**: [Aggregated insight with quantification]

### What's Slowing You Down
[Only include if DETECTED INEFFICIENCIES exist in context]
- Describe each inefficiency with specific time impact
- Reference the workflow/session where it occurred

### Recommended Actions
[Numbered list with EXACT commands — only for tools they use]
1. **[Action]** — [Tool]: \`[Exact shortcut/command]\` — Saves ~[X]min
2. **[Action]** — [Tool]: \`[Exact shortcut/command]\` — Saves ~[X]min
3. **[Action]** — [Tool]: \`[Exact shortcut/command]\` — Saves ~[X]min

### Peer Insights (only if PEER WORKFLOW INSIGHTS exists)
[What similar users do differently, with time savings]

### Tool Features You're Missing (only if TOOL FEATURE RECOMMENDATIONS exists)
[Specific features with exact shortcuts/triggers]

### Implementation Priority
[Which action to take first and why, based on their data impact]

`}

---

${RESPONSE_AGENT_VALIDATION_CHECKLIST}

---

## FINAL INSTRUCTION

Generate your response now. Remember:
- Every claim must cite specific evidence from the workflow data above
- Use the response structure template provided
- Apply the validation checklist before finalizing
- If data is limited, acknowledge this honestly rather than fabricating
`;

  // Select appropriate system prompt based on intent
  // BLOG_CREATION uses the specialized blog generation prompt
  // PROGRESS_UPDATE uses the specialized progress update prompt
  // SKILL_FILE_GENERATION uses the specialized skill file prompt
  // All other intents use the standard response agent prompt
  let systemPrompt: string;
  if (intent === 'BLOG_CREATION') {
    systemPrompt = BLOG_GENERATION_SYSTEM_PROMPT;
  } else if (intent === 'PROGRESS_UPDATE') {
    systemPrompt = PROGRESS_UPDATE_SYSTEM_PROMPT;
  } else if (intent === 'SKILL_FILE_GENERATION') {
    systemPrompt = SKILL_FILE_GENERATION_SYSTEM_PROMPT;
  } else {
    systemPrompt = RESPONSE_AGENT_SYSTEM_PROMPT;
  }

  logger.info('Generating final response with enhanced prompt framework', {
    intent,
    contextLength: aggregatedContext.length,
    sessionCount: state.userEvidence?.sessions?.length || 0,
    hasInefficiencies: (state.userDiagnostics?.inefficiencies?.length || 0) > 0,
    hasPeerInsights: (state.peerOptimizationPlan?.blocks?.length || 0) > 0,
    hasFeatureTips: (state.featureAdoptionTips?.length || 0) > 0,
    hasUrlContent,
    promptFramework: 'fact-disambiguation-v1',
    usingBlogPrompt: intent === 'BLOG_CREATION',
    usingProgressUpdatePrompt: intent === 'PROGRESS_UPDATE',
    usingSkillFilePrompt: intent === 'SKILL_FILE_GENERATION',
  });

  const response = await llmProvider.generateText([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]);

  // Build executive summary
  const totalTimeSaved = [
    state.peerOptimizationPlan?.totalTimeSaved || 0,
    state.webOptimizationPlan?.totalTimeSaved || 0,
    state.companyOptimizationPlan?.totalTimeSaved || 0,
  ].reduce((a, b) => a + b, 0);

  const topInefficiencies = state.userDiagnostics?.inefficiencies
    ?.slice(0, 3)
    .map(i => i.description) || [];

  // Merge optimization plans if available
  const mergedBlocks = [
    ...(state.peerOptimizationPlan?.blocks || []),
    ...(state.webOptimizationPlan?.blocks || []),
    ...(state.companyOptimizationPlan?.blocks || []),
  ];

  return {
    queryId: uuidv4(),
    query: state.query,
    userId: state.userId,
    userQueryAnswer: response.content,
    executiveSummary: {
      totalTimeReduced: totalTimeSaved,
      totalRelativeImprovement: mergedBlocks.length > 0
        ? mergedBlocks.reduce((sum, b) => sum + b.relativeImprovement, 0) / mergedBlocks.length
        : 0,
      topInefficiencies,
      claudeCodeInsertionPoints: [],
      passesQualityThreshold: totalTimeSaved >= 60 || mergedBlocks.length > 0,
    },
    optimizationPlan: mergedBlocks.length > 0 ? {
      blocks: mergedBlocks,
      totalTimeSaved,
      totalRelativeImprovement: mergedBlocks.reduce((sum, b) => sum + b.relativeImprovement, 0) / mergedBlocks.length,
      passesThreshold: true,
    } : undefined,
    featureAdoptionTips: state.featureAdoptionTips || undefined,
    createdAt: state.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    suggestedFollowUps: await generateLLMFollowUpQuestions(state, response.content, mergedBlocks, llmProvider, logger),
  };
}

/**
 * Generate contextually relevant follow-up questions using LLM
 * Ported from orchestrator-graph.ts for consistent quality
 */
async function generateLLMFollowUpQuestions(
  state: AgenticState,
  userQueryAnswer: string,
  mergedBlocks: Array<{ whyThisMatters: string; timeSaved: number }>,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<string[]> {
  logger.info('Generating LLM follow-up questions');

  // Detect if this is a knowledge/technical question vs workflow analysis
  const hasWorkflowContext = mergedBlocks.length > 0 ||
    (state.userDiagnostics?.inefficiencies?.length ?? 0) > 0 ||
    (state.userDiagnostics?.opportunities?.length ?? 0) > 0;

  const queryLower = state.query.toLowerCase();
  const isKnowledgeQuery = !hasWorkflowContext && (
    queryLower.includes('what is') ||
    queryLower.includes('what are') ||
    queryLower.includes('how does') ||
    queryLower.includes('how do') ||
    queryLower.includes('alternatives') ||
    queryLower.includes('compare') ||
    queryLower.includes('difference between') ||
    queryLower.includes('explain') ||
    queryLower.includes('why')
  );

  // Build context from the analysis results
  const contextParts: string[] = [];
  contextParts.push(`Original Query: "${state.query}"`);

  if (mergedBlocks.length > 0) {
    contextParts.push('\nKey Optimizations Found:');
    mergedBlocks.slice(0, 3).forEach((block, i) => {
      contextParts.push(`${i + 1}. ${block.whyThisMatters} (saves ${Math.round(block.timeSaved / 60)} min)`);
    });
  }

  const inefficiencies = state.userDiagnostics?.inefficiencies ?? [];
  if (inefficiencies.length > 0) {
    contextParts.push('\nInefficiencies Detected:');
    inefficiencies.slice(0, 3).forEach((ineff, i) => {
      contextParts.push(`${i + 1}. ${ineff.type}: ${ineff.description}`);
    });
  }

  const tools = state.userEvidence?.sessions
    ?.flatMap((s: { appsUsed?: string[] }) => s.appsUsed || [])
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .slice(0, 5);
  if (tools && tools.length > 0) {
    contextParts.push(`\nTools User Works With: ${tools.join(', ')}`);
  }

  if (state.userPersonas && state.userPersonas.length > 0) {
    contextParts.push(`\nUser's Roles: ${state.userPersonas.map((p) => p.displayName).join(', ')}`);
  }

  const context = contextParts.join('\n');
  const answerSummary = userQueryAnswer.slice(0, 500).replace(/\n+/g, ' ').trim();

  const prompt = isKnowledgeQuery
    ? `Generate 3 follow-up questions for this Q&A:

Q: "${state.query}"
A: ${answerSummary}

Rules: Be specific to the answer content. Under 80 chars each. No generic questions.
Output ONLY a JSON array: ["Q1", "Q2", "Q3"]`
    : `Generate 3 follow-up questions for this workflow analysis:

User asked: "${state.query}"
Context: ${context.slice(0, 400)}
Answer: ${answerSummary}

Rules: Reference specific tools/workflows mentioned. Under 80 chars. Actionable.
Output ONLY a JSON array: ["Q1", "Q2", "Q3"]`;

  try {
    const response = await llmProvider.generateText([
      { role: 'system', content: 'Output ONLY a valid JSON array with exactly 3 short questions. No markdown, no explanation. Example: ["Question 1?", "Question 2?", "Question 3?"]' },
      { role: 'user', content: prompt }
    ], { temperature: 0.5, maxTokens: 400 });

    const responseText = response.content.trim();

    // Parse JSON array from response
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const completeArrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (completeArrayMatch) {
      try {
        const arr = JSON.parse(completeArrayMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) {
          const followUps = arr
            .filter((q): q is string => typeof q === 'string' && q.length >= 10)
            .map((q) => q.trim().replace(/\?+$/, '?'))
            .slice(0, 3);

          if (followUps.length > 0) {
            logger.info('LLM follow-up questions generated', { count: followUps.length });
            return followUps;
          }
        }
      } catch {
        logger.warn('Failed to parse follow-up JSON, using fallbacks');
      }
    }
  } catch (error) {
    logger.warn('Failed to generate LLM follow-up questions', { error: String(error) });
  }

  // Fallback to contextual defaults
  return generateFallbackFollowUps(state, hasWorkflowContext);
}

/**
 * Generate fallback follow-up questions based on context
 */
function generateFallbackFollowUps(state: AgenticState, hasWorkflowContext: boolean): string[] {
  const followUps: string[] = [];

  if (!hasWorkflowContext) {
    // Knowledge query fallbacks
    followUps.push('How can I apply this to my workflow?');
    followUps.push('What are common pitfalls to avoid?');
    followUps.push('Are there alternatives I should consider?');
  } else {
    // Workflow analysis fallbacks
    if (!state.userEvidence) {
      followUps.push('What did I work on yesterday?');
    }

    if (state.userDiagnostics?.inefficiencies?.length) {
      followUps.push('How can I reduce context switching?');
      followUps.push('What tools could help me automate repetitive tasks?');
    }

    if (!state.featureAdoptionTips?.length && state.userEvidence) {
      followUps.push('What features am I not using in my current tools?');
    }

    // Additional contextual fallbacks
    if (followUps.length < 3) {
      followUps.push('How do my workflows compare to peers?');
    }
  }

  return followUps.slice(0, 3);
}

// ============================================================================
// INTENT-SPECIFIC RESPONSE GENERATION (Enhanced with Anti-Hallucination Rules)
// ============================================================================

/**
 * Get intent-specific instructions for response generation
 * Each intent type has specific evidence requirements and anti-hallucination rules
 */
function getIntentSpecificInstructions(intent: string, _query: string): string {
  switch (intent) {
    case 'TOOL_INTEGRATION':
      return `**INTENT: TOOL INTEGRATION**
The user wants to use, integrate, or learn about a specific tool.

**REQUIRED APPROACH:**
1. Identify the specific tool(s) mentioned in their query
2. Check if the tool appears in their workflow data (THEIR TOOLS section)
3. If tool is in their data: Reference their actual usage patterns
4. If tool is new to them: Use web research content if available

**EVIDENCE REQUIREMENTS:**
- If suggesting integration: Cite their current tools to show compatibility
- If explaining features: Use exact shortcuts/commands, not vague descriptions
- If comparing tools: Only compare to tools they actually use

**ANTI-HALLUCINATION:**
❌ DO NOT invent integration steps without documentation
❌ DO NOT assume their technical setup (OS, versions, configs)
❌ DO NOT give generic productivity tips unrelated to the tool
✅ DO reference their actual workflow patterns when relevant
✅ DO provide exact commands/shortcuts when available
✅ DO acknowledge if you lack specific integration details`;

    case 'EXPLORATION':
      return `**INTENT: EXPLORATION**
The user wants to understand what they worked on (descriptive, not prescriptive).

**REQUIRED APPROACH:**
1. Summarize their actual activities from the session/workflow data
2. Present facts chronologically or by category
3. Include specific times, tools, and activities
4. Be DESCRIPTIVE, not PRESCRIPTIVE

**EVIDENCE REQUIREMENTS:**
- Every activity mentioned must come from their workflow data
- Include actual session names and dates
- Quantify time spent on each activity

**ANTI-HALLUCINATION:**
❌ DO NOT fabricate activities or times not in the data
❌ DO NOT add improvement suggestions unless explicitly asked
❌ DO NOT psychoanalyze their work patterns
✅ DO quote actual session/workflow names
✅ DO provide time breakdowns from their data
✅ DO group activities logically (by project, tool, or time)

**STRUCTURE:**
"On [Date], you worked on [Activity] for [Duration] using [Tools]..."`;

    case 'DIAGNOSTIC':
      return `**INTENT: DIAGNOSTIC**
The user wants to identify problems or inefficiencies in their workflow.

**REQUIRED APPROACH:**
1. Start with the DETECTED INEFFICIENCIES from context
2. For each inefficiency: cite the specific session/workflow where it occurred
3. Quantify the time impact with actual numbers
4. Prioritize by impact (highest time waste first)

**EVIDENCE REQUIREMENTS:**
- Every problem must trace to specific workflow data
- Time estimates must come from actual step durations
- Must cite session names, dates, or workflow descriptions

**ANTI-HALLUCINATION:**
❌ DO NOT invent problems not in the detected inefficiencies
❌ DO NOT overstate time impacts beyond what data shows
❌ DO NOT assume problems exist without evidence
✅ DO use exact quotes from inefficiency descriptions
✅ DO calculate time waste from actual step durations
✅ DO acknowledge if no significant issues were detected

**STRUCTURE:**
"Your [Session Name] workflow shows [Inefficiency Type]: [Description]. This cost approximately [X minutes] based on [Evidence]."`;

    case 'OPTIMIZATION':
      return `**INTENT: OPTIMIZATION**
The user wants actionable improvements to their workflow.

**REQUIRED APPROACH:**
1. Start with the highest-impact OPPORTUNITIES from context
2. For each recommendation: link it to a specific detected inefficiency
3. Provide exact shortcuts, commands, or steps
4. Estimate savings based on the inefficiency's wasted time

**EVIDENCE REQUIREMENTS:**
- Recommendations must address detected inefficiencies
- Savings estimates must be ≤ the inefficiency's estimated waste
- Tools suggested must be ones they already use (unless asking for new tools)

**ANTI-HALLUCINATION:**
❌ DO NOT recommend tools they don't use (check their TOOLS list)
❌ DO NOT invent keyboard shortcuts — only use verified ones
❌ DO NOT promise unrealistic time savings
✅ DO link each recommendation to a specific inefficiency
✅ DO provide exact shortcuts (e.g., \`Cmd+Shift+F\`, not "use search")
✅ DO prioritize by impact (biggest time savings first)

**STRUCTURE:**
"Based on your [Inefficiency], try [Action] using [Tool]: \`[Exact Shortcut]\`. Expected savings: ~[X]min (based on [Evidence])."`;

    case 'COMPARISON':
      return `**INTENT: COMPARISON**
The user wants to compare their workflow to peers or benchmarks.

**REQUIRED APPROACH:**
1. Use PEER WORKFLOW INSIGHTS if available in context
2. Compare specific metrics (time, efficiency score, patterns)
3. Highlight both strengths and improvement areas
4. Be objective and data-driven

**EVIDENCE REQUIREMENTS:**
- Peer data must come from the PEER WORKFLOW INSIGHTS section
- Comparisons must use actual metrics from both user and peer data
- Percentage improvements must be calculated, not invented

**ANTI-HALLUCINATION:**
❌ DO NOT fabricate peer statistics not in the data
❌ DO NOT invent industry benchmarks
❌ DO NOT make value judgments without data support
✅ DO cite peer insights with source attribution
✅ DO compare like-for-like metrics
✅ DO acknowledge if peer data is limited or unavailable

**IF NO PEER DATA:**
Acknowledge: "I don't have peer comparison data for your workflow. To provide comparisons, we'd need data from similar users."`;

    case 'FEATURE_DISCOVERY':
      return `**INTENT: FEATURE DISCOVERY**
The user wants to find underused features in their current tools.

**REQUIRED APPROACH:**
1. Use TOOL FEATURE RECOMMENDATIONS from context
2. Focus ONLY on tools they actually use (from their workflow data)
3. Provide exact triggers, shortcuts, or navigation paths
4. Explain how each feature addresses their specific patterns

**EVIDENCE REQUIREMENTS:**
- Features must be for tools in their workflow data
- Shortcuts must be real and verified
- Suggestions must connect to their actual usage patterns

**ANTI-HALLUCINATION:**
❌ DO NOT suggest features for tools they don't use
❌ DO NOT invent feature names or shortcuts
❌ DO NOT assume they're missing features without evidence
✅ DO use exact shortcuts from TOOL FEATURE RECOMMENDATIONS
✅ DO explain how the feature helps their specific workflow
✅ DO provide step-by-step activation instructions

**STRUCTURE:**
"In [Tool they use], try [Feature Name] (\`[Shortcut]\`): [What it does]. Based on your [Pattern], this could [Benefit]."`;

    case 'LEARNING':
      return `**INTENT: LEARNING**
The user wants to learn best practices or improve their skills.

**REQUIRED APPROACH:**
1. Use EXTERNAL BEST PRACTICES from context if available
2. Connect practices to their specific tools and workflows
3. Provide actionable steps, not just theory
4. Cite sources when available

**EVIDENCE REQUIREMENTS:**
- Best practices should come from web research or documentation
- Must explain how practices apply to their specific workflow
- Should include implementation steps

**ANTI-HALLUCINATION:**
❌ DO NOT fabricate studies or statistics
❌ DO NOT invent "industry standards" without source
❌ DO NOT give generic advice unconnected to their workflow
✅ DO cite sources from EXTERNAL BEST PRACTICES section
✅ DO connect recommendations to their actual tools
✅ DO provide specific implementation steps

**IF NO WEB RESEARCH DATA:**
Focus on their workflow data and acknowledge: "Based on your captured workflows, here are patterns that could be optimized..."`;

    case 'PATTERN':
      return `**INTENT: PATTERN ANALYSIS**
The user wants to understand recurring patterns in their work.

**REQUIRED APPROACH:**
1. Use REPETITIVE PATTERNS section if available
2. Describe patterns with frequency and time data
3. Identify both productive and problematic patterns
4. Suggest optimizations for recurring workflows

**EVIDENCE REQUIREMENTS:**
- Patterns must come from actual session data
- Frequency counts must be accurate
- Time estimates must be based on actual durations

**ANTI-HALLUCINATION:**
❌ DO NOT invent patterns not in the data
❌ DO NOT assume patterns without evidence
❌ DO NOT overinterpret isolated events as patterns
✅ DO cite occurrence counts and time spent
✅ DO reference specific sessions where patterns appeared
✅ DO distinguish between patterns and one-off events`;

    case 'TOOL_MASTERY':
      return `**INTENT: TOOL MASTERY**
The user wants to become more proficient with a specific tool.

**REQUIRED APPROACH:**
1. Identify the tool from their query and workflow data
2. Use TOOL FEATURE RECOMMENDATIONS for that specific tool
3. Provide progressive learning path (basic → advanced)
4. Include exact shortcuts and commands

**EVIDENCE REQUIREMENTS:**
- Tool must be one they're actually using
- Features must be real and verified
- Shortcuts must be accurate for the tool

**ANTI-HALLUCINATION:**
❌ DO NOT invent features or shortcuts
❌ DO NOT assume their proficiency level
❌ DO NOT recommend features for wrong tool versions
✅ DO use verified shortcuts from context
✅ DO reference their current usage patterns
✅ DO provide exact commands and navigation paths`;

    case 'BLOG_CREATION':
      return `**INTENT: BLOG CREATION**
The user wants to create a blog post or article based on their workflow data.
Use ALL user-selected sessions provided in context. The session count is stated in the "USER-SELECTED SESSIONS" header — cover every one of them.

**REQUIRED APPROACH:**
1. Analyze the workflow data as a documentary narrative
2. Identify all applications and tools used chronologically
3. Trace the user's journey through their work session
4. Extract key content, decisions, and outcomes
5. Note any AI tool usage and human-AI collaboration patterns
6. Generate an engaging, professional blog post

**OUTPUT STRUCTURE:**
- Engaging title based on workflow content
- Opening hook with session context (duration, date)
- Chronological narrative of the workflow
- Tool ecosystem analysis
- AI integration observations (if applicable)
- Key insights and takeaways
- Forward-looking conclusion

**ANTI-HALLUCINATION:**
❌ DO NOT invent activities not in the workflow data
❌ DO NOT fabricate timestamps or durations
❌ DO NOT assume user intent without evidence
❌ DO NOT create fictional quotes or content
✅ DO use actual session names, times, and tools
✅ DO quote visible content from workflow steps
✅ DO maintain journalistic accuracy while being engaging
✅ DO acknowledge when data is incomplete

**FILE GENERATION (MANDATORY):**
Generate ONLY ONE downloadable markdown file:
\`\`\`download:workflow-blog-YYYY-MM-DD.md
[Blog content only - engaging title, narrative, insights]
\`\`\``;

    case 'PROGRESS_UPDATE':
      return `**INTENT: PROGRESS UPDATE**
The user wants to create a weekly progress update report based on their workflow data.
Use ALL user-selected sessions provided in context. The session count is stated in the "USER-SELECTED SESSIONS" header — cover every one of them in the report.

**REQUIRED APPROACH:**
1. Write a flowing narrative analysis of the workflow data (NO step headers)
2. Identify all applications and tools used
3. Extract key activities with timestamps
4. Identify key themes and deliverables
5. Synthesize into a structured progress report covering ALL provided sessions

**CRITICAL FORMAT RULES:**
❌ DO NOT use "Step 1:", "Step 2:", "Step 3:" headers
❌ DO NOT write "My Step-by-Step Analysis Process" as a section
❌ DO NOT use numbered step format in the analysis
✅ DO write analysis as natural flowing paragraphs

**OUTPUT STRUCTURE:**
- Flowing narrative analysis (2-3 paragraphs, no headers)
- Summary section
- Key Accomplishments (numbered)
- Tools & Platforms Utilized (table)
- Collaboration & Communication
- AI Integration Observations (if applicable)
- Upcoming Priorities
- Workflow Insights (strengths, areas for improvement)
- Generate ONE downloadable .md file

**ANTI-HALLUCINATION:**
❌ DO NOT fabricate activities not in the workflow data
❌ DO NOT invent timestamps, durations, or outcomes
❌ DO NOT assume the user's intent without evidence
❌ DO NOT create fictional meetings, documents, or communications
❌ DO NOT make up tool features or integrations
✅ DO reference actual session data
✅ DO use specific timestamps when available
✅ DO quote visible content accurately
✅ DO acknowledge uncertainty appropriately
✅ DO distinguish between observed facts and inferences

**FILE GENERATION (MANDATORY):**
Generate ONLY ONE downloadable markdown file:
\`\`\`download:weekly-progress-YYYY-MM-DD.md
[Report content only - NOT the analysis narrative]
\`\`\``;

    case 'SKILL_FILE_GENERATION':
      return `**INTENT: SKILL FILE GENERATION**
The user wants to create a SKILL.md file that documents a repeatable workflow pattern from their session data.
Use ALL user-selected sessions provided in context. If specific sessions are tagged, focus on those. Otherwise, identify the most impactful or recurring workflow pattern across all sessions.

**REQUIRED APPROACH:**
1. Identify all applications, tools, and transitions in the workflow data
2. Trace the chronological workflow with timestamps
3. Identify the core repeatable workflow pattern (Research → Create → Refine → Share, etc.)
4. Abstract the specific session into a generalizable, topic-independent methodology
5. Write as a SKILL.md with YAML frontmatter, methodology steps, tool table, and quality checks

**CRITICAL FORMAT RULES:**
❌ DO NOT use "Step 1:", "Step 2:" headers in the analysis narrative
❌ DO NOT expose raw analysis steps — write flowing paragraphs
✅ DO write a 2-3 paragraph flowing analysis narrative before the file
✅ DO generalize from the specific session into a reusable pattern

**OUTPUT STRUCTURE:**
- Flowing narrative analysis (2-3 paragraphs)
- YAML frontmatter (name + description with trigger conditions)
- Title and overview
- Methodology (step-by-step, imperative voice)
- Tools & Integration Points (table)
- AI Integration (if applicable)
- Quality Checks (checklist)
- Example (from actual session data)

**ANTI-HALLUCINATION:**
❌ DO NOT fabricate workflow steps not observed in the data
❌ DO NOT invent tool features or integrations
❌ DO NOT assume the user's intent without evidence
❌ DO NOT add steps from general knowledge that weren't in the session
✅ DO ground every methodology step in observed session data
✅ DO reference actual tools and features used
✅ DO quote visible content accurately (slide titles, document names)
✅ DO distinguish between observed steps and inferred best practices

**FILE GENERATION (MANDATORY):**
Generate ONLY ONE downloadable markdown file:
\`\`\`download:SKILL-[descriptive-name].md
---
name: [skill-name]
description: [Description with trigger conditions]
---
[Full SKILL.md content]
\`\`\``;

    default:
      return `**INTENT: GENERAL**
This is a general query. Apply the standard evidence-grounded response approach.

**REQUIRED APPROACH:**
1. Directly answer what they specifically asked
2. Use workflow data as primary evidence
3. Avoid unsolicited advice or tangential topics
4. Be concise but thorough

**EVIDENCE REQUIREMENTS:**
- Ground claims in their workflow data when available
- Cite specific sessions, tools, or patterns
- Quantify impacts where data exists

**ANTI-HALLUCINATION:**
❌ DO NOT add productivity tips they didn't ask for
❌ DO NOT assume their problems or needs
❌ DO NOT fabricate data or metrics
✅ DO stay focused on their specific question
✅ DO use their actual data for context
✅ DO acknowledge limitations in available data`;
  }
}

/**
 * Get human-readable description of query intent
 */
function getIntentDescription(intent: string): string {
  const descriptions: Record<string, string> = {
    TOOL_INTEGRATION: 'User wants to integrate, use, or learn about a specific tool',
    EXPLORATION: 'User wants to see what they worked on',
    DIAGNOSTIC: 'User wants to identify problems or inefficiencies',
    OPTIMIZATION: 'User wants actionable improvements',
    COMPARISON: 'User wants to compare with peers',
    FEATURE_DISCOVERY: 'User wants to discover underused features',
    TOOL_MASTERY: 'User wants to master a specific tool',
    LEARNING: 'User wants to learn best practices',
    PATTERN: 'User wants to understand their patterns',
    BLOG_CREATION: 'User wants to create a blog post from their workflow',
    PROGRESS_UPDATE: 'User wants to create a weekly progress update report from their workflow',
    SKILL_FILE_GENERATION: 'User wants to create a SKILL.md file documenting a repeatable workflow pattern',
    GENERAL: 'General productivity query',
  };
  return descriptions[intent] || 'General query';
}

// ============================================================================
// GRAPH CREATION
// ============================================================================

/**
 * Create the agentic loop graph
 */
export function createAgenticLoopGraph(deps: AgenticLoopDeps) {
  const { logger } = deps;

  logger.info('AgenticLoop: Creating graph');

  // Wrap nodes to persist progress to DB for frontend polling
  const withProgressWrite = (nodeFn: (state: AgenticState) => Promise<Partial<AgenticState>>) => {
    return async (state: AgenticState): Promise<Partial<AgenticState>> => {
      const update = await nodeFn(state);
      if (deps.onProgressUpdate && (update.progress !== undefined || update.currentStage)) {
        const progress = update.progress ?? state.progress;
        const stage = update.currentStage || state.currentStage;
        await deps.onProgressUpdate(progress, stage).catch(() => {});
      }
      return update;
    };
  };

  const graph = new StateGraph(AgenticStateAnnotation)
    // Add nodes (wrapped to persist progress to DB)
    .addNode('guardrail', withProgressWrite((state) => guardrailNode(state, { logger, llmProvider: deps.llmProvider })))
    .addNode('reason', withProgressWrite((state) => reasoningNode(state, { logger, llmProvider: deps.llmProvider })))
    .addNode('act', withProgressWrite((state) => actionNode(state, deps)))
    .addNode('terminate', withProgressWrite((state) => terminateNode(state, deps)))

    // Add edges
    .addEdge('__start__', 'guardrail')
    .addConditionalEdges('guardrail', routeAfterGuardrail, {
      reason: 'reason',
      terminate: 'terminate',
    })
    .addConditionalEdges('reason', routeAfterReasoning, {
      act: 'act',
      terminate: 'terminate',
    })
    .addConditionalEdges('act', routeAfterAction, {
      reason: 'reason',
      terminate: 'terminate',
    })
    .addEdge('terminate', END);

  return graph.compile();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { createInitialAgenticState, buildExecutionSummary };
