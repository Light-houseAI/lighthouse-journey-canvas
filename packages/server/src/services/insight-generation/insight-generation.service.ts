/**
 * Insight Generation Service
 *
 * Orchestrates the multi-agent insight generation pipeline.
 * Handles job management, async execution, and progress streaming.
 *
 * Jobs are persisted to the database for reliability across server restarts.
 */

import type { Logger } from '../../core/logger.js';
import type { LLMProvider } from '../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../repositories/session-mapping.repository.js';
import type { InsightGenerationJobRepository, InsightGenerationJobRecord } from '../../repositories/insight-generation-job.repository.js';
import type { EmbeddingService } from '../interfaces/index.js';
import type { PersonaService } from '../persona.service.js';
import { createOrchestratorGraph } from './graphs/orchestrator-graph.js';
import type { InsightState } from './state/insight-state.js';
import type {
  InsightGenerationResult,
  JobStatus,
  JobProgress,
  InsightGenerationOptions,
  InsightGenerationOptionsWithAgentic,
  AttachedSessionContext,
  RetrievedMemories,
  ConversationMemory,
} from './types.js';
import type { MemoryService } from './memory.service.js';
import type { NoiseFilterService } from './filters/noise-filter.service.js';
import { getInsightCacheManager, QueryEmbeddingCache } from './utils/insight-cache.js';
import { createAgenticLoopGraph, createInitialAgenticState, type AgenticLoopDeps } from './agentic-loop/index.js';

// Stub type for TraceService when tracing is disabled
type TraceService = {
  startTrace: (params: any) => Promise<string>;
  completeTrace: (params: any) => void;
} | null;

// ============================================================================
// TYPES
// ============================================================================

export interface InsightGenerationServiceDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
  embeddingService: EmbeddingService;
  insightGenerationJobRepository: InsightGenerationJobRepository;
  perplexityApiKey?: string;
  companyDocsEnabled?: boolean;
  /** Service to derive user personas from timeline nodes */
  personaService?: PersonaService;
  /** Service for conversation memory (Mem0 integration) */
  memoryService?: MemoryService;
  /** Service for query tracing (internal dashboard) */
  traceService?: TraceService | null;
  /** Service for filtering noise from evidence (Slack, etc.) */
  noiseFilterService?: NoiseFilterService;
  // Note: Company docs are now retrieved via NLQ service's searchCompanyDocuments()
}

export interface InsightJob {
  id: string;
  userId: number;
  query: string;
  options?: InsightGenerationOptions;
  status: JobStatus;
  progress: number;
  currentStage: string;
  result?: InsightGenerationResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

type JobListener = (progress: JobProgress) => void;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert database record to InsightJob interface
 */
function recordToJob(record: InsightGenerationJobRecord): InsightJob {
  return {
    id: record.id,
    userId: record.userId,
    query: record.query,
    status: record.status as JobStatus,
    progress: record.progress ?? 0,
    currentStage: record.currentStage ?? 'initializing',
    result: record.result as InsightGenerationResult | undefined,
    error: record.errorMessage ?? undefined,
    createdAt: record.createdAt,
    startedAt: record.startedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class InsightGenerationService {
  private readonly logger: Logger;
  private readonly llmProvider: LLMProvider;
  private readonly nlqService: NaturalLanguageQueryService;
  private readonly platformWorkflowRepository: PlatformWorkflowRepository;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly embeddingService: EmbeddingService;
  private readonly jobRepository: InsightGenerationJobRepository;
  private readonly perplexityApiKey?: string;
  private readonly companyDocsEnabled: boolean;
  private readonly personaService?: PersonaService;
  private readonly memoryService?: MemoryService;
  private readonly traceService?: TraceService | null;
  private readonly noiseFilterService?: NoiseFilterService;
  // Note: Company docs are now retrieved via NLQ service's searchCompanyDocuments()

  // In-memory listeners for real-time progress streaming (not persisted)
  private jobListeners: Map<string, Set<JobListener>> = new Map();
  // In-memory cache for job options (not stored in DB, only needed during processing)
  private jobOptionsCache: Map<string, InsightGenerationOptions> = new Map();
  // In-memory cache for attached session context (not stored in DB, only needed during processing)
  private sessionContextCache: Map<string, AttachedSessionContext[]> = new Map();
  // In-memory cache for retrieved conversation memories (for follow-up context)
  private memoryContextCache: Map<string, RetrievedMemories> = new Map();

  constructor(deps: InsightGenerationServiceDeps) {
    this.logger = deps.logger;
    this.llmProvider = deps.llmProvider;
    this.nlqService = deps.nlqService;
    this.platformWorkflowRepository = deps.platformWorkflowRepository;
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.embeddingService = deps.embeddingService;
    this.jobRepository = deps.insightGenerationJobRepository;
    this.perplexityApiKey = deps.perplexityApiKey;
    this.companyDocsEnabled = deps.companyDocsEnabled ?? false;
    this.personaService = deps.personaService;
    this.memoryService = deps.memoryService;
    this.traceService = deps.traceService;
    this.noiseFilterService = deps.noiseFilterService;

    // Debug logging for trace service injection
    this.logger.info('InsightGenerationService initialized', {
      hasTraceService: !!this.traceService,
      traceServiceType: this.traceService ? typeof this.traceService : 'null',
    });
  }

  /**
   * Start an async insight generation job
   * @param sessionContext - User-attached sessions for analysis (bypasses NLQ retrieval in A1)
   */
  async startJob(
    userId: number,
    query: string,
    options?: InsightGenerationOptions,
    sessionContext?: AttachedSessionContext[]
  ): Promise<{ jobId: string; status: JobStatus }> {
    // Create job in database
    const jobRecord = await this.jobRepository.create({
      userId,
      query,
      nodeId: options?.nodeId,
      status: 'pending',
      progress: 0,
      currentStage: 'initializing',
    });

    const jobId = jobRecord.id;

    // Cache options and session context for processing (not stored in DB)
    if (options) {
      this.jobOptionsCache.set(jobId, options);
    }
    if (sessionContext && sessionContext.length > 0) {
      this.sessionContextCache.set(jobId, sessionContext);
    }

    // Retrieve relevant conversation memories for follow-up context
    if (this.memoryService) {
      try {
        const memorySearchResult = await this.memoryService.searchMemories({
          query,
          userId,
          limit: 5,
          nodeId: options?.nodeId,
        });

        if (memorySearchResult.memories.length > 0) {
          const retrievedMemories: RetrievedMemories = {
            memories: memorySearchResult.memories.map((m) => ({
              id: m.id,
              content: m.memory,
              userId,
              relevanceScore: m.score,
              createdAt: m.createdAt,
              topics: m.metadata?.topics,
              originalQuery: m.metadata?.query,
              sessionIds: m.metadata?.sessionIds,
            })),
            totalFound: memorySearchResult.totalFound,
            retrievalTimeMs: memorySearchResult.searchTimeMs,
            formattedContext: this.memoryService.formatMemoriesForContext(memorySearchResult.memories),
          };

          this.memoryContextCache.set(jobId, retrievedMemories);

          this.logger.info('Retrieved conversation memories for job', {
            jobId,
            userId,
            memoriesFound: retrievedMemories.memories.length,
            retrievalTimeMs: retrievedMemories.retrievalTimeMs,
          });
        }
      } catch (memoryError) {
        this.logger.warn('Failed to retrieve conversation memories', {
          jobId,
          error: memoryError instanceof Error ? memoryError.message : String(memoryError),
        });
        // Continue without memories - this is not a critical failure
      }
    }

    this.logger.info('Starting insight generation job', {
      jobId,
      userId,
      query: query.slice(0, 100),
      hasMemoryContext: this.memoryContextCache.has(jobId),
    });

    // Start processing in background
    this.processJob(jobId).catch((error) => {
      this.logger.error(`Job processing failed for job ${jobId}`, error instanceof Error ? error : new Error(String(error)));
      this.updateJobInDb(jobId, {
        status: 'failed',
        errorMessage: error.message || 'Processing failed',
        completedAt: new Date(),
      }).catch((updateError) => {
        this.logger.error(`Failed to update job status after error for job ${jobId}`, updateError instanceof Error ? updateError : new Error(String(updateError)));
      });
    });

    return { jobId, status: 'pending' };
  }

  /**
   * Get job status and result
   */
  async getJob(jobId: string): Promise<InsightJob | null> {
    const record = await this.jobRepository.findById(jobId);
    if (!record) return null;
    return recordToJob(record);
  }

  /**
   * Get job progress for SSE streaming
   */
  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    const record = await this.jobRepository.findById(jobId);
    if (!record) return null;

    return {
      jobId: record.id,
      status: record.status as JobStatus,
      progress: record.progress ?? 0,
      currentStage: record.currentStage ?? 'initializing',
    };
  }

  /**
   * Subscribe to job progress updates
   */
  subscribeToProgress(jobId: string, listener: JobListener): () => void {
    if (!this.jobListeners.has(jobId)) {
      this.jobListeners.set(jobId, new Set());
    }
    this.jobListeners.get(jobId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.jobListeners.get(jobId)?.delete(listener);
    };
  }

  /**
   * Process a job using the orchestrator graph
   */
  private async processJob(jobId: string): Promise<void> {
    const jobStartTime = Date.now();

    const record = await this.jobRepository.findById(jobId);
    if (!record) {
      this.logger.error(`Job not found for processing: ${jobId}`);
      return;
    }

    // Get cached options, session context, and memory context
    const options = this.jobOptionsCache.get(jobId);
    const sessionContext = this.sessionContextCache.get(jobId);
    const memoryContext = this.memoryContextCache.get(jobId);

    await this.updateJobInDb(jobId, {
      status: 'processing',
      startedAt: new Date(),
    });

    // Start query trace if tracing is enabled
    let traceId: string | null = null;
    this.logger.info('Checking trace service for job', {
      jobId,
      hasTraceService: !!this.traceService,
    });
    if (this.traceService) {
      try {
        this.logger.info('Starting query trace...', { jobId });
        traceId = await this.traceService.startTrace({
          jobId,
          userId: record.userId,
          rawQuery: record.query,
          hasAttachedSessions: !!sessionContext && sessionContext.length > 0,
          attachedSessionCount: sessionContext?.length ?? 0,
          hasConversationMemory: !!memoryContext,
        });
        this.logger.info('Query trace started successfully', { jobId, traceId });
      } catch (traceError) {
        this.logger.warn('Failed to start query trace', { jobId, error: traceError });
        // Continue without tracing - this is not a critical failure
      }
    } else {
      this.logger.info('TraceService not available, skipping trace', { jobId });
    }

    this.logger.info('Job processing started', {
      jobId,
      userId: record.userId,
      query: record.query.slice(0, 100),
      traceId,
    });

    try {
      // Check if agentic loop should be used
      const agenticOptions = options as InsightGenerationOptionsWithAgentic | undefined;
      const useAgenticLoop = agenticOptions?.useAgenticLoop ?? true;

      let result: Partial<InsightState>;
      let graphElapsedMs = 0;

      if (useAgenticLoop) {
        // =====================================================================
        // AGENTIC LOOP (skill-based dynamic routing)
        // =====================================================================
        this.logger.info('Using agentic loop for job processing', {
          jobId,
          userId: record.userId,
        });

        const agenticDeps: AgenticLoopDeps = {
          logger: this.logger,
          llmProvider: this.llmProvider,
          nlqService: this.nlqService,
          platformWorkflowRepository: this.platformWorkflowRepository,
          sessionMappingRepository: this.sessionMappingRepository,
          embeddingService: this.embeddingService,
          memoryService: this.memoryService,
          personaService: this.personaService,
          noiseFilterService: this.noiseFilterService,
          companyDocsEnabled: this.companyDocsEnabled,
          perplexityApiKey: this.perplexityApiKey,
          modelConfig: options?.modelConfig,
          agenticConfig: agenticOptions?.agenticConfig,
        };

        const agenticGraph = createAgenticLoopGraph(agenticDeps);

        // Create initial agentic state
        const initialAgenticState = createInitialAgenticState({
          query: record.query,
          userId: record.userId,
          nodeId: options?.nodeId,
          lookbackDays: options?.lookbackDays || 30,
          includeWebSearch: options?.includeWebSearch ?? true,
          includePeerComparison: options?.includePeerComparison ?? true,
          includeCompanyDocs: options?.includeCompanyDocs ?? this.companyDocsEnabled,
          filterNoise: options?.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable
          attachedSessionContext: sessionContext || null,
          conversationMemory: memoryContext || null,
          _traceId: traceId,
        });

        // MT3: Stream progress with faster polling interval (500ms) for more responsive SSE updates
        let lastProgress = 0;
        let lastStage = '';
        const progressInterval = setInterval(async () => {
          const currentRecord = await this.jobRepository.findById(jobId);
          if (currentRecord && currentRecord.status === 'processing') {
            const progress = currentRecord.progress ?? 0;
            const stage = currentRecord.currentStage ?? 'processing';

            if (progress !== lastProgress || stage !== lastStage) {
              lastProgress = progress;
              lastStage = stage;

              // Agentic loop stage descriptions
              const stageDescriptions: Record<string, string> = {
                'agentic_initializing': 'Initializing agentic loop...',
                'agentic_guardrail': 'Classifying query...',
                'agentic_reasoning': 'Reasoning about next action...',
                'agentic_action_started': 'Executing skill...',
                'agentic_action_complete': 'Skill completed, analyzing results...',
                'agentic_action_failed': 'Skill execution failed, recovering...',
                'agentic_action_skipped': 'Skipping action, continuing...',
                'agentic_complete': 'Generating final response...',
                'agentic_failed': 'Processing failed',
              };

              const readableStage = stageDescriptions[stage] || stage;

              this.notifyListeners(jobId, {
                jobId,
                status: currentRecord.status as JobStatus,
                progress,
                currentStage: readableStage,
              });
            }
          }
        }, 500);

        // Run the agentic loop graph
        const graphStartTime = Date.now();
        result = await agenticGraph.invoke(initialAgenticState);
        graphElapsedMs = Date.now() - graphStartTime;

        clearInterval(progressInterval);

        this.logger.info('Agentic loop completed', {
          jobId,
          graphElapsedMs,
          skillsUsed: (result as any).usedSkills || [],
          iterations: (result as any).currentIteration || 0,
        });
      } else {
        // =====================================================================
        // LEGACY ORCHESTRATOR (fixed sequential pipeline)
        // =====================================================================
        // Create orchestrator graph with model configuration
        // Default: Gemini 2.5 Flash for A1/A3/A4, GPT-4 for A2 Judge
        const graph = createOrchestratorGraph({
          logger: this.logger,
          llmProvider: this.llmProvider,
          nlqService: this.nlqService,
          platformWorkflowRepository: this.platformWorkflowRepository,
          sessionMappingRepository: this.sessionMappingRepository,
          embeddingService: this.embeddingService,
          companyDocsEnabled: this.companyDocsEnabled,
          perplexityApiKey: this.perplexityApiKey,
          modelConfig: options?.modelConfig,
          personaService: this.personaService,
          // Company docs retrieved via nlqService.searchCompanyDocuments()
        });

        // Initial state with conversation memory for follow-up context
        const initialState: Partial<InsightState> = {
          query: record.query,
          userId: record.userId,
          nodeId: options?.nodeId || null,
          lookbackDays: options?.lookbackDays || 30,
          includePeerComparison: options?.includePeerComparison ?? true,
          includeWebSearch: options?.includeWebSearch ?? true,
          includeCompanyDocs: options?.includeCompanyDocs ?? this.companyDocsEnabled,
          filterNoise: options?.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable // Filter Slack/communication by default
          attachedSessionContext: sessionContext || null, // User-attached sessions (bypasses NLQ in A1)
          conversationMemory: memoryContext || null, // Previous conversation context for follow-ups
          status: 'processing',
          progress: 0,
          currentStage: 'starting',
          errors: [],
          a1RetryCount: 0,
          a2RetryCount: 0,
          // Tracing context
          _traceId: traceId,
          _executionOrder: 0,
        };

        // MT3: Stream progress with faster polling interval (500ms) for more responsive SSE updates
        // Also add human-readable stage descriptions
        let lastProgress = 0;
        let lastStage = '';
        const progressInterval = setInterval(async () => {
          const currentRecord = await this.jobRepository.findById(jobId);
          if (currentRecord && currentRecord.status === 'processing') {
            // Only notify if progress or stage changed (reduces noise)
            const progress = currentRecord.progress ?? 0;
            const stage = currentRecord.currentStage ?? 'processing';

            if (progress !== lastProgress || stage !== lastStage) {
              lastProgress = progress;
              lastStage = stage;

              // Map internal stage names to human-readable descriptions
              const stageDescriptions: Record<string, string> = {
                'initializing': 'Initializing analysis...',
                'starting': 'Starting insight generation...',
                'a1_user_evidence_complete': 'Retrieved your workflow history',
                'a1_peer_evidence_complete': 'Found peer workflow patterns',
                'a1_critique_passed': 'Validated evidence quality',
                'orchestrator_a1_complete': 'Analyzing your workflows...',
                'a2_diagnostics_started': 'Identifying inefficiencies...',
                'a2_critique_passed': 'Validating diagnoses...',
                'orchestrator_routing': 'Selecting optimization strategies...',
                'a3_alignment_complete': 'Comparing with peer patterns...',
                'a3_transformations_complete': 'Generated peer-based recommendations',
                'a4_web_extraction_complete': 'Found web best practices',
                'a4_company_extraction_complete': 'Retrieved company guidelines',
                'a5_feature_adoption_complete': 'Identified feature adoption tips',
                'orchestrator_merge_complete': 'Compiling optimization plan...',
                'orchestrator_executive_complete': 'Generating executive summary...',
                'orchestrator_answer_complete': 'Formulating your answer...',
                'orchestrator_followups_complete': 'Preparing follow-up questions...',
                'orchestrator_complete': 'Finalizing results...',
                'complete': 'Analysis complete!',
              };

              const readableStage = stageDescriptions[stage] || stage;

              this.notifyListeners(jobId, {
                jobId,
                status: currentRecord.status as JobStatus,
                progress,
                currentStage: readableStage,
              });
            }
          }
        }, 500); // Reduced from 1000ms to 500ms for faster updates

        // Run the graph
        const graphStartTime = Date.now();
        result = await graph.invoke(initialState);
        graphElapsedMs = Date.now() - graphStartTime;

        clearInterval(progressInterval);

        this.logger.info('Legacy orchestrator completed', {
          jobId,
          graphElapsedMs,
        });
      }

      // Extract final result (shared by both paths)
      const finalResult = result.finalResult as InsightGenerationResult | null;

      if (finalResult) {
        await this.updateJobInDb(jobId, {
          status: 'completed',
          progress: 100,
          currentStage: 'complete',
          result: finalResult,
          completedAt: new Date(),
        });

        const totalElapsedMs = Date.now() - jobStartTime;
        this.logger.info('Job completed successfully', {
          jobId,
          userId: record.userId,
          graphElapsedMs,
          totalElapsedMs,
          totalElapsedSec: Math.round(totalElapsedMs / 1000),
          blockCount: finalResult.optimizationPlan?.blocks?.length || 0,
          passesThreshold: finalResult.executiveSummary?.passesQualityThreshold,
        });

        // Complete query trace
        if (traceId && this.traceService) {
          const agentPath = this.buildAgentPath(result);
          this.traceService.completeTrace({
            traceId,
            status: 'completed',
            agentPath,
            totalProcessingTimeMs: totalElapsedMs,
            routingDecision: result.routingDecision ?? undefined,
          });
        }

        // Store the Q&A pair as a memory for future follow-up questions
        await this.storeConversationMemory(
          record.userId,
          record.query,
          finalResult,
          sessionContext
        );

        // AI4 OPTIMIZATION: Cache result for similar future queries
        try {
          const cacheManager = getInsightCacheManager();
          const queryEmbedding = await this.embeddingService.generateEmbedding(record.query);
          cacheManager.similarQueries.storeResult(
            record.userId,
            options?.nodeId || null,
            record.query,
            queryEmbedding,
            finalResult
          );
          this.logger.debug('AI4: Cached insight result for similar query matching', {
            userId: record.userId,
            queryPrefix: record.query.slice(0, 50),
          });
        } catch (cacheError) {
          // Non-critical - just log and continue
          this.logger.debug('AI4: Failed to cache insight result', {
            error: cacheError instanceof Error ? cacheError.message : String(cacheError),
          });
        }
      } else {
        const totalElapsedMs = Date.now() - jobStartTime;
        this.logger.warn('Job completed with no result', {
          jobId,
          totalElapsedMs,
        });
        await this.updateJobInDb(jobId, {
          status: 'failed',
          errorMessage: 'No result generated',
          completedAt: new Date(),
        });

        // Complete query trace with failure
        if (traceId && this.traceService) {
          this.traceService.completeTrace({
            traceId,
            status: 'failed',
            agentPath: 'unknown',
            totalProcessingTimeMs: totalElapsedMs,
          });
        }
      }
    } catch (error) {
      const totalElapsedMs = Date.now() - jobStartTime;
      this.logger.error(`Job ${jobId} processing error (${totalElapsedMs}ms)`, error instanceof Error ? error : new Error(String(error)));
      await this.updateJobInDb(jobId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });

      // Complete query trace with failure
      if (traceId && this.traceService) {
        this.traceService.completeTrace({
          traceId,
          status: 'failed',
          agentPath: 'error',
          totalProcessingTimeMs: totalElapsedMs,
        });
      }
    } finally {
      // Clean up cached options, session context, and memory context
      this.jobOptionsCache.delete(jobId);
      this.sessionContextCache.delete(jobId);
      this.memoryContextCache.delete(jobId);
    }
  }

  /**
   * Store a conversation Q&A pair as a memory for future follow-up context
   */
  private async storeConversationMemory(
    userId: number,
    query: string,
    result: InsightGenerationResult,
    sessionContext?: AttachedSessionContext[]
  ): Promise<void> {
    if (!this.memoryService) {
      return;
    }

    try {
      // Create a concise memory content from the Q&A
      const memoryContent = this.memoryService.createQAMemoryContent(
        query,
        result.userQueryAnswer,
        result.executiveSummary.passesQualityThreshold
          ? `Found ${result.optimizationPlan?.blocks?.length || 0} optimization opportunities with ${Math.round(result.executiveSummary.totalTimeReduced / 60)} minutes potential time savings.`
          : undefined
      );

      // Extract topics from the conversation
      const topics = this.memoryService.extractTopics(query, result.userQueryAnswer);

      // Get session IDs if sessions were attached
      const sessionIds = sessionContext?.map((s) => s.sessionId);

      // Store the memory
      await this.memoryService.addMemory({
        content: memoryContent,
        userId,
        metadata: {
          type: 'question_answer',
          query,
          timestamp: new Date().toISOString(),
          topics,
          sessionIds,
          hasOptimizations: (result.optimizationPlan?.blocks?.length || 0) > 0,
        },
      });

      this.logger.info('Stored conversation memory', {
        userId,
        queryPreview: query.substring(0, 50),
        topics,
        hasOptimizations: (result.optimizationPlan?.blocks?.length || 0) > 0,
      });
    } catch (error) {
      this.logger.warn('Failed to store conversation memory', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the job if memory storage fails
    }
  }

  /**
   * Update job in database and notify listeners
   */
  private async updateJobInDb(jobId: string, updates: {
    status?: JobStatus;
    progress?: number;
    currentStage?: string;
    result?: InsightGenerationResult;
    errorMessage?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<void> {
    const updated = await this.jobRepository.update(jobId, {
      status: updates.status,
      progress: updates.progress,
      currentStage: updates.currentStage,
      result: updates.result as Record<string, any>,
      errorMessage: updates.errorMessage,
      startedAt: updates.startedAt,
      completedAt: updates.completedAt,
    });

    if (updated) {
      // Notify listeners
      this.notifyListeners(jobId, {
        jobId,
        status: updated.status as JobStatus,
        progress: updated.progress ?? 0,
        currentStage: updated.currentStage ?? 'processing',
      });
    }
  }

  /**
   * Notify all listeners of progress update
   */
  private notifyListeners(jobId: string, progress: JobProgress): void {
    const listeners = this.jobListeners.get(jobId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(progress);
        } catch (error) {
          this.logger.warn('Listener notification failed', { jobId, error });
        }
      }
    }
  }

  /**
   * Build agent path string from graph result state
   * e.g., "A1→A2→A3→A5" or "A1→A2→A4_WEB→A5"
   */
  private buildAgentPath(result: Partial<InsightState>): string {
    const path: string[] = [];

    // A1 always runs
    if (result.userEvidence) {
      path.push('A1');
    }

    // A2 always runs after A1
    if (result.userDiagnostics) {
      path.push('A2');
    }

    // Downstream agents (based on what produced output)
    if (result.peerOptimizationPlan) {
      path.push('A3');
    }
    if (result.webOptimizationPlan) {
      path.push('A4_WEB');
    }
    if (result.companyOptimizationPlan) {
      path.push('A4_COMPANY');
    }
    if (result.featureAdoptionTips && result.featureAdoptionTips.length > 0) {
      path.push('A5');
    }

    return path.length > 0 ? path.join('→') : 'unknown';
  }

  /**
   * Generate quick insights (synchronous, simpler analysis)
   */
  async generateQuickInsights(
    userId: number,
    query: string,
    options?: InsightGenerationOptions
  ): Promise<InsightGenerationResult | null> {
    this.logger.info('Generating quick insights', {
      userId,
      query: query.slice(0, 100),
    });

    try {
      // Check if agentic loop should be used
      const agenticOptions = options as InsightGenerationOptionsWithAgentic | undefined;
      const useAgenticLoop = agenticOptions?.useAgenticLoop ?? true;

      if (useAgenticLoop) {
        // Use agentic loop
        const agenticDeps: AgenticLoopDeps = {
          logger: this.logger,
          llmProvider: this.llmProvider,
          nlqService: this.nlqService,
          platformWorkflowRepository: this.platformWorkflowRepository,
          sessionMappingRepository: this.sessionMappingRepository,
          embeddingService: this.embeddingService,
          memoryService: this.memoryService,
          personaService: this.personaService,
          noiseFilterService: this.noiseFilterService,
          companyDocsEnabled: this.companyDocsEnabled,
          perplexityApiKey: this.perplexityApiKey,
          modelConfig: options?.modelConfig,
          agenticConfig: agenticOptions?.agenticConfig,
        };

        const agenticGraph = createAgenticLoopGraph(agenticDeps);

        const initialAgenticState = createInitialAgenticState({
          query,
          userId,
          nodeId: options?.nodeId,
          lookbackDays: options?.lookbackDays || 30,
          includeWebSearch: options?.includeWebSearch ?? true,
          includePeerComparison: options?.includePeerComparison ?? true,
          includeCompanyDocs: options?.includeCompanyDocs ?? this.companyDocsEnabled,
          filterNoise: options?.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable
        });

        const result = await agenticGraph.invoke(initialAgenticState);
        return result.finalResult as InsightGenerationResult | null;
      }

      // Legacy: Create orchestrator graph with model configuration
      // Default: Gemini 2.5 Flash for A1/A3/A4, GPT-4 for A2 Judge
      const graph = createOrchestratorGraph({
        logger: this.logger,
        llmProvider: this.llmProvider,
        nlqService: this.nlqService,
        platformWorkflowRepository: this.platformWorkflowRepository,
        sessionMappingRepository: this.sessionMappingRepository,
        embeddingService: this.embeddingService,
        companyDocsEnabled: this.companyDocsEnabled,
        perplexityApiKey: this.perplexityApiKey,
        modelConfig: options?.modelConfig,
        personaService: this.personaService,
        // Company docs retrieved via nlqService.searchCompanyDocuments()
      });

      const initialState: Partial<InsightState> = {
        query,
        userId,
        nodeId: options?.nodeId || null,
        lookbackDays: options?.lookbackDays || 30,
        includePeerComparison: options?.includePeerComparison ?? true,
        includeWebSearch: options?.includeWebSearch ?? true,
        includeCompanyDocs: options?.includeCompanyDocs ?? this.companyDocsEnabled,
        filterNoise: options?.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable // Filter Slack/communication by default
        status: 'processing',
        progress: 0,
        currentStage: 'starting',
        errors: [],
        a1RetryCount: 0,
        a2RetryCount: 0,
      };

      const result = await graph.invoke(initialState);
      return result.finalResult as InsightGenerationResult | null;
    } catch (error) {
      this.logger.error(`Quick insights generation failed for user ${userId}`, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const record = await this.jobRepository.findById(jobId);
    if (!record || record.status !== 'processing') {
      return false;
    }

    await this.updateJobInDb(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    return true;
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(userId: number): Promise<InsightJob[]> {
    const records = await this.jobRepository.findByUserId(userId, { limit: 50 });
    return records.map(recordToJob);
  }
}
