/**
 * Insight Generation Service
 *
 * Orchestrates the multi-agent insight generation pipeline.
 * Handles job management, async execution, and progress streaming.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../core/logger.js';
import type { LLMProvider } from '../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../repositories/session-mapping.repository.js';
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
  perplexityApiKey?: string;
  companyDocsEnabled?: boolean;
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
// SERVICE
// ============================================================================

export class InsightGenerationService {
  private readonly logger: Logger;
  private readonly llmProvider: LLMProvider;
  private readonly nlqService: NaturalLanguageQueryService;
  private readonly platformWorkflowRepository: PlatformWorkflowRepository;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly embeddingService: EmbeddingService;
  private readonly perplexityApiKey?: string;
  private readonly companyDocsEnabled: boolean;

  // In-memory job storage (use database in production)
  private jobs: Map<string, InsightJob> = new Map();
  private jobListeners: Map<string, Set<JobListener>> = new Map();

  constructor(deps: InsightGenerationServiceDeps) {
    this.logger = deps.logger;
    this.llmProvider = deps.llmProvider;
    this.nlqService = deps.nlqService;
    this.platformWorkflowRepository = deps.platformWorkflowRepository;
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.embeddingService = deps.embeddingService;
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
    const jobId = uuidv4();

    const job: InsightJob = {
      id: jobId,
      userId,
      query,
      options,
      status: 'pending',
      progress: 0,
      currentStage: 'initializing',
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    this.logger.info('Starting insight generation job', {
      jobId,
      userId,
      query: query.slice(0, 100),
    });

    // Start processing in background
    this.processJob(jobId).catch((error) => {
      this.logger.error('Job processing failed', { jobId, error });
      this.updateJob(jobId, {
        status: 'failed',
        error: error.message || 'Processing failed',
        completedAt: new Date(),
      });
    });

    return { jobId, status: 'pending' };
  }

  /**
   * Get job status and result
   */
  async getJob(jobId: string): Promise<InsightJob | null> {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get job progress for SSE streaming
   */
  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
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
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.updateJob(jobId, {
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
        modelConfig: job.options?.modelConfig,
      });

      // Initial state
      const initialState: Partial<InsightState> = {
        query: job.query,
        userId: job.userId,
        nodeId: job.options?.nodeId || null,
        lookbackDays: job.options?.lookbackDays || 30,
        includePeerComparison: job.options?.includePeerComparison ?? true,
        includeWebSearch: job.options?.includeWebSearch ?? true,
        includeCompanyDocs: job.options?.includeCompanyDocs ?? this.companyDocsEnabled,
        maxOptimizationBlocks: job.options?.maxOptimizationBlocks || 5,
        status: 'processing',
        progress: 0,
        currentStage: 'starting',
        errors: [],
        a1RetryCount: 0,
        a2RetryCount: 0,
      };

      // Stream progress by periodically checking state
      const progressInterval = setInterval(() => {
        const currentJob = this.jobs.get(jobId);
        if (currentJob && currentJob.status === 'processing') {
          this.notifyListeners(jobId, {
            jobId,
            status: currentJob.status,
            progress: currentJob.progress,
            currentStage: currentJob.currentStage,
          });
        }
      }, 1000);

      // Run the graph
      const result = await graph.invoke(initialState);

      clearInterval(progressInterval);

      // Extract final result
      const finalResult = result.finalResult as InsightGenerationResult | null;

      if (finalResult) {
        this.updateJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStage: 'complete',
          result: finalResult,
          completedAt: new Date(),
        });
      } else {
        this.updateJob(jobId, {
          status: 'failed',
          error: 'No result generated',
          completedAt: new Date(),
        });
      }
    } catch (error) {
      this.logger.error('Job processing error', { jobId, error });
      this.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    }
  }

  /**
   * Update job and notify listeners
   */
  private updateJob(jobId: string, updates: Partial<InsightJob>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, updates);
    this.jobs.set(jobId, job);

    // Notify listeners
    this.notifyListeners(jobId, {
      jobId,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
    });
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
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'processing') {
      return false;
    }

    this.updateJob(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
    });

    return true;
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(userId: number): Promise<InsightJob[]> {
    const userJobs: InsightJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.userId === userId) {
        userJobs.push(job);
      }
    }
    return userJobs.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }
}
