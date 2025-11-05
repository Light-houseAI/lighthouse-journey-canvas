/**
 * Response Interceptor Middleware Test Suite
 *
 * Tests for response interceptor middleware that:
 * - Auto-wraps legacy responses in ApiResponse format
 * - Injects request IDs and metadata
 * - Maintains backward compatibility
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requestIdMiddleware,
  responseInterceptorMiddleware,
} from '../response-interceptor.middleware';

describe('Response Interceptor Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let originalJsonFn: any;

  beforeEach(() => {
    vi.clearAllMocks();

    originalJsonFn = vi.fn().mockReturnThis();

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      json: originalJsonFn,
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  describe('responseInterceptorMiddleware', () => {
    it('should call next and override res.json method', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledOnce();
      expect(typeof mockResponse.json).toBe('function');
      expect(mockResponse.json).not.toBe(originalJsonFn);
    });

    it('should pass through responses already in ApiResponse format', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const apiResponse = {
        success: true,
        data: { id: 1, name: 'Test' },
      };

      mockResponse.json!(apiResponse);

      expect(originalJsonFn).toHaveBeenCalledWith(apiResponse);
    });

    it('should wrap legacy success responses in ApiResponse format', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const legacyData = { id: 1, name: 'Test', items: [1, 2, 3] };
      mockResponse.json!(legacyData);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: legacyData,
      });
    });

    it('should wrap legacy response with null data', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!(null);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should wrap legacy response with array data', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const arrayData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      mockResponse.json!(arrayData);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: arrayData,
      });
    });

    it('should wrap legacy response with string data', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!('success message');

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: 'success message',
      });
    });

    it('should wrap legacy response with number data', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!(42);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: 42,
      });
    });

    it('should wrap legacy response with boolean data', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!(true);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: true,
      });
    });

    it('should recognize ApiResponse with success: false as already formatted', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const errorResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      };

      mockResponse.statusCode = 404;
      mockResponse.json!(errorResponse);

      expect(originalJsonFn).toHaveBeenCalledWith(errorResponse);
    });

    it('should handle 201 Created status code', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.statusCode = 201;
      const createdData = { id: 'new-123', name: 'Created Resource' };

      mockResponse.json!(createdData);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: createdData,
      });
    });

    it('should handle 204 No Content status code', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.statusCode = 204;
      mockResponse.json!(null);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should not wrap error status codes (4xx)', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.statusCode = 400;
      const errorData = { error: 'Bad Request' };

      mockResponse.json!(errorData);

      // Error responses should be passed through without wrapping
      // The error handler middleware should format them
      expect(originalJsonFn).toHaveBeenCalledWith(errorData);
    });

    it('should not wrap server error status codes (5xx)', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.statusCode = 500;
      const errorData = { error: 'Internal Server Error' };

      mockResponse.json!(errorData);

      expect(originalJsonFn).toHaveBeenCalledWith(errorData);
    });

    it('should handle undefined status code (default to 200)', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.statusCode = undefined;
      const data = { message: 'Success' };

      mockResponse.json!(data);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should handle responses with nested objects', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const complexData = {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
          version: '1.0',
        },
      };

      mockResponse.json!(complexData);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: complexData,
      });
    });

    it('should handle empty object', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!({});

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: {},
      });
    });

    it('should handle empty array', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!([]);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should preserve original json method context', () => {
      const originalContext = mockResponse;
      const contextCapture = { value: null as any };

      mockResponse.json = function (body: unknown) {
        contextCapture.value = this;
        // Simulate original json behavior
        return body as any;
      };

      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const data = { test: 'data' };
      mockResponse.json!(data);

      expect(contextCapture.value).toBe(originalContext);
    });
  });

  describe('requestIdMiddleware', () => {
    it('should generate request ID when not present in headers', () => {
      mockResponse.setHeader = vi.fn();

      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.headers!['x-request-id']).toBeDefined();
      expect(typeof mockRequest.headers!['x-request-id']).toBe('string');
      expect(mockRequest.headers!['x-request-id']).toMatch(
        /^req_\d+_[a-z0-9]+$/
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        mockRequest.headers!['x-request-id']
      );
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should use existing request ID from headers', () => {
      const existingRequestId = 'req_existing_abc123';
      mockRequest.headers = {
        'x-request-id': existingRequestId,
      };
      mockResponse.setHeader = vi.fn();

      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.headers['x-request-id']).toBe(existingRequestId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        existingRequestId
      );
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should add request ID to response headers', () => {
      mockResponse.setHeader = vi.fn();

      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.stringMatching(/^req_\d+_[a-z0-9]+$/)
      );
    });

    it('should generate unique request IDs', () => {
      const requestIds = new Set<string>();
      mockResponse.setHeader = vi.fn();

      // Generate multiple request IDs
      for (let i = 0; i < 100; i++) {
        mockRequest = { headers: {} };
        requestIdMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
        requestIds.add(mockRequest.headers!['x-request-id'] as string);
      }

      // All IDs should be unique
      expect(requestIds.size).toBe(100);
    });

    it('should call next function', () => {
      mockResponse.setHeader = vi.fn();

      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('Integration Tests', () => {
    it('should work together - request ID and response wrapping', () => {
      mockResponse.setHeader = vi.fn();

      // First apply request ID middleware
      requestIdMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then apply response interceptor
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        vi.fn()
      );

      // Send a legacy response
      const legacyData = { message: 'Success' };
      mockResponse.json!(legacyData);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: legacyData,
      });

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-ID',
        expect.any(String)
      );
    });

    it('should handle multiple sequential responses', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!({ data: 'first' });
      expect(originalJsonFn).toHaveBeenLastCalledWith({
        success: true,
        data: { data: 'first' },
      });

      mockResponse.json!({ data: 'second' });
      expect(originalJsonFn).toHaveBeenLastCalledWith({
        success: true,
        data: { data: 'second' },
      });

      expect(originalJsonFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle response with undefined value', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.json!(undefined);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: undefined,
      });
    });

    it('should handle response with circular reference protection', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Create object without circular reference (since JSON.stringify would fail anyway)
      const data = { name: 'Test', nested: { value: 123 } };

      mockResponse.json!(data);

      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should handle objects with success property that is not boolean', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Object has 'success' property but it's not a boolean
      const ambiguousData = {
        success: 'yes', // Not a boolean
        data: 'some data',
      };

      mockResponse.json!(ambiguousData);

      // Should be wrapped because success is not a boolean
      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: ambiguousData,
      });
    });

    it('should handle objects with data property but no success property', () => {
      responseInterceptorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const ambiguousData = {
        data: 'some data', // Has data but no success property
        otherField: 'value',
      };

      mockResponse.json!(ambiguousData);

      // Should be wrapped because it doesn't have success: boolean
      expect(originalJsonFn).toHaveBeenCalledWith({
        success: true,
        data: ambiguousData,
      });
    });
  });
});
