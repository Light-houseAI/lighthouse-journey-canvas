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
import { withTimeout } from '../../../core/retry-utils.js';

// LLM call timeout constant
const LLM_TIMEOUT_MS = 60000; // 60 seconds
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import { createRetrievalGraph, type RetrievalGraphDeps } from './retrieval-graph.js';
import { createJudgeGraph, type JudgeGraphDeps } from './judge-graph.js';
import { createComparatorGraph, type ComparatorGraphDeps } from './comparator-graph.js';
import { createWebBestPracticesGraph, type WebBestPracticesGraphDeps } from './web-best-practices-graph.js';
import { createCompanyDocsGraph, type CompanyDocsGraphDeps } from './company-docs-graph.js';
import { createFeatureAdoptionGraph, type FeatureAdoptionGraphDeps } from './feature-adoption-graph.js';
import { ANSWER_GENERATION_SYSTEM_PROMPT, FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT } from '../prompts/system-prompts.js';
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
  InsightModelConfiguration,
  UserToolbox,
  FeatureAdoptionTip,
  AgentDiagnostics,
  OptimizationBlock,
  EnrichedWorkflowStep,
  EnrichedStepStatus,
  ImplementationOption,
  OptimizationSummaryMetrics,
  RepetitiveWorkflowPattern,
} from '../types.js';
import { buildUserToolbox, isToolInUserToolbox } from '../utils/toolbox-utils.js';
import type { PersonaService } from '../../persona.service.js';
import { NoiseFilterService, createNoiseFilterService } from '../filters/noise-filter.service.js';

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
  /** Service to derive user personas from timeline nodes */
  personaService?: PersonaService;
  /** Service to filter noise (Slack, communication) from evidence */
  noiseFilterService?: NoiseFilterService;
  // Note: Company docs are now retrieved via nlqService.searchCompanyDocuments()
}

// Quality thresholds from types (lowered to show blocks more easily)
const THRESHOLDS = {
  ABSOLUTE_SAVINGS_SECONDS: 60, // 1 minute (was 10 minutes)
  RELATIVE_SAVINGS_PERCENT: 10, // 10% (was 40%)
  MIN_ABSOLUTE_SECONDS: 30, // 30 seconds (was 2 minutes)
  MIN_RELATIVE_PERCENT: 5, // 5% (was 10%)
  MIN_CONFIDENCE: 0.3, // 30% (was 60%)
};

// ============================================================================
// SUB-GRAPH EXECUTION
// ============================================================================

/**
 * Node: Execute A1 Retrieval Agent (as subgraph)
 * Uses Gemini 2.5 Flash by default
 * Also loads user personas and applies noise filtering
 */
async function executeRetrievalAgent(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, nlqService, platformWorkflowRepository, sessionMappingRepository, embeddingService, llmProvider, modelConfig, personaService, noiseFilterService } = deps;

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

  // Load user personas for context
  let userPersonas: InsightState['userPersonas'] = null;
  let activePersonaContext: string | null = null;

  if (personaService) {
    try {
      const personas = await personaService.getActivePersonas(state.userId);
      if (personas.length > 0) {
        userPersonas = personas.map(p => ({
          type: p.type,
          nodeId: p.nodeId,
          displayName: p.displayName,
          context: p.context as unknown as Record<string, unknown>,
        }));
        activePersonaContext = personaService.formatPersonasForLLM(personas);

        logger.info('Orchestrator: Loaded user personas', {
          userId: state.userId,
          personaCount: personas.length,
          personaTypes: personas.map(p => p.type),
        });
      }
    } catch (error) {
      logger.warn('Orchestrator: Failed to load personas, continuing without', { error });
    }
  }

  logger.info('Orchestrator: Starting A1 Retrieval Agent', {
    userId: state.userId,
    query: state.query,
    filterNoise: state.filterNoise,
    hasPersonas: !!userPersonas,
  });

  // Create or use provided noise filter service
  const effectiveNoiseFilter = state.filterNoise
    ? (noiseFilterService || createNoiseFilterService())
    : undefined;

  const retrievalDeps: RetrievalGraphDeps = {
    logger,
    nlqService,
    platformWorkflowRepository,
    sessionMappingRepository,
    embeddingService,
    llmProvider: a1LLMProvider,
    noiseFilterService: effectiveNoiseFilter,
  };

  try {
    const a1StartTime = Date.now();
    const retrievalGraph = createRetrievalGraph(retrievalDeps);

    // AI2 OPTIMIZATION: Start speculative company docs check in parallel with A1
    // This check runs alongside A1 so routing decision doesn't have to wait for it
    let speculativeCompanyDocsPromise: Promise<boolean> | null = null;
    if (deps.companyDocsEnabled && nlqService) {
      speculativeCompanyDocsPromise = nlqService.hasCompanyDocuments(state.userId)
        .catch(() => false); // Fail silently if check fails
      logger.debug('Orchestrator: Started speculative company docs check (parallel with A1)');
    }

    const result = await retrievalGraph.invoke(state);

    // Get speculative check result (should be ready now since A1 takes longer)
    const speculativeCompanyDocsAvailable = speculativeCompanyDocsPromise
      ? await speculativeCompanyDocsPromise
      : undefined;

    logger.info('Orchestrator: A1 complete', {
      hasUserEvidence: !!result.userEvidence,
      hasPeerEvidence: !!result.peerEvidence,
      critiquePassed: result.a1CritiqueResult?.passed,
      elapsedMs: Date.now() - a1StartTime,
    });

    // Build user toolbox from ALL historical sessions
    let userToolbox: UserToolbox | null = null;
    try {
      const allTools: string[] = [];

      // Get historical sessions (up to 365 days, 500 sessions max)
      const historicalSessions = await sessionMappingRepository.getRecentSessions(
        state.userId,
        365, // 1 year lookback
        500  // max sessions
      );

      // Extract tools from each session's summary
      for (const session of historicalSessions) {
        const summary = session.summary as Record<string, unknown> | null;
        if (!summary) continue;

        // V2 schema: workflows[].classification.level_4_tools
        const workflows = summary.workflows as Array<{
          classification?: { level_4_tools?: string[] };
          semantic_steps?: Array<{ tools_involved?: string[] }>;
        }> | undefined;

        if (workflows) {
          for (const wf of workflows) {
            // From classification
            if (wf.classification?.level_4_tools) {
              allTools.push(...wf.classification.level_4_tools);
            }
            // From semantic steps
            if (wf.semantic_steps) {
              for (const step of wf.semantic_steps) {
                if (step.tools_involved) {
                  allTools.push(...step.tools_involved);
                }
              }
            }
          }
        }

        // V1 schema: chapters[].primary_app, chapters[].granular_steps[].app
        const chapters = summary.chapters as Array<{
          primary_app?: string;
          granular_steps?: Array<{ app?: string }>;
        }> | undefined;

        if (chapters) {
          for (const chapter of chapters) {
            if (chapter.primary_app) {
              allTools.push(chapter.primary_app);
            }
            if (chapter.granular_steps) {
              for (const step of chapter.granular_steps) {
                if (step.app) {
                  allTools.push(step.app);
                }
              }
            }
          }
        }
      }

      // Also add tools from retrieved userEvidence
      if (result.userEvidence?.workflows) {
        for (const wf of result.userEvidence.workflows) {
          if (wf.tools) {
            allTools.push(...wf.tools);
          }
        }
      }
      if (result.userEvidence?.sessions) {
        for (const session of result.userEvidence.sessions) {
          if (session.appsUsed) {
            allTools.push(...session.appsUsed);
          }
        }
      }

      // Build the toolbox
      userToolbox = buildUserToolbox(allTools);

      logger.info('Orchestrator: Built user toolbox from historical data', {
        userId: state.userId,
        historicalSessionCount: historicalSessions.length,
        uniqueToolCount: userToolbox.tools.length,
        sampleTools: userToolbox.tools.slice(0, 10),
      });
    } catch (toolboxError) {
      logger.warn('Orchestrator: Failed to build user toolbox, continuing without', {
        error: toolboxError instanceof Error ? toolboxError.message : String(toolboxError),
      });
    }

    return {
      userEvidence: result.userEvidence,
      peerEvidence: result.peerEvidence,
      a1CritiqueResult: result.a1CritiqueResult,
      a1RetryCount: result.a1RetryCount,
      userPersonas,
      activePersonaContext,
      userToolbox,
      // AI2 OPTIMIZATION: Pass speculative check result to avoid blocking in routing
      _speculativeCompanyDocsAvailable: speculativeCompanyDocsAvailable,
      currentStage: 'orchestrator_a1_complete',
      progress: 30,
    };
  } catch (error) {
    logger.error('Orchestrator: A1 failed', error instanceof Error ? error : new Error(String(error)));
    return {
      userPersonas,
      activePersonaContext,
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
    const a2StartTime = Date.now();
    const judgeGraph = createJudgeGraph(judgeDeps);
    const result = await judgeGraph.invoke(state);

    logger.info('Orchestrator: A2 complete', {
      hasUserDiagnostics: !!result.userDiagnostics,
      hasPeerDiagnostics: !!result.peerDiagnostics,
      userEfficiency: result.userDiagnostics?.overallEfficiencyScore,
      peerEfficiency: result.peerDiagnostics?.overallEfficiencyScore,
      critiquePassed: result.a2CritiqueResult?.passed,
      elapsedMs: Date.now() - a2StartTime,
    });

    // DEBUG: Log detailed opportunity information
    logger.info('Orchestrator: A2 Opportunity Debug', {
      opportunityCount: result.userDiagnostics?.opportunities?.length ?? 0,
      inefficiencyCount: result.userDiagnostics?.inefficiencies?.length ?? 0,
      opportunities: result.userDiagnostics?.opportunities?.map(o => ({
        id: o.id,
        type: o.type,
        description: o.description.slice(0, 100),
        estimatedSavingsSeconds: o.estimatedSavingsSeconds,
        confidence: o.confidence,
        claudeCodeApplicable: o.claudeCodeApplicable,
      })) ?? [],
      inefficiencies: result.userDiagnostics?.inefficiencies?.map(i => ({
        id: i.id,
        type: i.type,
        description: i.description.slice(0, 100),
        estimatedWastedSeconds: i.estimatedWastedSeconds,
        confidence: i.confidence,
        stepIds: i.stepIds,
      })) ?? [],
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
 * COMBINED APPROACH: Run ALL available agents to maximize optimization suggestions
 */
async function makeRoutingDecision(
  state: InsightState,
  deps: OrchestratorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, companyDocsEnabled, perplexityApiKey, nlqService } = deps;

  logger.info('Orchestrator: Making combined routing decision');

  const agentsToRun: AgentId[] = [];
  const reasons: string[] = [];

  const userEfficiency = state.userDiagnostics?.overallEfficiencyScore ?? 50;
  const peerEfficiency = state.peerDiagnostics?.overallEfficiencyScore ?? null;
  const hasOpportunities = (state.userDiagnostics?.opportunities.length ?? 0) > 0;
  const hasInefficiencies = (state.userDiagnostics?.inefficiencies.length ?? 0) > 0;
  const hasPeerData = !!state.peerEvidence && state.peerEvidence.workflows.length > 0;
  const hasUserData = !!state.userEvidence && (
    (state.userEvidence.workflows?.length ?? 0) > 0 ||
    (state.userEvidence.sessions?.length ?? 0) > 0
  );

  // PRIORITY-BASED ROUTING: User data analysis first, web search as fallback
  //
  // The routing priority is:
  // 1. A5 Feature Adoption (always runs if user data exists) - uses existing tools
  // 2. A3 Comparator (if peer data available) - uses peer patterns
  // 3. A4-Company (if company docs enabled AND docs exist) - uses internal knowledge
  // 4. A4-Web (FALLBACK ONLY) - only when user analysis is insufficient

  // A5-Feature Adoption: ALWAYS run first if user data is available
  // This analyzes user's existing tools and suggests features they're not using
  if (hasUserData) {
    agentsToRun.push('A5_FEATURE_ADOPTION');
    reasons.push('User data available for feature discovery analysis (PRIORITY)');
  }

  // A3 Comparator: Run if we have peer data (for peer comparison insights)
  if (hasPeerData) {
    agentsToRun.push('A3_COMPARATOR');
    reasons.push(`Peer data available (${state.peerEvidence?.workflows.length} workflows)`);
  } else if (hasInefficiencies) {
    // FIX-4: Even without peer data, we can still generate heuristic optimization blocks
    // based on A2 inefficiencies. Mark this so we create fallback blocks later.
    reasons.push('No peer data - will generate heuristic optimizations from A2 analysis');
  }

  // A4-Company: Run ONLY if company docs are enabled AND user has indexed documents
  // AI2 OPTIMIZATION: Use cached check from A1 if available, otherwise check now
  if (companyDocsEnabled && nlqService) {
    // Check if we have a cached result from speculative check during A1
    const hasCompanyDocs = state._speculativeCompanyDocsAvailable !== undefined
      ? state._speculativeCompanyDocsAvailable
      : await nlqService.hasCompanyDocuments(state.userId);

    if (hasCompanyDocs) {
      agentsToRun.push('A4_COMPANY');
      reasons.push('Company documentation available and indexed');
    } else {
      logger.info('Orchestrator: Skipping A4-Company - no indexed documents for user', {
        userId: state.userId,
      });
      reasons.push('A4-Company skipped - no indexed company documents');
    }
  } else if (companyDocsEnabled && !nlqService) {
    logger.warn('Orchestrator: A4-Company enabled but NLQ service not available');
    reasons.push('A4-Company skipped - NLQ service not available');
  }

  // A4-Web: ALWAYS run web search when API key is available
  // Web search provides best practices and industry standards that complement user analysis
  // This is independent of A2's results - web research adds external context
  if (perplexityApiKey) {
    agentsToRun.push('A4_WEB');
    reasons.push('Web search enabled for best practices and industry standards');
  }

  // Log what data we have for context
  if (hasUserData) {
    reasons.push(`User data: ${state.userEvidence?.workflows?.length ?? 0} workflows, ${state.userEvidence?.sessions?.length ?? 0} sessions`);
  }
  if (hasInefficiencies) {
    reasons.push(`${state.userDiagnostics?.inefficiencies.length} inefficiencies identified`);
  }
  if (hasOpportunities) {
    reasons.push(`${state.userDiagnostics?.opportunities.length} opportunities identified`);
  }

  // Note: A2 opportunities are used for diagnostics only
  // Optimization blocks come from downstream agents (A3, A4-Web, A4-Company)

  // companyDocsAvailable reflects actual document availability, not just config flag
  const companyDocsAvailable = agentsToRun.includes('A4_COMPANY');

  const routingDecision: RoutingDecision = {
    agentsToRun,
    reason: reasons.join('; '),
    peerDataUsable: hasPeerData,
    companyDocsAvailable,
  };

  logger.info('Orchestrator: Routing decision made', {
    agentsToRun,
    reasons,
  });

  // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== ORCHESTRATOR OUTPUT (Combined Routing Decision) ===');
    logger.debug(JSON.stringify({
      agent: 'ORCHESTRATOR',
      outputType: 'routingDecision',
      routing: {
        agentsToRun,
        reasons,
        context: {
          userEfficiency,
          peerEfficiency,
          hasUserData,
          hasInefficiencies,
          hasOpportunities,
          hasPeerData,
          companyDocsEnabled,
          companyDocsAvailable,
          perplexityAvailable: !!perplexityApiKey,
        },
        routingDecision,
      },
    }));
    logger.debug('=== END ORCHESTRATOR ROUTING OUTPUT ===');
  }

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
        const startTime = Date.now();
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
            elapsedMs: Date.now() - startTime,
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
          const startTime = Date.now();
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
              elapsedMs: Date.now() - startTime,
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
        const startTime = Date.now();
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
            elapsedMs: Date.now() - startTime,
          });
          return plan;
        } catch (error) {
          logger.error('Orchestrator: A4-Company failed', error instanceof Error ? error : new Error(String(error)));
          return createPlaceholderOptimizationPlan('company_docs', state);
        }
      })(),
    });
  }

  // A5-Feature Adoption (Gemini 2.5 Flash, no external APIs)
  // Returns FeatureAdoptionTip[] instead of StepOptimizationPlan
  let featureAdoptionPromise: Promise<FeatureAdoptionTip[]> | null = null;
  if (agentsToRun.includes('A5_FEATURE_ADOPTION')) {
    featureAdoptionPromise = (async () => {
      const startTime = Date.now();
      try {
        const a5LLMProvider = createAgentLLMProvider('A5_FEATURE_ADOPTION', modelConfig);
        logger.info('Orchestrator: Starting A5-Feature Adoption (parallel)', {
          model: getModelConfigDescription(modelConfig)['A5_FEATURE_ADOPTION'],
        });

        const featureAdoptionDeps: FeatureAdoptionGraphDeps = {
          logger,
          llmProvider: a5LLMProvider,
        };

        const a5Graph = createFeatureAdoptionGraph(featureAdoptionDeps);
        const a5Result = await a5Graph.invoke(state);
        const tips = a5Result.featureAdoptionTips || [];

        logger.info('Orchestrator: A5-Feature Adoption complete', {
          tipCount: tips.length,
          tools: tips.map(t => t.toolName),
          elapsedMs: Date.now() - startTime,
        });
        return tips;
      } catch (error) {
        logger.error('Orchestrator: A5-Feature Adoption failed', error instanceof Error ? error : new Error(String(error)));
        return [];
      }
    })();
  }

  // OPTIMIZATION P2: Also run web search for user's query in parallel
  // This search is used during answer generation in finalization
  let webSearchPromise: Promise<{ content: string; citations: string[] } | null> | null = null;
  if (perplexityApiKey) {
    webSearchPromise = searchWebForQuery(state.query, perplexityApiKey, logger);
    logger.info('Orchestrator: Starting web search for user query (parallel with agents)');
  }

  // Execute all agents + web search + feature adoption in parallel
  const startTime = Date.now();
  const [agentResults, cachedWebSearchResult, featureAdoptionTips] = await Promise.all([
    Promise.all(agentPromises.map(p => p.promise)),
    webSearchPromise || Promise.resolve(null),
    featureAdoptionPromise || Promise.resolve([]),
  ]);
  const parallelDuration = Date.now() - startTime;

  logger.info('Orchestrator: All downstream agents + web search + feature adoption completed in parallel', {
    agentCount: agentPromises.length,
    parallelDurationMs: parallelDuration,
    agentNames: agentPromises.map(p => p.name),
    hasWebSearchResult: !!cachedWebSearchResult,
    featureAdoptionTipCount: featureAdoptionTips.length,
  });

  // Map results back to their respective plans
  let peerOptimizationPlan: StepOptimizationPlan | null = null;
  let webOptimizationPlan: StepOptimizationPlan | null = null;
  let companyOptimizationPlan: StepOptimizationPlan | null = null;

  agentPromises.forEach((agent, index) => {
    const plan = agentResults[index];
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
    featureAdoptionTips,
    cachedWebSearchResult,
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
  const finalizeStartTime = Date.now();

  logger.info('Orchestrator: Merging results and applying thresholds');

  // DEBUG: Log all available optimization plans from downstream agents
  logger.info('Orchestrator: Available optimization plans', {
    peerPlanExists: !!state.peerOptimizationPlan,
    peerBlockCount: state.peerOptimizationPlan?.blocks?.length ?? 0,
    webPlanExists: !!state.webOptimizationPlan,
    webBlockCount: state.webOptimizationPlan?.blocks?.length ?? 0,
    companyPlanExists: !!state.companyOptimizationPlan,
    companyBlockCount: state.companyOptimizationPlan?.blocks?.length ?? 0,
  });

  // Collect optimization plans from downstream agents (A3, A4-Web, A4-Company)
  const plans = [
    state.peerOptimizationPlan,
    state.webOptimizationPlan,
    state.companyOptimizationPlan,
  ].filter((p): p is StepOptimizationPlan => p !== null);

  const totalBlocksFromDownstream = plans.reduce((sum, p) => sum + p.blocks.length, 0);

  logger.info('Orchestrator: Plans after filtering nulls', {
    planCount: plans.length,
    totalBlocksBeforeMerge: totalBlocksFromDownstream,
  });

  // FALLBACK: If downstream agents didn't produce enough blocks, create blocks from A2 opportunities
  // This ensures we always show meaningful metrics based on user workflow analysis
  if (totalBlocksFromDownstream === 0 && state.userDiagnostics?.opportunities?.length) {
    logger.info('Orchestrator: No downstream blocks, creating fallback from A2 opportunities', {
      opportunityCount: state.userDiagnostics.opportunities.length,
    });
    const fallbackPlan = createPlaceholderOptimizationPlan('peer_comparison', state);
    plans.push(fallbackPlan);
  }

  // FIX-4: If A3 didn't run (no peer data) but we have inefficiencies, create heuristic blocks
  // This ensures users still get optimization recommendations even without peer comparison
  const a3DidNotRun = !state.peerOptimizationPlan;
  const hasInefficiencies = (state.userDiagnostics?.inefficiencies?.length ?? 0) > 0;
  if (a3DidNotRun && hasInefficiencies && totalBlocksFromDownstream < 3) {
    logger.info('Orchestrator: A3 skipped (no peer data), creating heuristic blocks from inefficiencies', {
      inefficiencyCount: state.userDiagnostics?.inefficiencies?.length ?? 0,
    });
    const heuristicPlan = createHeuristicOptimizationPlan(state, logger);
    if (heuristicPlan.blocks.length > 0) {
      plans.push(heuristicPlan);
    }
  }

  // Convert repetitive workflow patterns to optimization blocks with enriched data
  // These patterns (e.g., "research → summarize → email" occurring 10x/week) are
  // converted to visual side-by-side comparisons showing current vs optimized workflows
  if (state.userEvidence?.repetitivePatterns && state.userEvidence.repetitivePatterns.length > 0) {
    logger.info('Orchestrator: Converting repetitive patterns to optimization blocks', {
      patternCount: state.userEvidence.repetitivePatterns.length,
      patterns: state.userEvidence.repetitivePatterns.map(p => ({
        sequence: p.sequence.join(' → '),
        occurrenceCount: p.occurrenceCount,
        totalTimeHours: Math.round(p.totalTimeSpentSeconds / 3600 * 10) / 10,
      })),
    });
    const patternBlocks = convertRepetitivePatternsToOptimizationBlocks(
      state.userEvidence.repetitivePatterns,
      state,
      logger
    );
    if (patternBlocks.length > 0) {
      // Create a plan from the pattern blocks
      const patternPlan: StepOptimizationPlan = {
        blocks: patternBlocks,
        totalTimeSaved: patternBlocks.reduce((sum, b) => sum + b.timeSaved, 0),
        totalRelativeImprovement: patternBlocks.length > 0
          ? patternBlocks.reduce((sum, b) => sum + b.relativeImprovement, 0) / patternBlocks.length
          : 0,
        passesThreshold: false, // Will be set in merge step
      };
      plans.push(patternPlan);
    }
  }

  // NOTE: A5 FeatureAdoptionTips are NO LONGER converted to OptimizationBlocks
  // This was causing semantic mismatches where general tips (e.g., "use shell aliases")
  // were incorrectly mapped to unrelated steps (e.g., research steps in Granola/Chrome).
  // A5 tips are now displayed separately as "Workflow Tips" in the frontend,
  // which is more appropriate since they're tool-level suggestions, not step transformations.
  if (state.featureAdoptionTips && state.featureAdoptionTips.length > 0) {
    logger.info('Orchestrator: A5 feature adoption tips will be displayed separately', {
      tipCount: state.featureAdoptionTips.length,
      tips: state.featureAdoptionTips.map(t => ({ tool: t.toolName, feature: t.featureName })),
    });
  }

  // Merge optimization blocks from all sources
  // Pass userToolbox to filter out Claude Code prompts if user doesn't use Claude
  const mergedPlan = mergePlans(plans, logger, state.userToolbox);

  // Also include time savings from A5 feature adoption tips in the executive summary
  // Feature tips represent real optimization opportunities even though they're not "blocks"
  const featureAdoptionSavings = (state.featureAdoptionTips || [])
    .reduce((sum, tip) => sum + (tip.estimatedSavingsSeconds || 0), 0);

  if (featureAdoptionSavings > 0 && mergedPlan.totalTimeSaved === 0) {
    logger.info('Orchestrator: Adding feature adoption savings to total', {
      featureAdoptionSavings,
    });
    mergedPlan.totalTimeSaved = featureAdoptionSavings;
  }

  // Apply quality thresholds
  const passesThreshold = checkQualityThreshold(mergedPlan, logger);
  mergedPlan.passesThreshold = passesThreshold;

  if (!passesThreshold) {
    mergedPlan.thresholdReason = 'Savings below minimum threshold (10 min or 40% relative)';
  }

  // Generate user query answer from aggregated context
  const answerStartTime = Date.now();
  const userQueryAnswer = await generateUserQueryAnswer(state, deps);
  const answerElapsedMs = Date.now() - answerStartTime;

  // Generate follow-up questions using LLM (similar to workflow analysis chat)
  const followUpStartTime = Date.now();
  const suggestedFollowUps = await generateFollowUpQuestions(state, userQueryAnswer, mergedPlan, deps);
  const followUpElapsedMs = Date.now() - followUpStartTime;

  // Build final result (now includes userQueryAnswer, suggestedFollowUps, and featureAdoptionTips)
  const featureAdoptionTips = state.featureAdoptionTips || [];
  const finalResult = buildFinalResult(state, mergedPlan, userQueryAnswer, suggestedFollowUps, featureAdoptionTips, deps);

  logger.info('Orchestrator: Finalization complete', {
    totalTimeSaved: mergedPlan.totalTimeSaved,
    passesThreshold,
    blockCount: mergedPlan.blocks.length,
    featureAdoptionTipCount: featureAdoptionTips.length,
    elapsedMs: Date.now() - finalizeStartTime,
    answerGenerationMs: answerElapsedMs,
    followUpGenerationMs: followUpElapsedMs,
  });

  // Log detailed merged plan output (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== ORCHESTRATOR OUTPUT (Merged Optimization Plan) ===');
    logger.debug(JSON.stringify({
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
    }));
    logger.debug('=== END ORCHESTRATOR MERGED PLAN OUTPUT ===');

    // Log final result
    logger.debug('=== ORCHESTRATOR OUTPUT (Final Result) ===');
    logger.debug(JSON.stringify({
      agent: 'ORCHESTRATOR',
      outputType: 'finalResult',
      result: {
        queryId: finalResult.queryId,
        query: finalResult.query,
        userId: finalResult.userId,
        userQueryAnswerLength: finalResult.userQueryAnswer?.length || 0,
        executiveSummary: finalResult.executiveSummary,
        suggestedFollowUps: finalResult.suggestedFollowUps,
        createdAt: finalResult.createdAt,
        completedAt: finalResult.completedAt,
      },
    }));
    logger.debug('=== END ORCHESTRATOR FINAL RESULT OUTPUT ===');
  }

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

  // Conversation memory from previous interactions (HIGHEST PRIORITY for follow-ups)
  // This enables the assistant to answer follow-up questions with context
  if (state.conversationMemory && state.conversationMemory.memories.length > 0) {
    sections.push(state.conversationMemory.formattedContext);
  }

  // User-attached sessions (HIGHEST PRIORITY - user explicitly selected these for analysis)
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

  // User persona context (high priority - sets the frame for all advice)
  if (state.activePersonaContext) {
    sections.push(`USER CONTEXT AND PERSONAS (internal context only - do not expose in responses):\n${state.activePersonaContext}`);
  } else if (state.userPersonas && state.userPersonas.length > 0) {
    const personaSummary = state.userPersonas
      .map(p => `- ${p.displayName} (${p.type})`)
      .join('\n');
    sections.push(`USER'S ACTIVE ROLES (internal context only - do not mention in responses):\n${personaSummary}`);
  }

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
  // Now includes step-level details for richer context
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

        // Include step details for granular context (similar to attached sessions)
        // Shows step name as title and step summary if available
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

  // ============================================================================
  // SOURCE-LABELED CONTEXT SECTIONS (for structured response generation)
  // ============================================================================

  // A2: Identified inefficiencies from workflow analysis (PRIORITY - show first)
  if (state.userDiagnostics?.inefficiencies && state.userDiagnostics.inefficiencies.length > 0) {
    const ineffSummary = state.userDiagnostics.inefficiencies
      .slice(0, 5) // Show more for better context
      .map(i => {
        const wastedTime = i.estimatedWastedSeconds ? ` (~${Math.round(i.estimatedWastedSeconds / 60)}min wasted)` : '';
        return `- **${i.type}**: ${i.description}${wastedTime}`;
      })
      .join('\n');
    sections.push(`DETECTED INEFFICIENCIES [Source: A2 - Your Workflow Analysis]:\nThese patterns were identified in YOUR captured sessions:\n${ineffSummary}`);
  }

  // Repetitive workflow patterns detected across sessions (e.g., "research → summarize → email" 10x/week)
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
    sections.push(`REPETITIVE PATTERNS [Source: A1 - Session Analysis]:\nThese recurring patterns represent automation opportunities:\n${patternSummary}`);
  }

  // A2: Opportunities identified from workflow analysis
  if (state.userDiagnostics?.opportunities && state.userDiagnostics.opportunities.length > 0) {
    const oppSummary = state.userDiagnostics.opportunities
      .slice(0, 5)
      .map(o => {
        const tool = o.suggestedTool ? ` → Use ${o.suggestedTool}` : '';
        const shortcut = o.shortcutCommand ? ` (${o.shortcutCommand})` : '';
        const feature = o.featureSuggestion ? ` - ${o.featureSuggestion}` : '';
        return `- **${o.type}**: ${o.description}${tool}${shortcut}${feature}`;
      })
      .join('\n');
    sections.push(`IMPROVEMENT OPPORTUNITIES [Source: A2 - Your Workflow Analysis]:\n${oppSummary}`);
  }

  // A5: Feature Adoption Tips (suggestions for user's existing tools)
  if (state.featureAdoptionTips && state.featureAdoptionTips.length > 0) {
    const tipsSummary = state.featureAdoptionTips
      .map(t => `- **${t.toolName} - ${t.featureName}** (${t.triggerOrShortcut}): ${t.message}`)
      .join('\n');
    sections.push(`TOOL FEATURE RECOMMENDATIONS [Source: A5 - Feature Adoption]:\nFeatures in tools you already use:\n${tipsSummary}`);
  }

  // A3: Peer comparison insights
  if (state.peerOptimizationPlan?.blocks && state.peerOptimizationPlan.blocks.length > 0) {
    const peerInsights = state.peerOptimizationPlan.blocks
      .map(b => {
        const savedTime = b.timeSaved ? ` (saves ~${Math.round(b.timeSaved / 60)}min)` : '';
        return `- ${b.whyThisMatters}${savedTime} (${Math.round(b.relativeImprovement)}% improvement)`;
      })
      .join('\n');
    sections.push(`PEER WORKFLOW INSIGHTS [Source: A3 - Similar Users]:\nHow others with similar workflows optimized:\n${peerInsights}`);
  }

  // A4-Company: Internal documentation insights
  if (state.companyOptimizationPlan?.blocks && state.companyOptimizationPlan.blocks.length > 0) {
    const companyInsights = state.companyOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => `${c.title}${c.pageNumber ? ` (p.${c.pageNumber})` : ''}`).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [Doc: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`INTERNAL DOCUMENTATION [Source: A4-Doc - Company Docs]:\nRelevant practices from your organization:\n${companyInsights}`);
  }

  // A4-Web: External best practices (LOWER PRIORITY - supplementary)
  if (state.webOptimizationPlan?.blocks && state.webOptimizationPlan.blocks.length > 0) {
    const webInsights = state.webOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => c.url || c.title).filter(Boolean).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [URL: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`EXTERNAL BEST PRACTICES [Source: A4-Web - Industry Knowledge]:\nSupplementary recommendations from web research:\n${webInsights}`);
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
    let content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Post-process content to replace citation markers with markdown links
    // Perplexity uses [1], [2], etc. as inline citations
    if (citations.length > 0) {
      // Replace numbered citations [1], [2], etc. with markdown links
      content = content.replace(/\[(\d+)\]/g, (match, num) => {
        const index = parseInt(num, 10) - 1; // Citations are 1-indexed
        if (index >= 0 && index < citations.length) {
          const url = citations[index];
          try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.replace('www.', '');
            const title = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
            return `[${title}](${url})`;
          } catch {
            return `[Source](${url})`;
          }
        }
        return match;
      });

      // Also replace text-based citations like [Memgraph], [Neo4j], etc.
      // Match them to citations by domain name
      content = content.replace(/\[([A-Za-z][A-Za-z0-9-_]*)\]/g, (match, text) => {
        // Skip if it looks like a markdown link already (has URL after)
        const lowerText = text.toLowerCase();
        // Find a citation URL that contains this text in the domain
        const matchingUrl = citations.find(url => {
          try {
            const domain = new URL(url).hostname.toLowerCase();
            return domain.includes(lowerText);
          } catch {
            return false;
          }
        });
        if (matchingUrl) {
          return `[${text}](${matchingUrl})`;
        }
        return match;
      });
    }

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

  // OPTIMIZATION P2: Use cached web search result from parallel execution
  // This avoids a redundant Perplexity API call during finalization
  let webSearchResult = state.cachedWebSearchResult;
  if (!webSearchResult && perplexityApiKey) {
    // Fallback: If cache miss (shouldn't happen), do the search
    logger.warn('Orchestrator: Cache miss for web search, fetching now');
    webSearchResult = await searchWebForQuery(state.query, perplexityApiKey, logger);
  } else if (webSearchResult) {
    logger.info('Orchestrator: Using cached web search result', {
      contentLength: webSearchResult.content.length,
      citationCount: webSearchResult.citations.length,
    });
  }

  // Build web search context section
  let webSearchContext = '';
  if (webSearchResult && webSearchResult.content) {
    // Format citations as markdown links with domain as title
    const formattedCitations = webSearchResult.citations.map(url => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        // Create a readable title from the domain
        const title = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        return `- [${title}](${url})`;
      } catch {
        return `- ${url}`;
      }
    }).join('\n');

    webSearchContext = `

WEB SEARCH RESULTS (about "${state.query}"):
${webSearchResult.content}

${webSearchResult.citations.length > 0 ? `AVAILABLE SOURCES (use these exact markdown links in your response):\n${formattedCitations}` : ''}`;

    logger.info('Orchestrator: Including web search results in answer context', {
      contentLength: webSearchResult.content.length,
      citations: webSearchResult.citations.length,
    });
  }

  // Build persona-aware instructions
  const personaInstructions = state.userPersonas && state.userPersonas.length > 0
    ? `- Consider user's roles: ${state.userPersonas.map(p => p.displayName).join(', ')} (do not mention specific company/track names in response)`
    : '';

  // Build session references for citations
  const sessionReferences = state.userEvidence?.sessions?.slice(0, 5).map((s, i) => {
    const summary = s.highLevelSummary || s.startActivity || 'Work Session';
    const date = s.startTime ? new Date(s.startTime).toLocaleDateString() : '';
    return `- Session ${i + 1}: "${summary.substring(0, 80)}${summary.length > 80 ? '...' : ''}"${date ? ` (${date})` : ''}`;
  }).join('\n') || 'No sessions found';

  // Check if this is a follow-up question (has conversation memory)
  const isFollowUp = state.conversationMemory && state.conversationMemory.memories.length > 0;
  const followUpInstructions = isFollowUp
    ? `\n\nIMPORTANT: This appears to be a follow-up question. You have context from previous conversations with this user. Use that context to provide a more personalized and relevant answer. Reference previous discussions when applicable.`
    : '';

  // Determine if web search was actually used (for conditional source citation)
  const hasWebSearchContent = !!(webSearchResult && webSearchResult.content && webSearchResult.citations.length > 0);

  // Build conditional citation instructions
  const citationInstructions = hasWebSearchContent
    ? `4. **Cite web sources as markdown links** - Format as [Title](URL) when referencing external information`
    : `4. **No external sources needed** - Focus on user's workflow data and tool features`;

  // Build conditional sources section
  const sourcesSection = hasWebSearchContent
    ? `### Sources
- Include web sources ONLY if you actually referenced them in your response
- [Source Title](URL) - Brief description of what info came from this source`
    : ''; // No sources section if web search wasn't used

  // Build the prompt for answer generation
  const prompt = `You are a helpful workflow assistant. Answer the user's question clearly and actionably.${followUpInstructions}

USER'S QUESTION: "${state.query}"

CONTEXT FROM YOUR WORKFLOW ANALYSIS:
${aggregatedContext}${webSearchContext}

RESPONSE FORMAT REQUIREMENTS:
1. **Start with a direct answer** - One sentence that directly answers their question
2. **Use bullet points** - Structure all explanations as bullet lists for clarity
3. **Step-by-step when applicable** - If explaining how to do something, use numbered steps
${citationInstructions}
5. **Reference user's sessions** - When relevant, cite their own workflow patterns like "Based on your session where you were [activity]..."
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
[Use EXTERNAL BEST PRACTICES section - include source URLs]

### Step-by-Step Implementation
Provide 3-5 numbered, actionable steps with specific commands/shortcuts:
1. [Most impactful action with exact command]
2. [Second action]
3. [Third action]

### Next Steps
- 2-3 immediate actions they can take today
${sourcesSection}

USER'S SESSIONS (reference these throughout):
${sessionReferences}

CRITICAL REQUIREMENTS:
1. **BE DETAILED**: Write 4-6 paragraphs minimum. Don't be brief - users want thorough analysis.
2. **QUANTIFY EVERYTHING**: Include time estimates (minutes saved, % improvement)
3. **SPECIFIC SHORTCUTS**: Always include exact keyboard shortcuts (e.g., "Cmd+Shift+C")
4. **REFERENCE THEIR DATA**: Quote their actual workflows, tools, and sessions from the context
5. **INCLUDE ALL SOURCE SECTIONS**: If a context section has data (PEER INSIGHTS, TOOL FEATURES, etc.), include that section in your response
${hasWebSearchContent ? '6. Include web source links formatted as [Title](URL)' : ''}

PRIVACY: Do NOT mention company name, job title, or role. Use "your work" or "your projects" instead.`;

  try {
    // Use the same model as A4-Web for consistency
    let answerLLMProvider = llmProvider;
    try {
      answerLLMProvider = createAgentLLMProvider('A4_WEB', modelConfig);
    } catch {
      logger.warn('Orchestrator: Using default LLM provider for answer generation');
    }

    logger.info('Orchestrator: Starting user query answer LLM call');
    const llmStartTime = Date.now();

    const response = await withTimeout(
      answerLLMProvider.generateText([
        { role: 'system', content: ANSWER_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]),
      LLM_TIMEOUT_MS,
      'User query answer generation timed out'
    );

    const answerText = response.content;

    logger.info('Orchestrator: User query answer generated', {
      answerLength: answerText.length,
      includedWebSearch: !!webSearchResult,
      durationMs: Date.now() - llmStartTime,
    });

    return answerText;
  } catch (error) {
    logger.error('Orchestrator: Failed to generate user query answer', error instanceof Error ? error : new Error(String(error)));
    return `I found some optimization opportunities for your workflows, but I couldn't generate a specific answer to your question. Please see the Strategy Proposals panel for detailed recommendations.`;
  }
}

/**
 * Generate contextually relevant follow-up questions using LLM
 * Similar to the approach in natural-language-query.service.ts
 */
async function generateFollowUpQuestions(
  state: InsightState,
  userQueryAnswer: string,
  mergedPlan: StepOptimizationPlan,
  deps: OrchestratorGraphDeps
): Promise<string[]> {
  const { logger, llmProvider, modelConfig } = deps;

  logger.info('Orchestrator: Generating follow-up questions');

  // Detect if this is a knowledge/technical question vs workflow analysis
  const hasWorkflowContext = mergedPlan.blocks.length > 0 ||
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

  logger.info('Orchestrator: Query type detected', { isKnowledgeQuery, hasWorkflowContext });

  // Build context from the analysis results
  const contextParts: string[] = [];

  // User's original query
  contextParts.push(`Original Query: "${state.query}"`);

  // Key findings from the analysis
  if (mergedPlan.blocks.length > 0) {
    contextParts.push('\nKey Optimizations Found:');
    mergedPlan.blocks.slice(0, 3).forEach((block, i) => {
      contextParts.push(`${i + 1}. ${block.whyThisMatters} (saves ${Math.round(block.timeSaved / 60)} min)`);
    });
  }

  // Inefficiencies detected
  const inefficiencies = state.userDiagnostics?.inefficiencies ?? [];
  if (inefficiencies.length > 0) {
    contextParts.push('\nInefficiencies Detected:');
    inefficiencies.slice(0, 3).forEach((ineff, i) => {
      contextParts.push(`${i + 1}. ${ineff.type}: ${ineff.description}`);
    });
  }

  // Tools the user works with
  const tools = state.userEvidence?.sessions
    ?.flatMap((s: { appsUsed?: string[] }) => s.appsUsed || [])
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .slice(0, 5);
  if (tools && tools.length > 0) {
    contextParts.push(`\nTools User Works With: ${tools.join(', ')}`);
  }

  // Persona context
  if (state.userPersonas && state.userPersonas.length > 0) {
    contextParts.push(`\nUser's Roles: ${state.userPersonas.map((p) => p.displayName).join(', ')}`);
  }

  const context = contextParts.join('\n');

  // Use different prompts based on query type - provide full context for quality follow-ups
  const answerSummary = userQueryAnswer.slice(0, 1500).replace(/\n+/g, ' ').trim();

  const prompt = isKnowledgeQuery
    ? `Generate 3 follow-up questions for this Q&A:

Q: "${state.query}"
A: ${answerSummary}

Rules: Be specific to the answer content. Under 80 chars each. No generic questions.
Output ONLY a JSON array: ["Q1", "Q2", "Q3"]`
    : `Generate 3 follow-up questions for this workflow analysis:

User asked: "${state.query}"
Context: ${context}
Answer: ${answerSummary}

Rules: Reference specific tools/workflows mentioned. Under 80 chars. Actionable.
Output ONLY a JSON array: ["Q1", "Q2", "Q3"]`;

  try {
    // Use the same model as A4-Web for consistency
    let followUpLLMProvider = llmProvider;
    try {
      followUpLLMProvider = createAgentLLMProvider('A4_WEB', modelConfig);
    } catch {
      logger.warn('Orchestrator: Using default LLM provider for follow-up generation');
    }

    logger.info('Orchestrator: Starting follow-up questions LLM call');
    const llmStartTime = Date.now();

    // Helper function to parse follow-up questions from LLM response
    const parseFollowUpsFromResponse = (responseText: string): string[] => {
      let parsed: string[] = [];

      // Strip markdown code fences if present
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/^```\s*/i, '')
        .trim();

      // Try to find a complete JSON array using greedy match
      const completeArrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (completeArrayMatch) {
        try {
          const arr = JSON.parse(completeArrayMatch[0]);
          if (Array.isArray(arr) && arr.length > 0) {
            parsed = arr.filter((q): q is string => typeof q === 'string' && q.length > 10);
          }
        } catch {
          // JSON parse failed, try repair
        }
      }

      // If complete parse failed, try to extract from partial/truncated response
      if (parsed.length === 0 && cleaned.includes('[')) {
        const partialJson = cleaned.substring(cleaned.indexOf('['));
        // Extract all complete quoted strings
        const stringMatches = partialJson.match(/"([^"]{10,80})"/g);
        if (stringMatches && stringMatches.length > 0) {
          parsed = stringMatches
            .map(s => s.replace(/^"|"$/g, '').trim())
            .filter(s => s.length >= 10 && s.length <= 100);
        }
      }

      return parsed;
    };

    // Try LLM call with retry for truncated responses
    const MAX_RETRIES = 2;
    const MIN_VALID_RESPONSE_LENGTH = 50; // Minimum chars for a valid response with 1+ question
    let followUps: string[] = [];
    let lastResponseText = '';
    let attemptCount = 0;

    for (let attempt = 0; attempt < MAX_RETRIES && followUps.length === 0; attempt++) {
      attemptCount = attempt + 1;
      // Increase maxTokens on retry to handle potential truncation
      const maxTokens = attempt === 0 ? 400 : 600;

      try {
        const response = await withTimeout(
          followUpLLMProvider.generateText([
            { role: 'system', content: `${FOLLOW_UP_QUESTIONS_SYSTEM_PROMPT}\n\nOUTPUT FORMAT: Return ONLY a valid JSON array with exactly 3 questions. No markdown, no explanation. Example: ["Question 1?", "Question 2?", "Question 3?"]` },
            { role: 'user', content: prompt }
          ], { temperature: 0.5, maxTokens }),
          LLM_TIMEOUT_MS,
          'Follow-up questions generation timed out'
        );

        lastResponseText = response.content.trim();

        logger.info('Orchestrator: LLM response for follow-ups', {
          attempt: attemptCount,
          responseLength: lastResponseText.length,
          responsePreview: lastResponseText.slice(0, 200),
          durationMs: Date.now() - llmStartTime,
        });

        // Check if response is too short (likely truncated)
        if (lastResponseText.length < MIN_VALID_RESPONSE_LENGTH) {
          logger.warn('Orchestrator: Response too short, likely truncated', {
            attempt: attemptCount,
            responseLength: lastResponseText.length,
            willRetry: attempt < MAX_RETRIES - 1,
          });
          if (attempt < MAX_RETRIES - 1) {
            continue; // Retry with higher maxTokens
          }
        }

        // Parse the response
        followUps = parseFollowUpsFromResponse(lastResponseText);

        if (followUps.length > 0) {
          logger.info('Orchestrator: Parsed follow-up questions', {
            attempt: attemptCount,
            followUps
          });
        }
      } catch (attemptError) {
        logger.warn('Orchestrator: Follow-up generation attempt failed', {
          attempt: attemptCount,
          error: String(attemptError),
        });
      }
    }

    // If we got some but not all, supplement with contextual fallbacks
    if (followUps.length > 0 && followUps.length < 3) {
      const fallbacks = generateFallbackFollowUps(state, mergedPlan, userQueryAnswer);
      while (followUps.length < 3 && fallbacks.length > 0) {
        const next = fallbacks.shift();
        if (next && !followUps.includes(next)) {
          followUps.push(next);
        }
      }
      logger.info('Orchestrator: Supplemented with fallback questions', {
        originalCount: followUps.length - (3 - fallbacks.length),
        finalCount: followUps.length
      });
    }

    // Final validation and cleanup
    followUps = followUps
      .filter((q): q is string => typeof q === 'string' && q.length >= 10)
      .map((q) => q.trim().replace(/\?+$/, '?')) // Normalize question marks
      .slice(0, 3);

    logger.info('Orchestrator: Follow-up questions generated', {
      count: followUps.length,
      questions: followUps,
      attempts: attemptCount,
    });

    // If we got valid follow-ups, return them
    if (followUps.length > 0) {
      return followUps;
    }

    // Fallback to contextual defaults if all parsing failed
    logger.info('Orchestrator: Using fallback follow-up questions');
    return generateFallbackFollowUps(state, mergedPlan, userQueryAnswer);
  } catch (error) {
    logger.warn('Orchestrator: Failed to generate follow-up questions', { error: String(error) });
    return generateFallbackFollowUps(state, mergedPlan, userQueryAnswer);
  }
}

/**
 * Generate fallback follow-up questions based on analysis context and answer content
 */
function generateFallbackFollowUps(
  state: InsightState,
  mergedPlan: StepOptimizationPlan,
  userQueryAnswer: string
): string[] {
  // Check if this is a knowledge query (no workflow optimization context)
  const hasWorkflowContext = mergedPlan.blocks.length > 0 ||
    (state.userDiagnostics?.inefficiencies?.length ?? 0) > 0 ||
    (state.userDiagnostics?.opportunities?.length ?? 0) > 0;

  // Extract key terms from the answer for smarter fallbacks
  const answerLower = userQueryAnswer.toLowerCase();

  // For knowledge/technical questions, generate answer-aware follow-ups
  if (!hasWorkflowContext) {
    const followUps: string[] = [];

    // Check for common technical patterns in the answer
    if (answerLower.includes('sdk') || answerLower.includes('api') || answerLower.includes('library')) {
      followUps.push('How do I get started with this SDK/API?');
    }
    if (answerLower.includes('install') || answerLower.includes('setup') || answerLower.includes('configure')) {
      followUps.push('What are the configuration options?');
    }
    if (answerLower.includes('python') || answerLower.includes('javascript') || answerLower.includes('typescript')) {
      followUps.push('Can you show me more code examples?');
    }
    if (answerLower.includes('database') || answerLower.includes('query') || answerLower.includes('data')) {
      followUps.push('How do I optimize these queries?');
    }
    if (answerLower.includes('automat') || answerLower.includes('script') || answerLower.includes('poll')) {
      followUps.push('How do I set up alerts for failures?');
    }

    // Fill with general technical follow-ups if needed
    const generalTechFollowUps = [
      'What are the trade-offs of this approach?',
      'How would I integrate this into my workflow?',
      'What are common issues to watch out for?',
    ];

    while (followUps.length < 3 && generalTechFollowUps.length > 0) {
      const next = generalTechFollowUps.shift();
      if (next && !followUps.includes(next)) {
        followUps.push(next);
      }
    }

    return followUps.slice(0, 3);
  }

  // For workflow analysis, generate context-aware follow-ups
  const followUps: string[] = [];

  // Check if the answer mentions specific automation opportunities
  if (answerLower.includes('automat') || answerLower.includes('script') || answerLower.includes('claude code')) {
    followUps.push('Help me set up this automation');
  }

  // Add context-specific follow-ups based on what was analyzed
  if (mergedPlan.blocks.length > 0) {
    if (followUps.length === 0) {
      followUps.push('Walk me through implementing the first optimization');
    }
    followUps.push('Which optimization should I prioritize?');
  }

  const inefficienciesCount = state.userDiagnostics?.inefficiencies?.length ?? 0;
  if (inefficienciesCount > 0 && followUps.length < 3) {
    followUps.push('What causes these inefficiencies?');
  }

  // Add general follow-ups if we need more
  const generalFollowUps = [
    'Compare my workflow to best practices',
    'What tools could help with this?',
    'How do I measure improvement?',
  ];

  while (followUps.length < 3) {
    const nextFollowUp = generalFollowUps.shift();
    if (nextFollowUp && !followUps.includes(nextFollowUp)) {
      followUps.push(nextFollowUp);
    } else {
      break;
    }
  }

  return followUps.slice(0, 3);
}

/**
 * Create a placeholder optimization plan (to be replaced by actual agent implementations)
 * FIX: Now populates currentSteps from actual workflow data instead of empty array
 */
function createPlaceholderOptimizationPlan(
  source: 'peer_comparison' | 'web_best_practice' | 'company_docs',
  state: InsightState
): StepOptimizationPlan {
  // Use opportunities from diagnostics to create optimization blocks
  const opportunities = state.userDiagnostics?.opportunities || [];

  // FIX: Build step lookup across ALL workflows, not just the first one
  // This allows stepIds from any workflow to be matched correctly
  const allWorkflows = state.userEvidence?.workflows || [];
  const stepById = new Map<string, any>();
  const workflowByStepId = new Map<string, any>(); // Track which workflow each step belongs to

  for (const workflow of allWorkflows) {
    const steps = workflow?.steps || [];
    for (const step of steps) {
      if (step.stepId && !stepById.has(step.stepId)) {
        stepById.set(step.stepId, step);
        workflowByStepId.set(step.stepId, workflow);
      }
    }
  }

  // Get primary workflow for metadata (no fallback - removed per user request)
  const primaryWorkflow = allWorkflows[0];

  // Build inefficiency lookup to get stepIds from opportunities
  const inefficiencies = state.userDiagnostics?.inefficiencies || [];
  const inefficiencyById = new Map(inefficiencies.map((i: any) => [i.id, i]));

  const blocks = opportunities.slice(0, 3).map((opp, index) => {
    // Get stepIds from the linked inefficiency - NO FALLBACK per user request
    const linkedInefficiency = inefficiencyById.get(opp.inefficiencyId);
    const currentStepIds = (linkedInefficiency?.stepIds || []).filter((id: string) => stepById.has(id));

    // Build currentSteps array with actual step data (no fallback)
    const currentSteps = currentStepIds.map((stepId: string) => {
      const step = stepById.get(stepId);
      return {
        stepId,
        tool: step?.app || step?.tool || 'Current Tool',
        durationSeconds: step?.durationSeconds || 60,
        description: step?.description || 'Current workflow step',
      };
    });

    // Check if user has actual steps - if not, this is a new workflow suggestion
    const isNewWorkflowSuggestion = currentSteps.length === 0;

    // Calculate actual current time from steps
    // NOTE: If no current steps, we still need a baseline time for the recommendation
    const currentTimeTotal = currentSteps.reduce((sum: number, s: { durationSeconds: number }) => sum + s.durationSeconds, 0) || opp.estimatedSavingsSeconds * 2;
    // FIX: Cap time saved to not exceed current time, ensure optimized time has meaningful floor
    const cappedTimeSaved = Math.min(opp.estimatedSavingsSeconds, Math.round(currentTimeTotal * 0.9));
    const optimizedTimeTotal = Math.max(
      currentTimeTotal - cappedTimeSaved,
      Math.round(currentTimeTotal * 0.1),  // At least 10% of original time
      30  // Or at least 30 seconds minimum
    );

    return {
      blockId: `block-${source}-${index}`,
      workflowName: primaryWorkflow?.title || state.userDiagnostics?.workflowName || 'Workflow',
      workflowId: primaryWorkflow?.workflowId || state.userDiagnostics?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved: cappedTimeSaved,
      // FIX: Cap relative improvement at 99% (can't save more than total time)
      relativeImprovement: currentTimeTotal > 0 ? Math.min((cappedTimeSaved / currentTimeTotal) * 100, 99) : 50,
      confidence: opp.confidence,
      title: opp.suggestedTool ? `Optimize with ${opp.suggestedTool}` : `${opp.type} Optimization`,
      whyThisMatters: opp.description,
      metricDeltas: {
        contextSwitchesReduction: opp.type === 'consolidation' ? 2 : 0,
        reworkLoopsReduction: opp.type === 'automation' ? 1 : 0,
      },
      stepTransformations: [
        {
          transformationId: `trans-${index}`,
          currentSteps, // FIX: Now populated with actual step data
          optimizedSteps: [
            {
              stepId: `opt-step-${index}`,
              tool: opp.suggestedTool || (opp.claudeCodeApplicable ? 'Claude Code' : 'Optimized Tool'),
              estimatedDurationSeconds: optimizedTimeTotal,
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
      // Flag to indicate this is a NEW workflow suggestion (user has no current steps)
      isNewWorkflowSuggestion,
    };
  });

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
 * FIX-11.1: Generate step-specific descriptions based on inefficiency type
 * Instead of using a generic fallback like 'Current workflow step' for all steps,
 * this creates unique, contextual descriptions for each step position.
 */
function generateStepSpecificDescriptions(
  ineffType: string,
  stepCount: number
): string[] {
  // Type-specific step descriptions that explain what's happening at each step
  const typeDescriptions: Record<string, string[]> = {
    'manual_automation': [
      'Manually initiating the repetitive process',
      'Performing data entry or transfer by hand',
      'Verifying and completing the manual operation',
    ],
    'context_switching': [
      'Switching from primary tool to secondary application',
      'Locating and retrieving relevant information',
      'Returning to original context and resuming work',
    ],
    'rework_loop': [
      'Completing initial work that may need revision',
      'Reviewing and identifying issues requiring changes',
      'Implementing corrections and re-verifying results',
    ],
    'repetitive_search': [
      'Initiating search for frequently needed information',
      'Navigating through search results',
      'Extracting and using the found information',
    ],
    'tool_fragmentation': [
      'Opening and switching to required tool',
      'Performing task in fragmented tool environment',
      'Transferring results between disconnected tools',
    ],
    'idle_time': [
      'Waiting for process to complete',
      'Monitoring progress during idle period',
      'Resuming work after wait completes',
    ],
    'information_gathering': [
      'Starting research across multiple sources',
      'Collecting and comparing information',
      'Synthesizing findings into usable format',
    ],
    'longcut_path': [
      'Taking indirect route to accomplish task',
      'Navigating through unnecessary intermediate steps',
      'Finally reaching the intended destination',
    ],
  };

  const descriptions = typeDescriptions[ineffType] || [];

  // Generate descriptions for the requested number of steps
  return Array.from({ length: stepCount }, (_, idx) => {
    if (descriptions[idx]) {
      return descriptions[idx];
    }
    // Fallback with unique identifier for any additional steps
    return `Workflow step ${idx + 1}: ${ineffType.replace(/_/g, ' ')} activity`;
  });
}

/**
 * FIX-4: Create heuristic optimization blocks from A2 inefficiencies when A3 is skipped
 * (i.e., no peer data available). Uses best-practice patterns based on inefficiency type
 * to generate actionable optimization suggestions.
 */
function createHeuristicOptimizationPlan(
  state: InsightState,
  logger: Logger
): StepOptimizationPlan {
  const inefficiencies = state.userDiagnostics?.inefficiencies || [];

  if (inefficiencies.length === 0) {
    return { blocks: [], totalTimeSaved: 0, totalRelativeImprovement: 0, passesThreshold: false };
  }

  // FIX: Build step lookup across ALL workflows, not just the first one
  // This allows stepIds from any workflow to be matched correctly
  const allWorkflows = state.userEvidence?.workflows || [];
  const stepById = new Map<string, any>();

  for (const workflow of allWorkflows) {
    const steps = workflow?.steps || [];
    for (const step of steps) {
      if (step.stepId && !stepById.has(step.stepId)) {
        stepById.set(step.stepId, step);
      }
    }
  }

  // Get primary workflow for metadata
  const primaryWorkflow = allWorkflows[0];

  logger.debug('[createHeuristicOptimizationPlan] Step lookup built', {
    totalWorkflows: allWorkflows.length,
    totalStepsAcrossAllWorkflows: stepById.size,
    inefficiencyStepIds: inefficiencies.map((i: any) => ({
      id: i.id,
      type: i.type,
      stepIds: i.stepIds?.slice?.(0, 3) ?? [],
    })),
  });

  // Heuristic optimizations based on inefficiency type (using valid InefficiencyType values)
  const heuristicOptimizations: Record<string, {
    suggestedTool: string;
    rationale: string;
    automatable: boolean;
    savingsMultiplier: number;
  }> = {
    'context_switching': {
      suggestedTool: 'Integrated IDE with extensions',
      rationale: 'Reduce context switches by consolidating tools in a single environment',
      automatable: false,
      savingsMultiplier: 0.3,
    },
    'rework_loop': {
      suggestedTool: 'Version control or review tools',
      rationale: 'Reduce rework by catching issues earlier with better review processes',
      automatable: false,
      savingsMultiplier: 0.5,
    },
    'manual_automation': {
      suggestedTool: 'Script or Claude Code automation',
      rationale: 'Automate repetitive manual tasks with scripts or AI assistance',
      automatable: true,
      savingsMultiplier: 0.7,
    },
    'tool_fragmentation': {
      suggestedTool: 'Consolidated workflow tool',
      rationale: 'Replace fragmented tools with an integrated solution',
      automatable: false,
      savingsMultiplier: 0.4,
    },
    'repetitive_search': {
      suggestedTool: 'Knowledge management system',
      rationale: 'Cache frequently searched information for quick access',
      automatable: false,
      savingsMultiplier: 0.35,
    },
    'idle_time': {
      suggestedTool: 'Notification or automation triggers',
      rationale: 'Reduce wait time with automated triggers and notifications',
      automatable: true,
      savingsMultiplier: 0.4,
    },
    'longcut_path': {
      suggestedTool: 'Direct workflow shortcuts',
      rationale: 'Replace indirect paths with more efficient direct approaches',
      automatable: false,
      savingsMultiplier: 0.45,
    },
  };

  const defaultHeuristic = {
    suggestedTool: 'Workflow optimization',
    rationale: 'Optimize this workflow step based on best practices',
    automatable: false,
    savingsMultiplier: 0.25,
  };

  // Helper to format duration for display
  const formatDurationDisplay = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Helper to format time range for summary metrics
  const formatTimeRange = (seconds: number): string => {
    const mins = Math.round(seconds / 60);
    if (mins < 1) return `${Math.round(seconds)} seconds`;
    if (mins === 1) return '1 minute';
    if (mins < 60) {
      // Give a range like "5-7 minutes"
      const lower = Math.max(1, mins - 1);
      const upper = mins + 1;
      return `${lower}-${upper} minutes`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hours`;
  };

  // Generate sub-actions based on inefficiency type
  const generateSubActions = (ineffType: string, step: any, idx: number): string[] => {
    const typeSubActions: Record<string, string[][]> = {
      'context_switching': [
        ['Open application or browser tab', 'Navigate to required section', 'Locate relevant information'],
        ['Switch to another tool', 'Transfer context mentally', 'Resume task in new environment'],
        ['Return to original application', 'Re-orient to previous context', 'Continue interrupted work'],
      ],
      'rework_loop': [
        ['Create initial version of work', 'Submit for review or testing', 'Receive feedback on issues'],
        ['Analyze feedback and identify problems', 'Plan corrections needed', 'Make required changes'],
        ['Re-submit corrected work', 'Verify fixes are complete', 'Document lessons learned'],
      ],
      'manual_automation': [
        ['Manually initiate repetitive task', 'Enter data or commands by hand', 'Wait for manual process to complete'],
        ['Verify manual work output', 'Check for errors or inconsistencies', 'Correct any mistakes found'],
        ['Document completion status', 'Prepare for next iteration', 'Reset for next manual cycle'],
      ],
      'tool_fragmentation': [
        ['Open required tool for this step', 'Configure tool settings', 'Perform task in isolated environment'],
        ['Export or copy results', 'Navigate to next tool', 'Import or paste data'],
        ['Reconcile differences between tools', 'Manage multiple tool states', 'Synchronize changes manually'],
      ],
      'repetitive_search': [
        ['Formulate search query', 'Execute search across sources', 'Review search results'],
        ['Filter and evaluate findings', 'Extract relevant information', 'Note useful resources'],
        ['Repeat search with refined terms', 'Compare results across searches', 'Consolidate findings'],
      ],
      'idle_time': [
        ['Initiate process or request', 'Wait for external response', 'Monitor progress periodically'],
        ['Check status of pending item', 'Attempt to expedite if possible', 'Continue waiting if needed'],
        ['Receive completion notification', 'Verify results are ready', 'Resume dependent work'],
      ],
      'longcut_path': [
        ['Start with indirect approach', 'Navigate through intermediate steps', 'Progress toward eventual goal'],
        ['Realize more direct path exists', 'Evaluate switching strategies', 'Continue current path or redirect'],
        ['Complete circuitous route', 'Reach final destination', 'Reflect on time spent'],
      ],
    };

    const subActionsForType = typeSubActions[ineffType] || [
      ['Begin workflow step', 'Execute main action', 'Complete step tasks'],
    ];

    // Get sub-actions for this step index (cycle through if more steps than defined)
    const subActionSet = subActionsForType[idx % subActionsForType.length];

    // If we have actual step data, customize the first sub-action
    if (step?.description) {
      return [step.description, ...subActionSet.slice(1)];
    }

    return subActionSet;
  };

  // Generate implementation options based on inefficiency type
  const generateImplementationOptions = (ineffType: string, heuristic: any): ImplementationOption[] => {
    const optionsByType: Record<string, ImplementationOption[]> = {
      'context_switching': [
        {
          id: `impl-ide-${uuidv4().slice(0, 8)}`,
          name: 'IDE Extensions',
          command: 'Install relevant extensions in VS Code/Cursor',
          setupTime: '15-30 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: true,
        },
        {
          id: `impl-workspace-${uuidv4().slice(0, 8)}`,
          name: 'Workspace Configuration',
          command: 'Create .code-workspace file with multi-root setup',
          setupTime: '30 min',
          setupComplexity: 'medium',
          recommendation: 'Best for teams',
          isRecommended: false,
        },
      ],
      'rework_loop': [
        {
          id: `impl-precommit-${uuidv4().slice(0, 8)}`,
          name: 'Pre-commit Hooks',
          command: 'npx husky init && npm install lint-staged',
          setupTime: '20 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: true,
        },
        {
          id: `impl-ci-${uuidv4().slice(0, 8)}`,
          name: 'CI/CD Pipeline',
          command: 'Create .github/workflows/ci.yml',
          setupTime: '1-2 hours',
          setupComplexity: 'medium',
          recommendation: 'Best for production',
          isRecommended: false,
        },
      ],
      'manual_automation': [
        {
          id: `impl-script-${uuidv4().slice(0, 8)}`,
          name: 'Shell Script',
          command: './automate.sh',
          setupTime: '15 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: false,
        },
        {
          id: `impl-npm-${uuidv4().slice(0, 8)}`,
          name: 'NPM Script',
          command: 'npm run automate',
          setupTime: '30 min',
          setupComplexity: 'low',
          recommendation: 'Best balance',
          isRecommended: true,
        },
        {
          id: `impl-claude-${uuidv4().slice(0, 8)}`,
          name: 'Claude Code Automation',
          command: 'Ask Claude to automate this workflow',
          setupTime: '5 min',
          setupComplexity: 'low',
          recommendation: 'Fastest setup',
          isRecommended: false,
        },
      ],
      'tool_fragmentation': [
        {
          id: `impl-unified-${uuidv4().slice(0, 8)}`,
          name: 'Unified Platform',
          command: 'Migrate to integrated tool (e.g., Notion, Linear)',
          setupTime: '2-4 hours',
          setupComplexity: 'medium',
          recommendation: 'Best long-term',
          isRecommended: true,
        },
        {
          id: `impl-integration-${uuidv4().slice(0, 8)}`,
          name: 'Tool Integration',
          command: 'Set up Zapier/Make automation between tools',
          setupTime: '1-2 hours',
          setupComplexity: 'medium',
          recommendation: 'Quick integration',
          isRecommended: false,
        },
      ],
      'repetitive_search': [
        {
          id: `impl-bookmark-${uuidv4().slice(0, 8)}`,
          name: 'Bookmark Organization',
          command: 'Create organized bookmark folders',
          setupTime: '15 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: false,
        },
        {
          id: `impl-kb-${uuidv4().slice(0, 8)}`,
          name: 'Knowledge Base',
          command: 'Set up personal wiki (Obsidian, Notion)',
          setupTime: '1-2 hours',
          setupComplexity: 'medium',
          recommendation: 'Best long-term',
          isRecommended: true,
        },
      ],
      'idle_time': [
        {
          id: `impl-notify-${uuidv4().slice(0, 8)}`,
          name: 'Notification Setup',
          command: 'Configure webhook notifications',
          setupTime: '15 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: true,
        },
        {
          id: `impl-parallel-${uuidv4().slice(0, 8)}`,
          name: 'Parallel Processing',
          command: 'Set up async/parallel task execution',
          setupTime: '1 hour',
          setupComplexity: 'medium',
          recommendation: 'Advanced',
          isRecommended: false,
        },
      ],
      'longcut_path': [
        {
          id: `impl-shortcut-${uuidv4().slice(0, 8)}`,
          name: 'Keyboard Shortcuts',
          command: 'Learn and practice direct shortcuts',
          setupTime: '30 min',
          setupComplexity: 'low',
          recommendation: 'Quick start',
          isRecommended: true,
        },
        {
          id: `impl-alias-${uuidv4().slice(0, 8)}`,
          name: 'Command Aliases',
          command: 'Add aliases to ~/.bashrc or ~/.zshrc',
          setupTime: '15 min',
          setupComplexity: 'low',
          recommendation: 'For CLI users',
          isRecommended: false,
        },
      ],
    };

    return optionsByType[ineffType] || [
      {
        id: `impl-default-${uuidv4().slice(0, 8)}`,
        name: 'Workflow Optimization',
        command: `Apply ${heuristic.suggestedTool}`,
        setupTime: '30 min',
        setupComplexity: 'medium' as const,
        recommendation: 'Recommended',
        isRecommended: true,
      },
    ];
  };

  // Generate key benefits based on inefficiency type
  const generateKeyBenefits = (ineffType: string, savingsPercent: number): string[] => {
    const benefitsByType: Record<string, string[]> = {
      'context_switching': [
        `${Math.round(savingsPercent)}% reduction in context switch overhead`,
        'Maintain focus and flow state longer',
        'Reduce mental fatigue from task switching',
        'Faster completion of complex tasks',
      ],
      'rework_loop': [
        `${Math.round(savingsPercent)}% reduction in rework cycles`,
        'Catch issues earlier in the process',
        'Consistent quality across iterations',
        'Reduced frustration from repeated fixes',
      ],
      'manual_automation': [
        `${Math.round(savingsPercent)}% time saved through automation`,
        'Eliminate human error in repetitive tasks',
        'Consistent execution every time',
        'Free up time for higher-value work',
      ],
      'tool_fragmentation': [
        `${Math.round(savingsPercent)}% reduction in tool-switching overhead`,
        'Single source of truth for information',
        'Reduced data synchronization issues',
        'Streamlined workflow across tasks',
      ],
      'repetitive_search': [
        `${Math.round(savingsPercent)}% faster information retrieval`,
        'Instant access to frequently needed information',
        'Reduced cognitive load from re-searching',
        'Better knowledge retention over time',
      ],
      'idle_time': [
        `${Math.round(savingsPercent)}% reduction in waiting time`,
        'Automatic notifications when ready',
        'Better utilization of wait periods',
        'Reduced context loss during waits',
      ],
      'longcut_path': [
        `${Math.round(savingsPercent)}% faster task completion`,
        'Direct paths to common destinations',
        'Reduced navigation overhead',
        'More efficient daily workflows',
      ],
    };

    return benefitsByType[ineffType] || [
      `${Math.round(savingsPercent)}% improvement in workflow efficiency`,
      'Reduced time on repetitive tasks',
      'More consistent results',
      'Better overall productivity',
    ];
  };

  const blocks = inefficiencies.slice(0, 3).map((ineff, index) => {
    // Get heuristic for this inefficiency type
    const heuristic = heuristicOptimizations[ineff.type] || defaultHeuristic;

    // Get actual steps from inefficiency stepIds - NO FALLBACK per user request
    // If stepIds don't match, the currentSteps will be empty but that's intentional
    const currentStepIds = (ineff.stepIds || []).filter((id: string) => stepById.has(id));

    // FIX-11.1: Generate step-specific descriptions instead of using generic fallback
    const stepDescriptions = generateStepSpecificDescriptions(ineff.type, currentStepIds.length);

    // Build currentSteps array with actual step data and step-specific fallback descriptions
    const currentSteps = currentStepIds.map((stepId: string, idx: number) => {
      const step = stepById.get(stepId);
      return {
        stepId,
        // Use actual tool or derive from inefficiency type (not generic 'Current Tool')
        tool: step?.app || step?.tool || ineff.type?.replace(/_/g, ' ') || 'Workflow tool',
        durationSeconds: step?.durationSeconds || 60,
        // Use actual description, or step-specific fallback (NOT generic 'Current workflow step')
        description: step?.description || stepDescriptions[idx],
      };
    });

    // Calculate time estimates
    const currentTimeTotal = currentSteps.reduce((sum: number, s: { durationSeconds: number }) => sum + s.durationSeconds, 0) || 120;
    // FIX: Cap savings to not exceed 90% of current time, ensure optimized time has meaningful floor
    const rawSavings = Math.round(currentTimeTotal * heuristic.savingsMultiplier);
    const cappedSavings = Math.min(rawSavings, Math.round(currentTimeTotal * 0.9));
    const optimizedTimeTotal = Math.max(
      currentTimeTotal - cappedSavings,
      Math.round(currentTimeTotal * 0.1),  // At least 10% of original time
      30  // Or at least 30 seconds minimum
    );

    // Calculate savings percentage for benefits
    const savingsPercent = currentTimeTotal > 0 ? (cappedSavings / currentTimeTotal) * 100 : 25;

    // =========================================================================
    // GENERATE ENRICHED WORKFLOW DATA
    // =========================================================================

    // Generate currentWorkflowSteps with status and subActions
    const currentWorkflowSteps: EnrichedWorkflowStep[] = currentSteps.map((step, idx) => {
      const stepData = stepById.get(step.stepId);
      return {
        stepNumber: idx + 1,
        action: step.description,
        subActions: generateSubActions(ineff.type, stepData, idx),
        status: 'automate' as EnrichedStepStatus, // Heuristic blocks target automation
        tool: step.tool,
        durationSeconds: step.durationSeconds,
        durationDisplay: formatDurationDisplay(step.durationSeconds),
      };
    });

    // Generate recommendedWorkflowSteps - consolidated automated approach
    const recommendedWorkflowSteps: EnrichedWorkflowStep[] = [
      // Keep any steps that should remain manual (first step often needs human judgment)
      ...(currentWorkflowSteps.length > 0 ? [{
        stepNumber: 1,
        action: 'Review and Prepare',
        subActions: [
          'Review requirements and context',
          'Verify prerequisites are met',
          'Prepare inputs for automated process',
        ],
        status: 'keep' as EnrichedStepStatus,
        tool: currentWorkflowSteps[0]?.tool || 'Workflow tool',
        durationSeconds: Math.round(currentTimeTotal * 0.1),
        durationDisplay: formatDurationDisplay(Math.round(currentTimeTotal * 0.1)),
      }] : []),
      // Add the new automated step
      {
        stepNumber: currentWorkflowSteps.length > 0 ? 2 : 1,
        action: `Run ${heuristic.suggestedTool}`,
        subActions: [
          `Execute automated ${ineff.type.replace(/_/g, ' ')} optimization`,
          'Monitor progress and handle any prompts',
          'Verify completion status',
        ],
        status: 'new' as EnrichedStepStatus,
        tool: heuristic.suggestedTool,
        durationSeconds: Math.round(optimizedTimeTotal * 0.6),
        durationDisplay: formatDurationDisplay(Math.round(optimizedTimeTotal * 0.6)),
      },
      // Verification step
      {
        stepNumber: currentWorkflowSteps.length > 0 ? 3 : 2,
        action: 'Verify Results',
        subActions: [
          'Check output for correctness',
          'Validate against requirements',
          'Document completion if needed',
        ],
        status: 'keep' as EnrichedStepStatus,
        tool: 'Review',
        durationSeconds: Math.round(optimizedTimeTotal * 0.3),
        durationDisplay: formatDurationDisplay(Math.round(optimizedTimeTotal * 0.3)),
      },
    ];

    // Generate implementation options
    const implementationOptions = generateImplementationOptions(ineff.type, heuristic);

    // Generate key benefits
    const keyBenefits = generateKeyBenefits(ineff.type, savingsPercent);

    // Generate summary metrics
    const summaryMetrics: OptimizationSummaryMetrics = {
      currentTotalTime: formatTimeRange(currentTimeTotal),
      optimizedTotalTime: formatTimeRange(optimizedTimeTotal),
      timeReductionPercent: Math.round(savingsPercent),
      stepsAutomated: currentWorkflowSteps.filter(s => s.status === 'automate').length,
      stepsKept: recommendedWorkflowSteps.filter(s => s.status === 'keep').length,
    };

    logger.debug('Heuristic block created with enriched data', {
      inefficiencyType: ineff.type,
      stepCount: currentSteps.length,
      rawSavings,
      cappedSavings,
      heuristicTool: heuristic.suggestedTool,
      enrichedCurrentSteps: currentWorkflowSteps.length,
      enrichedRecommendedSteps: recommendedWorkflowSteps.length,
      implementationOptionsCount: implementationOptions.length,
    });

    return {
      blockId: `heuristic-${index}`,
      workflowName: primaryWorkflow?.title || state.userDiagnostics?.workflowName || 'Workflow',
      workflowId: primaryWorkflow?.workflowId || state.userDiagnostics?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved: cappedSavings,
      // FIX: Cap relative improvement at 99%
      relativeImprovement: currentTimeTotal > 0 ? Math.min((cappedSavings / currentTimeTotal) * 100, 99) : 25,
      confidence: 0.6, // Lower confidence for heuristic suggestions
      title: generateHeuristicTitle(ineff.type, heuristic.suggestedTool),
      whyThisMatters: ineff.description || `Optimize ${ineff.type.replace(/_/g, ' ')} pattern`,
      metricDeltas: {
        contextSwitchesReduction: ineff.type === 'context_switching' ? 2 : 0,
        reworkLoopsReduction: ineff.type === 'rework_loop' ? 1 : 0,
      },
      stepTransformations: [
        {
          transformationId: `trans-heuristic-${index}`,
          currentSteps,
          optimizedSteps: [
            {
              stepId: `opt-heuristic-${index}`,
              tool: heuristic.suggestedTool,
              estimatedDurationSeconds: optimizedTimeTotal,
              description: heuristic.rationale,
              claudeCodePrompt: heuristic.automatable
                ? `Automate: ${ineff.description || ineff.type}`
                : undefined,
              isNew: true,
              isInUserToolbox: false, // Heuristic suggestions may require new tools
            },
          ],
          timeSavedSeconds: cappedSavings,
          confidence: 0.6,
          rationale: heuristic.rationale,
        },
      ],
      source: 'heuristic' as any, // Mark as heuristic-generated
      // ENRICHED DATA for WorkflowTransformationView
      currentWorkflowSteps,
      recommendedWorkflowSteps,
      implementationOptions,
      keyBenefits,
      summaryMetrics,
      errorProneStepCount: currentWorkflowSteps.filter(s => s.status === 'automate').length,
    };
  });

  const totalTimeSaved = blocks.reduce((sum, b) => sum + b.timeSaved, 0);
  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  logger.info('Heuristic optimization plan created', {
    blockCount: blocks.length,
    totalTimeSaved,
    inefficiencyTypes: inefficiencies.slice(0, 3).map(i => i.type),
  });

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement: totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Will be set in merge step
  };
}

/**
 * Convert RepetitiveWorkflowPatterns into OptimizationBlocks with full enriched data.
 *
 * This creates visualization-ready blocks showing:
 * - Each step in the repetitive pattern with status badges
 * - Recommended consolidated/automated workflow
 * - Implementation options for automation
 * - Key benefits of optimization
 *
 * Example: "Research → Documentation → Email" pattern occurring 10x/week
 * gets transformed into a side-by-side comparison showing current manual steps
 * vs recommended automated approach.
 */
function convertRepetitivePatternsToOptimizationBlocks(
  patterns: RepetitiveWorkflowPattern[],
  state: InsightState,
  logger: Logger
): OptimizationBlock[] {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  // Helper to format duration for display
  const formatDurationDisplay = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Helper to format time range for summary metrics
  const formatTimeRange = (seconds: number): string => {
    const mins = Math.round(seconds / 60);
    if (mins < 1) return `${Math.round(seconds)} seconds`;
    if (mins === 1) return '~1 minute';
    if (mins < 60) {
      const lower = Math.max(1, mins - 2);
      const upper = mins + 2;
      return `${lower}-${upper} minutes`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours} hours`;
  };

  // Get primary workflow for additional context
  const primaryWorkflow = state.userEvidence?.workflows?.[0];

  return patterns.slice(0, 3).map((pattern, index) => {
    const sequenceStr = pattern.sequence.join(' → ');
    const savingsMultiplier = 0.4; // Conservative 40% savings estimate for patterns

    // Calculate time estimates
    const currentTimeTotal = pattern.avgDurationSeconds;
    const estimatedSavings = Math.round(currentTimeTotal * savingsMultiplier);
    const optimizedTimeTotal = Math.max(currentTimeTotal - estimatedSavings, 30);
    const savingsPercent = currentTimeTotal > 0 ? (estimatedSavings / currentTimeTotal) * 100 : 40;

    // Generate currentWorkflowSteps from the pattern sequence
    const avgStepDuration = Math.round(currentTimeTotal / pattern.sequence.length);
    const currentWorkflowSteps: EnrichedWorkflowStep[] = pattern.sequence.map((stepName, idx) => {
      // Determine if this step should be automated or kept
      const isManualReview = stepName.toLowerCase().includes('review') ||
                            stepName.toLowerCase().includes('approve') ||
                            stepName.toLowerCase().includes('decision');

      // Generate sub-actions based on step name
      const subActions = generatePatternStepSubActions(stepName, pattern.patternType);

      return {
        stepNumber: idx + 1,
        action: stepName,
        subActions,
        status: isManualReview ? 'keep' as EnrichedStepStatus : 'automate' as EnrichedStepStatus,
        tool: inferToolFromStepName(stepName),
        durationSeconds: avgStepDuration,
        durationDisplay: formatDurationDisplay(avgStepDuration),
      };
    });

    // Generate recommendedWorkflowSteps - consolidated automated approach
    const stepsToAutomate = currentWorkflowSteps.filter(s => s.status === 'automate').length;
    const stepsToKeep = currentWorkflowSteps.filter(s => s.status === 'keep').length;

    const recommendedWorkflowSteps: EnrichedWorkflowStep[] = [
      // Step 1: Trigger/Initiate
      {
        stepNumber: 1,
        action: 'Trigger Automated Workflow',
        subActions: [
          `Initiate the "${pattern.sequence[0]}" process`,
          'Provide any required inputs or parameters',
          'Confirm automation should proceed',
        ],
        status: 'new' as EnrichedStepStatus,
        tool: 'Automation Script',
        durationSeconds: Math.round(optimizedTimeTotal * 0.2),
        durationDisplay: formatDurationDisplay(Math.round(optimizedTimeTotal * 0.2)),
      },
      // Step 2: Automated Execution
      {
        stepNumber: 2,
        action: `Execute ${pattern.sequence.slice(0, -1).join(' → ')}`,
        subActions: [
          `Automatically handle ${stepsToAutomate} repetitive steps`,
          'Process data through integrated pipeline',
          'Generate intermediate outputs',
        ],
        status: 'new' as EnrichedStepStatus,
        tool: 'Automated Pipeline',
        durationSeconds: Math.round(optimizedTimeTotal * 0.4),
        durationDisplay: formatDurationDisplay(Math.round(optimizedTimeTotal * 0.4)),
      },
      // Step 3: Final step (often needs human judgment)
      {
        stepNumber: 3,
        action: `Complete ${pattern.sequence[pattern.sequence.length - 1]}`,
        subActions: [
          'Review automated outputs',
          'Make final adjustments if needed',
          'Confirm and complete the workflow',
        ],
        status: stepsToKeep > 0 ? 'keep' as EnrichedStepStatus : 'new' as EnrichedStepStatus,
        tool: inferToolFromStepName(pattern.sequence[pattern.sequence.length - 1]),
        durationSeconds: Math.round(optimizedTimeTotal * 0.4),
        durationDisplay: formatDurationDisplay(Math.round(optimizedTimeTotal * 0.4)),
      },
    ];

    // Generate implementation options based on pattern type
    const implementationOptions: ImplementationOption[] = [
      {
        id: `impl-template-${uuidv4().slice(0, 8)}`,
        name: 'Template + Checklist',
        command: 'Create reusable template with automated checklist',
        setupTime: '15 min',
        setupComplexity: 'low',
        recommendation: 'Quick start',
        isRecommended: false,
      },
      {
        id: `impl-script-${uuidv4().slice(0, 8)}`,
        name: 'Automation Script',
        command: pattern.patternType === 'workflow_sequence'
          ? `npm run workflow:${pattern.sequence[0].toLowerCase().replace(/\s+/g, '-')}`
          : `./automate-${pattern.sequence[0].toLowerCase().replace(/\s+/g, '-')}.sh`,
        setupTime: '30 min',
        setupComplexity: 'medium',
        recommendation: 'Best balance',
        isRecommended: true,
      },
      {
        id: `impl-claude-${uuidv4().slice(0, 8)}`,
        name: 'Claude Code Agent',
        command: `Ask Claude: "Automate my ${sequenceStr} workflow"`,
        setupTime: '5 min',
        setupComplexity: 'low',
        recommendation: 'Fastest setup',
        isRecommended: false,
      },
    ];

    // Generate key benefits
    const hoursSpent = Math.round(pattern.totalTimeSpentSeconds / 3600 * 10) / 10;
    const hoursSaved = Math.round(hoursSpent * savingsMultiplier * 10) / 10;
    const keyBenefits: string[] = [
      `Save ${Math.round(savingsPercent)}% time on this recurring workflow`,
      `Reduce ${hoursSpent}h spent to ~${(hoursSpent - hoursSaved).toFixed(1)}h`,
      `Eliminate repetitive manual steps (${stepsToAutomate} of ${pattern.sequence.length})`,
      `Consistent execution across ${pattern.occurrenceCount} weekly occurrences`,
      'Reduce cognitive load from remembering workflow steps',
    ];

    // Generate summary metrics
    const summaryMetrics: OptimizationSummaryMetrics = {
      currentTotalTime: formatTimeRange(currentTimeTotal),
      optimizedTotalTime: formatTimeRange(optimizedTimeTotal),
      timeReductionPercent: Math.round(savingsPercent),
      stepsAutomated: stepsToAutomate,
      stepsKept: stepsToKeep,
    };

    logger.debug('Repetitive pattern converted to optimization block', {
      patternIndex: index,
      sequence: sequenceStr,
      occurrenceCount: pattern.occurrenceCount,
      currentTime: currentTimeTotal,
      optimizedTime: optimizedTimeTotal,
      savingsPercent,
    });

    return {
      blockId: `pattern-${index}`,
      workflowName: `Repetitive: ${sequenceStr}`,
      workflowId: `pattern-${pattern.sessions[0] || index}`,
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved: estimatedSavings,
      relativeImprovement: savingsPercent,
      confidence: Math.min(0.9, 0.5 + pattern.occurrenceCount * 0.05),
      title: `Automate ${pattern.sequence[0]} Workflow`,
      whyThisMatters: pattern.optimizationOpportunity ||
        `This "${sequenceStr}" pattern occurs ${pattern.occurrenceCount} times and takes ~${formatDurationDisplay(currentTimeTotal)} each time. Automating it could save ${hoursSaved}h total.`,
      metricDeltas: {
        contextSwitchesReduction: pattern.sequence.length - 1,
        reworkLoopsReduction: 0,
      },
      stepTransformations: [
        {
          transformationId: `trans-pattern-${index}`,
          currentSteps: pattern.sequence.map((stepName, idx) => ({
            stepId: `pattern-step-${index}-${idx}`,
            tool: inferToolFromStepName(stepName),
            durationSeconds: avgStepDuration,
            description: stepName,
          })),
          optimizedSteps: [
            {
              stepId: `opt-pattern-${index}`,
              tool: 'Automated Workflow',
              estimatedDurationSeconds: optimizedTimeTotal,
              description: `Consolidated automation for ${sequenceStr}`,
              claudeCodePrompt: `Create an automated workflow that handles: ${pattern.sequence.join(', ')}. This pattern occurs ${pattern.occurrenceCount} times and currently takes ${formatDurationDisplay(currentTimeTotal)}.`,
              isNew: true,
              isInUserToolbox: false,
            },
          ],
          timeSavedSeconds: estimatedSavings,
          confidence: Math.min(0.9, 0.5 + pattern.occurrenceCount * 0.05),
          rationale: `Consolidate ${pattern.sequence.length} repetitive steps into automated workflow`,
        },
      ],
      source: 'heuristic' as const,
      // ENRICHED DATA for WorkflowTransformationView
      currentWorkflowSteps,
      recommendedWorkflowSteps,
      implementationOptions,
      keyBenefits,
      summaryMetrics,
      errorProneStepCount: stepsToAutomate,
    };
  });
}

/**
 * Generate sub-actions for a step in a repetitive pattern
 */
function generatePatternStepSubActions(stepName: string, patternType: string): string[] {
  const lowerName = stepName.toLowerCase();

  if (lowerName.includes('research') || lowerName.includes('search')) {
    return [
      'Search across multiple sources',
      'Filter and evaluate results',
      'Extract relevant information',
    ];
  }
  if (lowerName.includes('document') || lowerName.includes('write')) {
    return [
      'Create or open document',
      'Write and format content',
      'Review and finalize',
    ];
  }
  if (lowerName.includes('email') || lowerName.includes('send')) {
    return [
      'Compose message',
      'Add recipients and attachments',
      'Review and send',
    ];
  }
  if (lowerName.includes('review') || lowerName.includes('check')) {
    return [
      'Open item for review',
      'Evaluate against criteria',
      'Provide feedback or approval',
    ];
  }
  if (lowerName.includes('code') || lowerName.includes('develop')) {
    return [
      'Open development environment',
      'Write or modify code',
      'Test and verify changes',
    ];
  }
  if (lowerName.includes('meeting') || lowerName.includes('call')) {
    return [
      'Prepare materials',
      'Conduct meeting or call',
      'Document outcomes and actions',
    ];
  }

  // Default sub-actions
  return [
    `Begin ${stepName} process`,
    `Execute ${stepName} tasks`,
    `Complete and verify ${stepName}`,
  ];
}

/**
 * Infer the likely tool/app used for a given step name
 */
function inferToolFromStepName(stepName: string): string {
  const lowerName = stepName.toLowerCase();

  if (lowerName.includes('code') || lowerName.includes('develop') || lowerName.includes('debug')) {
    return 'IDE';
  }
  if (lowerName.includes('email') || lowerName.includes('message')) {
    return 'Email Client';
  }
  if (lowerName.includes('document') || lowerName.includes('write') || lowerName.includes('note')) {
    return 'Document Editor';
  }
  if (lowerName.includes('research') || lowerName.includes('search') || lowerName.includes('browse')) {
    return 'Browser';
  }
  if (lowerName.includes('design') || lowerName.includes('mockup')) {
    return 'Design Tool';
  }
  if (lowerName.includes('meeting') || lowerName.includes('call')) {
    return 'Video Conference';
  }
  if (lowerName.includes('terminal') || lowerName.includes('command') || lowerName.includes('deploy')) {
    return 'Terminal';
  }
  if (lowerName.includes('spreadsheet') || lowerName.includes('data') || lowerName.includes('analyze')) {
    return 'Spreadsheet';
  }

  return 'Workflow Tool';
}

/**
 * Convert FeatureAdoptionTips from A5 into OptimizationBlocks with step transformations
 * This allows A5 tips to appear in the "View Details" modal alongside other optimization blocks
 */
function convertFeatureAdoptionTipsToBlocks(
  tips: FeatureAdoptionTip[],
  state: InsightState
): OptimizationBlock[] {
  if (!tips || tips.length === 0) {
    return [];
  }

  // Get primary workflow for step data
  const primaryWorkflow = state.userEvidence?.workflows?.[0];
  const workflowSteps = primaryWorkflow?.steps || [];

  // Build step lookup
  const stepById = new Map(workflowSteps.map((s: any) => [s.stepId, s]));

  return tips.slice(0, 3).map((tip, index) => {
    // Find steps that might be related to this tool
    const relatedSteps = workflowSteps
      .filter((s: any) => {
        const app = (s.app || s.tool || '').toLowerCase();
        const toolName = tip.toolName.toLowerCase();
        return app.includes(toolName) || toolName.includes(app);
      })
      .slice(0, 2);

    // Build currentSteps from related steps only (no fallback to unrelated steps)
    // If user has no steps related to this tool, this is a new workflow suggestion
    const currentSteps = relatedSteps.map((s: any) => ({
      stepId: s.stepId,
      tool: s.app || s.tool || tip.toolName,
      durationSeconds: s.durationSeconds || 60,
      description: s.description || 'Current workflow step',
    }));

    // Check if this is a new workflow suggestion (no related steps found)
    const isNewWorkflowSuggestion = currentSteps.length === 0;

    const currentTimeTotal = currentSteps.reduce((sum: number, s: { durationSeconds: number }) => sum + s.durationSeconds, 0) || 120;
    const optimizedTimeTotal = Math.max(0, currentTimeTotal - tip.estimatedSavingsSeconds);

    return {
      blockId: `a5-tip-${tip.tipId || index}`,
      workflowName: primaryWorkflow?.title || 'Workflow',
      workflowId: primaryWorkflow?.workflowId || 'unknown',
      currentTimeTotal,
      optimizedTimeTotal,
      timeSaved: tip.estimatedSavingsSeconds,
      relativeImprovement: currentTimeTotal > 0 ? (tip.estimatedSavingsSeconds / currentTimeTotal) * 100 : 50,
      confidence: tip.confidence || 0.7,
      title: tip.featureName,
      whyThisMatters: `${tip.featureName}: ${tip.message}`,
      metricDeltas: {},
      stepTransformations: [
        {
          transformationId: `trans-a5-${index}`,
          currentSteps,
          optimizedSteps: [
            {
              stepId: `opt-a5-${index}`,
              tool: tip.toolName,
              estimatedDurationSeconds: optimizedTimeTotal,
              description: `Use ${tip.featureName} (${tip.triggerOrShortcut}) - ${tip.message}`,
              isNew: false, // A5 tips are for existing tools
              isInUserToolbox: true, // A5 only suggests tools user already has
            },
          ],
          timeSavedSeconds: tip.estimatedSavingsSeconds,
          confidence: tip.confidence || 0.7,
          rationale: tip.addressesPattern || tip.message,
        },
      ],
      source: 'feature_adoption' as any, // A5 source type
      // Flag to indicate if user has no related steps for this tool suggestion
      isNewWorkflowSuggestion,
    };
  });
}

/**
 * Generate a short, scannable title for heuristic optimization blocks
 */
function generateHeuristicTitle(inefficiencyType: string, suggestedTool: string): string {
  // Map inefficiency types to action-oriented titles
  const ineffTypeToTitle: Record<string, string> = {
    'repetitive_search': 'Reduce Repetitive Searches',
    'context_switching': 'Minimize Context Switching',
    'rework_loop': 'Prevent Rework Cycles',
    'manual_automation': 'Automate Manual Tasks',
    'longcut_path': 'Streamline Workflow Steps',
    'inefficient_tool': 'Upgrade Tool Selection',
    'information_gathering': 'Consolidate Information Sources',
    'duplicate_effort': 'Eliminate Duplicate Work',
  };

  // Try to get a predefined title
  if (ineffTypeToTitle[inefficiencyType]) {
    return ineffTypeToTitle[inefficiencyType];
  }

  // Generate title from tool name if available
  if (suggestedTool && suggestedTool !== 'unknown') {
    const cleanTool = suggestedTool.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
    if (cleanTool) {
      return `Use ${cleanTool} for Optimization`;
    }
  }

  // Fallback: format the inefficiency type nicely
  const formattedType = inefficiencyType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `Optimize ${formattedType}`;
}

/**
 * Get priority score for optimization block source
 * Lower score = higher priority (user-specific sources preferred)
 */
function getSourcePriority(source: string): number {
  const priorities: Record<string, number> = {
    'feature_adoption': 0,   // A5 tips - highest priority (uses user's existing tools)
    'peer_comparison': 1,    // User-specific (from A3 peer comparison)
    'heuristic': 2,          // Heuristic fallback (from A2 inefficiencies when A3 skipped)
    'company_docs': 3,       // Internal knowledge
    'web_best_practice': 4,  // External (lowest priority)
  };
  return priorities[source] ?? 3;
}

/**
 * Deduplicate step transformations within a block.
 * Removes duplicate transformations targeting the same current steps.
 */
function deduplicateStepTransformations(block: OptimizationBlock, logger: Logger): OptimizationBlock {
  if (!block.stepTransformations || block.stepTransformations.length <= 1) {
    return block;
  }

  const seenStepSets = new Set<string>();
  const uniqueTransformations = block.stepTransformations.filter((transform) => {
    // Create a key based on the current step IDs being optimized
    const currentStepKey = (transform.currentSteps || [])
      .map((s) => s.stepId)
      .sort()
      .join(',');

    if (seenStepSets.has(currentStepKey)) {
      logger.debug('Deduplicating step transformation within block', {
        blockId: block.blockId,
        duplicateSteps: currentStepKey,
      });
      return false;
    }
    seenStepSets.add(currentStepKey);
    return true;
  });

  return {
    ...block,
    stepTransformations: uniqueTransformations,
  };
}

/**
 * Extract key terms from text for semantic comparison.
 * Removes common words and returns meaningful terms.
 */
function extractKeyTerms(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and',
    'but', 'if', 'or', 'because', 'as', 'until', 'while', 'this', 'that',
    'these', 'those', 'it', 'its', 'use', 'using', 'step', 'steps',
  ]);

  // Normalize and tokenize
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return new Set(words);
}

/**
 * Calculate semantic overlap between two sets of terms.
 * Returns a score from 0 to 1.
 */
function calculateTermOverlap(terms1: Set<string>, terms2: Set<string>): number {
  if (terms1.size === 0 || terms2.size === 0) {
    return 0;
  }

  let overlapCount = 0;
  for (const term of terms1) {
    if (terms2.has(term)) {
      overlapCount++;
    } else {
      // Check for partial matches (e.g., "search" matches "searching")
      for (const term2 of terms2) {
        if (term.includes(term2) || term2.includes(term)) {
          overlapCount += 0.5;
          break;
        }
      }
    }
  }

  // Jaccard-like similarity
  const minSize = Math.min(terms1.size, terms2.size);
  return overlapCount / minSize;
}

/**
 * Validate semantic alignment between step description and Claude Code prompt.
 * Returns true if aligned, false if misaligned.
 *
 * Checks:
 * 1. Key term overlap between description and prompt
 * 2. Tool-specific alignment (prompt should mention similar tools/activities)
 * 3. Activity type alignment (research → research, coding → coding)
 */
function validatePromptAlignment(
  description: string,
  claudeCodePrompt: string,
  tool: string,
  logger: Logger
): { isAligned: boolean; confidence: number; reason: string } {
  // Extract key terms from both
  const descTerms = extractKeyTerms(description);
  const promptTerms = extractKeyTerms(claudeCodePrompt);
  const toolTerms = extractKeyTerms(tool);

  // Calculate overlap
  const descPromptOverlap = calculateTermOverlap(descTerms, promptTerms);

  // Activity type patterns
  const activityPatterns = {
    research: ['research', 'search', 'find', 'look', 'browse', 'explore', 'documentation', 'docs', 'read', 'investigate'],
    coding: ['code', 'coding', 'develop', 'implement', 'write', 'edit', 'refactor', 'debug', 'fix', 'program'],
    terminal: ['terminal', 'shell', 'command', 'cli', 'bash', 'script', 'alias', 'prompt'],
    design: ['design', 'figma', 'ui', 'ux', 'prototype', 'mockup', 'layout', 'visual'],
    communication: ['slack', 'email', 'message', 'chat', 'meeting', 'call', 'discuss'],
  };

  // Detect activity type in description
  let descActivity: string | null = null;
  for (const [activity, keywords] of Object.entries(activityPatterns)) {
    if (keywords.some((kw) => description.toLowerCase().includes(kw))) {
      descActivity = activity;
      break;
    }
  }

  // Detect activity type in prompt
  let promptActivity: string | null = null;
  for (const [activity, keywords] of Object.entries(activityPatterns)) {
    if (keywords.some((kw) => claudeCodePrompt.toLowerCase().includes(kw))) {
      promptActivity = activity;
      break;
    }
  }

  // Check for misalignment
  const activityMismatch = descActivity && promptActivity && descActivity !== promptActivity;

  // Calculate final confidence
  let confidence = descPromptOverlap;

  // Penalize activity mismatch
  if (activityMismatch) {
    confidence *= 0.3; // Heavy penalty for activity type mismatch
  }

  // Boost if tool is mentioned in prompt
  if (toolTerms.size > 0) {
    const toolInPrompt = Array.from(toolTerms).some((t) =>
      claudeCodePrompt.toLowerCase().includes(t)
    );
    if (toolInPrompt) {
      confidence = Math.min(1, confidence + 0.2);
    }
  }

  // Threshold for alignment
  const ALIGNMENT_THRESHOLD = 0.25;

  const isAligned = confidence >= ALIGNMENT_THRESHOLD && !activityMismatch;
  const reason = activityMismatch
    ? `Activity type mismatch: description is "${descActivity}" but prompt is "${promptActivity}"`
    : confidence < ALIGNMENT_THRESHOLD
      ? `Low term overlap (${(confidence * 100).toFixed(0)}%)`
      : 'Semantically aligned';

  logger.debug('Prompt alignment check', {
    descTerms: Array.from(descTerms).slice(0, 10),
    promptTerms: Array.from(promptTerms).slice(0, 10),
    overlap: descPromptOverlap.toFixed(2),
    descActivity,
    promptActivity,
    activityMismatch,
    confidence: confidence.toFixed(2),
    isAligned,
    reason,
  });

  return { isAligned, confidence, reason };
}

/**
 * Validate and clean semantic alignment of Claude Code prompts in optimization blocks.
 * Removes or clears prompts that don't semantically align with their step descriptions.
 * Also removes Claude Code prompts if Claude Code is not in the user's toolbox.
 */
function validateBlockSemanticAlignment(
  block: OptimizationBlock,
  logger: Logger,
  userToolbox?: UserToolbox | null
): OptimizationBlock {
  if (!block.stepTransformations || block.stepTransformations.length === 0) {
    return block;
  }

  // Check if Claude Code is in user's toolbox
  // If user doesn't use Claude Code, we should not show Claude Code prompts
  const userHasClaudeCode = userToolbox
    ? isToolInUserToolbox('claude', userToolbox) ||
      isToolInUserToolbox('claude code', userToolbox) ||
      isToolInUserToolbox('claude-code', userToolbox)
    : false;

  let alignmentIssuesFound = 0;
  let claudeNotInToolboxRemoved = 0;

  const cleanedTransformations = block.stepTransformations.map((transform) => {
    const cleanedOptimizedSteps = (transform.optimizedSteps || []).map((step) => {
      // Skip if no Claude Code prompt
      if (!step.claudeCodePrompt) {
        return step;
      }

      // FIX: Remove Claude Code prompt if user doesn't use Claude Code
      if (!userHasClaudeCode) {
        claudeNotInToolboxRemoved++;
        logger.info('Removing Claude Code prompt - not in user toolbox', {
          blockId: block.blockId,
          stepId: step.stepId,
          tool: step.tool,
          userTools: userToolbox?.tools?.slice(0, 5) || [],
          promptPreview: step.claudeCodePrompt.slice(0, 50),
        });
        return {
          ...step,
          claudeCodePrompt: undefined,
        };
      }

      // Validate semantic alignment
      const { isAligned, confidence, reason } = validatePromptAlignment(
        step.description || '',
        step.claudeCodePrompt,
        step.tool || '',
        logger
      );

      if (!isAligned) {
        alignmentIssuesFound++;
        logger.info('Removing misaligned Claude Code prompt', {
          blockId: block.blockId,
          stepId: step.stepId,
          tool: step.tool,
          descriptionPreview: (step.description || '').slice(0, 50),
          promptPreview: step.claudeCodePrompt.slice(0, 50),
          confidence,
          reason,
        });

        // Remove the misaligned prompt
        return {
          ...step,
          claudeCodePrompt: undefined,
        };
      }

      return step;
    });

    return {
      ...transform,
      optimizedSteps: cleanedOptimizedSteps,
    };
  });

  if (alignmentIssuesFound > 0 || claudeNotInToolboxRemoved > 0) {
    logger.debug('Semantic alignment validation complete', {
      blockId: block.blockId,
      source: block.source,
      alignmentIssuesFound,
      claudeNotInToolboxRemoved,
      userHasClaudeCode,
      transformationsCount: block.stepTransformations.length,
    });
  }

  return {
    ...block,
    stepTransformations: cleanedTransformations,
  };
}

/**
 * FIX-11.3: Enrich current steps with meaningful data when generic values are detected.
 * This fixes issues where steps show "unknown" tool or generic descriptions.
 */
function enrichCurrentSteps(block: OptimizationBlock, logger: Logger): OptimizationBlock {
  const enrichedTransformations = block.stepTransformations.map((transform) => {
    // Check if any current steps have generic data
    const hasGenericData = transform.currentSteps?.some(
      (step) =>
        !step.tool ||
        step.tool === 'unknown' ||
        step.tool === 'Current Tool' ||
        step.tool === 'Workflow tool' ||
        !step.description ||
        step.description === 'Current workflow step'
    );

    if (!hasGenericData) {
      return transform;
    }

    // Deduplicate steps with identical descriptions - merge them instead of showing duplicates
    const stepsByDescription = new Map<string, {
      stepIds: string[];
      tool: string;
      totalDuration: number;
      description: string;
    }>();

    for (const step of transform.currentSteps || []) {
      const key = step.description?.toLowerCase().trim() || step.stepId;
      if (stepsByDescription.has(key)) {
        const existing = stepsByDescription.get(key)!;
        existing.stepIds.push(step.stepId);
        existing.totalDuration += step.durationSeconds || 0;
        // Keep the more specific tool if available
        if (step.tool && step.tool !== 'unknown' && step.tool !== 'Current Tool') {
          existing.tool = step.tool;
        }
      } else {
        stepsByDescription.set(key, {
          stepIds: [step.stepId],
          tool: step.tool || 'Workflow tool',
          totalDuration: step.durationSeconds || 60,
          description: step.description || `Step in workflow`,
        });
      }
    }

    // Convert back to currentSteps array
    const mergedSteps = Array.from(stepsByDescription.values()).map((merged) => ({
      stepId: merged.stepIds[0], // Use first stepId as representative
      tool: merged.tool,
      durationSeconds: merged.totalDuration,
      description: merged.stepIds.length > 1
        ? `${merged.description} (${merged.stepIds.length} similar steps)`
        : merged.description,
    }));

    // Log enrichment if changes were made
    if (mergedSteps.length !== (transform.currentSteps?.length || 0)) {
      logger.debug('FIX-11.3: Merged duplicate current steps', {
        blockId: block.blockId,
        originalCount: transform.currentSteps?.length || 0,
        mergedCount: mergedSteps.length,
      });
    }

    return {
      ...transform,
      currentSteps: mergedSteps,
    };
  });

  return {
    ...block,
    stepTransformations: enrichedTransformations,
  };
}

/**
 * Semantic validation for optimization blocks.
 * Ensures optimizations make logical sense and have meaningful data.
 */
function validateOptimizationBlock(block: OptimizationBlock, logger: Logger): boolean {
  const warnings: string[] = [];
  let hasCriticalIssue = false;

  // 1. Check that time saved is positive and reasonable
  if (block.timeSaved <= 0) {
    warnings.push(`Invalid timeSaved: ${block.timeSaved}`);
    hasCriticalIssue = true;
  }

  // 2. Check that optimized time is less than current time
  if (block.optimizedTimeTotal >= block.currentTimeTotal && block.currentTimeTotal > 0) {
    warnings.push(`Optimized time (${block.optimizedTimeTotal}) >= current time (${block.currentTimeTotal})`);
  }

  // 3. CRITICAL: Validate step transformations have meaningful data
  // Blocks without real step transformations should NOT be shown
  const transformations = block.stepTransformations || [];
  if (transformations.length === 0) {
    warnings.push('No step transformations');
    hasCriticalIssue = true;
  }

  let hasRealStepData = false;
  for (const transform of transformations) {
    const currentSteps = transform.currentSteps || [];

    // Check if we have any real current steps
    if (currentSteps.length > 0) {
      // Verify steps have meaningful data (not synthetic/placeholder)
      const realSteps = currentSteps.filter(step => {
        const isSynthetic = step.stepId?.startsWith('synthetic-');
        const hasRealTool = step.tool &&
          step.tool !== 'unknown' &&
          step.tool !== 'Current Tool' &&
          step.tool !== 'Workflow' &&
          step.tool !== 'Current process';
        return !isSynthetic && hasRealTool;
      });

      if (realSteps.length > 0) {
        hasRealStepData = true;
      }
    }

    // Check that optimized steps are different from current steps
    const currentTools = new Set(currentSteps.map(s => s.tool?.toLowerCase()));
    for (const optStep of transform.optimizedSteps || []) {
      // It's okay if the optimized step uses the same tool with a better feature/shortcut
      // But flag if ALL optimized steps use the exact same tool with no change
      if (currentTools.has(optStep.tool?.toLowerCase()) &&
          !optStep.description?.toLowerCase().includes('shortcut') &&
          !optStep.description?.toLowerCase().includes('feature') &&
          !optStep.description?.toLowerCase().includes('automate')) {
        // Only warn, don't reject - the optimization might still be valid
        logger.debug('Optimized step uses same tool as current', {
          currentTools: Array.from(currentTools),
          optimizedTool: optStep.tool,
          description: optStep.description?.slice(0, 50),
        });
      }
    }
  }

  // CRITICAL: Reject blocks without real step data
  // It's better to show no optimization card than one with empty/fake transformations
  if (!hasRealStepData && transformations.length > 0) {
    warnings.push('No real step data in transformations - would show empty View Details');
    hasCriticalIssue = true;
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.debug('Optimization block validation', {
      blockId: block.blockId,
      source: block.source,
      warnings,
      rejected: hasCriticalIssue,
    });
  }

  // Reject blocks with critical issues
  return !hasCriticalIssue && block.currentTimeTotal > 0;
}

/**
 * Merge multiple optimization plans
 * Priority: user-specific sources first, then by time saved
 */
function mergePlans(
  plans: StepOptimizationPlan[],
  logger: Logger,
  userToolbox?: UserToolbox | null
): StepOptimizationPlan {
  // Combine all blocks with semantic validation and step-level deduplication
  // 1. Deduplicate step transformations within each block
  // 2. Validate semantic alignment of Claude Code prompts (and filter by user toolbox)
  // 3. Validate blocks (filter out invalid ones)
  // 4. Sort by source priority (user-specific first, web last)
  // 5. Then by time saved (within same source priority)
  const allBlocks = plans
    .flatMap((p) => p.blocks)
    .map((block) => deduplicateStepTransformations(block, logger))
    .map((block) => enrichCurrentSteps(block, logger)) // FIX-11.3: Enrich and deduplicate current steps
    .map((block) => validateBlockSemanticAlignment(block, logger, userToolbox)) // FIX: Remove Claude prompts if not in user toolbox
    .filter((block) => validateOptimizationBlock(block, logger))
    .sort((a, b) => {
      const priorityDiff = getSourcePriority(a.source) - getSourcePriority(b.source);
      if (priorityDiff !== 0) return priorityDiff;
      return b.timeSaved - a.timeSaved;
    });

  // Remove duplicates (blocks targeting same workflow/inefficiency)
  // FIX-7: Use full whyThisMatters text for deduplication (was slicing to 50 chars)
  // Also include source to allow different sources to provide similar recommendations
  const seenKeys = new Set<string>();
  const deduplicatedBlocks = allBlocks.filter((block) => {
    // Use full description + source for more accurate deduplication
    const key = `${block.workflowId}:${block.source}:${block.whyThisMatters.toLowerCase().trim()}`;
    if (seenKeys.has(key)) {
      logger.debug('Deduplicating block', {
        workflowId: block.workflowId,
        source: block.source,
        whyThisMatters: block.whyThisMatters.slice(0, 50) + '...',
      });
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  // FIX-6: Filter by confidence FIRST, then take top 5
  // Previously slice(0,5).filter() which could result in <5 blocks
  const confidentBlocks = deduplicatedBlocks.filter((b) => b.confidence >= THRESHOLDS.MIN_CONFIDENCE);

  // BALANCE: Limit web blocks when other sources have good results
  // Web search should complement, not dominate the answer
  const nonWebBlocks = confidentBlocks.filter((b) => b.source !== 'web_best_practice');
  const webBlocks = confidentBlocks.filter((b) => b.source === 'web_best_practice');

  let balancedBlocks: typeof confidentBlocks;
  if (nonWebBlocks.length >= 2) {
    // Have good non-web results - limit web to 1-2 supplementary blocks
    const maxWebBlocks = Math.min(2, 5 - nonWebBlocks.length);
    balancedBlocks = [...nonWebBlocks, ...webBlocks.slice(0, maxWebBlocks)];
    logger.debug('Balancing web blocks', {
      nonWebCount: nonWebBlocks.length,
      webCount: webBlocks.length,
      limitedWebTo: Math.min(maxWebBlocks, webBlocks.length),
    });
  } else {
    // Limited non-web results - allow more web blocks
    balancedBlocks = confidentBlocks;
  }

  const topBlocks = balancedBlocks.slice(0, 5); // Max 5 optimization blocks

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
 * Build the final InsightGenerationResult (simplified format)
 */
function buildFinalResult(
  state: InsightState,
  mergedPlan: StepOptimizationPlan,
  userQueryAnswer: string,
  suggestedFollowUps: string[],
  featureAdoptionTips: FeatureAdoptionTip[],
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

  // FIX-9: Build agent diagnostics for transparency
  const agentDiagnostics = buildAgentDiagnostics(state, mergedPlan);

  return {
    queryId,
    query: state.query,
    userId: state.userId,
    userQueryAnswer,
    executiveSummary,
    optimizationPlan: mergedPlan.blocks.length > 0 ? mergedPlan : undefined,
    createdAt: now,
    completedAt: now,
    suggestedFollowUps,
    // Feature adoption tips displayed as separate "Workflow Tips" section (not merged with optimization blocks)
    featureAdoptionTips: featureAdoptionTips.length > 0 ? featureAdoptionTips : undefined,
    // Repetitive workflow patterns (e.g., "research → summarize → email" 10x/week)
    repetitivePatterns: state.userEvidence?.repetitivePatterns?.length
      ? state.userEvidence.repetitivePatterns
      : undefined,
    // FIX-9: Agent diagnostics for debugging and transparency
    agentDiagnostics,
  };
}

/**
 * FIX-9: Build agent diagnostics from state
 * Shows which agents ran, which were skipped, and source breakdown
 */
function buildAgentDiagnostics(
  state: InsightState,
  mergedPlan: StepOptimizationPlan
): AgentDiagnostics {
  // Agents that were scheduled to run based on routing decision
  const agentsScheduled = state.routingDecision?.agentsToRun || [];

  // Determine which agents actually ran based on their output
  const agentsRan: AgentId[] = [];
  if (state.userEvidence) agentsRan.push('A1_RETRIEVAL');
  if (state.userDiagnostics) agentsRan.push('A2_JUDGE');
  if (state.peerOptimizationPlan) agentsRan.push('A3_COMPARATOR');
  if (state.webOptimizationPlan) agentsRan.push('A4_WEB');
  if (state.companyOptimizationPlan) agentsRan.push('A4_COMPANY');
  if (state.featureAdoptionTips && state.featureAdoptionTips.length > 0) {
    agentsRan.push('A5_FEATURE_ADOPTION');
  }

  // Agents that were skipped (scheduled but didn't produce output)
  const agentsSkipped: Array<{ agentId: AgentId; reason: string }> = [];

  if (agentsScheduled.includes('A3_COMPARATOR') && !state.peerOptimizationPlan) {
    const reason = !state.peerEvidence
      ? 'No peer data available'
      : state.peerDiagnostics?.overallEfficiencyScore &&
        state.userDiagnostics?.overallEfficiencyScore &&
        state.peerDiagnostics.overallEfficiencyScore <= state.userDiagnostics.overallEfficiencyScore
        ? 'User workflow already more efficient than peers'
        : 'Comparison did not produce actionable recommendations';
    agentsSkipped.push({ agentId: 'A3_COMPARATOR', reason });
  }

  if (agentsScheduled.includes('A4_WEB') && !state.webOptimizationPlan) {
    agentsSkipped.push({
      agentId: 'A4_WEB',
      reason: 'Web search did not return relevant best practices',
    });
  }

  if (agentsScheduled.includes('A4_COMPANY') && !state.companyOptimizationPlan) {
    agentsSkipped.push({
      agentId: 'A4_COMPANY',
      reason: state.routingDecision?.companyDocsAvailable === false
        ? 'No company documentation available'
        : 'Company docs did not contain relevant information',
    });
  }

  // Source breakdown: count blocks by source
  const sourceBreakdown: Record<string, number> = {};
  for (const block of mergedPlan.blocks) {
    const source = block.source || 'unknown';
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  }

  // Check if heuristic fallback was used
  const usedHeuristicFallback = sourceBreakdown['heuristic'] > 0;

  // Calculate total processing time if timestamps available
  let totalProcessingMs: number | undefined;
  if (state.startedAt && state.completedAt) {
    totalProcessingMs = new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime();
  }

  return {
    agentsScheduled,
    agentsRan,
    agentsSkipped,
    sourceBreakdown,
    usedHeuristicFallback,
    totalProcessingMs,
  };
}

