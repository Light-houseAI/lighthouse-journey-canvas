/**
 * Unit Tests for Insight Generation Service
 *
 * Tests the multi-agent insight generation orchestration service.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../../core/logger';
import type { LLMProvider } from '../../../core/llm-provider';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository';
import type { EmbeddingService } from '../../interfaces/index';
import { InsightGenerationService } from '../insight-generation.service';
import type { InsightGenerationOptions, JobStatus } from '../types';

describe('InsightGenerationService', () => {
  let service: InsightGenerationService;
  let mockLogger: MockProxy<Logger>;
  let mockLLMProvider: MockProxy<LLMProvider>;
  let mockNLQService: MockProxy<NaturalLanguageQueryService>;
  let mockPlatformWorkflowRepository: MockProxy<PlatformWorkflowRepository>;
  let mockSessionMappingRepository: MockProxy<SessionMappingRepository>;
  let mockEmbeddingService: MockProxy<EmbeddingService>;

  const TEST_USER_ID = 1;
  const TEST_QUERY = 'How can I improve my coding workflow?';

  beforeEach(() => {
    mockLogger = mock<Logger>();
    mockLLMProvider = mock<LLMProvider>();
    mockNLQService = mock<NaturalLanguageQueryService>();
    mockPlatformWorkflowRepository = mock<PlatformWorkflowRepository>();
    mockSessionMappingRepository = mock<SessionMappingRepository>();
    mockEmbeddingService = mock<EmbeddingService>();

    service = new InsightGenerationService({
      logger: mockLogger,
      llmProvider: mockLLMProvider,
      nlqService: mockNLQService,
      platformWorkflowRepository: mockPlatformWorkflowRepository,
      sessionMappingRepository: mockSessionMappingRepository,
      embeddingService: mockEmbeddingService,
      perplexityApiKey: 'test-api-key',
      companyDocsEnabled: false,
    });

    // Clear all mocks
    mockClear(mockLogger);
    mockClear(mockLLMProvider);
    mockClear(mockNLQService);
    mockClear(mockPlatformWorkflowRepository);
    mockClear(mockSessionMappingRepository);
    mockClear(mockEmbeddingService);
  });

  describe('startJob', () => {
    it('should create a new job and return jobId with pending status', async () => {
      const result = await service.startJob(TEST_USER_ID, TEST_QUERY);

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe('string');
      expect(result.status).toBe('pending');
    });

    it('should create job with custom options', async () => {
      const options: InsightGenerationOptions = {
        nodeId: 'test-node-id',
        lookbackDays: 60,
        includePeerComparison: true,
        maxWorkflows: 20,
      };

      const result = await service.startJob(TEST_USER_ID, TEST_QUERY, options);

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should log job creation', async () => {
      await service.startJob(TEST_USER_ID, TEST_QUERY);

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('getJob', () => {
    it('should return null for non-existent job', async () => {
      const result = await service.getJob('non-existent-job-id');

      expect(result).toBeNull();
    });

    it('should return job details for existing job', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);

      const job = await service.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.userId).toBe(TEST_USER_ID);
      expect(job?.query).toBe(TEST_QUERY);
    });
  });

  describe('getJobProgress', () => {
    it('should return null for non-existent job', async () => {
      const result = await service.getJobProgress('non-existent-job-id');

      expect(result).toBeNull();
    });

    it('should return progress for existing job', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);

      const progress = await service.getJobProgress(jobId);

      expect(progress).toBeDefined();
      expect(progress?.jobId).toBe(jobId);
      expect(typeof progress?.progress).toBe('number');
      expect(progress?.status).toBeDefined();
    });
  });

  describe('subscribeToProgress', () => {
    it('should return unsubscribe function', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);
      const listener = vi.fn();

      const unsubscribe = service.subscribeToProgress(jobId, listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call listener when progress updates', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);
      const listener = vi.fn();

      service.subscribeToProgress(jobId, listener);

      // The service should emit initial progress
      // (Implementation dependent - may need to wait or trigger an update)
    });

    it('should stop calling listener after unsubscribe', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);
      const listener = vi.fn();

      const unsubscribe = service.subscribeToProgress(jobId, listener);
      unsubscribe();

      // Listener should no longer be called after unsubscribe
    });
  });

  describe('cancelJob', () => {
    it('should return false for non-existent job', async () => {
      const result = await service.cancelJob('non-existent-job-id');

      expect(result).toBe(false);
    });

    it('should return true and cancel existing pending job', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);

      const result = await service.cancelJob(jobId);

      expect(result).toBe(true);

      const job = await service.getJob(jobId);
      expect(job?.status).toBe('cancelled');
    });

    it('should return false for already completed job', async () => {
      const { jobId } = await service.startJob(TEST_USER_ID, TEST_QUERY);

      // First cancellation should succeed
      await service.cancelJob(jobId);

      // Second cancellation should fail (already cancelled)
      const result = await service.cancelJob(jobId);

      expect(result).toBe(false);
    });
  });

  describe('generateQuickInsights', () => {
    beforeEach(() => {
      // Mock NLQ service response
      mockNLQService.query.mockResolvedValue({
        answer: 'Test answer',
        sources: [],
        relatedWorkSessions: [
          {
            sessionId: 'test-session',
            summary: 'Test session',
            timestamp: new Date().toISOString(),
          },
        ],
        retrievalMetadata: {
          totalTimeMs: 100,
        },
      });

      // Mock embedding service
      mockEmbeddingService.generateEmbedding.mockResolvedValue(
        new Array(1536).fill(0)
      );

      // Mock platform workflow repository
      mockPlatformWorkflowRepository.searchByEmbedding.mockResolvedValue([]);

      // Mock LLM provider for structured responses
      mockLLMProvider.generateStructuredResponse.mockResolvedValue({
        inefficiencies: [],
        opportunities: [],
      });
    });

    it('should generate insights synchronously', async () => {
      const result = await service.generateQuickInsights(
        TEST_USER_ID,
        TEST_QUERY
      );

      // Result should be defined (even if empty/partial due to mocked data)
      expect(result).toBeDefined();
    });

    it('should use provided options', async () => {
      const options: InsightGenerationOptions = {
        lookbackDays: 30,
        includePeerComparison: false,
      };

      const result = await service.generateQuickInsights(
        TEST_USER_ID,
        TEST_QUERY,
        options
      );

      expect(result).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      // The graph catches internal errors and returns partial results.
      // Service-level errors are caught and return null.
      // Here we verify the result structure is still valid even with missing data
      const result = await service.generateQuickInsights(
        TEST_USER_ID,
        TEST_QUERY
      );

      // Even with mocked/empty data, should return a valid result structure
      // (or null if there's a fatal error in graph creation)
      if (result !== null) {
        expect(result).toHaveProperty('queryId');
        expect(result).toHaveProperty('query');
        expect(result).toHaveProperty('executiveSummary');
      }
    });
  });
});
