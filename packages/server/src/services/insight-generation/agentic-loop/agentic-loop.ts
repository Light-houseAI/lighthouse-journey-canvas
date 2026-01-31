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
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository.js';
import type { EmbeddingService } from '../../interfaces/index.js';
import type { MemoryService } from '../memory.service.js';
import type { PersonaService } from '../../persona.service.js';
import type { NoiseFilterService } from '../filters/noise-filter.service.js';
import type { InsightModelConfiguration, AgenticActionResult, InsightGenerationResult, SkillId } from '../types.js';
import type { SkillDependencies } from '../skills/skill-types.js';

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
  companyDocsEnabled: boolean;
  perplexityApiKey?: string;
  modelConfig?: Partial<InsightModelConfiguration>;
  agenticConfig?: Partial<AgenticLoopConfig>;
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
    companyDocsEnabled: deps.companyDocsEnabled,
    perplexityApiKey: deps.perplexityApiKey,
    modelConfig: deps.modelConfig,
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

    return {
      ...result.stateUpdates,
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
  const { logger, llmProvider } = deps;

  logger.info('Terminate: Generating final response', {
    reason: state.terminationReason || 'normal completion',
    skillsUsed: state.usedSkills,
    iterations: state.currentIteration,
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

  // Generate response from gathered data
  try {
    const response = await generateFinalResponse(state, llmProvider, logger);

    return {
      finalResult: response,
      userQueryAnswer: response.userQueryAnswer,
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

    sections.push(`USER-SELECTED SESSIONS FOR ANALYSIS (FOCUS ON THESE):\n${attachedDetails}`);
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
  // RICH STRUCTURED PROMPT TEMPLATE (ported from orchestrator-graph)
  // =========================================================================
  const prompt = `You are a helpful workflow assistant. Answer the user's question clearly and actionably.${followUpInstructions}${urlInstructions}

USER'S QUESTION: "${state.query}"

QUERY INTENT: ${intent} - ${getIntentDescription(intent)}

CONTEXT FROM YOUR WORKFLOW ANALYSIS:
${aggregatedContext}

${hasUrlContent ? `
RESPONSE FORMAT REQUIREMENTS (URL-FOCUSED QUERY):
1. **Use content from the URLs as your PRIMARY source** - The user explicitly provided URLs to analyze
2. **Extract and present information FROM THE URL CONTENT** - Include actual examples, code, templates, documentation from the fetched content
3. **Create actionable output based on URL content** - If they asked to "create" something, generate it based on the URL content
4. **Reference the source URLs** - Cite the URLs you analyzed
${personaInstructions}

STRUCTURE YOUR RESPONSE (URL-FOCUSED):

## [Topic Based on URL Content]

[Direct answer using information from the URL content]

### Key Information from the URL(s)
Extract and present the most important information from the fetched URL content:
- Main concepts/features
- Examples or templates found
- Documentation or instructions

### Applying This to Your Workflow
Based on your workflow analysis AND the URL content:
- How this information applies to your specific situation
- Personalized recommendations using both sources

### Generated Content/Implementation
If the user asked to "create" or "generate" something:
- Provide the actual generated content (code, config, template, etc.)
- Base it DIRECTLY on the URL content examples
- Tailor it to the user's workflow where applicable

### Step-by-Step Guide
1. [First step based on URL documentation]
2. [Second step]
3. [Additional steps]

### Sources
- List the URLs analyzed

USER'S WORKFLOW CONTEXT (for personalization):
${sessionReferences}

CRITICAL REQUIREMENTS:
1. **PRIORITIZE URL CONTENT**: Your primary source is the fetched URL content - use it extensively
2. **BE SPECIFIC**: Include actual code examples, templates, or configurations from the URL
3. **GENERATE REQUESTED CONTENT**: If asked to create/generate something, provide the actual output
4. **CITE SOURCES**: Reference the URLs and specific sections you used

FORMATTING:
- Use code blocks for code examples (with language specifier)
- Bold important terms using **bold**
- Use bullet points and numbered lists for clarity` : `
RESPONSE FORMAT REQUIREMENTS:
1. **Start with a direct answer** - One sentence that directly answers their question
2. **Use bullet points** - Structure all explanations as bullet lists for clarity
3. **Step-by-step when applicable** - If explaining how to do something, use numbered steps
4. **Reference user's sessions** - When relevant, cite their own workflow patterns like "Based on your session where you were [activity]..."
${personaInstructions}

STRUCTURE YOUR RESPONSE (be thorough and detailed):

## [Brief Topic/Answer Title]

[1-2 sentence direct answer]

### What's Slowing You Down (from your workflow analysis)
Start with the DETECTED INEFFICIENCIES from your context. For each inefficiency:
- Describe the specific pattern (e.g., "You spent ~X minutes on manual monitoring")
- Reference the workflow or session where this occurred
- Quantify the time impact when available

### How to Improve

**Peer Insights** - From users with similar workflows:
[Use insights from PEER WORKFLOW INSIGHTS section - explain what others do differently and time savings]

**Tool Features You're Missing** - Shortcuts and features in tools you already use:
[Use TOOL FEATURE RECOMMENDATIONS - include specific shortcuts like "Use Cmd+Option+J in Chrome"]

**From Your Company Docs:**
[Use INTERNAL DOCUMENTATION section if available - cite specific documents]

**Industry Best Practices:**
[Use EXTERNAL BEST PRACTICES section - include source URLs if available]

### Step-by-Step Implementation
Provide 3-5 numbered, actionable steps with specific commands/shortcuts:
1. [Most impactful action with exact command]
2. [Second action]
3. [Third action]

### Next Steps
- 2-3 immediate actions they can take today

USER'S SESSIONS (reference these throughout):
${sessionReferences}

INTENT-SPECIFIC INSTRUCTIONS:
${intentInstructions}

CRITICAL REQUIREMENTS:
1. **BE DETAILED**: Write 4-6 paragraphs minimum. Don't be brief - users want thorough analysis.
2. **QUANTIFY EVERYTHING**: Include time estimates (minutes saved, % improvement)
3. **SPECIFIC SHORTCUTS**: Always include exact keyboard shortcuts (e.g., "Cmd+Shift+C")
4. **REFERENCE THEIR DATA**: Quote their actual workflows, tools, and sessions from the context
5. **INCLUDE ALL SOURCE SECTIONS**: If a context section has data (PEER INSIGHTS, TOOL FEATURES, etc.), include that section in your response
6. **SKIP EMPTY SECTIONS**: If a section has no data (e.g., no peer insights), omit that subsection entirely

PRIVACY: Do NOT mention company name, job title, or role. Use "your work" or "your projects" instead.

FORMATTING:
- Do NOT use code blocks or backticks for regular text
- Bold important terms using **bold**
- Use bullet points and numbered lists for clarity`}`;

  logger.info('Generating final response with rich template', {
    intent,
    contextLength: aggregatedContext.length,
    sessionCount: state.userEvidence?.sessions?.length || 0,
    hasInefficiencies: (state.userDiagnostics?.inefficiencies?.length || 0) > 0,
    hasPeerInsights: (state.peerOptimizationPlan?.blocks?.length || 0) > 0,
    hasFeatureTips: (state.featureAdoptionTips?.length || 0) > 0,
  });

  const response = await llmProvider.generateText([
    { role: 'system', content: 'You are a helpful workflow optimization assistant that provides detailed, actionable, and personalized advice based on user workflow data.' },
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
// INTENT-SPECIFIC RESPONSE GENERATION
// ============================================================================

/**
 * Get intent-specific instructions for response generation
 */
function getIntentSpecificInstructions(intent: string, query: string): string {
  switch (intent) {
    case 'TOOL_INTEGRATION':
      return `This is a TOOL INTEGRATION query. The user wants to know how to use, add, or integrate a tool.
- Focus your response on the specific tool(s) mentioned in their query
- Explain what the tool does and how it can help their workflow
- Provide step-by-step integration guidance if available from web research
- If the tool is unfamiliar, explain its purpose based on web results
- Reference their current tools to show how the new tool fits in
- DO NOT give generic productivity advice or context switching tips`;

    case 'EXPLORATION':
      return `This is an EXPLORATION query. The user wants to understand what they worked on.
- Summarize their actual activities from the workflow data
- Highlight key tasks, tools used, and time spent
- Be descriptive about their work, not prescriptive about improvements
- Only mention improvements if explicitly asked`;

    case 'DIAGNOSTIC':
      return `This is a DIAGNOSTIC query. The user wants to identify problems.
- Focus on the specific inefficiencies found in their workflow
- Cite concrete examples from their workflow data
- Quantify issues where possible (time lost, frequency, etc.)
- Only include the most impactful issues (top 2-3)`;

    case 'OPTIMIZATION':
      return `This is an OPTIMIZATION query. The user wants actionable improvements.
- Provide specific, actionable recommendations
- Prioritize the highest-impact improvements
- Include concrete steps they can take
- Reference their specific tools and workflows`;

    case 'COMPARISON':
      return `This is a COMPARISON query. The user wants to know how they compare.
- Focus on peer comparison data if available
- Highlight areas where they excel and areas for improvement
- Be objective and data-driven`;

    case 'FEATURE_DISCOVERY':
      return `This is a FEATURE DISCOVERY query. The user wants to find underused features.
- Focus on features in tools they already use
- Explain how each feature could help them
- Provide shortcuts or triggers to access the features`;

    case 'LEARNING':
      return `This is a LEARNING query. The user wants best practices.
- Share industry best practices from web research
- Explain how these practices apply to their specific workflow
- Provide actionable guidance`;

    default:
      return `Provide a balanced, helpful response that directly addresses their question.
- Focus on what they specifically asked about
- Include relevant data from their workflow analysis
- Avoid generic advice that doesn't relate to their question`;
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

  const graph = new StateGraph(AgenticStateAnnotation)
    // Add nodes
    .addNode('guardrail', (state) => guardrailNode(state, { logger, llmProvider: deps.llmProvider }))
    .addNode('reason', (state) => reasoningNode(state, { logger, llmProvider: deps.llmProvider }))
    .addNode('act', (state) => actionNode(state, deps))
    .addNode('terminate', (state) => terminateNode(state, deps))

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
