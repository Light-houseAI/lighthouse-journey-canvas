/**
 * Unit Tests for Error Handler Middleware
 *
 * Tests the global error handler that transforms all errors into
 * standardized API error responses with appropriate HTTP status codes.
 */

import { ApiError } from '@journey/schema';
import { NextFunction, Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode, HttpStatus } from '../../core/api-responses';
import { errorHandlerMiddleware } from '../error-handler.middleware';

describe('errorHandlerMiddleware', () => {
  let mockReq: Request;
  let mockRes: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {} as Request;
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('ApiError Instances', () => {
    it('should preserve ApiError statusCode and use toJSON() response', () => {
      const apiError = new ApiError(
        'Validation failed',
        ErrorCode.VALIDATION_ERROR as any,
        HttpStatus.BAD_REQUEST
      );

      errorHandlerMiddleware(apiError as any, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith(apiError.toJSON());
    });

    it('should handle ApiError with custom details', () => {
      const apiError = new ApiError(
        'Access denied',
        ErrorCode.INSUFFICIENT_PERMISSIONS as any,
        HttpStatus.FORBIDDEN,
        { requiredRole: 'admin' }
      );

      errorHandlerMiddleware(apiError as any, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      const response = apiError.toJSON();
      expect(mockRes.json).toHaveBeenCalledWith(response);
    });
  });

  describe('Error Code Detection', () => {
    it('should map ValidationError name to VALIDATION_ERROR (400)', () => {
      const error = new Error('Invalid input') as any;
      error.name = 'ValidationError';

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input',
          }),
        })
      );
    });

    it('should map ZodError name to VALIDATION_ERROR with details (400)', () => {
      const error = new Error('Validation failed') as any;
      error.name = 'ZodError';
      error.errors = [
        { path: ['email'], message: 'Invalid email format' },
        { path: ['age'], message: 'Must be a number' },
      ];

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            details: error.errors,
          }),
        })
      );
    });

    it('should map "not found" message to NOT_FOUND (404)', () => {
      const error = new Error('User not found');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
            message: 'User not found',
          }),
        })
      );
    });

    it('should map "Not found" (capitalized) message to NOT_FOUND (404)', () => {
      const error = new Error('Resource Not found');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
          }),
        })
      );
    });

    it('should map "unauthorized" message to AUTHENTICATION_REQUIRED (401)', () => {
      const error = new Error('unauthorized access attempt');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.AUTHENTICATION_REQUIRED,
          }),
        })
      );
    });

    it('should map "authentication" message to AUTHENTICATION_REQUIRED (401)', () => {
      const error = new Error('authentication required');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.AUTHENTICATION_REQUIRED,
          }),
        })
      );
    });

    it('should map "forbidden" message to ACCESS_DENIED (403)', () => {
      const error = new Error('forbidden operation');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.ACCESS_DENIED,
          }),
        })
      );
    });

    it('should map "access denied" message to ACCESS_DENIED (403)', () => {
      const error = new Error('access denied to resource');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.ACCESS_DENIED,
          }),
        })
      );
    });

    it('should map "already exists" message to ALREADY_EXISTS (409)', () => {
      const error = new Error('Email already exists');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.ALREADY_EXISTS,
          }),
        })
      );
    });

    it('should map "conflict" message to ALREADY_EXISTS (409)', () => {
      const error = new Error('Version conflict detected');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.ALREADY_EXISTS,
          }),
        })
      );
    });

    it('should map AwilixResolutionError to DEPENDENCY_INJECTION_ERROR (500)', () => {
      const error = new Error('Could not resolve dependency') as any;
      error.name = 'AwilixResolutionError';

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.DEPENDENCY_INJECTION_ERROR,
          }),
        })
      );
    });

    it('should map ECONNREFUSED code to DATABASE_ERROR (500)', () => {
      const error = new Error('Connection refused') as any;
      error.code = 'ECONNREFUSED';

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.DATABASE_ERROR,
          }),
        })
      );
    });

    it('should map "database" message to DATABASE_ERROR (500)', () => {
      const error = new Error('database connection failed');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.DATABASE_ERROR,
          }),
        })
      );
    });

    it('should map "timeout" message to REQUEST_TIMEOUT (500)', () => {
      const error = new Error('Request timeout exceeded');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.REQUEST_TIMEOUT,
          }),
        })
      );
    });

    it('should preserve custom code property when it matches ErrorCode enum', () => {
      const error = new Error('Quota exceeded') as any;
      error.code = ErrorCode.QUOTA_EXCEEDED;

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      // QUOTA_EXCEEDED maps to 429 in error-codes.ts metadata
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      ); // Middleware uses switch statement, 429 falls to default case
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.QUOTA_EXCEEDED,
          }),
        })
      );
    });

    it('should default to INTERNAL_ERROR (500) for unknown errors', () => {
      const error = new Error('Something went wrong');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Something went wrong',
          }),
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should set Content-Type header to application/json', () => {
      const error = new Error('Test error');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
    });

    it('should always set success to false', () => {
      const error = new Error('Test error');

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should handle error without message (default message)', () => {
      const error = new Error() as any;
      error.message = '';

      errorHandlerMiddleware(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Internal Server Error',
          }),
        })
      );
    });
  });
});
