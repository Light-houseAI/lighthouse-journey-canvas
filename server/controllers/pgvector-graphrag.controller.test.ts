/**
 * GraphRAG Controller Unit Tests
 * 
 * Direct controller method tests without HTTP layer
 * Tests business logic and response handling
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { PgVectorGraphRAGController } from './pgvector-graphrag.controller';
import type { GraphRAGSearchResponse, IPgVectorGraphRAGService } from '../types/graphrag.types';

describe('PgVectorGraphRAGController', () => {
  let controller: PgVectorGraphRAGController;
  let mockService: MockProxy<IPgVectorGraphRAGService>;
  let mockReq: any;
  let mockRes: any;
  let mockLogger: any;

  beforeEach(() => {
    // Mock service with vitest-mock-extended
    mockService = mock<IPgVectorGraphRAGService>();

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    };

    // Mock Express req/res
    mockReq = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      }
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };

    // Create controller with mocked service and logger using Awilix DI pattern
    controller = new PgVectorGraphRAGController({
      pgVectorGraphRAGService: mockService,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockService.mockReset();
  });

  describe('searchProfiles', () => {
    test('should handle valid request with query and limit', async () => {
      mockReq.body = {
        query: 'distributed systems',
        limit: 5,
      };

      const mockSearchResult: GraphRAGSearchResponse = {
        query: 'distributed systems',
        totalResults: 2,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockService.searchProfiles.mockResolvedValue(mockSearchResult);

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockService.searchProfiles).toHaveBeenCalledWith({
        query: 'distributed systems',
        limit: 5,
        excludeUserId: undefined,
        similarityThreshold: 0.5,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockSearchResult);
    });

    test('should handle missing query parameter', async () => {
      mockReq.body = {
        limit: 10,
      };

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        details: expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['query'],
            message: 'Required'
          })
        ])
      });
    });

    test('should use default limit when not provided', async () => {
      mockReq.body = {
        query: 'software engineer',
      };

      const mockSearchResult: GraphRAGSearchResponse = {
        query: 'software engineer',
        totalResults: 5,
        profiles: [],
        timestamp: new Date().toISOString(),
      };

      mockService.searchProfiles.mockResolvedValue(mockSearchResult);

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockService.searchProfiles).toHaveBeenCalledWith({
        query: 'software engineer',
        limit: 20, // default limit
        excludeUserId: undefined,
        similarityThreshold: 0.5,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    test('should handle service errors gracefully', async () => {
      mockReq.body = {
        query: 'test query',
        limit: 10,
      };

      const mockError = new Error('Service unavailable');
      mockService.searchProfiles.mockRejectedValue(mockError);

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Failed to perform search',
        timestamp: expect.any(String),
      });
    });

    test('should reject limit exceeding maximum', async () => {
      mockReq.body = {
        query: 'test query',
        limit: 150, // exceeds maximum
      };

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid request',
        details: expect.arrayContaining([
          expect.objectContaining({
            code: 'too_big',
            maximum: 100,
            path: ['limit'],
            type: 'number'
          })
        ])
      });
    });
  });
});