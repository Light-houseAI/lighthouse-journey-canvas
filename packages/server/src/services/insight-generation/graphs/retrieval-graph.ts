/**
 * A1 Retrieval Agent Graph
 *
 * LangGraph implementation of the Retrieval Agent (A1) that:
 * 1. Retrieves user's sessions/workflows/steps via Hybrid RAG
 * 2. Runs critique loop to validate retrieval quality
 *
 * Uses existing NaturalLanguageQueryService for Hybrid RAG.
 */

import { StateGraph, END } from '@langchain/langgraph';
import type { Logger } from '../../../core/logger.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository.js';
import type { ArangoDBGraphService } from '../../arangodb-graph.service.js';
import type { HelixGraphService } from '../../helix-graph.service.js';
import type { EmbeddingService } from '../../interfaces/index.js';

// Generic graph service type - supports both ArangoDB and Helix implementations
type GraphService = ArangoDBGraphService | HelixGraphService;
import type { LLMProvider } from '../../../core/llm-provider.js';
import { withTimeout } from '../../../core/retry-utils.js';

// LLM call timeout constant
const LLM_TIMEOUT_MS = 60000; // 60 seconds
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  EvidenceBundle,
  UserWorkflow,
  UserStep,
  SessionInfo,
  ExtractedEntity,
  ExtractedConcept,
  CritiqueResult,
  CritiqueIssue,
  AttachedSessionContext,
  RepetitiveWorkflowPattern,
  SessionKnowledgeEntry,
  KnowledgeBaseWorkflow,
} from '../types.js';
import { z } from 'zod';
import { NoiseFilterService } from '../filters/noise-filter.service.js';
import { A1_RETRIEVAL_SYSTEM_PROMPT } from '../prompts/system-prompts.js';
import { classifyQuery, type QueryClassification } from '../classifiers/query-classifier.js';

// ============================================================================
// DOMAIN RELEVANCE FILTERING
// ============================================================================

/**
 * Generic action keywords that are too broad for filtering on their own.
 * These keywords need to be combined with domain-specific keywords to be meaningful.
 * e.g., "build" alone matches "build chat app" AND "build iOS app" - not specific enough.
 */
const GENERIC_ACTION_KEYWORDS = new Set([
  'build', 'automation', 'automate', 'ci', 'cd', 'pipeline',
  'deploy', 'test', 'testing', 'release', 'process', 'workflow',
  'create', 'make', 'develop', 'development', 'app', 'application',
]);

/**
 * Check if a workflow is relevant to the given domain keywords.
 * Uses fuzzy matching on workflow title, summary, intent, and tools.
 *
 * Key insight: Generic action keywords (like "build") match too many workflows.
 * We require at least ONE domain-specific keyword to match, not just generic actions.
 *
 * For example, for query "automate build for Apple apps":
 * - Domain-specific: "apple", "ios", "xcode"
 * - Generic: "automate", "build", "app"
 *
 * A workflow must match at least one domain-specific keyword to be relevant.
 * This prevents "build chat app" from matching "Apple build automation" query.
 *
 * @param workflow - The workflow to check
 * @param domainKeywords - Keywords extracted from the query (e.g., ['ios', 'apple', 'build'])
 * @returns true if workflow matches at least one domain-specific keyword
 */
function isWorkflowRelevantToDomain(
  workflow: UserWorkflow,
  domainKeywords: string[]
): boolean {
  if (!domainKeywords || domainKeywords.length === 0) {
    return true; // No domain filter, all workflows are relevant
  }

  // Build searchable text from workflow fields
  const searchableText = [
    workflow.title || '',
    workflow.summary || '',
    workflow.intent || '',
    workflow.approach || '',
    workflow.context || '',
    ...(workflow.tools || []),
    ...(workflow.steps?.map(s => s.description) || []),
    ...(workflow.steps?.map(s => s.app) || []),
  ].join(' ').toLowerCase();

  // Separate domain-specific from generic action keywords
  const domainSpecificKeywords = domainKeywords.filter(
    kw => !GENERIC_ACTION_KEYWORDS.has(kw.toLowerCase())
  );

  // If we have domain-specific keywords, require at least one to match
  // This prevents "build chat app" from matching "Apple build automation" query
  if (domainSpecificKeywords.length > 0) {
    return domainSpecificKeywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchableText);
    });
  }

  // If only generic keywords, fall back to OR matching (less strict)
  return domainKeywords.some(keyword => {
    const keywordLower = keyword.toLowerCase();
    // Use word boundary matching for better precision
    const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(searchableText);
  });
}

/**
 * Filter workflows by domain relevance when strict domain matching is enabled.
 * This prevents unrelated workflows (e.g., "chat app research") from being returned
 * for domain-specific queries (e.g., "Apple build automation").
 *
 * @param workflows - All retrieved workflows
 * @param classification - Query classification with domain keywords
 * @param logger - Logger for debugging
 * @returns Filtered workflows that match the domain, or all workflows if no domain filter
 */
function filterWorkflowsByDomain(
  workflows: UserWorkflow[],
  classification: QueryClassification,
  logger: Logger
): UserWorkflow[] {
  const domainKeywords = classification.filters.domainKeywords || [];
  const strictMatching = classification.routing.strictDomainMatching;

  // If no domain keywords or strict matching not enabled, return all
  if (!strictMatching || domainKeywords.length === 0) {
    return workflows;
  }

  const relevantWorkflows = workflows.filter(wf =>
    isWorkflowRelevantToDomain(wf, domainKeywords)
  );

  logger.info('A1: Domain relevance filtering applied', {
    domainKeywords,
    originalCount: workflows.length,
    filteredCount: relevantWorkflows.length,
    removedCount: workflows.length - relevantWorkflows.length,
  });

  // If filtering removes ALL workflows, fall back to original (avoid empty results)
  if (relevantWorkflows.length === 0 && workflows.length > 0) {
    logger.warn('A1: Domain filter removed all workflows, falling back to original', {
      domainKeywords,
      sampleWorkflowTitles: workflows.slice(0, 3).map(w => w.title),
    });
    return workflows;
  }

  return relevantWorkflows;
}

// ============================================================================
// TYPES
// ============================================================================

export interface RetrievalGraphDeps {
  logger: Logger;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
  graphService?: GraphService;
  embeddingService: EmbeddingService;
  llmProvider: LLMProvider;
  noiseFilterService?: NoiseFilterService;
}

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Retrieve user's evidence via Hybrid RAG
 * If user has attached sessions via @mention, uses those directly instead of NLQ retrieval
 */
async function retrieveUserEvidence(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, nlqService, sessionMappingRepository, noiseFilterService } = deps;

  // Check if user has attached sessions - if so, skip NLQ retrieval
  if (state.attachedSessionContext && state.attachedSessionContext.length > 0) {
    logger.info('A1: Using attached sessions (skipping NLQ retrieval)', {
      attachedSessionCount: state.attachedSessionContext.length,
      sessionIds: state.attachedSessionContext.map(s => s.sessionId),
    });

    // Transform attached sessions to EvidenceBundle format (with enriched JSONB data)
    const userEvidence = await transformAttachedSessionsToEvidence(
      state.attachedSessionContext,
      logger,
      sessionMappingRepository
    );

    logger.info('A1: Attached sessions transformed to evidence', {
      workflowCount: userEvidence.workflows.length,
      stepCount: userEvidence.totalStepCount,
      sessionCount: userEvidence.sessions.length,
    });

    return {
      userEvidence,
      currentStage: 'a1_user_evidence_complete',
      progress: 20,
    };
  }

  // Classify query to determine optimal retrieval strategy
  const queryClassification = classifyQuery(state.query, false);

  // Use classification to determine maxResults and routing
  const { maxResults, useSemanticSearch } = queryClassification.routing;

  // Normal NLQ retrieval when no sessions attached
  const userEvidenceStartMs = Date.now();
  logger.info('A1: Retrieving user evidence via NLQ', {
    userId: state.userId,
    query: state.query,
    nodeId: state.nodeId,
    filterNoise: state.filterNoise,
    queryClassification: {
      scope: queryClassification.scope,
      intent: queryClassification.intent,
      specificity: queryClassification.specificity,
      maxResults,
      useSemanticSearch,
      filters: queryClassification.filters,
    },
  });

  try {
    // Use existing NLQ service for Hybrid RAG
    const nlqStartMs = Date.now();
    const nlqResult = await nlqService.query(state.userId, {
      query: state.query,
      nodeId: state.nodeId || undefined,
      lookbackDays: state.lookbackDays,
      maxResults,
      includeGraph: true,
      includeVectors: true,
    });

    logger.info(`A1 PROFILING: NLQ query took ${Date.now() - nlqStartMs}ms`);

    // Fetch full session data with chapters from session_mappings
    const sessionChaptersStartMs = Date.now();
    const sessionChaptersMap = await fetchSessionChapters(
      state.userId,
      nlqResult.relatedWorkSessions || [],
      sessionMappingRepository,
      logger
    );

    logger.info(`A1 PROFILING: Session chapters fetch took ${Date.now() - sessionChaptersStartMs}ms`);

    // Transform NLQ result to EvidenceBundle format with chapter data
    let userEvidence = transformNLQToEvidence(nlqResult, logger, sessionChaptersMap);

    // Apply noise filter to remove Slack/communication app steps if enabled
    if (state.filterNoise && noiseFilterService) {
      const noiseAnalysis = noiseFilterService.analyzeWorkflowNoise(userEvidence.workflows);
      logger.info('A1: Noise analysis before filtering', {
        totalSteps: noiseAnalysis.totalSteps,
        noiseSteps: noiseAnalysis.noiseSteps,
        noisePercentage: noiseAnalysis.noisePercentage.toFixed(1),
        isHighNoise: noiseAnalysis.isHighNoise,
        noiseByApp: noiseAnalysis.noiseByApp,
      });

      const filteredWorkflows = noiseFilterService.filterWorkflows(userEvidence.workflows);
      const filteredSessions = noiseFilterService.filterSessions(userEvidence.sessions);

      // Recalculate totals after filtering
      const filteredTotalStepCount = filteredWorkflows.reduce((sum, w) => sum + w.steps.length, 0);
      const filteredTotalDuration = filteredWorkflows.reduce((sum, w) => sum + w.totalDurationSeconds, 0);

      userEvidence = {
        ...userEvidence,
        workflows: filteredWorkflows,
        sessions: filteredSessions,
        totalStepCount: filteredTotalStepCount,
        totalDurationSeconds: filteredTotalDuration,
      };

      logger.info('A1: Noise filtered from evidence', {
        originalWorkflows: noiseAnalysis.totalSteps,
        filteredWorkflows: filteredWorkflows.length,
        stepsRemoved: noiseAnalysis.noiseSteps,
      });
    }

    // Apply domain relevance filtering when strictDomainMatching is enabled
    // This ensures only workflows matching the query's domain are returned
    // (e.g., filtering out "chat app research" for "Apple build automation" queries)
    if (queryClassification.routing.strictDomainMatching) {
      const domainFilteredWorkflows = filterWorkflowsByDomain(
        userEvidence.workflows,
        queryClassification,
        logger
      );

      // Recalculate totals after domain filtering
      const domainFilteredTotalStepCount = domainFilteredWorkflows.reduce(
        (sum, w) => sum + w.steps.length,
        0
      );
      const domainFilteredTotalDuration = domainFilteredWorkflows.reduce(
        (sum, w) => sum + w.totalDurationSeconds,
        0
      );

      userEvidence = {
        ...userEvidence,
        workflows: domainFilteredWorkflows,
        totalStepCount: domainFilteredTotalStepCount,
        totalDurationSeconds: domainFilteredTotalDuration,
      };
    }

    const userEvidenceTotalMs = Date.now() - userEvidenceStartMs;
    logger.info('A1: User evidence retrieved', {
      workflowCount: userEvidence.workflows.length,
      stepCount: userEvidence.totalStepCount,
      sessionCount: userEvidence.sessions.length,
      elapsedMs: userEvidenceTotalMs,
    });

    // === DOWNSTREAM DATA LOGGING ===
    // Log what session/workflow/step data is going downstream to A4 agents
    logger.info('=== A1 DOWNSTREAM DATA: Sessions ===');
    for (const session of userEvidence.sessions) {
      logger.info(`Session [${session.sessionId}]`, {
        highLevelSummary: session.highLevelSummary,
        startActivity: session.startActivity,
        endActivity: session.endActivity,
        durationSeconds: session.durationSeconds,
        workflowCount: session.workflowCount,
        appsUsed: session.appsUsed,
        hasScreenshotDescriptions: !!session.screenshotDescriptions,
        screenshotDescriptionCount: session.screenshotDescriptions ? Object.keys(session.screenshotDescriptions).length : 0,
      });
    }

    logger.info('=== A1 DOWNSTREAM DATA: Workflows & Steps (VLM Descriptions) ===');
    for (const workflow of userEvidence.workflows) {
      logger.info(`Workflow [${workflow.workflowId}]`, {
        title: workflow.title,
        summary: workflow.summary,
        intent: workflow.intent,
        approach: workflow.approach,
        primaryApp: workflow.primaryApp,
        totalDurationSeconds: workflow.totalDurationSeconds,
        tools: workflow.tools,
        stepCount: workflow.steps.length,
      });

      // Log each step's VLM description
      for (const step of workflow.steps) {
        logger.info(`  Step [${step.stepId}]`, {
          description: step.description,
          stepSummary: step.stepSummary || '(none)',
          app: step.app,
          toolCategory: step.toolCategory,
          durationSeconds: step.durationSeconds,
          agenticPattern: step.agenticPattern || '(none)',
          rawActionCount: step.rawActionCount || 0,
        });
      }
    }
    logger.info('=== END A1 DOWNSTREAM DATA ===');

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A1 RETRIEVAL AGENT OUTPUT (User Evidence) ===');
      logger.debug(JSON.stringify({
        agent: 'A1_RETRIEVAL',
        outputType: 'userEvidence',
        summary: {
          workflowCount: userEvidence.workflows.length,
          totalStepCount: userEvidence.totalStepCount,
          sessionCount: userEvidence.sessions.length,
          totalDurationSeconds: userEvidence.totalDurationSeconds,
          entityCount: userEvidence.entities.length,
          conceptCount: userEvidence.concepts.length,
        },
        workflows: userEvidence.workflows.map(w => ({
          workflowId: w.workflowId,
          title: w.title,
          summary: w.summary,
          intent: w.intent,
          approach: w.approach,
          context: w.context,
          stepCount: w.steps.length,
          totalDurationSeconds: w.totalDurationSeconds,
          tools: w.tools,
        })),
        sessions: userEvidence.sessions.map(s => ({
          sessionId: s.sessionId,
          highLevelSummary: s.highLevelSummary,
          startActivity: s.startActivity,
          endActivity: s.endActivity,
          intent: s.intent,
          approach: s.approach,
          durationSeconds: s.durationSeconds,
        })),
        retrievalMetadata: userEvidence.retrievalMetadata,
      }));
      logger.debug('=== END A1 USER EVIDENCE OUTPUT ===');
    }



    return {
      userEvidence,
      queryClassification, // Store for use in peer evidence retrieval
      currentStage: 'a1_user_evidence_complete',
      progress: 15,
    };
  } catch (error) {
    logger.error('A1: Failed to retrieve user evidence', { error });
    return {
      errors: [`A1 user retrieval failed: ${error}`],
      currentStage: 'a1_user_evidence_failed',
    };
  }
}

/**
 * Node: Critique the retrieval results
 */
async function critiqueRetrieval(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A1: Running critique loop');

  const issues: CritiqueIssue[] = [];

  // Check 1: User evidence has sufficient step-level data
  if (!state.userEvidence || state.userEvidence.totalStepCount < 3) {
    issues.push({
      type: 'insufficient_evidence',
      description: `User evidence has only ${state.userEvidence?.totalStepCount || 0} steps (minimum 3 required)`,
      severity: 'error',
    });
  }

  // Check 2: User evidence has workflow context
  if (!state.userEvidence || state.userEvidence.workflows.length === 0) {
    issues.push({
      type: 'insufficient_evidence',
      description: 'No workflows found in user evidence',
      severity: 'error',
    });
  }

  // Check 3: Retrieval is relevant to query (use LLM for semantic check)
  if (state.userEvidence && state.userEvidence.workflows.length > 0) {
    const relevanceCheck = await checkRelevance(
      state.query,
      state.userEvidence,
      llmProvider,
      logger
    );
    if (!relevanceCheck.isRelevant) {
      issues.push({
        type: 'insufficient_evidence',
        description: `Retrieved evidence may not be relevant: ${relevanceCheck.reason}`,
        severity: 'warning',
      });
    }
  }

  const passed = issues.filter((i) => i.severity === 'error').length === 0;
  const canRetry = state.a1RetryCount < 2 && !passed;

  const critiqueResult: CritiqueResult = {
    passed,
    issues,
    canRetry,
    retryCount: state.a1RetryCount,
    maxRetries: 2,
  };

  logger.info('A1: Critique complete', {
    passed,
    issueCount: issues.length,
    canRetry,
  });

  // Log detailed critique output (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== A1 RETRIEVAL AGENT OUTPUT (Critique) ===');
    logger.debug(JSON.stringify({
      agent: 'A1_RETRIEVAL',
      outputType: 'critique',
      critiqueResult: {
        passed,
        canRetry,
        retryCount: state.a1RetryCount,
        maxRetries: 2,
        issues: issues.map(issue => ({
          type: issue.type,
          description: issue.description,
          severity: issue.severity,
          affectedIds: issue.affectedIds,
        })),
      },
    }));
    logger.debug('=== END A1 CRITIQUE OUTPUT ===');
  }

  return {
    a1CritiqueResult: critiqueResult,
    a1RetryCount: state.a1RetryCount + (canRetry ? 1 : 0),
    currentStage: passed ? 'a1_critique_passed' : 'a1_critique_failed',
    progress: 30,
  };
}

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================

/**
 * Route after critique: retry or continue
 */
function routeAfterCritique(state: InsightState): string {
  if (state.a1CritiqueResult?.passed) {
    return 'continue';
  }
  if (state.a1CritiqueResult?.canRetry) {
    return 'retry';
  }
  return 'fail_gracefully';
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Node: Detect repetitive workflow patterns across user's sessions
 * Uses ArangoDB graph to find recurring sequences like "research → summarize → email"
 */
/**
 * Node: Load pre-computed repetitive patterns from stitched_context.
 * Patterns are pre-computed during the desktop app's "analyzing" phase
 * and stored in session_mappings.stitched_context JSONB.
 * No on-the-fly Helix/ArangoDB calls needed.
 */
async function detectRepetitivePatterns(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, sessionMappingRepository } = deps;

  if (!state.userId || !state.userEvidence) {
    logger.debug('A1: Skipping repetitive pattern detection (no user evidence)');
    return { progress: 18 };
  }

  logger.info('A1: Loading pre-computed repetitive patterns from stitched_context');

  try {
    // Read the most recent stitched_context for this user
    const stitchedContext = await sessionMappingRepository.getLatestStitchedContext(state.userId);

    if (!stitchedContext) {
      logger.debug('A1: No pre-computed stitched context found');
      return { progress: 18 };
    }

    const patterns = (stitchedContext as Record<string, unknown>).repetitivePatterns as RepetitiveWorkflowPattern[] | undefined;

    if (patterns && patterns.length > 0) {
      logger.info('A1: Loaded pre-computed repetitive patterns', {
        patternCount: patterns.length,
        topPattern: patterns[0]?.sequence.join(' → '),
      });

      return {
        userEvidence: {
          ...state.userEvidence,
          repetitivePatterns: patterns,
        },
        progress: 18,
      };
    }

    logger.debug('A1: No repetitive patterns in pre-computed context');
    return { progress: 18 };
  } catch (error) {
    logger.error('A1: Failed to load pre-computed repetitive patterns',
      error instanceof Error ? error : new Error(String(error))
    );
    return { progress: 18 };
  }
}

/**
 * Node: Load pre-computed stitched context from session_mappings.stitched_context.
 * Context is pre-computed during the desktop app's "analyzing" phase via
 * POST /api/v2/sessions/stitch-context. No on-the-fly LLM stitching needed.
 */
async function stitchContextAcrossSessions(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, sessionMappingRepository } = deps;

  if (!state.userEvidence) {
    logger.debug('A1: Skipping context stitching (no user evidence)');
    return { progress: 19 };
  }

  logger.info('A1: Loading pre-computed stitched context from DB');

  try {
    // Extract session IDs from user evidence
    const sessionIds = state.userEvidence.sessions.map(s => s.sessionId);

    if (sessionIds.length === 0) {
      logger.debug('A1: No session IDs to load stitched context for');
      return { progress: 19 };
    }

    // Bulk read stitched_context for all sessions in the evidence
    const stitchedContextMap = await sessionMappingRepository.getPreComputedStitching(sessionIds);

    if (stitchedContextMap.size === 0) {
      logger.debug('A1: No pre-computed stitched context found for sessions');
      return { progress: 19 };
    }

    // Reconstruct StitchedContext from the most recent session's pre-computed data
    // (the latest session has the cumulative context of all previous sessions)
    const latestStitchedContext = Array.from(stitchedContextMap.values()).pop() as Record<string, unknown> | undefined;

    if (!latestStitchedContext) {
      return { progress: 19 };
    }

    // Build the StitchedContext shape expected by downstream nodes
    const workstreamAssignment = latestStitchedContext.workstreamAssignment as Record<string, unknown> | null;
    const toolMasteryGroups = (latestStitchedContext.toolMasteryGroups || []) as Array<{
      toolName: string;
      usagePatterns: Array<{ patternName: string; description: string; frequency: number; avgDurationSeconds: number; sessionIds: string[] }>;
      sessionIds: string[];
      totalTimeSeconds: number;
      optimizationOpportunities: string[];
    }>;

    const stitchedContext = {
      workstreams: workstreamAssignment ? [{
        workstreamId: workstreamAssignment.workstreamId as string,
        name: workstreamAssignment.workstreamName as string,
        outcomeDescription: workstreamAssignment.outcomeDescription as string,
        confidence: workstreamAssignment.confidence as number,
        sessionIds: (workstreamAssignment.relatedSessionIds as string[]) || [],
        topics: [] as string[],
        toolsUsed: [] as string[],
        firstActivity: '',
        lastActivity: '',
        totalDurationSeconds: 0,
      }] : [],
      toolMasteryGroups,
      ungroupedSessionIds: [] as string[],
      metadata: {
        totalSessions: sessionIds.length,
        sessionsStitched: stitchedContextMap.size,
        workstreamCount: workstreamAssignment ? 1 : 0,
        toolGroupCount: toolMasteryGroups.length,
        processingTimeMs: 0,
        stitchingVersion: (latestStitchedContext.stitchingVersion as string) || '1.0.0',
      },
    };

    logger.info('A1: Loaded pre-computed stitched context', {
      sessionsWithContext: stitchedContextMap.size,
      workstreamCount: stitchedContext.workstreams.length,
      toolGroupCount: stitchedContext.toolMasteryGroups.length,
    });

    return {
      stitchedContext,
      progress: 19,
    };
  } catch (error) {
    logger.error('A1: Failed to load pre-computed stitched context',
      error instanceof Error ? error : new Error(String(error))
    );
    return { progress: 19 };
  }
}


/**
 * Create the A1 Retrieval Agent graph
 */
export function createRetrievalGraph(deps: RetrievalGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A1 Retrieval Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('retrieve_user_evidence', (state) =>
      retrieveUserEvidence(state, deps)
    )
    .addNode('detect_repetitive_patterns', (state) =>
      detectRepetitivePatterns(state, deps)
    )
    .addNode('stitch_context', (state) =>
      stitchContextAcrossSessions(state, deps)
    )
    .addNode('critique_retrieval', (state) => critiqueRetrieval(state, deps))

    // Define edges
    .addEdge('__start__', 'retrieve_user_evidence')
    .addEdge('retrieve_user_evidence', 'detect_repetitive_patterns')
    .addEdge('detect_repetitive_patterns', 'stitch_context')
    .addEdge('stitch_context', 'critique_retrieval')

    // Conditional routing after critique
    .addConditionalEdges('critique_retrieval', routeAfterCritique, {
      continue: END,
      retry: 'retrieve_user_evidence',
      fail_gracefully: END,
    });

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Session data structure supporting both V1 (chapters) and V2 (workflows) formats
 */
interface SessionChapterData {
  schemaVersion?: 1 | 2;
  highLevelSummary?: string;
  /** Screenshot-level descriptions from Gemini Vision analysis, keyed by timestamp */
  screenshotDescriptions?: Record<string, {
    description: string;
    app: string;
    category: string;
    isMeaningful: boolean;
    ocrText: string | null;
    hasOcr: boolean;
    appName: string | null;
    windowTitle: string | null;
    browserUrl: string | null;
  }>;
  /** Deep gap & improvement analysis from Gemini Vision (pre-computed by Desktop companion) */
  gapAnalysis?: Record<string, unknown>;
  /** Session insights from Gemini (at-a-glance, impressive things, issues, improvements) */
  insights?: Record<string, unknown>;
  /** Peer insights fetched from backend API for this session's journey node */
  peerInsights?: Record<string, unknown>[] | null;
  /** User-provided notes to improve summary accuracy */
  userNotes?: string | null;
  /** Pre-computed context stitching (workstreams, tool mastery, patterns) */
  stitchedContext?: Record<string, unknown> | null;
  // V1: Chapter-based structure
  chapters?: Array<{
    chapter_id: number;
    title: string;
    summary: string;
    primary_app?: string | null;
    time_start?: string | null;
    time_end?: string | null;
    granular_steps?: Array<{
      step_id: number;
      description: string;
      timestamp: string;
      app: string;
    }>;
  }>;
  // V2: Workflow-based structure with 5-tier classification
  workflows?: Array<{
    id: string;
    workflow_summary?: string;
    classification: {
      level_1_intent: string;
      level_2_problem: string;
      level_3_approach: string;
      level_4_tools: string[];
      level_5_outcome?: string;
      workflow_type: string;
    };
    timestamps: {
      start: string;
      end: string;
      duration_ms: number;
    };
    comparison_signature?: {
      step_hash: string;
      complexity_score: number;
    };
    semantic_steps: Array<{
      step_name: string;
      duration_seconds: number;
      tools_involved: string[];
      description: string;
      raw_action_count?: number;
      agentic_pattern?: string;
    }>;
    inefficiencies?: Array<{
      type: string;
      detected_at: string;
      description: string;
      time_lost_seconds: number;
    }>;
    recommendations?: Array<{
      title: string;
      description: string;
      confidence_score: number;
      impact_score: string;
      estimated_time_savings_minutes?: number;
    }>;
  }>;
}

/**
 * Detect schema version from session data
 */
function detectSessionSchemaVersion(data: unknown): 1 | 2 {
  if (!data || typeof data !== 'object') return 1;
  const obj = data as Record<string, unknown>;
  if (obj.schema_version === 2 || obj.workflows) return 2;
  return 1;
}

/**
 * Fetch full session data with chapters from session_mappings
 * This retrieves the AI-generated summaries from the desktop app
 */
async function fetchSessionChapters(
  userId: number,
  relatedSessions: Array<{ sessionId: string }>,
  sessionMappingRepository: SessionMappingRepository,
  logger: Logger
): Promise<Map<string, SessionChapterData>> {
  const chaptersMap = new Map<string, SessionChapterData>();

  if (!relatedSessions || relatedSessions.length === 0) {
    return chaptersMap;
  }

  try {
    for (const session of relatedSessions) {
      // Get session mapping by desktop session ID
      const sessionMapping = await sessionMappingRepository.getByDesktopSessionId(
        userId,
        session.sessionId
      );

      if (sessionMapping) {
        // Get screenshot descriptions from session mapping (keyed by timestamp)
        // This is extracted from sessionMapping and shared across all branches
        const screenshotDescriptions = (sessionMapping as any).screenshotDescriptions as Record<string, {
          description: string;
          app: string;
          category: string;
          isMeaningful: boolean;
          ocrText: string | null;
          hasOcr: boolean;
          appName: string | null;
          windowTitle: string | null;
          browserUrl: string | null;
        }> | null;

        // Extract enriched JSONB columns from session_mapping
        const gapAnalysis = (sessionMapping as any).gapAnalysis as Record<string, unknown> | null;
        const insights = (sessionMapping as any).insights as Record<string, unknown> | null;
        const peerInsights = (sessionMapping as any).peerInsights as Record<string, unknown>[] | null;
        const userNotes = (sessionMapping as any).userNotes as string | null;
        const stitchedContext = (sessionMapping as any).stitchedContext as Record<string, unknown> | null;

        // First, try to get summary data from session_mapping.summary (new approach)
        // This contains the full AI-generated summary with chapters/workflows
        const summaryData = sessionMapping.summary as Record<string, any> | null;

        if (summaryData) {
          const schemaVersion = detectSessionSchemaVersion(summaryData);

          logger.debug('A1: Found summary in session_mapping', {
            sessionId: session.sessionId,
            schemaVersion,
            hasWorkflows: !!summaryData.workflows,
            workflowsLength: summaryData.workflows?.length,
            hasChapters: !!summaryData.chapters,
            chaptersLength: summaryData.chapters?.length,
            hasScreenshotDescriptions: !!screenshotDescriptions,
            screenshotDescriptionsCount: screenshotDescriptions ? Object.keys(screenshotDescriptions).length : 0,
          });

          if (schemaVersion === 2 && summaryData.workflows?.length > 0) {
            // V2: Workflow-based data from session_mapping.summary
            chaptersMap.set(session.sessionId, {
              schemaVersion: 2,
              highLevelSummary: summaryData.highLevelSummary || sessionMapping.highLevelSummary || undefined,
              workflows: summaryData.workflows,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });

            logger.debug('A1: Using workflows from session_mapping.summary (V2)', {
              sessionId: session.sessionId,
              highLevelSummary: (summaryData.highLevelSummary || sessionMapping.highLevelSummary)?.substring(0, 100),
              workflowCount: summaryData.workflows.length,
              firstWorkflowSteps: summaryData.workflows[0]?.semantic_steps?.length,
            });
          } else if (summaryData.chapters?.length > 0) {
            // V1: Chapter-based data from session_mapping.summary
            chaptersMap.set(session.sessionId, {
              schemaVersion: 1,
              highLevelSummary: summaryData.highLevelSummary || sessionMapping.highLevelSummary || undefined,
              chapters: summaryData.chapters,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });

            logger.debug('A1: Using chapters from session_mapping.summary (V1)', {
              sessionId: session.sessionId,
              highLevelSummary: (summaryData.highLevelSummary || sessionMapping.highLevelSummary)?.substring(0, 100),
              chapterCount: summaryData.chapters.length,
            });
          } else if (sessionMapping.highLevelSummary) {
            // Summary exists but no workflows/chapters
            chaptersMap.set(session.sessionId, {
              highLevelSummary: sessionMapping.highLevelSummary,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });
          }
        } else if (sessionMapping.nodeId) {
          // Fallback: Try to get from node metadata (legacy approach)
          const nodeData = await sessionMappingRepository.getByNodeIdWithMeta(
            sessionMapping.nodeId,
            { page: 1, limit: 1 }
          );

          logger.debug('A1: Fallback to nodeMeta for session', {
            sessionId: session.sessionId,
            nodeId: sessionMapping.nodeId,
            hasNodeMeta: !!nodeData.nodeMeta,
            nodeMetaKeys: nodeData.nodeMeta ? Object.keys(nodeData.nodeMeta) : [],
            hasWorkflows: !!nodeData.nodeMeta?.workflows,
            hasChapters: !!nodeData.nodeMeta?.chapters,
          });

          const schemaVersion = detectSessionSchemaVersion(nodeData.nodeMeta);

          if (schemaVersion === 2 && nodeData.nodeMeta?.workflows) {
            chaptersMap.set(session.sessionId, {
              schemaVersion: 2,
              highLevelSummary: sessionMapping.highLevelSummary || undefined,
              workflows: nodeData.nodeMeta.workflows,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });
          } else if (nodeData.nodeMeta?.chapters) {
            chaptersMap.set(session.sessionId, {
              schemaVersion: 1,
              highLevelSummary: sessionMapping.highLevelSummary || undefined,
              chapters: nodeData.nodeMeta.chapters,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });
          } else if (sessionMapping.highLevelSummary) {
            chaptersMap.set(session.sessionId, {
              highLevelSummary: sessionMapping.highLevelSummary,
              screenshotDescriptions: screenshotDescriptions || undefined,
              gapAnalysis: gapAnalysis || undefined,
              insights: insights || undefined,
              peerInsights: peerInsights || undefined,
              userNotes: userNotes || undefined,
              stitchedContext: stitchedContext || undefined,
            });
          }
        } else if (sessionMapping.highLevelSummary) {
          // No summary and no node, but we have highLevelSummary
          chaptersMap.set(session.sessionId, {
            highLevelSummary: sessionMapping.highLevelSummary,
            screenshotDescriptions: screenshotDescriptions || undefined,
            gapAnalysis: gapAnalysis || undefined,
            insights: insights || undefined,
            peerInsights: peerInsights || undefined,
            userNotes: userNotes || undefined,
            stitchedContext: stitchedContext || undefined,
          });
        }
      }
    }

    logger.info('A1: Fetched chapter data for sessions', {
      totalSessions: relatedSessions.length,
      sessionsWithChapters: chaptersMap.size,
    });
  } catch (error) {
    logger.warn('A1: Failed to fetch session chapters, continuing without them', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return chaptersMap;
}

/**
 * Transform NLQ service result to EvidenceBundle format
 */
function transformNLQToEvidence(
  nlqResult: any,
  logger: Logger,
  sessionChaptersMap?: Map<string, SessionChapterData>
): EvidenceBundle {
  const workflows: UserWorkflow[] = [];
  const sessions: SessionInfo[] = [];
  const entities: ExtractedEntity[] = [];
  const concepts: ExtractedConcept[] = [];
  let totalStepCount = 0;
  let totalDurationSeconds = 0;

  // Group screenshot sources by sessionId to create workflows with steps
  const sessionScreenshots = new Map<string, any[]>();

  // Extract from sources - screenshots contain step-level data
  if (nlqResult.sources) {
    for (const source of nlqResult.sources) {
      // Screenshot sources represent individual steps
      if (source.type === 'screenshot' && source.sessionId) {
        const screenshots = sessionScreenshots.get(source.sessionId) || [];
        screenshots.push(source);
        sessionScreenshots.set(source.sessionId, screenshots);
      }

      // Extract entities from description if available
      if (source.description) {
        const extractedEntities = extractEntitiesFromText(source.description);
        entities.push(...extractedEntities);
      }
    }
  }

  // Extract from related work sessions with chapter/workflow data
  if (nlqResult.relatedWorkSessions) {
    for (const session of nlqResult.relatedWorkSessions) {
      // Get session data if available (supports both V1 chapters and V2 workflows)
      const sessionData = sessionChaptersMap?.get(session.sessionId);
      const v2Workflows = sessionData?.workflows || [];
      const chapters = sessionData?.chapters || [];

      // Determine start/end activities based on schema version
      let startActivity = session.name || 'Work session started';
      let endActivity = 'Work session completed';
      let workflowCount = 1;
      let appsUsed: string[] = [];

      if (v2Workflows.length > 0) {
        // V2: Use first/last semantic step descriptions for specific activities
        const firstWorkflow = v2Workflows[0];
        const lastWorkflow = v2Workflows[v2Workflows.length - 1];
        const firstStep = firstWorkflow?.semantic_steps?.[0];
        const lastStep = lastWorkflow?.semantic_steps?.[lastWorkflow?.semantic_steps?.length - 1];

        // Debug: Log semantic step extraction
        logger.debug('A1: Extracting start/end activities from semantic steps', {
          sessionId: session.sessionId,
          firstWorkflowId: firstWorkflow?.id,
          lastWorkflowId: lastWorkflow?.id,
          firstStepName: firstStep?.step_name,
          firstStepDescription: firstStep?.description?.substring(0, 100),
          lastStepName: lastStep?.step_name,
          lastStepDescription: lastStep?.description?.substring(0, 100),
          totalSemanticSteps: v2Workflows.reduce((sum, wf) => sum + (wf.semantic_steps?.length || 0), 0),
        });

        // startActivity: First meaningful action after session started
        startActivity = firstStep?.step_name || firstStep?.description ||
          firstWorkflow?.classification?.level_1_intent || startActivity;
        // endActivity: Last meaningful action before session ended
        endActivity = lastStep?.step_name || lastStep?.description ||
          lastWorkflow?.classification?.level_1_intent || endActivity;
        workflowCount = v2Workflows.length;
        appsUsed = v2Workflows.flatMap(wf => wf.classification?.level_4_tools || []);
      } else if (chapters.length > 0) {
        // V1: Use first/last granular step descriptions for specific activities
        const firstChapter = chapters[0];
        const lastChapter = chapters[chapters.length - 1];
        const firstStep = firstChapter?.granular_steps?.[0];
        const lastStep = lastChapter?.granular_steps?.[lastChapter?.granular_steps?.length - 1];

        // Debug: Log granular step extraction
        logger.debug('A1: Extracting start/end activities from granular steps (V1)', {
          sessionId: session.sessionId,
          firstChapterTitle: firstChapter?.title,
          lastChapterTitle: lastChapter?.title,
          firstStepDescription: firstStep?.description?.substring(0, 100),
          lastStepDescription: lastStep?.description?.substring(0, 100),
          totalGranularSteps: chapters.reduce((sum, ch) => sum + (ch.granular_steps?.length || 0), 0),
        });

        // startActivity: First meaningful action after session started
        startActivity = firstStep?.description || firstChapter?.title || startActivity;
        // endActivity: Last meaningful action before session ended
        endActivity = lastStep?.description || lastChapter?.title || endActivity;
        workflowCount = chapters.length;
        appsUsed = chapters.map(c => c.primary_app).filter(Boolean) as string[];
      }

      // Log final start/end activities
      logger.debug('A1: Session start/end activities determined', {
        sessionId: session.sessionId,
        startActivity: startActivity.substring(0, 100),
        endActivity: endActivity.substring(0, 100),
        source: v2Workflows.length > 0 ? 'V2_workflows' : chapters.length > 0 ? 'V1_chapters' : 'fallback',
      });

      sessions.push({
        sessionId: session.sessionId,
        highLevelSummary: sessionData?.highLevelSummary || session.summary || session.name,
        startActivity,
        endActivity,
        startTime: session.timestamp,
        endTime: session.timestamp, // Will be updated from screenshots
        durationSeconds: 0,
        workflowCount,
        appsUsed,
        // Include screenshot-level descriptions for granular insight generation
        screenshotDescriptions: sessionData?.screenshotDescriptions,
        // Enriched JSONB from session_mappings (replaces A2/A5)
        gapAnalysis: sessionData?.gapAnalysis,
        insights: sessionData?.insights,
        peerInsights: sessionData?.peerInsights,
        userNotes: sessionData?.userNotes || undefined,
      });

      // Ensure we have an entry for this session in screenshots map
      if (!sessionScreenshots.has(session.sessionId)) {
        sessionScreenshots.set(session.sessionId, []);
      }
    }
  }

  // Create workflows from V2 workflows (5-tier classification) or V1 chapters
  for (const [sessionId, screenshots] of sessionScreenshots) {
    // Sort screenshots by timestamp to get correct step order
    const sortedScreenshots = screenshots.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });

    // Get session data for this session
    const sessionData = sessionChaptersMap?.get(sessionId);
    const v2Workflows = sessionData?.workflows || [];
    const chapters = sessionData?.chapters || [];

    // Debug: Log workflow creation decision
    logger.debug('A1: Creating workflows for session', {
      sessionId,
      hasSessionData: !!sessionData,
      sessionDataKeys: sessionData ? Object.keys(sessionData) : [],
      v2WorkflowsCount: v2Workflows.length,
      chaptersCount: chapters.length,
      screenshotCount: screenshots.length,
      branch: v2Workflows.length > 0 ? 'V2_workflows' : chapters.length > 0 ? 'V1_chapters' : 'fallback_screenshots',
    });

    // V2: If we have workflows with 5-tier classification, use them
    if (v2Workflows.length > 0) {
      for (const wf of v2Workflows) {
        // Extract 5-tier classification
        const classification = wf.classification || {};
        const intent = classification.level_1_intent || 'Unknown intent';
        const problem = classification.level_2_problem || '';
        const approach = classification.level_3_approach || '';
        const toolsFromClassification = classification.level_4_tools || [];
        const outcome = classification.level_5_outcome || '';
        const workflowSummary = wf.workflow_summary || '';

        // Convert semantic_steps to UserStep format
        // step_name = short title, description = longer summary
        const workflowSteps: UserStep[] = (wf.semantic_steps || []).map((ss, index) => ({
          stepId: `step-${wf.id || sessionId}-${index}`,
          description: ss.step_name || ss.description || 'Untitled step',
          stepSummary: ss.description && ss.step_name ? ss.description : undefined,
          app: ss.tools_involved?.[0] || 'Unknown',
          toolCategory: categorizeApp(ss.tools_involved?.[0] || ''),
          durationSeconds: ss.duration_seconds || 30,
          timestamp: wf.timestamps?.start || '',
          // Include agentic pattern if available
          agenticPattern: ss.agentic_pattern,
          rawActionCount: ss.raw_action_count,
        }));

        const workflowDuration = wf.timestamps?.duration_ms
          ? Math.round(wf.timestamps.duration_ms / 1000)
          : workflowSteps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

        totalStepCount += workflowSteps.length;
        totalDurationSeconds += workflowDuration;

        // Collect all tools from steps and classification
        const stepTools = workflowSteps.flatMap(s => s.app ? [s.app] : []);
        const allTools = [...new Set([...toolsFromClassification, ...stepTools])];
        const primaryApp = allTools[0] || 'Unknown';

        // Build a rich intent combining Level 1 + Level 2
        const fullIntent = problem ? `${intent}: ${problem}` : intent;

        // Use workflow_summary if available, otherwise fallback to fullIntent
        const summaryText = workflowSummary || fullIntent;

        const workflow: UserWorkflow = {
          workflowId: `wf-${sessionId}-${wf.id || 'unknown'}`,
          title: intent, // Use Level 1 intent as title
          summary: summaryText, // Use workflow_summary or combine intent + problem
          intent: fullIntent, // Full 5-tier intent
          approach: approach || `Using ${allTools.join(', ')}`, // Level 3 approach
          primaryApp,
          steps: workflowSteps,
          totalDurationSeconds: workflowDuration,
          tools: allTools,
          timeStart: wf.timestamps?.start || sortedScreenshots[0]?.timestamp || '',
          timeEnd: wf.timestamps?.end || sortedScreenshots[sortedScreenshots.length - 1]?.timestamp || '',
          sessionId,
          // Store full classification for downstream use
          context: JSON.stringify({
            schemaVersion: 2,
            classification,
            workflowSummary,
            outcome,
            inefficiencies: wf.inefficiencies,
            recommendations: wf.recommendations,
            workflowType: classification.workflow_type,
          }),
        };

        workflows.push(workflow);

        logger.debug('A1: Created workflow from V2 classification', {
          sessionId,
          workflowId: wf.id,
          intent,
          problem,
          approach,
          outcome,
          workflowSummary: workflowSummary?.substring(0, 100) || '(empty)',
          tools: allTools,
          stepCount: workflowSteps.length,
          // Include first 3 step descriptions for debugging
          stepSamples: workflowSteps.slice(0, 3).map(s => ({
            description: s.description?.substring(0, 80),
            app: s.app,
            durationSeconds: s.durationSeconds,
          })),
        });
      }
    } else if (chapters.length > 0) {
      // V1: Fall back to chapter-based workflows
      for (const chapter of chapters) {
        // Get steps for this chapter from granular_steps or derive from screenshots
        const chapterSteps: UserStep[] = chapter.granular_steps?.map((gs, index) => ({
          stepId: `step-${chapter.chapter_id}-${gs.step_id || index}`,
          description: gs.description,
          app: gs.app || chapter.primary_app || 'Unknown',
          toolCategory: categorizeApp(gs.app || chapter.primary_app || ''),
          durationSeconds: 30,
          timestamp: gs.timestamp || '',
        })) || [];

        // If no granular steps, create steps from screenshot data for this chapter's time range
        if (chapterSteps.length === 0 && chapter.time_start && chapter.time_end) {
          const chapterStart = new Date(chapter.time_start).getTime();
          const chapterEnd = new Date(chapter.time_end).getTime();

          const chapterScreenshots = sortedScreenshots.filter(ss => {
            const ssTime = ss.timestamp ? new Date(ss.timestamp).getTime() : 0;
            return ssTime >= chapterStart && ssTime <= chapterEnd;
          });

          chapterScreenshots.forEach((ss, index) => {
            const app = ss.metadata?.workflowTag ||
              extractToolFromText(ss.title || ss.description || '') ||
              chapter.primary_app || 'Unknown';

            chapterSteps.push({
              stepId: `step-${chapter.chapter_id}-${ss.id || index}`,
              description: ss.title || ss.description || 'Screenshot step',
              app,
              toolCategory: categorizeApp(app),
              durationSeconds: 30,
              timestamp: ss.timestamp || '',
            });
          });
        }

        const workflowDuration = chapterSteps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
        totalStepCount += chapterSteps.length;
        totalDurationSeconds += workflowDuration;

        const tools = [...new Set(chapterSteps.map(s => s.app).filter(Boolean))];
        const primaryApp = chapter.primary_app || tools[0] || 'Unknown';

        // Generate a meaningful approach from V1 chapter data
        const toolsApproach = tools.length > 1
          ? `Multi-tool workflow using ${tools.slice(0, 3).join(', ')}${tools.length > 3 ? ' and others' : ''}`
          : `${primaryApp}-based workflow`;

        const workflow: UserWorkflow = {
          workflowId: `wf-${sessionId}-ch-${chapter.chapter_id}`,
          title: chapter.title,
          summary: chapter.summary,
          intent: chapter.title, // Use title as intent for V1 (more concise than summary)
          approach: toolsApproach,
          primaryApp,
          steps: chapterSteps,
          totalDurationSeconds: workflowDuration,
          tools,
          timeStart: chapter.time_start || sortedScreenshots[0]?.timestamp || '',
          timeEnd: chapter.time_end || sortedScreenshots[sortedScreenshots.length - 1]?.timestamp || '',
          sessionId,
          context: JSON.stringify({ schemaVersion: 1 }),
        };

        workflows.push(workflow);

        logger.debug('A1: Created workflow from V1 chapter', {
          sessionId,
          chapterId: chapter.chapter_id,
          title: chapter.title,
          stepCount: chapterSteps.length,
        });
      }
    } else {
      // Fallback: No chapters available, create a single workflow from session
      const sessionInfo = sessions.find(s => s.sessionId === sessionId);
      const sessionName = sessionInfo?.highLevelSummary ||
        sortedScreenshots[0]?.title ||
        'Work Session';

      // Convert screenshots to steps
      const steps: UserStep[] = sortedScreenshots.map((ss, index) => {
        const app = ss.metadata?.workflowTag ||
          extractToolFromText(ss.title || ss.description || '');

        return {
          stepId: `step-${ss.id || index}`,
          description: ss.title || ss.description || 'Screenshot step',
          app,
          toolCategory: categorizeApp(app),
          durationSeconds: 30,
          timestamp: ss.timestamp || '',
        };
      });

      const workflowDuration = steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      totalStepCount += steps.length;
      totalDurationSeconds += workflowDuration;

      const tools = [...new Set(steps.map(s => s.app).filter(Boolean))];
      const primaryApp = tools[0] || 'Unknown';

      // Generate a meaningful approach from available tools
      const fallbackApproach = tools.length > 1
        ? `Multi-tool workflow using ${tools.slice(0, 3).join(', ')}${tools.length > 3 ? ' and others' : ''}`
        : tools.length === 1
          ? `${primaryApp}-based workflow`
          : 'General workflow';

      const workflow: UserWorkflow = {
        workflowId: `wf-${sessionId}`,
        title: sessionName,
        summary: sessionData?.highLevelSummary || sessionName,
        intent: sessionData?.highLevelSummary || 'Extracted from session',
        approach: fallbackApproach,
        primaryApp,
        steps,
        totalDurationSeconds: workflowDuration,
        tools,
        timeStart: sortedScreenshots[0]?.timestamp || '',
        timeEnd: sortedScreenshots[sortedScreenshots.length - 1]?.timestamp || '',
        sessionId,
        context: JSON.stringify({ schemaVersion: 1, fallback: true }),
      };
      workflows.push(workflow);
    }

    // Update session info if not present
    const existingSession = sessions.find(s => s.sessionId === sessionId);
    if (!existingSession) {
      const sessionData = sessionChaptersMap?.get(sessionId);
      const v2Workflows = sessionData?.workflows || [];
      const chapters = sessionData?.chapters || [];

      // Determine workflow count based on schema version
      const workflowCount = v2Workflows.length || chapters.length || 1;

      // Determine start/end activities from semantic steps
      let startActivity = 'Work session started';
      let endActivity = 'Work session completed';

      if (v2Workflows.length > 0) {
        const firstWorkflow = v2Workflows[0];
        const lastWorkflow = v2Workflows[v2Workflows.length - 1];
        const firstStep = firstWorkflow?.semantic_steps?.[0];
        const lastStep = lastWorkflow?.semantic_steps?.[lastWorkflow?.semantic_steps?.length - 1];
        startActivity = firstStep?.step_name || firstStep?.description ||
          firstWorkflow?.classification?.level_1_intent || startActivity;
        endActivity = lastStep?.step_name || lastStep?.description ||
          lastWorkflow?.classification?.level_1_intent || endActivity;
      } else if (chapters.length > 0) {
        const firstChapter = chapters[0];
        const lastChapter = chapters[chapters.length - 1];
        const firstStep = firstChapter?.granular_steps?.[0];
        const lastStep = lastChapter?.granular_steps?.[lastChapter?.granular_steps?.length - 1];
        startActivity = firstStep?.description || firstChapter?.title || startActivity;
        endActivity = lastStep?.description || lastChapter?.title || endActivity;
      }

      sessions.push({
        sessionId,
        highLevelSummary: sessionData?.highLevelSummary || sortedScreenshots[0]?.title || 'Work Session',
        startActivity,
        endActivity,
        startTime: sortedScreenshots[0]?.timestamp || '',
        endTime: sortedScreenshots[sortedScreenshots.length - 1]?.timestamp || '',
        durationSeconds: totalDurationSeconds,
        workflowCount,
        appsUsed: v2Workflows.flatMap(wf => wf.classification?.level_4_tools || []),
      });
    }
  }

  // Build session knowledge base entries (complete data, no truncation)
  const sessionKnowledgeBase: SessionKnowledgeEntry[] = sessions.map(session => {
    const sessionData = sessionChaptersMap?.get(session.sessionId);
    const v2Workflows = sessionData?.workflows || [];
    const chapters = sessionData?.chapters || [];

    // Build KB workflows from V2 or V1 data
    const kbWorkflows: KnowledgeBaseWorkflow[] = [];
    if (v2Workflows.length > 0) {
      for (const wf of v2Workflows) {
        kbWorkflows.push({
          workflowSummary: wf.workflow_summary || '',
          intent: wf.classification?.level_1_intent || '',
          approach: wf.classification?.level_3_approach || '',
          tools: wf.classification?.level_4_tools || [],
          durationSeconds: wf.timestamps?.duration_ms ? Math.round(wf.timestamps.duration_ms / 1000) : 0,
          steps: (wf.semantic_steps || []).map(s => ({
            stepName: s.step_name || '',
            description: s.description || '',
            durationSeconds: s.duration_seconds || 0,
            toolsInvolved: s.tools_involved || [],
            agenticPattern: s.agentic_pattern,
          })),
        });
      }
    } else if (chapters.length > 0) {
      for (const ch of chapters) {
        kbWorkflows.push({
          workflowSummary: ch.title || '',
          intent: ch.title || '',
          approach: ch.summary || '',
          tools: ch.primary_app ? [ch.primary_app] : [],
          durationSeconds: (ch.granular_steps || []).length * 30,
          steps: (ch.granular_steps || []).map(s => ({
            stepName: s.description || '',
            description: s.description || '',
            durationSeconds: 30,
            toolsInvolved: s.app ? [s.app] : [],
          })),
        });
      }
    }

    return {
      sessionId: session.sessionId,
      title: session.highLevelSummary || session.startActivity || 'Untitled Session',
      highLevelSummary: session.highLevelSummary || '',
      durationSeconds: session.durationSeconds,
      appsUsed: session.appsUsed,
      userNotes: session.userNotes || undefined,
      workflows: kbWorkflows,
      gapAnalysis: sessionData?.gapAnalysis || null,
      insights: sessionData?.insights || null,
      peerInsights: sessionData?.peerInsights || null,
      screenshotDescriptions: sessionData?.screenshotDescriptions as Record<string, unknown> || null,
      stitchedContext: sessionData?.stitchedContext || null,
    };
  });

  logger.info('Transformed NLQ to evidence', {
    workflowCount: workflows.length,
    sessionCount: sessions.length,
    entityCount: entities.length,
    totalStepCount,
    knowledgeBaseEntries: sessionKnowledgeBase.length,
    // Include workflow summary samples for debugging
    workflowSamples: workflows.slice(0, 3).map(w => ({
      workflowId: w.workflowId,
      title: w.title?.substring(0, 50),
      summary: w.summary?.substring(0, 80) || '(empty)',
      stepCount: w.steps?.length || 0,
      hasStepDescriptions: w.steps?.some(s => s.description?.length > 0) || false,
    })),
  });

  return {
    workflows,
    sessions,
    entities: deduplicateEntities(entities),
    concepts,
    totalStepCount,
    totalDurationSeconds,
    retrievalMetadata: {
      queryTimeMs: nlqResult.retrievalMetadata?.totalTimeMs || 0,
      sourcesRetrieved: nlqResult.sources?.length || 0,
      retrievalMethod: 'hybrid',
      embeddingModel: 'text-embedding-3-small',
    },
    sessionKnowledgeBase,
  };
}

/**
 * Extract tool/app name from text description
 */
function extractToolFromText(text: string): string {
  const toolPatterns = [
    { pattern: /Chrome|Firefox|Safari|Edge|browser/i, tool: 'Browser' },
    { pattern: /VS\s*Code|VSCode|Visual Studio Code/i, tool: 'VSCode' },
    { pattern: /Claude|Anthropic/i, tool: 'Claude' },
    { pattern: /GitHub|git/i, tool: 'GitHub' },
    { pattern: /Slack/i, tool: 'Slack' },
    { pattern: /Notion/i, tool: 'Notion' },
    { pattern: /Figma/i, tool: 'Figma' },
    { pattern: /Terminal|bash|zsh|shell/i, tool: 'Terminal' },
    { pattern: /Jira|Linear/i, tool: 'Issue Tracker' },
  ];

  for (const { pattern, tool } of toolPatterns) {
    if (pattern.test(text)) {
      return tool;
    }
  }

  return 'Unknown';
}

/**
 * Categorize app into tool category
 */
function categorizeApp(app: string): string {
  const categoryMap: Record<string, string> = {
    'Browser': 'browser',
    'Chrome': 'browser',
    'Firefox': 'browser',
    'Safari': 'browser',
    'VSCode': 'ide',
    'Visual Studio Code': 'ide',
    'Claude': 'ai_assistant',
    'GitHub': 'version_control',
    'Slack': 'communication',
    'Notion': 'documentation',
    'Figma': 'design',
    'Terminal': 'terminal',
    'Issue Tracker': 'project_management',
    'Jira': 'project_management',
    'Linear': 'project_management',
  };

  return categoryMap[app] || 'other';
}

/**
 * Transform attached session context to EvidenceBundle format
 * Used when user explicitly selects sessions via @mention (skips NLQ retrieval)
 */
async function transformAttachedSessionsToEvidence(
  attachedSessions: AttachedSessionContext[],
  logger: Logger,
  sessionMappingRepository?: SessionMappingRepository
): Promise<EvidenceBundle> {
  const workflows: UserWorkflow[] = [];
  const sessions: SessionInfo[] = [];
  let totalStepCount = 0;
  let totalDurationSeconds = 0;

  // Batch-fetch enriched JSONB data (gapAnalysis, insights, peerInsights, screenshotDescriptions)
  let enrichedMap = new Map<string, any>();
  if (sessionMappingRepository) {
    try {
      const sessionIds = attachedSessions.map(s => s.sessionId);
      enrichedMap = await sessionMappingRepository.getEnrichedByIds(sessionIds);
      logger.info('A1: Fetched enriched data for attached sessions', {
        requestedCount: sessionIds.length,
        foundCount: enrichedMap.size,
      });
    } catch (error) {
      logger.warn('A1: Failed to fetch enriched data for attached sessions, continuing without', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const session of attachedSessions) {
    // Determine start/end activities from first/last semantic steps
    const firstWorkflow = session.workflows[0];
    const lastWorkflow = session.workflows[session.workflows.length - 1];
    const firstStep = firstWorkflow?.semantic_steps?.[0];
    const lastStep = lastWorkflow?.semantic_steps?.[lastWorkflow?.semantic_steps?.length - 1];

    // Get enriched JSONB data for this session (if available)
    const enrichedData = enrichedMap.get(session.sessionId);

    // Create SessionInfo from attached session
    sessions.push({
      sessionId: session.sessionId,
      highLevelSummary: session.highLevelSummary || session.title,
      startActivity: firstStep?.step_name || firstWorkflow?.workflow_summary || 'Session started',
      endActivity: lastStep?.step_name || lastWorkflow?.workflow_summary || 'Session ended',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: session.totalDurationSeconds,
      workflowCount: session.workflows.length,
      appsUsed: session.appsUsed,
      // Enriched JSONB from session_mappings (replaces A2/A5)
      screenshotDescriptions: enrichedData?.screenshotDescriptions || undefined,
      gapAnalysis: enrichedData?.gapAnalysis || undefined,
      insights: enrichedData?.insights || undefined,
      peerInsights: enrichedData?.peerInsights || undefined,
      userNotes: enrichedData?.userNotes || undefined,
    });

    // Transform each workflow
    for (let wfIndex = 0; wfIndex < session.workflows.length; wfIndex++) {
      const wf = session.workflows[wfIndex];

      // Transform semantic steps to UserStep format
      const workflowSteps: UserStep[] = (wf.semantic_steps || []).map((step, stepIndex) => ({
        stepId: `attached-step-${session.sessionId}-${wfIndex}-${stepIndex}`,
        description: step.step_name || step.description,
        stepSummary: step.description && step.step_name ? step.description : undefined,
        app: step.tools_involved?.[0] || 'Unknown',
        toolCategory: categorizeApp(step.tools_involved?.[0] || ''),
        durationSeconds: step.duration_seconds || 30,
        timestamp: new Date().toISOString(),
        workflowTag: wf.classification?.level_1_intent || 'unknown',
        order: stepIndex,
      }));

      const workflowDuration = wf.timestamps?.duration_ms
        ? Math.round(wf.timestamps.duration_ms / 1000)
        : workflowSteps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);

      totalStepCount += workflowSteps.length;
      totalDurationSeconds += workflowDuration;

      workflows.push({
        workflowId: `attached-wf-${session.sessionId}-${wfIndex}`,
        title: wf.workflow_summary || 'Untitled Workflow',
        summary: wf.workflow_summary || '',
        intent: wf.classification?.level_1_intent || 'Unknown intent',
        approach: '',
        primaryApp: wf.classification?.level_4_tools?.[0] || 'Unknown',
        steps: workflowSteps,
        totalDurationSeconds: workflowDuration,
        tools: wf.classification?.level_4_tools || [],
        timeStart: new Date().toISOString(),
        timeEnd: new Date().toISOString(),
        sessionId: session.sessionId,
      });
    }
  }

  // Build session knowledge base entries (complete data, no truncation)
  const sessionKnowledgeBase: SessionKnowledgeEntry[] = attachedSessions.map(session => {
    const enrichedData = enrichedMap.get(session.sessionId);
    const kbWorkflows: KnowledgeBaseWorkflow[] = (session.workflows || []).map(wf => {
      const duration = wf.timestamps?.duration_ms
        ? Math.round(wf.timestamps.duration_ms / 1000)
        : (wf.semantic_steps || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      return {
        workflowSummary: wf.workflow_summary || '',
        intent: wf.classification?.level_1_intent || '',
        approach: wf.classification?.level_3_approach || '',
        tools: wf.classification?.level_4_tools || [],
        durationSeconds: duration,
        steps: (wf.semantic_steps || []).map(s => ({
          stepName: s.step_name || '',
          description: s.description || '',
          durationSeconds: s.duration_seconds || 0,
          toolsInvolved: s.tools_involved || [],
          agenticPattern: s.agentic_pattern,
        })),
      };
    });

    // Safe date handling: enrichedData dates may be Date objects or strings
    const startedAt = enrichedData?.startedAt instanceof Date
      ? enrichedData.startedAt.toISOString()
      : (typeof enrichedData?.startedAt === 'string' ? enrichedData.startedAt : undefined);
    const endedAt = enrichedData?.endedAt instanceof Date
      ? enrichedData.endedAt.toISOString()
      : (typeof enrichedData?.endedAt === 'string' ? enrichedData.endedAt : undefined);

    return {
      sessionId: session.sessionId,
      title: session.title || session.highLevelSummary || 'Untitled Session',
      highLevelSummary: enrichedData?.highLevelSummary || session.highLevelSummary || session.title || '',
      startedAt,
      endedAt,
      durationSeconds: session.totalDurationSeconds,
      appsUsed: session.appsUsed,
      userNotes: enrichedData?.userNotes || undefined,
      workflows: kbWorkflows,
      gapAnalysis: enrichedData?.gapAnalysis || null,
      insights: enrichedData?.insights || null,
      peerInsights: enrichedData?.peerInsights || null,
      screenshotDescriptions: enrichedData?.screenshotDescriptions || null,
      stitchedContext: enrichedData?.stitchedContext || null,
    };
  });

  logger.info('A1: Transformed attached sessions to evidence', {
    sessionCount: sessions.length,
    workflowCount: workflows.length,
    totalStepCount,
    totalDurationSeconds,
    knowledgeBaseEntries: sessionKnowledgeBase.length,
  });

  return {
    workflows,
    sessions,
    entities: [], // Entities could be extracted if needed
    concepts: [],
    totalStepCount,
    totalDurationSeconds,
    retrievalMetadata: {
      queryTimeMs: 0, // No retrieval time for attached sessions
      sourcesRetrieved: attachedSessions.length,
      retrievalMethod: 'hybrid', // Using 'hybrid' for compatibility
      embeddingModel: 'n/a', // No embedding used for attached sessions
    },
    sessionKnowledgeBase,
  };
}

/**
 * Check if retrieved evidence is relevant to the query
 */
async function checkRelevance(
  query: string,
  evidence: EvidenceBundle,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<{ isRelevant: boolean; reason: string }> {
  try {
    const workflowSummaries = evidence.workflows
      .slice(0, 3)
      .map((w) => w.name)
      .join(', ');

    const schema = z.object({
      isRelevant: z.boolean(),
      reason: z.string(),
    });

    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: A1_RETRIEVAL_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Determine if the retrieved evidence is relevant to the user's query.

Query: "${query}"

Retrieved workflow summaries: ${workflowSummaries}

Is this evidence relevant to answering the query? Respond with isRelevant (true/false) and a brief reason.`,
          },
        ],
        schema
      ),
      LLM_TIMEOUT_MS,
      'A1 relevance check timed out'
    );

    return response.content;
  } catch (error) {
    logger.warn('Relevance check failed, assuming relevant', { error });
    return { isRelevant: true, reason: 'Relevance check skipped' };
  }
}

/**
 * Extract entities from text content
 */
function extractEntitiesFromText(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Simple pattern matching for common entities
  // In production, this would use NER or the LLM

  // Tools/apps
  const toolPatterns = [
    /\b(Chrome|Firefox|Safari|VSCode|GitHub|Slack|Notion)\b/gi,
  ];
  for (const pattern of toolPatterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      entities.push({
        name: match,
        type: 'tool',
        frequency: 1,
        confidence: 0.8,
      });
    }
  }

  return entities;
}

/**
 * Deduplicate entities by name
 */
function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const map = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = entity.name.toLowerCase();
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.frequency += entity.frequency;
    } else {
      map.set(key, { ...entity });
    }
  }

  return Array.from(map.values());
}

