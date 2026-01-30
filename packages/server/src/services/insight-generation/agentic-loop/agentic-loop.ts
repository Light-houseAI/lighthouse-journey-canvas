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
const MAX_RECOMMENDATIONS = 3;

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

async function generateFinalResponse(
  state: AgenticState,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<InsightGenerationResult> {
  const intent = state.queryClassification?.intent || 'GENERAL';

  // Build context from gathered data - FILTERED by intent and confidence
  const contextParts: string[] = [];

  if (state.conversationMemory?.formattedContext) {
    contextParts.push(`## Previous Conversation Context\n${state.conversationMemory.formattedContext}`);
  }

  // For TOOL_INTEGRATION queries, prioritize web search results
  if (intent === 'TOOL_INTEGRATION' && state.webOptimizationPlan) {
    contextParts.push(`## Web Research Results (PRIMARY)`);
    const webBlocks = (state.webOptimizationPlan.blocks || [])
      .filter(b => (b.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, MAX_RECOMMENDATIONS);
    if (webBlocks.length > 0) {
      const webInfo = webBlocks
        .map(b => `  - ${b.title}: ${b.transformationPlan?.slice(0, 200) || b.title}`)
        .join('\n');
      contextParts.push(webInfo);
    }
    // For integration queries, user evidence is secondary context
    if (state.userEvidence) {
      contextParts.push(`## Your Current Workflow Context`);
      contextParts.push(`- Tools you currently use: ${[...new Set(state.userEvidence.workflows.flatMap(w => w.tools))].join(', ')}`);
    }
  } else {
    // Standard workflow analysis context
    if (state.userEvidence) {
      contextParts.push(`## User Workflows\n- ${state.userEvidence.workflows.length} workflows analyzed`);
      contextParts.push(`- ${state.userEvidence.totalStepCount} total steps`);
      contextParts.push(`- Tools used: ${[...new Set(state.userEvidence.workflows.flatMap(w => w.tools))].join(', ')}`);
    }

    // Only include diagnostics if relevant to intent (not for EXPLORATION/TOOL_INTEGRATION)
    if (state.userDiagnostics && ['DIAGNOSTIC', 'OPTIMIZATION', 'COMPARISON', 'PATTERN', 'GENERAL'].includes(intent)) {
      contextParts.push(`## Analysis Results`);
      contextParts.push(`- Efficiency score: ${state.userDiagnostics.overallEfficiencyScore}/100`);

      // Filter inefficiencies by confidence and limit to top recommendations
      const highConfidenceInefficiencies = (state.userDiagnostics.inefficiencies || [])
        .filter(i => (i.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, MAX_RECOMMENDATIONS);

      contextParts.push(`- Inefficiencies found: ${highConfidenceInefficiencies.length} (high confidence)`);

      // Filter opportunities by confidence
      const highConfidenceOpportunities = (state.userDiagnostics.opportunities || [])
        .filter(o => (o.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, MAX_RECOMMENDATIONS);

      contextParts.push(`- Opportunities identified: ${highConfidenceOpportunities.length} (high confidence)`);

      if (highConfidenceInefficiencies.length > 0) {
        const topInefficiencies = highConfidenceInefficiencies
          .map(i => `  - ${formatInefficiencyType(i.type)}: ${i.description} (${Math.round((i.confidence || 0) * 100)}% confidence)`)
          .join('\n');
        contextParts.push(`\nTop inefficiencies:\n${topInefficiencies}`);
      }
    }
  }

  // Feature tips - filter by confidence and limit
  if (state.featureAdoptionTips?.length) {
    const highConfidenceTips = state.featureAdoptionTips
      .filter(t => (t.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, MAX_RECOMMENDATIONS);

    if (highConfidenceTips.length > 0) {
      const tips = highConfidenceTips
        .map(t => `  - ${t.toolName}: ${t.featureName} - ${t.message}`)
        .join('\n');
      contextParts.push(`## Feature Suggestions\n${tips}`);
    }
  }

  // Build intent-specific instructions
  const intentInstructions = getIntentSpecificInstructions(intent, state.query);

  // Generate response using LLM
  const prompt = `You are a productivity assistant. Based on the following analysis, provide a helpful and actionable response to their query.

## User Query
"${state.query}"

## Query Intent
${intent} - ${getIntentDescription(intent)}

${contextParts.join('\n\n')}

## CRITICAL Instructions
${intentInstructions}

## General Guidelines
- DIRECTLY answer the user's question - do not provide unrelated advice
- If the user asks about a specific tool/integration, focus on THAT tool
- Reference specific data from the context when applicable
- Keep the response focused and on-topic
- Do NOT mention context switching, multitasking, or general efficiency tips unless the user specifically asked about them

## Formatting Guidelines
- Do NOT use code blocks or backticks for regular text
- Write in plain, conversational language
- Use bullet points or numbered lists for clarity when needed
- Bold important terms using **bold** if emphasis is needed`;

  const response = await llmProvider.generateText([
    { role: 'system', content: 'You are a helpful productivity assistant that provides concise, actionable advice.' },
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
    suggestedFollowUps: generateFollowUpQuestions(state),
  };
}

function generateFollowUpQuestions(state: AgenticState): string[] {
  const followUps: string[] = [];

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
