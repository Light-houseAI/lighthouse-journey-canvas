/**
 * Tests for Standardized PgVectorGraphRAGController
 * 
 * Test suite for the updated PgVectorGraphRAGController with BaseController inheritance
 * Validates API response format consistency and error handling
 */

import { Request, Response } from 'express';
import { PgVectorGraphRAGController } from '../pgvector-graphrag.controller';
import type { IPgVectorGraphRAGService, GraphRAGSearchResponse } from '../../types/graphrag.types';
import { ValidationError } from '../../core/errors';

// Mock dependencies
const mockPgVectorGraphRAGService = {
  searchProfiles: jest.fn(),
} as jest.Mocked<IPgVectorGraphRAGService>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('Standardized PgVectorGraphRAGController', () => {
  let controller: PgVectorGraphRAGController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new PgVectorGraphRAGController({
      pgVectorGraphRAGService: mockPgVectorGraphRAGService,
      logger: mockLogger,
    });

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 1 },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('searchProfiles', () => {
    it('should search profiles and return standardized success response', async () => {
      const mockSearchResponse: GraphRAGSearchResponse = {
        results: [
          {
            userId: 2,
            score: 0.8,
            profile: {
              name: 'Jane Doe',
              headline: 'Senior Developer',
            },
          },
        ],
        totalResults: 1,
        query: 'software engineer',
        executionTime: 150,
      };

      mockRequest.body = {
        query: 'software engineer',
        limit: 20,
        similarityThreshold: 0.5,
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockSearchResponse);

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.any(String));
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSearchResponse,
        meta: {
          total: mockSearchResponse.totalResults,
        },
      });
    });

    it('should handle validation errors with standardized error response', async () => {
      mockRequest.body = {
        query: '', // Invalid empty query
        limit: 20,
      };

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
          }),
        })
      );
    });

    it('should handle service errors with standardized error response', async () => {
      mockRequest.body = {
        query: 'software engineer',
        limit: 20,
      };

      mockPgVectorGraphRAGService.searchProfiles.mockRejectedValue(
        new Error('Search service error')
      );

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Search service error',
          }),
        })
      );
    });

    it('should validate query parameter limits', async () => {
      mockRequest.body = {
        query: 'software engineer',
        limit: 200, // Exceeds maximum limit of 100
        similarityThreshold: 1.5, // Exceeds maximum of 1.0
      };

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
          }),
        })
      );
    });

    it('should add current user ID to exclude from results', async () => {
      const mockSearchResponse: GraphRAGSearchResponse = {
        results: [],
        totalResults: 0,
        query: 'software engineer',
        executionTime: 100,
      };

      mockRequest.body = {
        query: 'software engineer',
        limit: 20,
      };

      mockRequest.user = { id: 123 };
      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockSearchResponse);

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'software engineer',
          limit: 20,
          excludeUserId: 123,
        })
      );
    });

    it('should apply default values for optional parameters', async () => {
      const mockSearchResponse: GraphRAGSearchResponse = {
        results: [],
        totalResults: 0,
        query: 'software engineer',
        executionTime: 100,
      };

      mockRequest.body = {
        query: 'software engineer',
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockSearchResponse);

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockPgVectorGraphRAGService.searchProfiles).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'software engineer',
          limit: 20, // Default value
          similarityThreshold: 0.5, // Default value
        })
      );
    });

    it('should log search request and response', async () => {
      const mockSearchResponse: GraphRAGSearchResponse = {
        results: [],
        totalResults: 0,
        query: 'software engineer',
        executionTime: 100,
      };

      mockRequest.body = {
        query: 'software engineer',
        limit: 10,
      };

      mockPgVectorGraphRAGService.searchProfiles.mockResolvedValue(mockSearchResponse);

      await controller.searchProfiles(mockRequest as Request, mockResponse as Response);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GraphRAG search request received',
        expect.objectContaining({
          query: 'software engineer',
          limit: 10,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'GraphRAG search completed',
        expect.objectContaining({
          query: 'software engineer',
          resultsCount: 0,
          status: 200,
        })
      );
    });
  });

  describe('healthCheck', () => {
    it('should return standardized health check response', async () => {
      await controller.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          status: 'healthy',
          service: 'pgvector-graphrag',
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle health check errors with standardized error response', async () => {
      // Mock a health check failure scenario
      const originalHealthCheck = controller.healthCheck;
      controller.healthCheck = jest.fn().mockImplementation(async (req, res) => {
        try {
          throw new Error('Health check failed');
        } catch (error) {
          const handleError = (controller as any).handleError;
          handleError.call(controller, res, error);
        }
      });

      await controller.healthCheck(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Health check failed',
          }),
        })
      );
    });
  });

  describe('getStats', () => {
    it('should return standardized statistics response', async () => {
      await controller.getStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          service: 'pgvector-graphrag',
          stats: {
            totalChunks: 0,
            totalEdges: 0,
            avgResponseTime: 0,
          },
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle stats errors with standardized error response', async () => {
      // Mock a stats failure scenario
      const originalGetStats = controller.getStats;
      controller.getStats = jest.fn().mockImplementation(async (req, res) => {
        try {
          throw new Error('Stats retrieval failed');
        } catch (error) {
          const handleError = (controller as any).handleError;
          handleError.call(controller, res, error);
        }
      });

      await controller.getStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Stats retrieval failed',
          }),
        })
      );
    });
  });
});