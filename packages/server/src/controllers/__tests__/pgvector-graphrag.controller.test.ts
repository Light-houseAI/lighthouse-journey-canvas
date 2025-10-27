/**
 * GraphRAG Controller Unit Tests
 *
 * Direct controller method tests without HTTP layer
 * Tests business logic and response handling
 */

import type { GraphRAGSearchResponse } from '@journey/schema';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { createMockLogger } from '../../../tests/utils';
import type { IPgVectorGraphRAGService } from '../../services/interfaces';
import { PgVectorGraphRAGController } from '../pgvector-graphrag.controller.js';

describe('PgVectorGraphRAGController', () => {
  let controller: PgVectorGraphRAGController;
  let mockService: MockProxy<IPgVectorGraphRAGService>;
  let mockReq: any;
  let mockRes: any;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    // Mock service with vitest-mock-extended
    mockService = mock<IPgVectorGraphRAGService>();

    // Mock logger
    mockLogger = createMockLogger();

    // Mock Express req/res
    mockReq = {
      body: {} as any,
      params: {} as any,
      query: {} as any,
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
      },
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
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // mockReset not available on MockProxy, use vi.clearAllMocks() instead
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
        results: [],
      };

      mockService.searchProfiles.mockResolvedValue(mockSearchResult);

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockService.searchProfiles).toHaveBeenCalledWith({
        query: 'distributed systems',
        limit: 5,
        excludeUserId: undefined,
        requestingUserId: undefined,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          query: 'distributed systems',
          totalResults: 2,
          results: [],
        },
      });
    });

    test('should throw validation error for missing query parameter', async () => {
      mockReq.body = {
        limit: 10,
      };

      // Act & Assert
      await expect(
        controller.searchProfiles(mockReq, mockRes)
      ).rejects.toThrow();
    });

    test('should use default limit when not provided', async () => {
      mockReq.body = {
        query: 'software engineer',
      };

      const mockSearchResult: GraphRAGSearchResponse = {
        query: 'software engineer',
        totalResults: 5,
        results: [],
      };

      mockService.searchProfiles.mockResolvedValue(mockSearchResult);

      await controller.searchProfiles(mockReq, mockRes);

      expect(mockService.searchProfiles).toHaveBeenCalledWith({
        query: 'software engineer',
        limit: 20, // default limit
        excludeUserId: undefined,
        requestingUserId: undefined,
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          query: 'software engineer',
          totalResults: 5,
          results: [],
        },
      });
    });

    test('should throw service errors', async () => {
      mockReq.body = {
        query: 'test query',
        limit: 10,
      };

      const mockError = new Error('Service unavailable');
      mockService.searchProfiles.mockRejectedValue(mockError);

      // Act & Assert
      await expect(controller.searchProfiles(mockReq, mockRes)).rejects.toThrow(
        'Service unavailable'
      );
    });

    test('should throw validation error for limit exceeding maximum', async () => {
      mockReq.body = {
        query: 'test query',
        limit: 150, // exceeds maximum
      };

      // Act & Assert
      await expect(
        controller.searchProfiles(mockReq, mockRes)
      ).rejects.toThrow();
    });
  });
});
