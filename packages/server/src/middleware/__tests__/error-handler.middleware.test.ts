/**
 * Error Handler Middleware Test Suite
 *
 * Tests for global error handler middleware that:
 * - Catches all uncaught errors
 * - Returns standardized API error responses
 * - Maps errors to appropriate HTTP status codes
 * - Handles ApiError instances
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  ApiApiErrorCode,
  HTTP_STATUS,
  NotFoundError,
  ValidationError,
} from '@journey/schema';
import { errorHandlerMiddleware } from '../error-handler.middleware';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      path: '/api/test',
      method: 'GET',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('ApiError Handling', () => {
    it('should handle ValidationError from schema package', () => {
      const error = new ValidationError('Invalid input data', {
        field: 'email',
        message: 'Invalid email format',
      });

      errorHandlerMiddleware(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(error.statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith(error.toJSON());
    });

    it('should handle NotFoundError from schema package', () => {
      const error = new NotFoundError('User not found');

      errorHandlerMiddleware(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(error.statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith(error.toJSON());
    });

    it('should handle generic ApiError instances', () => {
      const error = new ApiError(
        'Something went wrong',
        ApiApiErrorCode.INTERNAL_SERVER_ERROR,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );

      errorHandlerMiddleware(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiApiErrorCode.INTERNAL_SERVER_ERROR,
            message: 'Something went wrong',
          }),
        })
      );
    });
  });

  describe('Validation Error Detection', () => {
    it('should detect ValidationError by name', () => {
      const error = new Error('Invalid data') as any;
      error.name = 'ValidationError';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
          }),
        })
      );
    });

    it('should detect ZodError by name', () => {
      const error = new Error('Validation failed') as any;
      error.name = 'ZodError';
      error.errors = [
        {
          path: ['email'],
          message: 'Invalid email',
        },
      ];

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            details: error.errors,
          }),
        })
      );
    });
  });

  describe('Not Found Error Detection', () => {
    it('should detect "not found" in error message (lowercase)', () => {
      const error = new Error('Resource not found');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND,
          }),
        })
      );
    });

    it('should detect "Not found" in error message (uppercase)', () => {
      const error = new Error('User Not found');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe('Authentication Error Detection', () => {
    it('should detect "unauthorized" in error message', () => {
      const error = new Error('User is unauthorized');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.AUTHENTICATION_REQUIRED,
          }),
        })
      );
    });

    it('should detect "authentication" in error message', () => {
      const error = new Error('authentication required');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe('Access Denied Error Detection', () => {
    it('should detect "forbidden" in error message', () => {
      const error = new Error('This action is forbidden');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.ACCESS_DENIED,
          }),
        })
      );
    });

    it('should detect "access denied" in error message', () => {
      const error = new Error('access denied');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
    });
  });

  describe('Conflict Error Detection', () => {
    it('should detect "already exists" in error message', () => {
      const error = new Error('User already exists');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.ALREADY_EXISTS,
          }),
        })
      );
    });

    it('should detect "conflict" in error message', () => {
      const error = new Error('Resource conflict detected');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT);
    });
  });

  describe('Dependency Injection Error Detection', () => {
    it('should detect AwilixResolutionError', () => {
      const error = new Error('Could not resolve dependency') as any;
      error.name = 'AwilixResolutionError';
      error.resolutionPath = 'userService -> database';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.DEPENDENCY_INJECTION_ERROR,
          }),
        })
      );
    });
  });

  describe('Database Error Detection', () => {
    it('should detect ECONNREFUSED error code', () => {
      const error = new Error('Connection refused') as any;
      error.code = 'ECONNREFUSED';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.DATABASE_ERROR,
          }),
        })
      );
    });

    it('should detect "database" in error message', () => {
      const error = new Error('database connection failed');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.DATABASE_ERROR,
          }),
        })
      );
    });
  });

  describe('Timeout Error Detection', () => {
    it('should detect "timeout" in error message', () => {
      const error = new Error('Request timeout exceeded');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.REQUEST_TIMEOUT,
          }),
        })
      );
    });
  });

  describe('Custom Error Code Handling', () => {
    it('should use custom error code if provided and valid', () => {
      const error = new Error('Custom error') as any;
      error.code = ApiErrorCode.NOT_FOUND;

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND,
          }),
        })
      );
    });

    it('should ignore invalid custom error codes', () => {
      const error = new Error('Error with invalid code') as any;
      error.code = 'INVALID_CODE';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should fall back to INTERNAL_ERROR
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.INTERNAL_ERROR,
          }),
        })
      );
    });
  });

  describe('HTTP Status Code Mapping', () => {
    it('should map VALIDATION_ERROR to 400', () => {
      const error = new Error('Validation failed') as any;
      error.name = 'ValidationError';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
    });

    it('should map AUTHENTICATION_REQUIRED to 401', () => {
      const error = new Error('authentication required');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
    });

    it('should map ACCESS_DENIED to 403', () => {
      const error = new Error('access denied');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
    });

    it('should map NOT_FOUND to 404', () => {
      const error = new Error('Resource not found');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
    });

    it('should map ALREADY_EXISTS to 409', () => {
      const error = new Error('already exists');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.CONFLICT);
    });

    it('should map unknown errors to 500', () => {
      const error = new Error('Unknown error');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Response Headers', () => {
    it('should set Content-Type header to application/json', () => {
      const error = new Error('Test error');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
    });
  });

  describe('Response Structure', () => {
    it('should return standardized error response structure', () => {
      const error = new Error('Test error message');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: expect.any(String),
          message: 'Test error message',
        },
      });
    });

    it('should include error details for ZodErrors', () => {
      const error = new Error('Validation failed') as any;
      error.name = 'ZodError';
      error.errors = [
        { path: ['email'], message: 'Invalid email' },
        { path: ['age'], message: 'Must be at least 18' },
      ];

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            details: error.errors,
          }),
        })
      );
    });

    it('should handle errors without messages', () => {
      const error = new Error();

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
          }),
        })
      );
    });

    it('should preserve original error message', () => {
      const customMessage = 'This is a custom error message with details';
      const error = new Error(customMessage);

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: customMessage,
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle error with undefined message', () => {
      const error = { message: undefined } as any;

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
          }),
        })
      );
    });

    it('should handle error with empty message', () => {
      const error = new Error('');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal Server Error',
          }),
        })
      );
    });

    it('should handle errors with additional properties', () => {
      const error = new Error('Database constraint violation') as any;
      error.constraint = 'unique_email';
      error.table = 'users';
      error.column = 'email';

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle errors with nested error objects', () => {
      const error = new Error('Nested error') as any;
      error.cause = new Error('Original cause');
      error.response = {
        data: { message: 'API error' },
        error: { code: 'API_ERROR' },
      };

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle RangeError', () => {
      const error = new RangeError('Invalid array length');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle ReferenceError', () => {
      const error = new ReferenceError('Variable is not defined');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    it('should handle SyntaxError', () => {
      const error = new SyntaxError('Unexpected token');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Multiple Error Conditions', () => {
    it('should prioritize custom code over error message detection', () => {
      const error = new Error('Resource not found') as any;
      error.code = ApiErrorCode.VALIDATION_ERROR; // Custom code takes priority

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR, // Not NOT_FOUND
          }),
        })
      );
    });

    it('should handle error with multiple matching message patterns', () => {
      // Message could match multiple patterns, but first match wins
      const error = new Error('authentication failed: not found');

      errorHandlerMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // ValidationError check comes first in the code
      // Then NOT_FOUND, then AUTHENTICATION_REQUIRED
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND, // First match
          }),
        })
      );
    });
  });
});
