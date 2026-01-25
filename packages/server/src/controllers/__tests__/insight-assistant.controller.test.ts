/**
 * Unit Tests for Insight Assistant Controller
 *
 * Tests the HTTP request handlers for multi-agent insight generation endpoints.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockClear, type MockProxy } from 'vitest-mock-extended';
import type { Request, Response } from 'express';

import type { Logger } from '../../core/logger';
import type { InsightAssistantService } from '../../services/insight-assistant.service';
import type { InsightGenerationService } from '../../services/insight-generation/insight-generation.service';
import { InsightAssistantController } from '../insight-assistant.controller';

describe('InsightAssistantController', () => {
  let controller: InsightAssistantController;
  let mockInsightAssistantService: MockProxy<InsightAssistantService>;
  let mockInsightGenerationService: MockProxy<InsightGenerationService>;
  let mockLogger: MockProxy<Logger>;
  let mockRequest: MockProxy<Request>;
  let mockResponse: MockProxy<Response>;

  const TEST_USER_ID = 1;
  const TEST_JOB_ID = 'test-job-id-123';
  const TEST_QUERY = 'How can I improve my workflow?';

  beforeEach(() => {
    mockInsightAssistantService = mock<InsightAssistantService>();
    mockInsightGenerationService = mock<InsightGenerationService>();
    mockLogger = mock<Logger>();

    controller = new InsightAssistantController({
      insightAssistantService: mockInsightAssistantService,
      insightGenerationService: mockInsightGenerationService,
      logger: mockLogger,
    });

    // Create mock request/response
    mockRequest = mock<Request>();
    mockResponse = mock<Response>();

    // Setup response chain methods
    mockResponse.status.mockReturnThis();
    mockResponse.json.mockReturnThis();
    mockResponse.setHeader.mockReturnThis();
    mockResponse.write.mockReturnThis();
    mockResponse.flushHeaders.mockReturnThis();
    mockResponse.end.mockReturnThis();

    // Clear all mocks
    mockClear(mockInsightAssistantService);
    mockClear(mockInsightGenerationService);
    mockClear(mockLogger);
  });

  describe('generateInsights', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: TEST_USER_ID };
      mockRequest.body = { query: TEST_QUERY };
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      await controller.generateInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    });

    it('should return 503 when insight generation service is not available', async () => {
      const controllerWithoutService = new InsightAssistantController({
        insightAssistantService: mockInsightAssistantService,
        insightGenerationService: undefined,
        logger: mockLogger,
      });

      await controllerWithoutService.generateInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
      });
    });

    it('should start a job and return 202 with jobId', async () => {
      mockInsightGenerationService.startJob.mockResolvedValue({
        jobId: TEST_JOB_ID,
        status: 'pending',
      });

      await controller.generateInsights(mockRequest, mockResponse);

      expect(mockInsightGenerationService.startJob).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_QUERY,
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { jobId: TEST_JOB_ID, status: 'pending' },
      });
    });

    it('should pass options to startJob', async () => {
      mockRequest.body = {
        query: TEST_QUERY,
        options: { lookbackDays: 60, includePeerComparison: true },
      };
      mockInsightGenerationService.startJob.mockResolvedValue({
        jobId: TEST_JOB_ID,
        status: 'pending',
      });

      await controller.generateInsights(mockRequest, mockResponse);

      // Zod schema adds default values, so check that the call contains our values
      expect(mockInsightGenerationService.startJob).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_QUERY,
        expect.objectContaining({ lookbackDays: 60, includePeerComparison: true })
      );
    });

    it('should return 400 for validation errors', async () => {
      mockRequest.body = { query: '' }; // Invalid: empty query

      await controller.generateInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getJob', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: TEST_USER_ID };
      mockRequest.params = { jobId: TEST_JOB_ID };
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      await controller.getJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when job not found', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue(null);

      await controller.getJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    });

    it('should return 403 when job belongs to different user', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: 999, // Different user
        query: TEST_QUERY,
        status: 'pending',
        progress: 0,
        currentStage: 'initial',
        createdAt: new Date().toISOString(),
      });

      await controller.getJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      });
    });

    it('should return job details when authorized', async () => {
      const mockJob = {
        id: TEST_JOB_ID,
        userId: TEST_USER_ID,
        query: TEST_QUERY,
        status: 'processing' as const,
        progress: 50,
        currentStage: 'a2_diagnostics',
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      mockInsightGenerationService.getJob.mockResolvedValue(mockJob);

      await controller.getJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          jobId: TEST_JOB_ID,
          status: 'processing',
          progress: 50,
          currentStage: 'a2_diagnostics',
          result: null,
          error: null,
          createdAt: mockJob.createdAt,
          completedAt: null,
        },
      });
    });
  });

  describe('streamJobProgress', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: TEST_USER_ID };
      mockRequest.params = { jobId: TEST_JOB_ID };
      mockRequest.on = mock();
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      await controller.streamJobProgress(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when job not found', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue(null);

      await controller.streamJobProgress(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when job belongs to different user', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: 999,
        query: TEST_QUERY,
        status: 'pending',
        progress: 0,
        currentStage: 'initial',
        createdAt: new Date().toISOString(),
      });

      await controller.streamJobProgress(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should set up SSE headers', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: TEST_USER_ID,
        query: TEST_QUERY,
        status: 'processing',
        progress: 0,
        currentStage: 'initial',
        createdAt: new Date().toISOString(),
      });
      mockInsightGenerationService.getJobProgress.mockResolvedValue(null);
      mockInsightGenerationService.subscribeToProgress.mockReturnValue(() => {});

      await controller.streamJobProgress(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.flushHeaders).toHaveBeenCalled();
    });

    it('should send initial progress', async () => {
      const initialProgress = { jobId: TEST_JOB_ID, status: 'processing', progress: 50 };
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: TEST_USER_ID,
        query: TEST_QUERY,
        status: 'processing',
        progress: 50,
        currentStage: 'initial',
        createdAt: new Date().toISOString(),
      });
      mockInsightGenerationService.getJobProgress.mockResolvedValue(initialProgress);
      mockInsightGenerationService.subscribeToProgress.mockReturnValue(() => {});

      await controller.streamJobProgress(mockRequest, mockResponse);

      expect(mockResponse.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(initialProgress)}\n\n`
      );
    });
  });

  describe('quickInsights', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: TEST_USER_ID };
      mockRequest.body = { query: TEST_QUERY };
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      await controller.quickInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 503 when service not available', async () => {
      const controllerWithoutService = new InsightAssistantController({
        insightAssistantService: mockInsightAssistantService,
        insightGenerationService: undefined,
        logger: mockLogger,
      });

      await controllerWithoutService.quickInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
    });

    it('should return 500 when generation fails', async () => {
      mockInsightGenerationService.generateQuickInsights.mockResolvedValue(null);

      await controller.quickInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Failed to generate insights' },
      });
    });

    it('should return insights when generation succeeds', async () => {
      const mockResult = {
        queryId: 'query-123',
        query: TEST_QUERY,
        userId: TEST_USER_ID,
        executiveSummary: {
          totalTimeReduced: 600,
          totalRelativeImprovement: 45,
          topInefficiencies: ['context_switching'],
          claudeCodeInsertionPoints: ['Use Claude Code to...'],
          passesQualityThreshold: true,
        },
        optimizationPlan: {
          blocks: [],
          totalTimeSaved: 600,
          totalRelativeImprovement: 45,
          passesThreshold: true,
        },
        finalOptimizedWorkflow: [],
        supportingEvidence: {
          userStepReferences: [],
        },
        metadata: {
          queryId: 'query-123',
          agentsUsed: ['A1', 'A2'],
          totalProcessingTimeMs: 5000,
          peerDataAvailable: false,
          companyDocsAvailable: false,
          webSearchUsed: true,
          modelVersion: 'v1',
        },
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      mockInsightGenerationService.generateQuickInsights.mockResolvedValue(mockResult);

      await controller.quickInsights(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('cancelJob', () => {
    beforeEach(() => {
      (mockRequest as any).user = { id: TEST_USER_ID };
      mockRequest.params = { jobId: TEST_JOB_ID };
    });

    it('should return 401 when user is not authenticated', async () => {
      (mockRequest as any).user = null;

      await controller.cancelJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 when job not found', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue(null);

      await controller.cancelJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when job belongs to different user', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: 999,
        query: TEST_QUERY,
        status: 'processing',
        progress: 50,
        currentStage: 'a2',
        createdAt: new Date().toISOString(),
      });

      await controller.cancelJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should cancel job and return result', async () => {
      mockInsightGenerationService.getJob.mockResolvedValue({
        id: TEST_JOB_ID,
        userId: TEST_USER_ID,
        query: TEST_QUERY,
        status: 'processing',
        progress: 50,
        currentStage: 'a2',
        createdAt: new Date().toISOString(),
      });
      mockInsightGenerationService.cancelJob.mockResolvedValue(true);

      await controller.cancelJob(mockRequest, mockResponse);

      expect(mockInsightGenerationService.cancelJob).toHaveBeenCalledWith(TEST_JOB_ID);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { cancelled: true },
      });
    });
  });
});
