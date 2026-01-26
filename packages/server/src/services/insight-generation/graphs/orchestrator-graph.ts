/**
 * Insight Generation Orchestrator Graph
 *
 * Main LangGraph StateGraph that coordinates all agents:
 * 1. A1 Retrieval Agent → Evidence bundles
 * 2. A2 Judge Agent → Diagnostics
 * 3. Routing decision → Which downstream agents to run
 * 4. A3 Comparator, A4-Web, A4-Company (parallel or sequential)
 * 5. Merge results and apply quality thresholds
 *
 * Model Configuration:
 * - A1, A3, A4-Web, A4-Company: Gemini 2.5 Flash (fast, cost-effective)
 * - A2 Judge: GPT-4 (high quality for LLM-as-judge evaluation)
 *
 * Routing Logic:
 * - Run A3 if peer efficiency > user efficiency
 * - Run A4-Web if user has improvement opportunities
 * - Run A4-Company if company docs available
 * - Fallback to A4-Web + A4-Company if no peer data
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository.js';
import type { EmbeddingService } from '../../interfaces/index.js';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import { createRetrievalGraph, type RetrievalGraphDeps } from './retrieval-graph.js';
import { createJudgeGraph, type JudgeGraphDeps } from './judge-graph.js';
import { createComparatorGraph, type ComparatorGraphDeps } from './comparator-graph.js';
import { createWebBestPracticesGraph, type WebBestPracticesGraphDeps } from './web-best-practices-graph.js';
import { createCompanyDocsGraph, type CompanyDocsGraphDeps } from './company-docs-graph.js';
import {
  createAgentLLMProvider,
  getModelConfigDescription,
} from '../utils/model-provider-factory.js';
import type {
  RoutingDecision,
  AgentId,
  StepOptimizationPlan,
  InsightGenerationResult,
  ExecutiveSummary,
  FinalWorkflowStep,
  ComparisonTableEntry,
  SupportingEvidence,
  InsightGenerationMetadata,
  InsightModelConfiguration,
  QUALITY_THRESHOLDS,
} from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface OrchestratorGraphDeps {
  logger: Logger;
  /** Default LLM provider (fallback) */
  llmProvider: LLMProvider;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
  embeddingService: EmbeddingService;
  companyDocsEnabled: boolean;
  perplexityApiKey?: string;
  /** Custom model configuration for agents */
  modelConfig?: Partial<InsightModelConfiguration>;
  // Note: Company docs are now retrieved via nlqService.searchCompanyDocuments()
}

// Quality thresholds from types
const THRESHOLDS = {
  ABSOLUTE_SAVINGS_SECONDS: 600, // 10 minutes
  RELATIVE_SAVINGS_PERCENT: 40, // 40%
  MIN_ABSOLUTE_SECONDS: 120, // 2 minutes
  MIN_RELATIVE_PERCENT: 10, // 10%
  MIN_CONFIDENCE: 0.6,
};

// ============================================================================
// SUB-GRAPH EXECUTION
// ============================================================================

/**
 * Node: Execute A1 Retrieval Agent (as subgraph)
 * Uses Gemini 2.5 Flash by default
 */
async function executeRetrievalAgent(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, nlqService, platformWorkflowRepository, sessionMappingRepository, embeddingService, llmProvider, modelConfig } = deps;

  // Get agent-specific LLM provider (Gemini 2.5 Flash by default)
  let a1LLMProvider: LLMProvider;
  try {
    a1LLMProvider = createAgentLLMProvider('A1_RETRIEVAL', modelConfig);
    logger.info('Orchestrator: Using agent-specific model for A1', {
      config: getModelConfigDescription(modelConfig)['A1_RETRIEVAL'],
    });
  } catch (error) {
    logger.warn('Orchestrator: Failed to create A1-specific provider, using default', { error });
    a1LLMProvider = llmProvider;
  }

  logger.info('Orchestrator: Starting A1 Retrieval Agent', {
    userId: state.userId,
    query: state.query,
  });

  const retrievalDeps: RetrievalGraphDeps = {
    logger,
    nlqService,
    platformWorkflowRepository,
    sessionMappingRepository,
    embeddingService,
    llmProvider: a1LLMProvider,
  };

  try {
    const retrievalGraph = createRetrievalGraph(retrievalDeps);
    const result = await retrievalGraph.invoke(state);

    logger.info('Orchestrator: A1 complete', {
      hasUserEvidence: !!result.userEvidence,
      hasPeerEvidence: !!result.peerEvidence,
      critiquePassed: result.a1CritiqueResult?.passed,
    });

    return {
      userEvidence: result.userEvidence,
      peerEvidence: result.peerEvidence,
      a1CritiqueResult: result.a1CritiqueResult,
      a1RetryCount: result.a1RetryCount,
      currentStage: 'orchestrator_a1_complete',
      progress: 30,
    };
  } catch (error) {
    logger.error('Orchestrator: A1 failed', error instanceof Error ? error : new Error(String(error)));
    return {
      errors: [`A1 execution failed: ${error}`],
      currentStage: 'orchestrator_a1_failed',
    };
  }
}

/**
 * Node: Execute A2 Judge Agent (as subgraph)
 * Uses GPT-4 by default for high-quality LLM-as-judge evaluation
 */
async function executeJudgeAgent(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider, modelConfig } = deps;

  // Get agent-specific LLM provider (GPT-4 by default for LLM-as-judge)
  let a2LLMProvider: LLMProvider;
  try {
    a2LLMProvider = createAgentLLMProvider('A2_JUDGE', modelConfig);
    logger.info('Orchestrator: Using agent-specific model for A2 Judge', {
      config: getModelConfigDescription(modelConfig)['A2_JUDGE'],
    });
  } catch (error) {
    logger.warn('Orchestrator: Failed to create A2-specific provider, using default', { error });
    a2LLMProvider = llmProvider;
  }

  logger.info('Orchestrator: Starting A2 Judge Agent');

  const judgeDeps: JudgeGraphDeps = {
    logger,
    llmProvider: a2LLMProvider,
  };

  try {
    const judgeGraph = createJudgeGraph(judgeDeps);
    const result = await judgeGraph.invoke(state);

    logger.info('Orchestrator: A2 complete', {
      hasUserDiagnostics: !!result.userDiagnostics,
      hasPeerDiagnostics: !!result.peerDiagnostics,
      userEfficiency: result.userDiagnostics?.overallEfficiencyScore,
      peerEfficiency: result.peerDiagnostics?.overallEfficiencyScore,
      critiquePassed: result.a2CritiqueResult?.passed,
    });

    return {
      userDiagnostics: result.userDiagnostics,
      peerDiagnostics: result.peerDiagnostics,
      a2CritiqueResult: result.a2CritiqueResult,
      a2RetryCount: result.a2RetryCount,
      currentStage: 'orchestrator_a2_complete',
      progress: 55,
    };
  } catch (error) {
    logger.error('Orchestrator: A2 failed', error instanceof Error ? error : new Error(String(error)));
    return {
      errors: [`A2 execution failed: ${error}`],
      currentStage: 'orchestrator_a2_failed',
    };
  }
}

/**
 * Node: Make routing decision for downstream agents
 */
async function makeRoutingDecision(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, companyDocsEnabled, perplexityApiKey } = deps;

  logger.info('Orchestrator: Making routing decision');

  const agentsToRun: AgentId[] = [];
  const reasons: string[] = [];

  const userEfficiency = state.userDiagnostics?.overallEfficiencyScore ?? 50;
  const peerEfficiency = state.peerDiagnostics?.overallEfficiencyScore ?? null;
  const hasOpportunities = (state.userDiagnostics?.opportunities.length ?? 0) > 0;
  const hasPeerData = !!state.peerEvidence && state.peerEvidence.workflows.length > 0;

  // Decision logic based on plan
  if (hasPeerData && peerEfficiency !== null && peerEfficiency > userEfficiency) {
    // Peer is more efficient - run A3 Comparator
    agentsToRun.push('A3_COMPARATOR');
    reasons.push(`Peer efficiency (${peerEfficiency}) > User efficiency (${userEfficiency})`);
  }

  if (hasOpportunities && perplexityApiKey) {
    // User has opportunities - run A4-Web for best practices
    agentsToRun.push('A4_WEB');
    reasons.push(`User has ${state.userDiagnostics?.opportunities.length} improvement opportunities`);
  }

  if (companyDocsEnabled && hasOpportunities) {
    // Company docs available - run A4-Company
    agentsToRun.push('A4_COMPANY');
    reasons.push('Company docs enabled for internal guidance');
  }

  // Fallback: If no peer data, rely on A4-Web and A4-Company
  if (!hasPeerData) {
    if (perplexityApiKey && !agentsToRun.includes('A4_WEB')) {
      agentsToRun.push('A4_WEB');
      reasons.push('No peer data - using web best practices as primary source');
    }
    if (companyDocsEnabled && !agentsToRun.includes('A4_COMPANY')) {
      agentsToRun.push('A4_COMPANY');
      reasons.push('No peer data - using company docs as secondary source');
    }
  }

  // If no agents selected and we have opportunities, at least try heuristics
  if (agentsToRun.length === 0 && hasOpportunities) {
    // Will use heuristic-based optimization in merge step
    reasons.push('Using heuristic optimization (no external data sources)');
  }

  const routingDecision: RoutingDecision = {
    agentsToRun,
    reason: reasons.join('; '),
    peerDataUsable: hasPeerData,
    companyDocsAvailable: companyDocsEnabled,
  };

  logger.info('Orchestrator: Routing decision made', {
    agentsToRun,
    reasons,
  });

  // Log detailed output for debugging
  logger.info('=== ORCHESTRATOR OUTPUT (Routing Decision) ===');
  logger.info(JSON.stringify({
    agent: 'ORCHESTRATOR',
    outputType: 'routingDecision',
    routing: {
      agentsToRun,
      reasons,
      context: {
        userEfficiency,
        peerEfficiency,
        hasOpportunities,
        hasPeerData,
        companyDocsEnabled,
        perplexityAvailable: !!perplexityApiKey,
      },
      routingDecision,
    },
  }, null, 2));
  logger.info('=== END ORCHESTRATOR ROUTING OUTPUT ===');

  return {
    routingDecision,
    currentStage: 'orchestrator_routing_complete',
    progress: 60,
  };
}

/**
 * Node: Execute downstream agents based on routing decision
 *
 * Model Configuration:
 * - A3 Comparator: Gemini 2.5 Flash
 * - A4-Web: Gemini 2.5 Flash + Perplexity API
 * - A4-Company: Gemini 2.5 Flash + RAG over uploaded company documents
 *
 * OPTIMIZATION: Agents run in PARALLEL using Promise.all for reduced latency.
 * Each agent is invoked with error handling - on failure, falls back to heuristic-based plans.
 */
async function executeDownstreamAgents(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, modelConfig, perplexityApiKey, nlqService } = deps;
  const agentsToRun = state.routingDecision?.agentsToRun || [];

  logger.info('Orchestrator: Executing downstream agents IN PARALLEL', {
    agentsToRun,
    modelConfig: {
      A3_COMPARATOR: getModelConfigDescription(modelConfig)['A3_COMPARATOR'],
      A4_WEB: getModelConfigDescription(modelConfig)['A4_WEB'],
      A4_COMPANY: getModelConfigDescription(modelConfig)['A4_COMPANY'],
    },
  });

  // Build array of agent promises to run in parallel
  const agentPromises: Array<{
    name: string;
    promise: Promise<StepOptimizationPlan | null>;
  }> = [];

  // A3 Comparator (Gemini 2.5 Flash)
  if (agentsToRun.includes('A3_COMPARATOR')) {
    agentPromises.push({
      name: 'A3_COMPARATOR',
      promise: (async () => {
        try {
          const a3LLMProvider = createAgentLLMProvider('A3_COMPARATOR', modelConfig);
          logger.info('Orchestrator: Starting A3 Comparator (parallel)', {
            model: getModelConfigDescription(modelConfig)['A3_COMPARATOR'],
          });

          const comparatorDeps: ComparatorGraphDeps = {
            logger,
            llmProvider: a3LLMProvider,
          };

          const a3Graph = createComparatorGraph(comparatorDeps);
          const a3Result = await a3Graph.invoke(state);
          const plan = a3Result.peerOptimizationPlan || null;

          logger.info('Orchestrator: A3 Comparator complete', {
            hasOptimizationPlan: !!plan,
            blockCount: plan?.blocks?.length || 0,
          });
          return plan;
        } catch (error) {
          logger.error('Orchestrator: A3 Comparator failed', error instanceof Error ? error : new Error(String(error)));
          return createPlaceholderOptimizationPlan('peer_comparison', state);
        }
      })(),
    });
  }

  // A4-Web (Gemini 2.5 Flash + Perplexity)
  if (agentsToRun.includes('A4_WEB')) {
    if (perplexityApiKey) {
      agentPromises.push({
        name: 'A4_WEB',
        promise: (async () => {
          try {
            const a4WebLLMProvider = createAgentLLMProvider('A4_WEB', modelConfig);
            logger.info('Orchestrator: Starting A4-Web (parallel)', {
              model: getModelConfigDescription(modelConfig)['A4_WEB'],
            });

            const webDeps: WebBestPracticesGraphDeps = {
              logger,
              llmProvider: a4WebLLMProvider,
              perplexityApiKey,
            };

            const a4WebGraph = createWebBestPracticesGraph(webDeps);
            const a4WebResult = await a4WebGraph.invoke(state);
            const plan = a4WebResult.webOptimizationPlan || null;

            logger.info('Orchestrator: A4-Web complete', {
              hasOptimizationPlan: !!plan,
              blockCount: plan?.blocks?.length || 0,
            });
            return plan;
          } catch (error) {
            logger.error('Orchestrator: A4-Web failed', error instanceof Error ? error : new Error(String(error)));
            return createPlaceholderOptimizationPlan('web_best_practice', state);
          }
        })(),
      });
    } else {
      logger.warn('Orchestrator: A4-Web skipped - no Perplexity API key');
    }
  }

  // A4-Company (Gemini 2.5 Flash + RAG over company docs via NLQ service)
  if (agentsToRun.includes('A4_COMPANY')) {
    agentPromises.push({
      name: 'A4_COMPANY',
      promise: (async () => {
        try {
          const a4CompanyLLMProvider = createAgentLLMProvider('A4_COMPANY', modelConfig);
          logger.info('Orchestrator: Starting A4-Company (parallel)', {
            model: getModelConfigDescription(modelConfig)['A4_COMPANY'],
            hasNlqService: !!nlqService,
          });

          const companyDocsDeps: CompanyDocsGraphDeps = {
            logger,
            llmProvider: a4CompanyLLMProvider,
            nlqService,
          };

          const a4CompanyGraph = createCompanyDocsGraph(companyDocsDeps);
          const a4CompanyResult = await a4CompanyGraph.invoke(state);
          const plan = a4CompanyResult.companyOptimizationPlan || null;

          logger.info('Orchestrator: A4-Company complete', {
            hasOptimizationPlan: !!plan,
            blockCount: plan?.blocks?.length || 0,
          });
          return plan;
        } catch (error) {
          logger.error('Orchestrator: A4-Company failed', error instanceof Error ? error : new Error(String(error)));
          return createPlaceholderOptimizationPlan('company_docs', state);
        }
      })(),
    });
  }

  // Execute all agents in parallel
  const startTime = Date.now();
  const results = await Promise.all(agentPromises.map(p => p.promise));
  const parallelDuration = Date.now() - startTime;

  logger.info('Orchestrator: All downstream agents completed in parallel', {
    agentCount: agentPromises.length,
    parallelDurationMs: parallelDuration,
    agentNames: agentPromises.map(p => p.name),
  });

  // Map results back to their respective plans
  let peerOptimizationPlan: StepOptimizationPlan | null = null;
  let webOptimizationPlan: StepOptimizationPlan | null = null;
  let companyOptimizationPlan: StepOptimizationPlan | null = null;

  agentPromises.forEach((agent, index) => {
    const plan = results[index];
    switch (agent.name) {
      case 'A3_COMPARATOR':
        peerOptimizationPlan = plan;
        break;
      case 'A4_WEB':
        webOptimizationPlan = plan;
        break;
      case 'A4_COMPANY':
        companyOptimizationPlan = plan;
        break;
    }
  });

  return {
    peerOptimizationPlan,
    webOptimizationPlan,
    companyOptimizationPlan,
    currentStage: 'orchestrator_downstream_complete',
    progress: 80,
  };
}

/**
 * Node: Merge results and apply quality thresholds
 */
async function mergeAndFinalize(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger } = deps;

  logger.info('Orchestrator: Merging results and applying thresholds');

  // Collect all optimization plans
  const plans = [
    state.peerOptimizationPlan,
    state.webOptimizationPlan,
    state.companyOptimizationPlan,
  ].filter((p): p is StepOptimizationPlan => p !== null);

  // Merge optimization blocks from all sources
  const mergedPlan = mergePlans(plans, logger);

  // Apply quality thresholds
  const passesThreshold = checkQualityThreshold(mergedPlan, logger);
  mergedPlan.passesThreshold = passesThreshold;

  if (!passesThreshold) {
    mergedPlan.thresholdReason = 'Savings below minimum threshold (10 min or 40% relative)';
  }

  // Generate user query answer from aggregated context
  const userQueryAnswer = await generateUserQueryAnswer(state, deps);

  // Build final result (now includes userQueryAnswer)
  const finalResult = buildFinalResult(state, mergedPlan, userQueryAnswer, deps);

  logger.info('Orchestrator: Finalization complete', {
    totalTimeSaved: mergedPlan.totalTimeSaved,
    passesThreshold,
    blockCount: mergedPlan.blocks.length,
  });

  // Log detailed merged plan output
  logger.info('=== ORCHESTRATOR OUTPUT (Merged Optimization Plan) ===');
  logger.info(JSON.stringify({
    agent: 'ORCHESTRATOR',
    outputType: 'mergedPlan',
    plan: {
      totalBlocks: mergedPlan.blocks.length,
      totalTimeSaved: mergedPlan.totalTimeSaved,
      totalRelativeImprovement: mergedPlan.totalRelativeImprovement,
      passesThreshold: mergedPlan.passesThreshold,
      thresholdReason: mergedPlan.thresholdReason,
      blocks: mergedPlan.blocks.map(b => ({
        blockId: b.blockId,
        workflowName: b.workflowName,
        timeSaved: b.timeSaved,
        relativeImprovement: b.relativeImprovement,
        confidence: b.confidence,
        source: b.source,
        whyThisMatters: b.whyThisMatters,
      })),
    },
  }, null, 2));
  logger.info('=== END ORCHESTRATOR MERGED PLAN OUTPUT ===');

  // Log final result
  logger.info('=== ORCHESTRATOR OUTPUT (Final Result) ===');
  logger.info(JSON.stringify({
    agent: 'ORCHESTRATOR',
    outputType: 'finalResult',
    result: {
      queryId: finalResult.queryId,
      query: finalResult.query,
      userId: finalResult.userId,
      executiveSummary: {
        totalTimeReduced: finalResult.executiveSummary.totalTimeReduced,
        totalRelativeImprovement: finalResult.executiveSummary.totalRelativeImprovement,
        topInefficiencies: finalResult.executiveSummary.topInefficiencies,
        claudeCodeInsertionPoints: finalResult.executiveSummary.claudeCodeInsertionPoints,
        passesQualityThreshold: finalResult.executiveSummary.passesQualityThreshold,
      },
      optimizationPlan: {
        blockCount: finalResult.optimizationPlan.blocks.length,
        totalTimeSaved: finalResult.optimizationPlan.totalTimeSaved,
        totalRelativeImprovement: finalResult.optimizationPlan.totalRelativeImprovement,
        passesThreshold: finalResult.optimizationPlan.passesThreshold,
      },
      finalOptimizedWorkflow: {
        stepCount: finalResult.finalOptimizedWorkflow.length,
        steps: finalResult.finalOptimizedWorkflow.map(s => ({
          stepId: s.stepId,
          order: s.order,
          tool: s.tool,
          description: s.description,
          estimatedDurationSeconds: s.estimatedDurationSeconds,
          isNew: s.isNew,
          hasClaudeCodePrompt: !!s.claudeCodePrompt,
        })),
      },
      supportingEvidence: {
        userStepReferenceCount: finalResult.supportingEvidence.userStepReferences.length,
        companyDocCitationCount: finalResult.supportingEvidence.companyDocCitations?.length || 0,
        peerWorkflowPatternCount: finalResult.supportingEvidence.peerWorkflowPatterns?.length || 0,
      },
      metadata: finalResult.metadata,
      createdAt: finalResult.createdAt,
      completedAt: finalResult.completedAt,
    },
  }, null, 2));
  logger.info('=== END ORCHESTRATOR FINAL RESULT OUTPUT ===');

  return {
    mergedPlan,
    userQueryAnswer,
    finalResult,
    currentStage: 'orchestrator_complete',
    status: 'completed',
    progress: 100,
  };
}

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================

/**
 * Route after A1: continue to A2 or fail
 */
function routeAfterA1(state: InsightState): string {
  if (state.errors.length > 0 && !state.userEvidence) {
    return 'fail';
  }
  return 'continue';
}

/**
 * Route after A2: continue to routing or fail
 */
function routeAfterA2(state: InsightState): string {
  if (state.errors.length > 0 && !state.userDiagnostics) {
    return 'fail';
  }
  return 'continue';
}

/**
 * Route after routing decision: to downstream agents or skip
 */
function routeAfterRouting(state: InsightState): string {
  const agentsToRun = state.routingDecision?.agentsToRun || [];
  if (agentsToRun.length === 0) {
    return 'skip_downstream';
  }
  return 'run_downstream';
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the main Orchestrator graph
 */
export function createOrchestratorGraph(deps: OrchestratorGraphDeps) {
  const { logger, modelConfig } = deps;

  // Log model configuration for observability
  const modelDescriptions = getModelConfigDescription(modelConfig);
  logger.info('Creating Orchestrator Graph', {
    modelConfiguration: {
      A1_RETRIEVAL: modelDescriptions['A1_RETRIEVAL'],
      A2_JUDGE: modelDescriptions['A2_JUDGE'],
      A3_COMPARATOR: modelDescriptions['A3_COMPARATOR'],
      A4_WEB: modelDescriptions['A4_WEB'],
      A4_COMPANY: modelDescriptions['A4_COMPANY'],
    },
  });

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('execute_a1', (state) => executeRetrievalAgent(state, deps))
    .addNode('execute_a2', (state) => executeJudgeAgent(state, deps))
    .addNode('make_routing_decision', (state) => makeRoutingDecision(state, deps))
    .addNode('execute_downstream', (state) => executeDownstreamAgents(state, deps))
    .addNode('merge_and_finalize', (state) => mergeAndFinalize(state, deps))

    // Define edges
    .addEdge('__start__', 'execute_a1')
    .addConditionalEdges('execute_a1', routeAfterA1, {
      continue: 'execute_a2',
      fail: 'merge_and_finalize', // Still produce partial result
    })
    .addConditionalEdges('execute_a2', routeAfterA2, {
      continue: 'make_routing_decision',
      fail: 'merge_and_finalize',
    })
    .addConditionalEdges('make_routing_decision', routeAfterRouting, {
      run_downstream: 'execute_downstream',
      skip_downstream: 'merge_and_finalize',
    })
    .addEdge('execute_downstream', 'merge_and_finalize')
    .addEdge('merge_and_finalize', END);

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build aggregated context string from all agent outputs for answer generation
 */
function buildAggregatedContext(state: InsightState): string {
  const sections: string[] = [];

  // Session summaries from A1 (pre-generated during screenshot analysis - highest priority)
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

  // User's individual workflow summaries from A1 (chapters from desktop app AI analysis)
  if (state.userEvidence?.workflows && state.userEvidence.workflows.length > 0) {
    const workflowDetails = state.userEvidence.workflows
      .slice(0, 8) // Include more workflows since they now have rich summaries
      .map(w => {
        const tools = w.tools?.join(', ') || 'various tools';
        const title = w.title || 'Untitled workflow';
        // Use the full summary from chapter data
        const summary = w.summary && w.summary !== w.title ? `\n    Summary: ${w.summary}` : '';
        const intent = w.intent && w.intent !== 'Extracted from session' && w.intent !== w.summary
          ? `\n    Intent: ${w.intent}` : '';
        return `- **${title}** (using ${tools})${summary}${intent}`;
      })
      .join('\n');
    sections.push(`USER'S RECENT WORKFLOWS (from captured sessions):\n${workflowDetails}`);
  }

  // Identified inefficiencies from A2
  if (state.userDiagnostics?.inefficiencies && state.userDiagnostics.inefficiencies.length > 0) {
    const ineffSummary = state.userDiagnostics.inefficiencies
      .slice(0, 3)
      .map(i => `- ${i.type}: ${i.description}`)
      .join('\n');
    sections.push(`IDENTIFIED WORKFLOW PATTERNS:\n${ineffSummary}`);
  }

  // Opportunities from A2
  if (state.userDiagnostics?.opportunities && state.userDiagnostics.opportunities.length > 0) {
    const oppSummary = state.userDiagnostics.opportunities
      .slice(0, 3)
      .map(o => `- ${o.type}: ${o.description}${o.suggestedTool ? ` (suggested tool: ${o.suggestedTool})` : ''}`)
      .join('\n');
    sections.push(`IMPROVEMENT OPPORTUNITIES:\n${oppSummary}`);
  }

  // Web best practices from A4-Web
  if (state.webOptimizationPlan?.blocks && state.webOptimizationPlan.blocks.length > 0) {
    const webInsights = state.webOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => c.url || c.title).filter(Boolean).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [Sources: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`WEB BEST PRACTICES:\n${webInsights}`);
  }

  // Peer comparison insights from A3
  if (state.peerOptimizationPlan?.blocks && state.peerOptimizationPlan.blocks.length > 0) {
    const peerInsights = state.peerOptimizationPlan.blocks
      .map(b => `- ${b.whyThisMatters} (${Math.round(b.relativeImprovement)}% improvement potential)`)
      .join('\n');
    sections.push(`PEER WORKFLOW INSIGHTS:\n${peerInsights}`);
  }

  // Company docs insights from A4-Company
  if (state.companyOptimizationPlan?.blocks && state.companyOptimizationPlan.blocks.length > 0) {
    const companyInsights = state.companyOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => `${c.title}${c.pageNumber ? ` (p.${c.pageNumber})` : ''}`).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [From: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`INTERNAL DOCUMENTATION INSIGHTS:\n${companyInsights}`);
  }

  // If no context at all, provide a fallback
  if (sections.length === 0) {
    return 'No specific workflow context available. Provide general guidance based on the question.';
  }

  return sections.join('\n\n');
}

/**
 * Search the web using Perplexity API for information about the user's query
 */
async function searchWebForQuery(
  query: string,
  perplexityApiKey: string | undefined,
  logger: Logger
): Promise<{ content: string; citations: string[] } | null> {
  if (!perplexityApiKey) {
    logger.info('Orchestrator: No Perplexity API key, skipping web search for answer');
    return null;
  }

  try {
    logger.info('Orchestrator: Searching web for query context', { query });

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides comprehensive, accurate information about developer tools, workflows, and best practices. Focus on practical guidance and real-world usage patterns.',
          },
          {
            role: 'user',
            content: `Provide detailed information about: ${query}

Include:
- What it is and what it does
- How to use it (step-by-step if applicable)
- Best practices and common patterns
- Integration with common development workflows
- Any gotchas or important considerations`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
        return_citations: true,
      }),
    });

    if (!response.ok) {
      logger.warn('Orchestrator: Perplexity API error', { status: response.status });
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message: { content: string } }>;
      citations?: string[];
    };
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    logger.info('Orchestrator: Web search completed', {
      contentLength: content.length,
      citationCount: citations.length,
    });

    return { content, citations };
  } catch (error) {
    logger.warn('Orchestrator: Web search failed', { error: String(error) });
    return null;
  }
}

/**
 * Generate a direct, conversational answer to the user's query
 * using aggregated context from A1, A2, A3, and A4 agents,
 * plus web search results from Perplexity
 */
async function generateUserQueryAnswer(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<string> {
  const { logger, llmProvider, modelConfig, perplexityApiKey } = deps;

  logger.info('Orchestrator: Generating user query answer');

  // Build aggregated context from all agents
  const aggregatedContext = buildAggregatedContext(state);

  // Search the web for information about the user's query
  const webSearchResult = await searchWebForQuery(state.query, perplexityApiKey, logger);

  // Build web search context section
  let webSearchContext = '';
  if (webSearchResult && webSearchResult.content) {
    webSearchContext = `

WEB SEARCH RESULTS (about "${state.query}"):
${webSearchResult.content}

${webSearchResult.citations.length > 0 ? `Sources:\n${webSearchResult.citations.map(c => `- ${c}`).join('\n')}` : ''}`;

    logger.info('Orchestrator: Including web search results in answer context', {
      contentLength: webSearchResult.content.length,
      citations: webSearchResult.citations.length,
    });
  }

  // Build the prompt for answer generation
  const prompt = `You are a helpful workflow optimization assistant. Your job is to directly answer the user's question in a conversational, comprehensive way.

USER'S QUESTION: "${state.query}"

CONTEXT FROM WORKFLOW ANALYSIS:
${aggregatedContext}${webSearchContext}

INSTRUCTIONS:
1. **Answer the question directly** - Don't start with optimization suggestions. Answer what they asked.
2. **Use web search results** - If web search results contain relevant information about what they're asking, use that information to provide a detailed, accurate answer.
3. **Reference their actual workflows** - Use specifics from their sessions (tools they use, patterns you see) to tailor the advice.
4. **Provide step-by-step guidance** when explaining how to use a tool/technique
5. **Tailor advice to their context** - Reference their specific apps, codebase, or workflow patterns
6. **Include practical examples** relevant to their work
7. **Cite sources** - If you reference information from web search, mention where it came from.
8. **Warn about common gotchas** if applicable
9. **Offer next steps** - What would help them get started?

Write a helpful, conversational response (use markdown formatting for structure):`;

  try {
    // Use the same model as A4-Web for consistency
    let answerLLMProvider = llmProvider;
    try {
      answerLLMProvider = createAgentLLMProvider('A4_WEB', modelConfig);
    } catch {
      logger.warn('Orchestrator: Using default LLM provider for answer generation');
    }

    const response = await answerLLMProvider.generateText([
      { role: 'user', content: prompt }
    ]);

    const answerText = response.content;

    logger.info('Orchestrator: User query answer generated', {
      answerLength: answerText.length,
      includedWebSearch: !!webSearchResult,
    });

    return answerText;
  } catch (error) {
    logger.error('Orchestrator: Failed to generate user query answer', error instanceof Error ? error : new Error(String(error)));
    return `I found some optimization opportunities for your workflows, but I couldn't generate a specific answer to your question. Please see the Strategy Proposals panel for detailed recommendations.`;
  }
}

/**
 * Create a placeholder optimization plan (to be replaced by actual agent implementations)
 */
function createPlaceholderOptimizationPlan(
  source: 'peer_comparison' | 'web_best_practice' | 'company_docs',
  state: InsightState
): StepOptimizationPlan {
  // Use opportunities from diagnostics to create optimization blocks
  const opportunities = state.userDiagnostics?.opportunities || [];

  const blocks = opportunities.slice(0, 3).map((opp, index) => ({
    blockId: `block-${source}-${index}`,
    workflowName: state.userDiagnostics?.workflowName || 'Workflow',
    workflowId: state.userDiagnostics?.workflowId || 'unknown',
    currentTimeTotal: opp.estimatedSavingsSeconds * 2, // Estimate current time
    optimizedTimeTotal: opp.estimatedSavingsSeconds,
    timeSaved: opp.estimatedSavingsSeconds,
    relativeImprovement:
      (opp.estimatedSavingsSeconds / (opp.estimatedSavingsSeconds * 2)) * 100,
    confidence: opp.confidence,
    whyThisMatters: opp.description,
    metricDeltas: {
      contextSwitchesReduction: opp.type === 'consolidation' ? 2 : 0,
      reworkLoopsReduction: opp.type === 'automation' ? 1 : 0,
    },
    stepTransformations: [
      {
        transformationId: `trans-${index}`,
        currentSteps: [],
        optimizedSteps: [
          {
            stepId: `opt-step-${index}`,
            tool: opp.suggestedTool || (opp.claudeCodeApplicable ? 'Claude Code' : 'Optimized Tool'),
            estimatedDurationSeconds: opp.estimatedSavingsSeconds,
            description: `Optimized: ${opp.description}`,
            claudeCodePrompt: opp.claudeCodeApplicable
              ? `Use Claude Code to: ${opp.description}`
              : undefined,
            isNew: true,
          },
        ],
        timeSavedSeconds: opp.estimatedSavingsSeconds,
        confidence: opp.confidence,
        rationale: opp.description,
      },
    ],
    source,
    citations: source === 'company_docs' ? [{ title: 'Internal Docs', excerpt: 'Placeholder' }] : undefined,
  }));

  const totalTimeSaved = blocks.reduce((sum, b) => sum + b.timeSaved, 0);
  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Will be set in merge step
  };
}

/**
 * Merge multiple optimization plans
 */
function mergePlans(
  plans: StepOptimizationPlan[],
  logger: Logger
): StepOptimizationPlan {
  // Combine all blocks, sorted by time saved
  const allBlocks = plans
    .flatMap((p) => p.blocks)
    .sort((a, b) => b.timeSaved - a.timeSaved);

  // Remove duplicates (blocks targeting same workflow/inefficiency)
  const seenWorkflowIds = new Set<string>();
  const deduplicatedBlocks = allBlocks.filter((block) => {
    const key = `${block.workflowId}:${block.whyThisMatters.slice(0, 50)}`;
    if (seenWorkflowIds.has(key)) {
      return false;
    }
    seenWorkflowIds.add(key);
    return true;
  });

  // Take top blocks based on confidence and savings
  const topBlocks = deduplicatedBlocks
    .slice(0, 5) // Max 5 optimization blocks
    .filter((b) => b.confidence >= THRESHOLDS.MIN_CONFIDENCE);

  const totalTimeSaved = topBlocks.reduce((sum, b) => sum + b.timeSaved, 0);
  const totalCurrentTime = topBlocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  logger.debug('Merged optimization plans', {
    inputPlans: plans.length,
    totalBlocks: allBlocks.length,
    afterDedup: deduplicatedBlocks.length,
    finalBlocks: topBlocks.length,
    totalTimeSaved,
  });

  return {
    blocks: topBlocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Will be set below
  };
}

/**
 * Check if the optimization plan passes quality thresholds
 */
function checkQualityThreshold(
  plan: StepOptimizationPlan,
  logger: Logger
): boolean {
  // Absolute threshold: >= 10 minutes (600 seconds)
  const meetsAbsolute = plan.totalTimeSaved >= THRESHOLDS.ABSOLUTE_SAVINGS_SECONDS;

  // Relative threshold: >= 40%
  const meetsRelative = plan.totalRelativeImprovement >= THRESHOLDS.RELATIVE_SAVINGS_PERCENT;

  // Must meet at least one threshold
  const passesThreshold = meetsAbsolute || meetsRelative;

  // But must also meet minimum thresholds to not be trivial
  const aboveMinimum =
    plan.totalTimeSaved >= THRESHOLDS.MIN_ABSOLUTE_SECONDS ||
    plan.totalRelativeImprovement >= THRESHOLDS.MIN_RELATIVE_PERCENT;

  logger.debug('Quality threshold check', {
    totalTimeSaved: plan.totalTimeSaved,
    totalRelativeImprovement: plan.totalRelativeImprovement,
    meetsAbsolute,
    meetsRelative,
    aboveMinimum,
    passesThreshold: passesThreshold && aboveMinimum,
  });

  return passesThreshold && aboveMinimum;
}

/**
 * Build the final InsightGenerationResult
 */
function buildFinalResult(
  state: InsightState,
  mergedPlan: StepOptimizationPlan,
  userQueryAnswer: string,
  deps: OrchestratorGraphDeps
): InsightGenerationResult {
  const queryId = uuidv4();
  const now = new Date().toISOString();

  // Executive summary
  const executiveSummary: ExecutiveSummary = {
    totalTimeReduced: mergedPlan.totalTimeSaved,
    totalRelativeImprovement: mergedPlan.totalRelativeImprovement,
    topInefficiencies:
      state.userDiagnostics?.inefficiencies
        .slice(0, 3)
        .map((i) => `${i.type}: ${i.description}`) || [],
    claudeCodeInsertionPoints: mergedPlan.blocks
      .flatMap((b) =>
        b.stepTransformations
          .flatMap((t) => t.optimizedSteps)
          .filter((s) => s.claudeCodePrompt)
          .map((s) => s.claudeCodePrompt!)
      )
      .slice(0, 5),
    passesQualityThreshold: mergedPlan.passesThreshold,
  };

  // Build final optimized workflow from transformations
  const finalOptimizedWorkflow: FinalWorkflowStep[] = [];
  let order = 1;
  for (const block of mergedPlan.blocks) {
    for (const transformation of block.stepTransformations) {
      for (const optStep of transformation.optimizedSteps) {
        finalOptimizedWorkflow.push({
          stepId: optStep.stepId,
          order: order++,
          tool: optStep.tool,
          description: optStep.description,
          estimatedDurationSeconds: optStep.estimatedDurationSeconds,
          isNew: optStep.isNew,
          replacesSteps: optStep.replacesSteps,
          claudeCodePrompt: optStep.claudeCodePrompt,
        });
      }
    }
  }

  // Build comparison table (Current vs Proposed workflow)
  const comparisonTable: ComparisonTableEntry[] = generateComparisonTable(
    state,
    mergedPlan
  );

  // Supporting evidence
  const supportingEvidence: SupportingEvidence = {
    userStepReferences:
      state.userDiagnostics?.inefficiencies.flatMap((i) => i.stepIds) || [],
    companyDocCitations: mergedPlan.blocks
      .filter((b) => b.source === 'company_docs' && b.citations)
      .flatMap((b) => b.citations || []),
    peerWorkflowPatterns: state.peerEvidence?.workflows.map((w) => w.title) || [],
  };

  // Metadata
  const agentsUsed: string[] = ['A1_RETRIEVAL', 'A2_JUDGE'];
  if (state.routingDecision?.agentsToRun) {
    agentsUsed.push(...state.routingDecision.agentsToRun);
  }

  const metadata: InsightGenerationMetadata = {
    queryId,
    agentsUsed,
    totalProcessingTimeMs: 0, // Would be calculated from actual timing
    peerDataAvailable: !!state.peerEvidence,
    companyDocsAvailable: deps.companyDocsEnabled,
    webSearchUsed: state.routingDecision?.agentsToRun.includes('A4_WEB') || false,
    modelVersion: 'insight-generation-v1',
  };

  return {
    queryId,
    query: state.query,
    userId: state.userId,
    userQueryAnswer,
    executiveSummary,
    optimizationPlan: mergedPlan,
    finalOptimizedWorkflow,
    comparisonTable,
    supportingEvidence,
    metadata,
    createdAt: now,
    completedAt: now,
  };
}

/**
 * Generate comparison table showing current vs proposed workflow steps
 */
function generateComparisonTable(
  state: InsightState,
  mergedPlan: StepOptimizationPlan
): ComparisonTableEntry[] {
  const entries: ComparisonTableEntry[] = [];
  let stepNumber = 1;

  for (const block of mergedPlan.blocks) {
    for (const transformation of block.stepTransformations) {
      // Get current steps info
      const currentSteps = transformation.currentSteps;
      const optimizedSteps = transformation.optimizedSteps;

      // If we have current steps to compare against
      if (currentSteps.length > 0) {
        // Create one entry per current step that gets transformed
        for (const currentStep of currentSteps) {
          // Find corresponding optimized step (may be combined)
          const optimizedStep = optimizedSteps[0]; // Typically steps are consolidated

          entries.push({
            stepNumber: stepNumber++,
            currentAction: currentStep.description || `Step using ${currentStep.tool}`,
            currentTool: currentStep.tool,
            currentDuration: currentStep.durationSeconds,
            proposedAction: optimizedStep?.description || transformation.rationale,
            proposedTool: optimizedStep?.tool || 'Optimized Tool',
            proposedDuration: optimizedStep?.estimatedDurationSeconds || 0,
            timeSaved: currentStep.durationSeconds - (optimizedStep?.estimatedDurationSeconds || 0),
            improvementNote: block.whyThisMatters,
          });
        }
      } else {
        // No current steps - this is a new recommended step
        for (const optimizedStep of optimizedSteps) {
          entries.push({
            stepNumber: stepNumber++,
            currentAction: 'Manual process / No automation',
            currentTool: 'Manual',
            currentDuration: transformation.timeSavedSeconds * 2, // Estimate
            proposedAction: optimizedStep.description,
            proposedTool: optimizedStep.tool,
            proposedDuration: optimizedStep.estimatedDurationSeconds,
            timeSaved: transformation.timeSavedSeconds,
            improvementNote: block.whyThisMatters,
          });
        }
      }
    }
  }

  // If no optimization blocks, try to build from user diagnostics
  if (entries.length === 0 && state.userDiagnostics?.opportunities) {
    for (const opportunity of state.userDiagnostics.opportunities.slice(0, 5)) {
      const currentDuration = opportunity.estimatedSavingsSeconds * 2; // Estimate
      const proposedDuration = opportunity.estimatedSavingsSeconds;

      entries.push({
        stepNumber: stepNumber++,
        currentAction: opportunity.description,
        currentTool: 'Current Workflow',
        currentDuration,
        proposedAction: `Optimize: ${opportunity.description}`,
        proposedTool: opportunity.suggestedTool || (opportunity.claudeCodeApplicable ? 'Claude Code' : 'Optimized Tool'),
        proposedDuration,
        timeSaved: opportunity.estimatedSavingsSeconds,
        improvementNote: `${opportunity.type}: ${opportunity.description}`,
      });
    }
  }

  return entries;
}
