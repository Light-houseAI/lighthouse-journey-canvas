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
import { createFeatureAdoptionGraph, type FeatureAdoptionGraphDeps } from './feature-adoption-graph.js';
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
} from '../types.js';
import { buildUserToolbox } from '../utils/toolbox-utils.js';
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
          context: p.context as Record<string, unknown>,
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
    const result = await retrievalGraph.invoke(state);

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
  const { logger, companyDocsEnabled, perplexityApiKey } = deps;

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
  // 3. A4-Company (if company docs enabled) - uses internal knowledge
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
  }

  // A4-Company: Run if company docs are enabled
  if (companyDocsEnabled) {
    agentsToRun.push('A4_COMPANY');
    reasons.push('Company documentation available');
  }

  // A4-Web: FALLBACK - Only run web search when:
  // 1. User explicitly requested it (includeWebSearch = true), OR
  // 2. A2 didn't produce enough actionable results (< 3 opportunities + inefficiencies)
  const totalA2Results = (state.userDiagnostics?.opportunities.length ?? 0) +
                         (state.userDiagnostics?.inefficiencies.length ?? 0);
  const insufficientUserAnalysis = totalA2Results < 3;
  const shouldUseWebSearch = state.includeWebSearch || insufficientUserAnalysis;

  if (perplexityApiKey && shouldUseWebSearch) {
    agentsToRun.push('A4_WEB');
    if (state.includeWebSearch) {
      reasons.push('Web search explicitly requested');
    } else {
      reasons.push(`Web search as fallback (only ${totalA2Results} user analysis results)`);
    }
  } else if (perplexityApiKey && !shouldUseWebSearch) {
    reasons.push(`Web search skipped - sufficient user analysis (${totalA2Results} results)`);
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

  // Merge optimization blocks from all sources
  const mergedPlan = mergePlans(plans, logger);

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
      .slice(0, 5) // Show more opportunities
      .map(o => {
        const tool = o.suggestedTool ? ` → Use ${o.suggestedTool}` : '';
        const shortcut = o.shortcutCommand ? ` (${o.shortcutCommand})` : '';
        const feature = o.featureSuggestion ? ` - ${o.featureSuggestion}` : '';
        return `- **${o.type}**: ${o.description}${tool}${shortcut}${feature}`;
      })
      .join('\n');
    sections.push(`IMPROVEMENT OPPORTUNITIES (from your workflow analysis):\n${oppSummary}`);
  }

  // Feature Adoption Tips from A5 (HIGH PRIORITY - suggestions for user's existing tools)
  // These are personalized recommendations based on tools the user already uses
  if (state.featureAdoptionTips && state.featureAdoptionTips.length > 0) {
    const tipsSummary = state.featureAdoptionTips
      .map(t => `- **${t.toolName} - ${t.featureName}** (${t.triggerOrShortcut}): ${t.message}`)
      .join('\n');
    sections.push(`TOOL FEATURE RECOMMENDATIONS (for tools you already use):\n${tipsSummary}`);
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

  // Web best practices from A4-Web (LOWER PRIORITY - supplementary external knowledge)
  // Only included when user data analysis was insufficient
  if (state.webOptimizationPlan?.blocks && state.webOptimizationPlan.blocks.length > 0) {
    const webInsights = state.webOptimizationPlan.blocks
      .map(b => {
        const citations = b.citations?.map(c => c.url || c.title).filter(Boolean).join(', ');
        return `- ${b.whyThisMatters}${citations ? ` [Sources: ${citations}]` : ''}`;
      })
      .join('\n');
    sections.push(`ADDITIONAL RESOURCES (from web search):\n${webInsights}`);
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

STRUCTURE YOUR RESPONSE AS (user-specific insights FIRST):

## [Brief Topic/Answer Title]

[1-2 sentence direct answer to their question]

### Analysis of Your Workflows
- Start with what you observed in THEIR specific sessions and patterns
- Reference their actual tool usage (e.g., "I noticed you frequently switch between X and Y")
- Identify specific inefficiencies you detected in their workflow

### Recommended Improvements Using Your Current Tools
- Suggest features in tools they ALREADY use (prioritize this over new tools)
- Include keyboard shortcuts and triggers (e.g., "Use Cmd+D in VSCode")
- Reference tool feature recommendations from the analysis

### Step-by-Step Implementation (if applicable)
1. First specific action they can take
2. Second action
3. Third action

### Additional Best Practices
- Only include if relevant external knowledge adds value
- Keep this section brief

### Next Steps
- 2-3 concrete, actionable next steps they can take immediately
${sourcesSection}

USER'S SESSIONS (reference these in "Analysis of Your Workflows" section):
${sessionReferences}

IMPORTANT - RESPONSE PRIORITIES:
1. **USER-SPECIFIC ANALYSIS FIRST**: Lead with insights about THEIR actual workflow patterns
2. **EXISTING TOOLS PRIORITY**: Recommend features in tools they already use (from TOOL FEATURE RECOMMENDATIONS context)
3. **SHORTCUTS AND TRIGGERS**: Include specific keyboard shortcuts like "Use @plan in Cursor" or "Press Cmd+D"
4. **MINIMIZE GENERIC ADVICE**: Avoid generic productivity tips - be specific to their context
5. **WEB CONTENT LAST**: Only include web best practices if they add specific value
- Keep bullets concise (1-2 lines each)
${hasWebSearchContent ? '- Copy web source links exactly as provided above (they are already formatted as [Title](URL))' : '- Do NOT include a Sources section since no web search was performed'}
- Quote specific session activities when referencing user's patterns
- End with 2-3 concrete next steps they can take immediately
- PRIVACY: Do NOT mention the user's specific company name, job title, track name, or role in your response. Use generic terms like "your work", "your projects", or "your workflow" instead.`;

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
  const tools = state.userEvidence?.sessionSnapshots
    ?.flatMap((s) => s.appSequence || [])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);
  if (tools && tools.length > 0) {
    contextParts.push(`\nTools User Works With: ${tools.join(', ')}`);
  }

  // Persona context
  if (state.userPersonas && state.userPersonas.length > 0) {
    contextParts.push(`\nUser's Roles: ${state.userPersonas.map((p) => p.displayName).join(', ')}`);
  }

  const context = contextParts.join('\n');

  // Use different prompts based on query type
  const prompt = isKnowledgeQuery
    ? `Based on this Q&A conversation, generate 3 specific follow-up questions the user might want to ask next.

Original Question: "${state.query}"

Answer Summary:
${userQueryAnswer.slice(0, 800)}${userQueryAnswer.length > 800 ? '...' : ''}

RULES:
1. Questions should help the user explore related topics or dive deeper into specifics
2. Questions should be concise (under 100 characters each)
3. Questions should reference specific concepts, technologies, or options mentioned in the answer
4. Questions should be natural follow-ups that a curious user would ask
5. Do NOT ask generic questions like "tell me more" - be specific about WHAT to tell more about
6. PRIVACY: Do NOT mention the user's specific company name, job title, or personal information

Return ONLY a JSON array of 3 question strings, nothing else:
["Question 1", "Question 2", "Question 3"]`
    : `Based on the following workflow analysis conversation, generate 3 specific, actionable follow-up questions the user might want to ask next.

${context}

Answer Summary:
${userQueryAnswer.slice(0, 500)}${userQueryAnswer.length > 500 ? '...' : ''}

RULES:
1. Questions should be specific to the user's actual workflow and tools
2. Questions should help the user dive deeper into optimizations or explore related topics
3. Questions should be concise (under 100 characters each)
4. Questions should be actionable and lead to useful insights
5. Do NOT ask generic questions - reference their specific tools, workflows, or findings
6. PRIVACY: Do NOT mention the user's specific company name, job title, or track name in questions. Use generic terms like "your work" or "your projects" instead.

Return ONLY a JSON array of 3 question strings, nothing else:
["Question 1", "Question 2", "Question 3"]`;

  try {
    // Use the same model as A4-Web for consistency
    let followUpLLMProvider = llmProvider;
    try {
      followUpLLMProvider = createAgentLLMProvider('A4_WEB', modelConfig);
    } catch {
      logger.warn('Orchestrator: Using default LLM provider for follow-up generation');
    }

    const response = await followUpLLMProvider.generateText([
      { role: 'user', content: prompt }
    ], { temperature: 0.7, maxTokens: 500 });

    // Parse JSON array from response
    let responseText = response.content.trim();
    logger.info('Orchestrator: LLM response for follow-ups', {
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 200)
    });

    let followUps: string[] = [];

    try {
      // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      responseText = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // Try to extract JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        followUps = JSON.parse(jsonMatch[0]);
        logger.info('Orchestrator: Parsed follow-up questions', { followUps });
      } else {
        // If no complete JSON array found, try to parse what we have
        // Handle truncated responses by closing the array
        if (responseText.includes('[') && !responseText.includes(']')) {
          // Count open quotes and try to repair truncated JSON
          const partialJson = responseText.substring(responseText.indexOf('['));
          // Try to extract complete strings from partial JSON
          const stringMatches = partialJson.match(/"([^"]+)"/g);
          if (stringMatches && stringMatches.length > 0) {
            followUps = stringMatches.map(s => s.replace(/"/g, '').trim()).filter(s => s.length > 10);
            logger.info('Orchestrator: Extracted questions from partial JSON', { followUps });
          } else {
            logger.warn('Orchestrator: No JSON array found in response', { responseText: responseText.slice(0, 300) });
          }
        } else {
          logger.warn('Orchestrator: No JSON array found in response', { responseText: responseText.slice(0, 300) });
        }
      }
    } catch (parseError) {
      logger.warn('Orchestrator: Failed to parse follow-up questions JSON', {
        error: String(parseError),
        responseText: responseText.slice(0, 300)
      });
    }

    // Validate and clean up
    followUps = followUps
      .filter((q): q is string => typeof q === 'string' && q.length > 0)
      .map((q) => q.trim())
      .slice(0, 3);

    logger.info('Orchestrator: Follow-up questions generated', {
      count: followUps.length,
      questions: followUps,
    });

    // If we got valid follow-ups, return them
    if (followUps.length > 0) {
      return followUps;
    }

    // Fallback to contextual defaults if parsing failed
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
 * Get priority score for optimization block source
 * Lower score = higher priority (user-specific sources preferred)
 */
function getSourcePriority(source: string): number {
  const priorities: Record<string, number> = {
    'peer_comparison': 1,    // User-specific (from A2 opportunities)
    'company_docs': 2,       // Internal knowledge
    'web_best_practice': 3,  // External (lowest priority)
  };
  return priorities[source] ?? 2;
}

/**
 * Merge multiple optimization plans
 * Priority: user-specific sources first, then by time saved
 */
function mergePlans(
  plans: StepOptimizationPlan[],
  logger: Logger
): StepOptimizationPlan {
  // Combine all blocks, sorted by:
  // 1. Source priority (user-specific first, web last)
  // 2. Time saved (within same source priority)
  const allBlocks = plans
    .flatMap((p) => p.blocks)
    .sort((a, b) => {
      const priorityDiff = getSourcePriority(a.source) - getSourcePriority(b.source);
      if (priorityDiff !== 0) return priorityDiff;
      return b.timeSaved - a.timeSaved;
    });

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
  };
}

