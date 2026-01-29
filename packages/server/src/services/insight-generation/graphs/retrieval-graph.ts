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
import type { EmbeddingService } from '../../interfaces/index.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
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
} from '../types.js';
import { z } from 'zod';
import { NoiseFilterService } from '../filters/noise-filter.service.js';
import { classifyQuery, type QueryClassification } from '../classifiers/query-classifier.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RetrievalGraphDeps {
  logger: Logger;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
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
    const nlqResult = await nlqService.query(state.userId, {
      query: state.query,
      nodeId: state.nodeId || undefined,
      lookbackDays: state.lookbackDays,
      maxResults,
      includeGraph: true,
      includeVectors: true,
    });

    // Fetch full session data with chapters from session_mappings
    const sessionChaptersMap = await fetchSessionChapters(
      state.userId,
      nlqResult.relatedWorkSessions || [],
      sessionMappingRepository,
      logger
    );

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

    logger.info('A1: User evidence retrieved', {
      workflowCount: userEvidence.workflows.length,
      stepCount: userEvidence.totalStepCount,
      sessionCount: userEvidence.sessions.length,
    });

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
 * Node: Retrieve anonymized peer evidence from platform tables
 */
async function retrievePeerEvidence(
  state: InsightState,
  deps: RetrievalGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, platformWorkflowRepository, embeddingService } = deps;

  if (!state.includePeerComparison) {
    logger.info('A1: Peer comparison disabled, skipping');
    return {
      peerEvidence: null,
      currentStage: 'a1_peer_evidence_skipped',
      progress: 25,
    };
  }

  logger.info('A1: Retrieving peer evidence from platform');

  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddingService.generateEmbedding(state.query);

    // Determine workflow type from user's evidence (if available)
    const workflowType = state.userEvidence?.workflows[0]?.name
      ? inferWorkflowType(state.userEvidence.workflows[0].name)
      : undefined;

    // Search platform for similar workflow patterns
    const peerPatterns = await platformWorkflowRepository.searchByEmbedding(
      queryEmbedding,
      {
        workflowType,
        minEfficiencyScore: 50, // Only get reasonably efficient workflows
        limit: 10,
      }
    );

    if (peerPatterns.length === 0) {
      logger.info('A1: No peer patterns found');
      return {
        peerEvidence: null,
        currentStage: 'a1_peer_evidence_none_found',
        progress: 25,
      };
    }

    // Transform peer patterns to EvidenceBundle format
    const peerEvidence = transformPeerPatternsToEvidence(peerPatterns, logger);

    logger.info('A1: Peer evidence retrieved', {
      workflowCount: peerEvidence.workflows.length,
      avgEfficiencyScore: peerPatterns.reduce(
        (sum, p) => sum + (p.efficiencyScore || 0),
        0
      ) / peerPatterns.length,
    });

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A1 RETRIEVAL AGENT OUTPUT (Peer Evidence) ===');
      logger.debug(JSON.stringify({
        agent: 'A1_RETRIEVAL',
        outputType: 'peerEvidence',
        summary: {
          workflowCount: peerEvidence.workflows.length,
          totalStepCount: peerEvidence.totalStepCount,
          avgEfficiencyScore: peerPatterns.reduce((sum, p) => sum + (p.efficiencyScore || 0), 0) / peerPatterns.length,
        },
        workflows: peerEvidence.workflows.map(w => ({
          workflowId: w.workflowId,
          name: w.name,
          intent: w.intent,
          stepCount: w.steps.length,
          totalDurationSeconds: w.totalDurationSeconds,
          tools: w.tools,
        })),
      }));
      logger.debug('=== END A1 PEER EVIDENCE OUTPUT ===');
    }

    return {
      peerEvidence,
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
    .addNode('retrieve_peer_evidence', (state) =>
      retrievePeerEvidence(state, deps)
    )
    .addNode('critique_retrieval', (state) => critiqueRetrieval(state, deps))

    // Define edges
    .addEdge('__start__', 'retrieve_user_evidence')
    .addEdge('retrieve_user_evidence', 'retrieve_peer_evidence')
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
          });

          if (schemaVersion === 2 && summaryData.workflows?.length > 0) {
            // V2: Workflow-based data from session_mapping.summary
            chaptersMap.set(session.sessionId, {
              schemaVersion: 2,
              highLevelSummary: summaryData.highLevelSummary || sessionMapping.highLevelSummary || undefined,
              workflows: summaryData.workflows,
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
            });
          } else if (nodeData.nodeMeta?.chapters) {
            chaptersMap.set(session.sessionId, {
              schemaVersion: 1,
              highLevelSummary: sessionMapping.highLevelSummary || undefined,
              chapters: nodeData.nodeMeta.chapters,
            });
          } else if (sessionMapping.highLevelSummary) {
            chaptersMap.set(session.sessionId, {
              highLevelSummary: sessionMapping.highLevelSummary,
            });
          }
        } else if (sessionMapping.highLevelSummary) {
          // No summary and no node, but we have highLevelSummary
          chaptersMap.set(session.sessionId, {
            highLevelSummary: sessionMapping.highLevelSummary,
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
        const workflowSteps: UserStep[] = (wf.semantic_steps || []).map((ss, index) => ({
          stepId: `step-${wf.id || sessionId}-${index}`,
          description: ss.step_name || ss.description,
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
          workflowId: `wf-${sessionId}`,
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
          tools: allTools,
          stepCount: workflowSteps.length,
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

  logger.debug('Transformed NLQ to evidence', {
    workflowCount: workflows.length,
    sessionCount: sessions.length,
    entityCount: entities.length,
    totalStepCount,
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

    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Determine if the retrieved evidence is relevant to the user's query.

Query: "${query}"

Retrieved workflow summaries: ${workflowSummaries}

Is this evidence relevant to answering the query? Respond with isRelevant (true/false) and a brief reason.`,
        },
      ],
      schema
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
