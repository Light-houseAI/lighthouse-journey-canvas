/**
 * Middleware Integration Tests
 *
 * Tests to verify that the response interceptor and error handler middleware
 * work correctly with both legacy and standardized API responses.
 */

import { Request, Response } from 'express';

import { errorHandlerMiddleware } from '../middleware/error-handler.middleware';
import {
  requestIdMiddleware,
  responseInterceptorMiddleware,
} from '../middleware/response-interceptor.middleware';

// Mock Express Request and Response
const mockRequest = (overrides = {}) => {
  const req = {
    headers: {},
    method: 'GET',
    path: '/api/test',
    ...overrides,
  } as any as Request;
  return req;
};

const mockResponse = () => {
  const res = {} as any as Response;
  res.json = jest.fn().mockReturnThis();
  res.status = jest.fn().mockReturnThis();
  res.setHeader = jest.fn().mockReturnThis();
  res.statusCode = 200;
  return res;
};

const mockNext = jest.fn();

describe('Response Interceptor Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should add request ID to request headers', () => {
    const req = mockRequest();
    const res = mockResponse();

    requestIdMiddleware(req, res, mockNext);

    expect(req.headers['x-request-id']).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.any(String)
    );
    expect(mockNext).toHaveBeenCalled();
  });

  test('should preserve existing request ID', () => {
    const existingId = 'existing-123';
    const req = mockRequest({ headers: { 'x-request-id': existingId } });
    const res = mockResponse();

    requestIdMiddleware(req, res, mockNext);

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });

  test('should wrap legacy response in ApiResponse format', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();

    responseInterceptorMiddleware(req, res, mockNext);

    // Mock calling res.json with legacy data
    const legacyData = { message: 'Success', data: [1, 2, 3] };
    res.json(legacyData);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: legacyData,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          requestId: 'test-123',
        }),
      })
    );
  });

  test('should not wrap already standardized ApiResponse', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();

    responseInterceptorMiddleware(req, res, mockNext);

    // Mock calling res.json with already standardized data
    const apiResponse = {
      success: true,
      data: { message: 'Already standardized' },
      meta: { timestamp: '2024-01-01T00:00:00.000Z' },
    };
    res.json(apiResponse);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { message: 'Already standardized' },
        meta: expect.objectContaining({
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'test-123',
        }),
      })
    );
  });

  test('should handle null/undefined responses', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();

    responseInterceptorMiddleware(req, res, mockNext);

    res.json(null);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: null,
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          requestId: 'test-123',
        }),
      })
    );
  });

  test('should handle simple "OK" responses', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();

    responseInterceptorMiddleware(req, res, mockNext);

    res.json('OK');

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { message: 'OK' },
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          requestId: 'test-123',
        }),
      })
    );
  });
});

describe('Error Handler Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create standardized error response', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'test-123' },
      path: '/api/test',
    });
    const res = mockResponse();
    const error = new Error('Test error');

    errorHandlerMiddleware(error, req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String),
          message: 'Test error',
        }),
        meta: expect.objectContaining({
          timestamp: expect.any(String),
          requestId: 'test-123',
        }),
      })
    );
  });

  test('should map ValidationError to correct error code', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'test-123' },
      path: '/api/test',
    });
    const res = mockResponse();
    const error = new Error('Validation failed');
    error.name = 'ValidationError';

    errorHandlerMiddleware(error, req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        }),
      })
    );
  });

  test('should set JSON content type for API routes', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'test-123' },
      path: '/api/test',
    });
    const res = mockResponse();
    const error = new Error('Test error');

    errorHandlerMiddleware(error, req, res, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json'
    );
  });

  test('should include debug info in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = mockRequest({
      headers: { 'x-request-id': 'test-123' },
      path: '/api/test',
    });
    const res = mockResponse();
    const error = new Error('Test error');

    errorHandlerMiddleware(error, req, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          debug: expect.objectContaining({
            originalError: 'Test error',
            errorName: 'Error',
          }),
        }),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });
});
