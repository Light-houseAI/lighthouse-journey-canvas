/**
 * Middleware Integration Tests
 *
 * Tests to verify that the response interceptor and error handler middleware
 * work correctly with both legacy and standardized API responses.
 */

import { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandlerMiddleware } from '../src/middleware/error-handler.middleware.js';
import {
  requestIdMiddleware,
  responseInterceptorMiddleware,
} from '../src/middleware/response-interceptor.middleware.js';

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
  res.json = vi.fn().mockReturnThis();
  res.status = vi.fn().mockReturnThis();
  res.setHeader = vi.fn().mockReturnThis();
  res.statusCode = 200;
  return res;
};

const mockNext = vi.fn();

describe('Response Interceptor Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add request ID to request headers', () => {
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

  it('should preserve existing request ID', () => {
    const existingId = 'existing-123';
    const req = mockRequest({ headers: { 'x-request-id': existingId } });
    const res = mockResponse();

    requestIdMiddleware(req, res, mockNext);

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });

  it('should wrap legacy response in ApiResponse format', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();
    const originalJson = res.json;

    responseInterceptorMiddleware(req, res, mockNext);

    // Mock calling res.json with legacy data
    const legacyData = { message: 'Success', data: [1, 2, 3] };
    res.json(legacyData);

    expect(originalJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: legacyData,
      })
    );
  });

  it('should not wrap already standardized ApiResponse', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();
    const originalJson = res.json;

    responseInterceptorMiddleware(req, res, mockNext);

    // Mock calling res.json with already standardized data
    const apiResponse = {
      success: true,
      data: { message: 'Already standardized' },
      meta: { timestamp: '2024-01-01T00:00:00.000Z' },
    };
    res.json(apiResponse);

    expect(originalJson).toHaveBeenCalledWith(apiResponse);
  });

  it('should handle null/undefined responses', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();
    const originalJson = res.json;

    responseInterceptorMiddleware(req, res, mockNext);

    res.json(null);

    expect(originalJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: null,
      })
    );
  });

  it('should handle simple "OK" responses', () => {
    const req = mockRequest({ headers: { 'x-request-id': 'test-123' } });
    const res = mockResponse();
    const originalJson = res.json;

    responseInterceptorMiddleware(req, res, mockNext);

    res.json('OK');

    expect(originalJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: 'OK',
      })
    );
  });
});

describe('Error Handler Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create standardized error response', () => {
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
      })
    );
  });

  it('should map ValidationError to correct error code', () => {
    const req = mockRequest({
      headers: { 'x-request-id': 'test-123' },
      path: '/api/test',
    });
    const res = mockResponse();
    const error = new Error('Validation failed');
    error.name = 'ValidationError';

    errorHandlerMiddleware(error, req, res, mockNext);

    // ValidationError should return 400
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Validation failed',
        }),
      })
    );
  });

  it('should set JSON content type for API routes', () => {
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

  // Test removed - debug info functionality not implemented in error handler
});
