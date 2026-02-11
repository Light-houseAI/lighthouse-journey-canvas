/**
 * A1 Retrieval Agent Graph
 *
 * LangGraph implementation of the Retrieval Agent (A1) that:
 * 1. Retrieves user's sessions/workflows/steps via Hybrid RAG
 * 2. Retrieves anonymized peer patterns from platform tables
 * 3. Runs critique loop to validate retrieval quality
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
  SessionForStitching,
} from '../types.js';
import {
  ContextStitchingService,
  createContextStitchingService,
} from '../context-stitching.service.js';
import { z } from 'zod';
import { NoiseFilterService } from '../filters/noise-filter.service.js';
import { A1_RETRIEVAL_SYSTEM_PROMPT } from '../prompts/system-prompts.js';
import { classifyQuery, type QueryClassification } from '../classifiers/query-classifier.js';
import {
  getInsightCacheManager,
  QueryEmbeddingCache,
  PeerWorkflowCache,
} from '../utils/insight-cache.js';

// ============================================================================
// LEVEL 3: PII ANONYMIZATION FOR PEER DATA
// ============================================================================

/**
 * PII patterns for anonymizing peer workflow data before showing to other users.
 * This prevents leaking sensitive information like emails, file paths, API keys, etc.
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  urlWithPath: /https?:\/\/[^\s]+/g,
  filePath: /(?:\/Users\/|\/home\/|C:\\Users\\)[^\s\/\\]+/gi,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  apiKey: /(?:api[_-]?key|token|secret|password|auth)[=:]\s*[^\s,;]+/gi,
};

/**
 * Anonymize text by removing PII patterns.
 * Used to sanitize peer workflow data before showing to other users.
 */
function anonymizeText(text: string): string {
  if (!text) return text;

  let anonymized = text;

  // Remove emails
  anonymized = anonymized.replace(PII_PATTERNS.email, '[email]');

  // Remove URLs (keep domain only for context)
  anonymized = anonymized.replace(PII_PATTERNS.urlWithPath, (url) => {
    try {
      const domain = new URL(url).hostname;
      return `[${domain}]`;
    } catch {
      return '[url]';
    }
  });

  // Remove file paths with usernames
  anonymized = anonymized.replace(PII_PATTERNS.filePath, '[path]');

  // Remove UUIDs
  anonymized = anonymized.replace(PII_PATTERNS.uuid, '[id]');

  // Remove API keys/tokens
  anonymized = anonymized.replace(PII_PATTERNS.apiKey, '[credential]');

  // Remove phone numbers
  anonymized = anonymized.replace(PII_PATTERNS.phone, '[phone]');

  // Remove IP addresses
  anonymized = anonymized.replace(PII_PATTERNS.ipAddress, '[ip]');

  return anonymized;
}

/**
 * Anonymize a peer workflow by sanitizing all text fields.
 * This is LEVEL 3 of the privacy fix - ensures no PII leaks to other users.
 */
function anonymizePeerWorkflow(workflow: UserWorkflow): UserWorkflow {
  return {
    ...workflow,
    title: anonymizeText(workflow.title || ''),
    summary: anonymizeText(workflow.summary || ''),
    intent: anonymizeText(workflow.intent || ''),
    approach: anonymizeText(workflow.approach || ''),
    context: workflow.context ? anonymizeText(workflow.context) : undefined,
    steps: workflow.steps?.map(step => ({
      ...step,
      description: anonymizeText(step.description || ''),
    })) || [],
  };
}

/**
 * Anonymize an evidence bundle containing peer workflows.
 */
function anonymizePeerEvidence(evidence: EvidenceBundle): EvidenceBundle {
  return {
    ...evidence,
    workflows: evidence.workflows.map(anonymizePeerWorkflow),
  };
}

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
  /** Whether to enable context stitching (default: false for backward compatibility) */
  enableContextStitching?: boolean;
  /** Context stitching persistence service for saving results to graph */
  contextStitchingPersistenceService?: any; // Type will be ContextStitchingPersistenceService
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

    // Transform attached sessions to EvidenceBundle format
    const userEvidence = transformAttachedSessionsToEvidence(
      state.attachedSessionContext,
      logger
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
    }, { skipLLMGeneration: true }); // A1 only needs sources/sessions, not the NLQ answer

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
    // Log what session/workflow/step data is going downstream to A2/A3/A4 agents
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
 * Node: Retrieve anonymized peer evidence from platform tables or cross-user sessions
 *
 * Strategy:
 * 1. First try platform_workflow_patterns table (curated patterns)
 * 2. If empty, try cross-user session search via pgvector (semantic similarity)
 * 3. If still empty, try ArangoDB graph-based peer retrieval (structural similarity)
 */
async function retrievePeerEvidence(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, platformWorkflowRepository, sessionMappingRepository, graphService, embeddingService } = deps;

  if (!state.includePeerComparison) {
    logger.info('A1: Peer comparison disabled, skipping');
    return {
      peerEvidence: null,
      currentStage: 'a1_peer_evidence_skipped',
      progress: 25,
    };
  }

  const peerEvidenceStartMs = Date.now();
  logger.info('A1: Retrieving peer evidence from platform');

  try {
    // AI4 OPTIMIZATION: Cache query embeddings for repeated queries
    const cacheManager = getInsightCacheManager();
    const embeddingCacheKey = QueryEmbeddingCache.makeKey(state.query);
    let queryEmbedding = cacheManager.queryEmbeddings.get(embeddingCacheKey);

    if (queryEmbedding) {
      logger.debug('A1: Using cached query embedding', { cacheKey: embeddingCacheKey.slice(0, 50) });
    } else {
      queryEmbedding = await embeddingService.generateEmbedding(state.query);
      cacheManager.queryEmbeddings.set(embeddingCacheKey, queryEmbedding);
      logger.debug('A1: Cached new query embedding', { cacheKey: embeddingCacheKey.slice(0, 50) });
    }

    // AI4 OPTIMIZATION: Check peer workflow cache before fetching
    const embeddingHash = PeerWorkflowCache.hashEmbedding(queryEmbedding);
    const peerCacheKey = PeerWorkflowCache.makeKey(state.userId, embeddingHash);
    const cachedPeerEvidence = cacheManager.peerWorkflows.get(peerCacheKey);

    if (cachedPeerEvidence) {
      logger.info('A1: Using cached peer evidence', {
        workflowCount: cachedPeerEvidence.workflows.length,
        cacheHit: true,
      });
      return {
        peerEvidence: cachedPeerEvidence,
        currentStage: 'a1_peer_evidence_cached',
        progress: 25,
      };
    }

    // Determine workflow type from user's evidence (if available)
    const workflowType = state.userEvidence?.workflows[0]?.title
      ? inferWorkflowType(state.userEvidence.workflows[0].title)
      : undefined;

    // OPTIMIZATION MT2: Reduce peer workflow limit from 10 to 5
    // A3-Comparator only uses 3 peer workflows, so fetching 10 was wasteful
    const PEER_WORKFLOW_LIMIT = 5;

    // Convert Float32Array to number[] for repository compatibility
    const embeddingArray = Array.from(queryEmbedding);

    // PARALLEL PEER RETRIEVAL: Run all 3 strategies concurrently for speed
    // Pick the first strategy (by priority) that returns results
    // Priority: Strategy 1 (curated patterns) > Strategy 2 (cross-user) > Strategy 3 (graph)

    // Extract entities for Strategy 3 upfront
    const userEntities = state.userEvidence?.entities?.map(e => e.name) ||
      state.userEvidence?.workflows.flatMap(w => w.tools || []) || [];

    // Helper: apply domain filtering to evidence
    const applyDomainFilter = (evidence: EvidenceBundle, source: string): EvidenceBundle => {
      if (!state.queryClassification?.routing.strictDomainMatching || evidence.workflows.length === 0) {
        return evidence;
      }
      const filtered = filterWorkflowsByDomain(evidence.workflows, state.queryClassification, logger);
      logger.info(`A1: Applied domain filtering to peer evidence (${source})`, {
        originalCount: evidence.workflows.length,
        filteredCount: filtered.length,
      });
      return {
        ...evidence,
        workflows: filtered,
        totalStepCount: filtered.reduce((sum, w) => sum + (w.steps?.length || 0), 0),
      };
    };

    // Strategy 1: Platform curated patterns
    const strategy1Promise = platformWorkflowRepository.searchByEmbedding(
      embeddingArray,
      { workflowType, minEfficiencyScore: 50, limit: PEER_WORKFLOW_LIMIT }
    ).then(patterns => {
      if (patterns.length === 0) return null;
      let evidence = transformPeerPatternsToEvidence(patterns, logger);
      evidence = applyDomainFilter(evidence, 'platform_patterns');
      return evidence.workflows.length > 0 ? evidence : null;
    }).catch(() => null);

    // Strategy 2: Cross-user session search
    const strategy2Promise = (state.userId
      ? sessionMappingRepository.searchPeerSessionsByEmbedding(
          state.userId,
          queryEmbedding,
          { minSimilarity: 0.35, limit: PEER_WORKFLOW_LIMIT }
        ).then(sessions => {
          if (sessions.length === 0) return null;
          let evidence = transformPeerSessionsToEvidence(sessions, logger);
          evidence = applyDomainFilter(evidence, 'cross_user');
          return evidence.workflows.length > 0 ? evidence : null;
        }).catch(() => null)
      : Promise.resolve(null)
    );

    // Strategy 3: Graph-based retrieval
    const strategy3Promise = (graphService && state.userId
      ? graphService.getPeerWorkflowPatterns(
          state.userId,
          { workflowType, entities: userEntities.slice(0, 10), minOccurrences: 2, limit: 10 }
        ).then(patterns => {
          if (patterns.length === 0) return null;
          let evidence = transformGraphPeerPatternsToEvidence(patterns, logger);
          evidence = applyDomainFilter(evidence, 'graph');
          return evidence.workflows.length > 0 ? evidence : null;
        }).catch(() => null)
      : Promise.resolve(null)
    );

    // Run all strategies in parallel
    const [s1Result, s2Result, s3Result] = await Promise.all([
      strategy1Promise,
      strategy2Promise,
      strategy3Promise,
    ]);

    // Pick best result by priority order
    const peerEvidence = s1Result || s2Result || s3Result;
    const peerSource = s1Result ? 'platform_patterns' : s2Result ? 'cross_user_sessions' : s3Result ? 'arangodb_graph' : 'none';

    const peerEvidenceElapsedMs = Date.now() - peerEvidenceStartMs;

    if (!peerEvidence) {
      logger.info(`A1 PROFILING: Peer evidence retrieval took ${peerEvidenceElapsedMs}ms (no results)`);
      return {
        peerEvidence: null,
        currentStage: 'a1_peer_evidence_none_found',
        progress: 25,
      };
    }

    logger.info('A1: Peer evidence retrieved', {
      workflowCount: peerEvidence.workflows.length,
      source: peerSource,
      elapsedMs: peerEvidenceElapsedMs,
    });

    // LEVEL 3: Anonymize peer evidence before returning (privacy protection)
    const anonymizedPeerEvidence = anonymizePeerEvidence(peerEvidence);

    // AI4 OPTIMIZATION: Cache anonymized peer evidence for future similar queries
    cacheManager.peerWorkflows.set(peerCacheKey, anonymizedPeerEvidence);
    logger.debug('A1: Cached peer evidence for future queries', { cacheKey: peerCacheKey });

    return {
      peerEvidence: anonymizedPeerEvidence,
      currentStage: 'a1_peer_evidence_complete',
      progress: 25,
    };
  } catch (error) {
    logger.error('A1: Failed to retrieve peer evidence', { error });
    return {
      peerEvidence: null,
      errors: [`A1 peer retrieval failed: ${error}`],
      currentStage: 'a1_peer_evidence_failed',
      progress: 25,
    };
  }
}

/**
 * Transform peer sessions from cross-user search to EvidenceBundle format
 */
function transformPeerSessionsToEvidence(
  peerSessions: Array<{
    sessionId: string;
    category: string;
    workflowName: string | null;
    durationSeconds: number | null;
    highLevelSummary: string | null;
    summary: Record<string, unknown> | null;
    similarity: number;
  }>,
  logger: Logger
): EvidenceBundle {
  const workflows: UserWorkflow[] = [];
  let totalStepCount = 0;

  for (const session of peerSessions) {
    // Extract workflows from session summary if available
    const summaryData = session.summary as {
      workflows?: Array<{
        id?: string;
        classification?: {
          level_1_intent?: string;
          level_2_problem?: string;
          level_3_approach?: string;
          level_4_tools?: string[];
        };
        workflow_summary?: string;
        semantic_steps?: Array<{
          step_name?: string;
          description?: string;
          tools_involved?: string[];
          duration_seconds?: number;
        }>;
      }>;
    } | null;

    if (summaryData?.workflows && summaryData.workflows.length > 0) {
      for (const wf of summaryData.workflows) {
        const classification = wf.classification || {};
        const steps: UserStep[] = (wf.semantic_steps || []).map((ss, index) => ({
          stepId: `peer-step-${session.sessionId}-${index}`,
          description: ss.step_name || ss.description || 'Peer step',
          stepSummary: ss.description && ss.step_name ? ss.description : undefined,
          app: ss.tools_involved?.[0] || 'Unknown',
          toolCategory: categorizeApp(ss.tools_involved?.[0] || ''),
          durationSeconds: ss.duration_seconds || 30,
          timestamp: '',
        }));

        totalStepCount += steps.length;

        workflows.push({
          workflowId: `peer-wf-${session.sessionId}-${wf.id || 'unknown'}`,
          title: classification.level_1_intent || session.workflowName || 'Peer Workflow',
          summary: wf.workflow_summary || session.highLevelSummary || '',
          intent: classification.level_1_intent || 'Peer workflow pattern',
          approach: classification.level_3_approach || '',
          primaryApp: classification.level_4_tools?.[0] || 'Unknown',
          steps,
          totalDurationSeconds: session.durationSeconds || 0,
          tools: classification.level_4_tools || [],
        });
      }
    } else if (session.highLevelSummary) {
      // Create a simple workflow from high-level summary
      workflows.push({
        workflowId: `peer-wf-${session.sessionId}`,
        title: session.workflowName || session.category || 'Peer Workflow',
        summary: session.highLevelSummary,
        intent: session.workflowName || 'Peer workflow pattern',
        approach: '',
        primaryApp: 'Unknown',
        steps: [],
        totalDurationSeconds: session.durationSeconds || 0,
        tools: [],
      });
    }
  }

  logger.debug('Transformed peer sessions to evidence', {
    inputSessions: peerSessions.length,
    outputWorkflows: workflows.length,
    totalStepCount,
  });

  return {
    workflows,
    sessions: [],
    entities: [],
    concepts: [],
    totalStepCount,
  };
}

/**
 * Transform graph-based peer patterns to EvidenceBundle format
 * Used when peer data comes from ArangoDB graph traversal
 */
function transformGraphPeerPatternsToEvidence(
  graphPatterns: Array<{
    workflowType: string;
    avgDurationSeconds: number;
    occurrenceCount: number;
    uniqueUserCount: number;
    commonEntities: string[];
    commonTransitions: Array<{ from: string; to: string; frequency: number }>;
  }>,
  logger: Logger
): EvidenceBundle {
  const workflows: UserWorkflow[] = [];
  let totalStepCount = 0;

  for (const pattern of graphPatterns) {
    // Create steps from common entities (tools used)
    const steps: UserStep[] = pattern.commonEntities.map((entity, index) => ({
      stepId: `graph-step-${pattern.workflowType}-${index}`,
      description: `Use ${entity}`,
      app: entity,
      toolCategory: categorizeApp(entity),
      durationSeconds: Math.round(pattern.avgDurationSeconds / Math.max(pattern.commonEntities.length, 1)),
      timestamp: '',
    }));

    totalStepCount += steps.length;

    // Build workflow summary from transitions
    const transitionSummary = pattern.commonTransitions.length > 0
      ? `Common transitions: ${pattern.commonTransitions.map(t => `${t.from} → ${t.to}`).join(', ')}`
      : '';

    workflows.push({
      workflowId: `graph-peer-wf-${pattern.workflowType}`,
      title: pattern.workflowType || 'Peer Workflow Pattern',
      summary: `Aggregated pattern from ${pattern.uniqueUserCount} users (${pattern.occurrenceCount} occurrences). ${transitionSummary}`,
      intent: `Efficient ${pattern.workflowType} workflow pattern`,
      approach: `Common tools: ${pattern.commonEntities.join(', ')}`,
      primaryApp: pattern.commonEntities[0] || 'Unknown',
      steps,
      totalDurationSeconds: pattern.avgDurationSeconds,
      tools: pattern.commonEntities,
    });
  }

  logger.debug('Transformed graph peer patterns to evidence', {
    inputPatterns: graphPatterns.length,
    outputWorkflows: workflows.length,
    totalStepCount,
  });

  return {
    workflows,
    sessions: [],
    entities: [],
    concepts: [],
    totalStepCount,
  };
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

  // Check 3: Peer evidence has no PII (if present)
  if (state.peerEvidence) {
    const piiCheck = checkForPII(state.peerEvidence, logger);
    if (piiCheck.hasPII) {
      issues.push({
        type: 'pii_detected',
        description: `PII detected in peer evidence: ${piiCheck.details}`,
        severity: 'error',
        affectedIds: piiCheck.affectedIds,
      });
    }
  }

  // Check 4: Retrieval is relevant to query (use LLM for semantic check)
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
async function detectRepetitivePatterns(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, graphService } = deps;

  // Skip if no graph service or no user evidence
  if (!graphService || !state.userId || !state.userEvidence) {
    logger.debug('A1: Skipping repetitive pattern detection (no graph service or user evidence)');
    return { progress: 18 };
  }

  logger.info('A1: Detecting repetitive workflow patterns', { userId: state.userId });

  try {
    const patterns = await graphService.detectRepetitiveWorkflowPatterns(
      state.userId,
      {
        lookbackDays: state.lookbackDays || 30,
        minOccurrences: 3,
        minSequenceLength: 2,
        maxSequenceLength: 4,
      }
    );

    if (patterns.length > 0) {
      logger.info('A1: Found repetitive workflow patterns', {
        patternCount: patterns.length,
        topPattern: patterns[0]?.sequence.join(' → '),
        topPatternOccurrences: patterns[0]?.occurrenceCount,
        totalTimeInPatterns: patterns.reduce((sum, p) => sum + p.totalTimeSpentSeconds, 0),
      });

      // Add patterns to user evidence
      const updatedUserEvidence = {
        ...state.userEvidence,
        repetitivePatterns: patterns,
      };

      // Log detailed output for debugging
      if (process.env.INSIGHT_DEBUG === 'true') {
        logger.debug('=== A1 RETRIEVAL AGENT OUTPUT (Repetitive Patterns) ===');
        logger.debug(JSON.stringify({
          agent: 'A1_RETRIEVAL',
          outputType: 'repetitivePatterns',
          patterns: patterns.map(p => ({
            type: p.patternType,
            sequence: p.sequence.join(' → '),
            occurrences: p.occurrenceCount,
            totalTimeHours: Math.round(p.totalTimeSpentSeconds / 3600 * 10) / 10,
            optimizationOpportunity: p.optimizationOpportunity,
          })),
        }));
        logger.debug('=== END A1 REPETITIVE PATTERNS OUTPUT ===');
      }

      return {
        userEvidence: updatedUserEvidence,
        progress: 18,
      };
    }

    logger.debug('A1: No repetitive patterns found');
    return { progress: 18 };
  } catch (error) {
    logger.error('A1: Failed to detect repetitive patterns', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail the pipeline, just continue without patterns
    return { progress: 18 };
  }
}

/**
 * Node: Stitch context across sessions using two-tier system
 * Tier 1: Outcome-Based Stitching - Groups sessions by shared deliverable/goal
 * Tier 2: Tool-Mastery Stitching - Groups by tool usage patterns
 */
async function stitchContextAcrossSessions(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider, embeddingService, enableContextStitching } = deps;

  // Skip if stitching is disabled or no user evidence
  if (!enableContextStitching || !state.userEvidence) {
    logger.debug('A1: Skipping context stitching (disabled or no user evidence)');
    return { progress: 19 };
  }

  logger.info('A1: Starting two-tier context stitching', {
    sessionCount: state.userEvidence.sessions.length,
    workflowCount: state.userEvidence.workflows.length,
  });

  try {
    // Create the context stitching service
    const stitchingService = createContextStitchingService(
      logger,
      llmProvider,
      embeddingService
    );

    // Transform evidence to stitching format
    const sessionsForStitching: SessionForStitching[] = transformEvidenceToStitchingFormat(
      state.userEvidence,
      logger
    );

    if (sessionsForStitching.length < 2) {
      logger.debug('A1: Not enough sessions for stitching (need at least 2)');
      return { progress: 19 };
    }

    // Detect workstream focus from query if present
    const workstreamFocus = extractWorkstreamFocus(state.query);

    // Perform two-tier stitching
    const stitchedContext = await stitchingService.stitchContext(
      sessionsForStitching,
      {
        minConfidence: 0.60,
        focusWorkstream: workstreamFocus,
      }
    );

    logger.info('A1: Context stitching complete', {
      workstreamCount: stitchedContext.workstreams.length,
      toolGroupCount: stitchedContext.toolMasteryGroups.length,
      ungroupedCount: stitchedContext.ungroupedSessionIds.length,
      processingTimeMs: stitchedContext.metadata.processingTimeMs,
    });

    // Persist stitching results to graph if persistence service is available
    logger.info('A1: Checking persistence prerequisites', {
      hasPersistenceService: !!deps.contextStitchingPersistenceService,
      hasUserId: !!state.userId,
      userId: state.userId,
    });

    if (deps.contextStitchingPersistenceService && state.userId) {
      try {
        logger.info('A1: Persisting stitching results to graph', {
          userId: state.userId,
          workstreamCount: stitchedContext.workstreams.length,
          toolGroupCount: stitchedContext.toolMasteryGroups.length,
          processPatternCount: stitchedContext.processPatterns.length,
        });

        await deps.contextStitchingPersistenceService.persistWorkstreams(
          state.userId,
          stitchedContext.workstreams
        );
        await deps.contextStitchingPersistenceService.persistToolMasteryGroups(
          state.userId,
          stitchedContext.toolMasteryGroups
        );
        await deps.contextStitchingPersistenceService.persistProcessPatterns(
          state.userId,
          stitchedContext.processPatterns
        );

        logger.info('A1: Successfully persisted stitching results to graph', {
          userId: state.userId,
        });
      } catch (error) {
        logger.error('A1: Failed to persist stitching results', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't fail the pipeline - persistence is non-critical
      }
    } else {
      logger.warn('A1: Skipping persistence - missing prerequisites', {
        hasPersistenceService: !!deps.contextStitchingPersistenceService,
        hasUserId: !!state.userId,
      });
    }

    // Log detailed output for debugging
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A1 RETRIEVAL AGENT OUTPUT (Stitched Context) ===');
      logger.debug(JSON.stringify({
        agent: 'A1_RETRIEVAL',
        outputType: 'stitchedContext',
        tier1_workstreams: stitchedContext.workstreams.map(ws => ({
          name: ws.name,
          sessionCount: ws.sessionIds.length,
          confidence: ws.confidence,
          topics: ws.topics,
        })),
        tier2_toolGroups: stitchedContext.toolMasteryGroups.map(tg => ({
          toolName: tg.toolName,
          patternCount: tg.usagePatterns.length,
          totalTimeHours: Math.round(tg.totalTimeSeconds / 3600 * 10) / 10,
        })),
      }));
      logger.debug('=== END A1 STITCHED CONTEXT OUTPUT ===');
    }

    return {
      stitchedContext,
      progress: 19,
    };
  } catch (error) {
    logger.error('A1: Failed to stitch context', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail the pipeline, just continue without stitching
    return { progress: 19 };
  }
}

/**
 * Transform EvidenceBundle to SessionForStitching format
 */
function transformEvidenceToStitchingFormat(
  evidence: EvidenceBundle,
  logger: Logger
): SessionForStitching[] {
  const sessionsMap = new Map<string, SessionForStitching>();

  // Group workflows by session
  for (const workflow of evidence.workflows) {
    const sessionId = workflow.sessionId || 'unknown';

    if (!sessionsMap.has(sessionId)) {
      // Find corresponding session info
      const sessionInfo = evidence.sessions.find(s => s.sessionId === sessionId);

      sessionsMap.set(sessionId, {
        sessionId,
        title: sessionInfo?.highLevelSummary || workflow.title || 'Untitled Session',
        highLevelSummary: sessionInfo?.highLevelSummary || workflow.summary || '',
        workflows: [],
        toolsUsed: [],
        totalDurationSeconds: 0,
        timestamp: workflow.timeStart || new Date().toISOString(),
      });
    }

    const session = sessionsMap.get(sessionId)!;
    session.workflows.push({
      intent: workflow.intent || workflow.title,
      approach: workflow.approach || '',
      tools: workflow.tools || [],
      summary: workflow.summary || '',
      durationSeconds: workflow.totalDurationSeconds || 0,
    });
    session.toolsUsed = [...new Set([...session.toolsUsed, ...(workflow.tools || [])])];
    session.totalDurationSeconds += workflow.totalDurationSeconds || 0;
  }

  const result = Array.from(sessionsMap.values());
  logger.debug('A1: Transformed evidence to stitching format', {
    inputWorkflows: evidence.workflows.length,
    outputSessions: result.length,
  });

  return result;
}

/**
 * Extract workstream focus from user query
 * Looks for explicit project/deliverable references
 */
function extractWorkstreamFocus(query: string): string | undefined {
  // Common patterns that indicate a specific workstream
  const patterns = [
    /(?:about|for|on|regarding)\s+(?:the\s+)?([a-z0-9\s]+(?:presentation|deck|document|report|project|feature|release))/i,
    /(?:my|the)\s+([a-z0-9\s]+(?:work|task|effort))/i,
    /working\s+on\s+(?:the\s+)?([a-z0-9\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Create the A1 Retrieval Agent graph
 */
export function createRetrievalGraph(deps: RetrievalGraphDeps) {
  const { logger, enableContextStitching } = deps;

  logger.info('Creating A1 Retrieval Graph', {
    enableContextStitching: !!enableContextStitching,
  });

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
    .addNode('retrieve_peer_evidence', (state) =>
      retrievePeerEvidence(state, deps)
    )
    .addNode('critique_retrieval', (state) => critiqueRetrieval(state, deps))

    // Define edges
    .addEdge('__start__', 'retrieve_user_evidence')
    .addEdge('retrieve_user_evidence', 'detect_repetitive_patterns')
    .addEdge('detect_repetitive_patterns', 'stitch_context')
    .addEdge('stitch_context', 'retrieve_peer_evidence')
    .addEdge('retrieve_peer_evidence', 'critique_retrieval')

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
    isMeaningful?: boolean;
  }>;
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
          isMeaningful?: boolean;
        }> | null;

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
            });
          } else if (nodeData.nodeMeta?.chapters) {
            chaptersMap.set(session.sessionId, {
              schemaVersion: 1,
              highLevelSummary: sessionMapping.highLevelSummary || undefined,
              chapters: nodeData.nodeMeta.chapters,
              screenshotDescriptions: screenshotDescriptions || undefined,
            });
          } else if (sessionMapping.highLevelSummary) {
            chaptersMap.set(session.sessionId, {
              highLevelSummary: sessionMapping.highLevelSummary,
              screenshotDescriptions: screenshotDescriptions || undefined,
            });
          }
        } else if (sessionMapping.highLevelSummary) {
          // No summary and no node, but we have highLevelSummary
          chaptersMap.set(session.sessionId, {
            highLevelSummary: sessionMapping.highLevelSummary,
            screenshotDescriptions: screenshotDescriptions || undefined,
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

  logger.info('Transformed NLQ to evidence', {
    workflowCount: workflows.length,
    sessionCount: sessions.length,
    entityCount: entities.length,
    totalStepCount,
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
function transformAttachedSessionsToEvidence(
  attachedSessions: AttachedSessionContext[],
  logger: Logger
): EvidenceBundle {
  const workflows: UserWorkflow[] = [];
  const sessions: SessionInfo[] = [];
  let totalStepCount = 0;
  let totalDurationSeconds = 0;

  for (const session of attachedSessions) {
    // Determine start/end activities from first/last semantic steps
    const firstWorkflow = session.workflows[0];
    const lastWorkflow = session.workflows[session.workflows.length - 1];
    const firstStep = firstWorkflow?.semantic_steps?.[0];
    const lastStep = lastWorkflow?.semantic_steps?.[lastWorkflow?.semantic_steps?.length - 1];

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

  logger.info('A1: Transformed attached sessions to evidence', {
    sessionCount: sessions.length,
    workflowCount: workflows.length,
    totalStepCount,
    totalDurationSeconds,
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
  };
}

/**
 * Transform peer patterns to EvidenceBundle format
 */
function transformPeerPatternsToEvidence(
  patterns: any[],
  logger: Logger
): EvidenceBundle {
  const workflows: UserWorkflow[] = [];

  for (const pattern of patterns) {
    const steps: UserStep[] = (pattern.stepSequence || []).map(
      (step: any, index: number) => ({
        stepId: `peer-step-${pattern.workflowHash}-${index}`,
        description: step.description || `${step.type} action`,
        tool: step.toolCategory,
        toolCategory: step.toolCategory,
        durationSeconds: step.avgDuration,
        timestamp: '',
        workflowTag: pattern.workflowType,
        order: step.order,
      })
    );

    workflows.push({
      workflowId: `peer-wf-${pattern.workflowHash}`,
      name: `${pattern.workflowType} workflow pattern`,
      intent: `Efficient ${pattern.workflowType} pattern`,
      approach: 'Peer benchmark',
      steps,
      totalDurationSeconds: pattern.avgDurationSeconds,
      tools: Object.keys(pattern.toolPatterns || {}),
      sessionId: 'platform',
      startTime: '',
      endTime: '',
    });
  }

  logger.debug('Transformed peer patterns to evidence', {
    workflowCount: workflows.length,
  });

  return {
    workflows,
    sessions: [],
    entities: [],
    concepts: [],
    totalStepCount: workflows.reduce((sum, w) => sum + w.steps.length, 0),
    totalDurationSeconds: workflows.reduce(
      (sum, w) => sum + w.totalDurationSeconds,
      0
    ),
    retrievalMetadata: {
      queryTimeMs: 0,
      sourcesRetrieved: patterns.length,
      retrievalMethod: 'vector',
      embeddingModel: 'text-embedding-3-small',
    },
  };
}

/**
 * Check for PII in evidence bundle
 */
function checkForPII(
  evidence: EvidenceBundle,
  logger: Logger
): { hasPII: boolean; details: string; affectedIds: string[] } {
  const piiPatterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
    name: /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+/,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  };

  const affectedIds: string[] = [];
  const issues: string[] = [];

  for (const workflow of evidence.workflows) {
    for (const step of workflow.steps) {
      for (const [type, pattern] of Object.entries(piiPatterns)) {
        if (pattern.test(step.description)) {
          issues.push(`${type} in step ${step.stepId}`);
          affectedIds.push(step.stepId);
        }
      }
    }
  }

  if (issues.length > 0) {
    logger.warn('PII detected in evidence', { issues });
  }

  return {
    hasPII: issues.length > 0,
    details: issues.join(', '),
    affectedIds,
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

/**
 * Infer workflow type from workflow name
 */
function inferWorkflowType(name: string): string | undefined {
  const lower = name.toLowerCase();

  if (lower.includes('research') || lower.includes('search')) return 'research';
  if (lower.includes('cod') || lower.includes('develop')) return 'coding';
  if (lower.includes('doc') || lower.includes('writ')) return 'documentation';
  if (lower.includes('debug') || lower.includes('fix')) return 'debugging';
  if (lower.includes('test')) return 'testing';
  if (lower.includes('design')) return 'design';
  if (lower.includes('plan')) return 'planning';

  return undefined;
}
