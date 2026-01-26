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
import { createOrchestratorGraph } from './graphs/orchestrator-graph.js';
import type { InsightState } from './state/insight-state.js';
import type {
  InsightGenerationResult,
  JobStatus,
  JobProgress,
  InsightGenerationOptions,
} from './types.js';

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
  // Note: Company docs are now retrieved via NLQ service's searchCompanyDocuments()

  // In-memory listeners for real-time progress streaming (not persisted)
  private jobListeners: Map<string, Set<JobListener>> = new Map();
  // In-memory cache for job options (not stored in DB, only needed during processing)
  private jobOptionsCache: Map<string, InsightGenerationOptions> = new Map();

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
  }

  /**
   * Start an async insight generation job
   */
  async startJob(
    userId: number,
    query: string,
    options?: InsightGenerationOptions
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

    // Cache options for processing (not stored in DB)
    if (options) {
      this.jobOptionsCache.set(jobId, options);
    }

    this.logger.info('Starting insight generation job', {
      jobId,
      userId,
      query: query.slice(0, 100),
    });

    // Start processing in background
    this.processJob(jobId).catch((error) => {
      this.logger.error('Job processing failed', { jobId, error });
      this.updateJobInDb(jobId, {
        status: 'failed',
        errorMessage: error.message || 'Processing failed',
        completedAt: new Date(),
      }).catch((updateError) => {
        this.logger.error('Failed to update job status after error', { jobId, updateError });
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
    const record = await this.jobRepository.findById(jobId);
    if (!record) {
      this.logger.error('Job not found for processing', { jobId });
      return;
    }

    // Get cached options
    const options = this.jobOptionsCache.get(jobId);

    await this.updateJobInDb(jobId, {
      status: 'processing',
      startedAt: new Date(),
    });

    try {
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
        // Company docs retrieved via nlqService.searchCompanyDocuments()
      });

      // Initial state
      const initialState: Partial<InsightState> = {
        query: record.query,
        userId: record.userId,
        nodeId: options?.nodeId || null,
        lookbackDays: options?.lookbackDays || 30,
        includePeerComparison: options?.includePeerComparison ?? true,
        includeWebSearch: options?.includeWebSearch ?? true,
        includeCompanyDocs: options?.includeCompanyDocs ?? this.companyDocsEnabled,
        maxOptimizationBlocks: options?.maxOptimizationBlocks || 5,
        status: 'processing',
        progress: 0,
        currentStage: 'starting',
        errors: [],
        a1RetryCount: 0,
        a2RetryCount: 0,
      };

      // Stream progress by periodically checking state and updating DB
      const progressInterval = setInterval(async () => {
        const currentRecord = await this.jobRepository.findById(jobId);
        if (currentRecord && currentRecord.status === 'processing') {
          this.notifyListeners(jobId, {
            jobId,
            status: currentRecord.status as JobStatus,
            progress: currentRecord.progress ?? 0,
            currentStage: currentRecord.currentStage ?? 'processing',
          });
        }
      }, 1000);

      // Run the graph
      const result = await graph.invoke(initialState);

      clearInterval(progressInterval);

      // Extract final result
      const finalResult = result.finalResult as InsightGenerationResult | null;

      if (finalResult) {
        await this.updateJobInDb(jobId, {
          status: 'completed',
          progress: 100,
          currentStage: 'complete',
          result: finalResult,
          completedAt: new Date(),
        });
      } else {
        await this.updateJobInDb(jobId, {
          status: 'failed',
          errorMessage: 'No result generated',
          completedAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error('Job processing error', { jobId, error });
      await this.updateJobInDb(jobId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    } finally {
      // Clean up cached options
      this.jobOptionsCache.delete(jobId);
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
        maxOptimizationBlocks: options?.maxOptimizationBlocks || 3,
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
      this.logger.error('Quick insights generation failed', { userId, error });
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
