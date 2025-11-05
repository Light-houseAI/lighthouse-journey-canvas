/**
 * Error Classes Tests
 * Tests for API error classes and their behavior
 */

import { describe, expect, it } from 'vitest';

import {
  ApiError,
  ApiErrorCode,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  HTTP_STATUS,
  InternalServerError,
  InvalidCredentialsError,
  NotFoundError,
  ServiceUnavailableError,
  TokenExpiredError,
  TokenInvalidError,
  UnauthorizedError,
  ValidationError,
} from '../errors';

describe('HTTP_STATUS Constants', () => {
  it('should have correct status code values', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

describe('ApiErrorCode Enum', () => {
  it('should contain all expected error codes', () => {
    expect(ApiErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ApiErrorCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ApiErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ApiErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
    expect(ApiErrorCode.TOKEN_INVALID).toBe('TOKEN_INVALID');
    expect(ApiErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
    expect(ApiErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(ApiErrorCode.MISSING_REQUIRED_FIELD).toBe('MISSING_REQUIRED_FIELD');
    expect(ApiErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ApiErrorCode.ALREADY_EXISTS).toBe('ALREADY_EXISTS');
    expect(ApiErrorCode.CONFLICT).toBe('CONFLICT');
    expect(ApiErrorCode.BUSINESS_RULE_VIOLATION).toBe('BUSINESS_RULE_VIOLATION');
    expect(ApiErrorCode.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
    expect(ApiErrorCode.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('ApiError Base Class', () => {
  it('should create error with required properties', () => {
    const error = new ApiError(
      'Test error',
      ApiErrorCode.VALIDATION_ERROR,
      400
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ApiError');
  });

  it('should create error with details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const error = new ApiError(
      'Validation failed',
      ApiErrorCode.VALIDATION_ERROR,
      400,
      details
    );

    expect(error.details).toEqual(details);
  });

  it('should have proper stack trace', () => {
    const error = new ApiError(
      'Test error',
      ApiErrorCode.INTERNAL_SERVER_ERROR,
      500
    );

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApiError');
  });

  it('should convert to JSON correctly without details', () => {
    const error = new ApiError(
      'Test error',
      ApiErrorCode.NOT_FOUND,
      404
    );

    const json = error.toJSON();
    expect(json).toEqual({
      success: false,
      error: {
        message: 'Test error',
        code: ApiErrorCode.NOT_FOUND,
      },
    });
  });

  it('should convert to JSON correctly with details', () => {
    const details = { resourceId: 123 };
    const error = new ApiError(
      'Resource not found',
      ApiErrorCode.NOT_FOUND,
      404,
      details
    );

    const json = error.toJSON();
    expect(json).toEqual({
      success: false,
      error: {
        message: 'Resource not found',
        code: ApiErrorCode.NOT_FOUND,
        details,
      },
    });
  });
});

describe('ValidationError', () => {
  it('should create validation error with correct properties', () => {
    const error = new ValidationError('Invalid input');

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(error.name).toBe('ValidationError');
  });

  it('should accept details parameter', () => {
    const details = [{ field: 'email', message: 'Invalid format' }];
    const error = new ValidationError('Validation failed', details);

    expect(error.details).toEqual(details);
  });

  it('should serialize to JSON correctly', () => {
    const error = new ValidationError('Invalid email');
    const json = error.toJSON();

    expect(json.success).toBe(false);
    expect(json.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });
});

describe('NotFoundError', () => {
  it('should create error with default message', () => {
    const error = new NotFoundError();

    expect(error.message).toBe('Resource not found');
    expect(error.code).toBe(ApiErrorCode.NOT_FOUND);
    expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(error.name).toBe('NotFoundError');
  });

  it('should create error with custom message', () => {
    const error = new NotFoundError('User not found');

    expect(error.message).toBe('User not found');
  });
});

describe('UnauthorizedError', () => {
  it('should create error with default message', () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe('User authentication required');
    expect(error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(error.name).toBe('UnauthorizedError');
  });

  it('should create error with custom message', () => {
    const error = new UnauthorizedError('Please log in');

    expect(error.message).toBe('Please log in');
  });
});

describe('ForbiddenError', () => {
  it('should create error with default message', () => {
    const error = new ForbiddenError();

    expect(error.message).toBe('Access denied');
    expect(error.code).toBe(ApiErrorCode.FORBIDDEN);
    expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
    expect(error.name).toBe('ForbiddenError');
  });

  it('should create error with custom message', () => {
    const error = new ForbiddenError('Insufficient permissions');

    expect(error.message).toBe('Insufficient permissions');
  });
});

describe('ConflictError', () => {
  it('should create error with correct properties', () => {
    const error = new ConflictError('Resource already exists');

    expect(error.message).toBe('Resource already exists');
    expect(error.code).toBe(ApiErrorCode.CONFLICT);
    expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT);
    expect(error.name).toBe('ConflictError');
  });

  it('should accept details parameter', () => {
    const details = { existingId: 123 };
    const error = new ConflictError('Duplicate entry', details);

    expect(error.details).toEqual(details);
  });
});

describe('BusinessRuleError', () => {
  it('should create error with correct properties', () => {
    const error = new BusinessRuleError('Cannot delete active project');

    expect(error.message).toBe('Cannot delete active project');
    expect(error.code).toBe(ApiErrorCode.BUSINESS_RULE_VIOLATION);
    expect(error.statusCode).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(error.name).toBe('BusinessRuleError');
  });

  it('should accept details parameter', () => {
    const details = { rule: 'project-delete-active', projectId: 456 };
    const error = new BusinessRuleError('Business rule violated', details);

    expect(error.details).toEqual(details);
  });
});

describe('InvalidCredentialsError', () => {
  it('should create error with default message', () => {
    const error = new InvalidCredentialsError();

    expect(error.message).toBe('Invalid email or password');
    expect(error.code).toBe(ApiErrorCode.INVALID_CREDENTIALS);
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(error.name).toBe('InvalidCredentialsError');
  });

  it('should create error with custom message', () => {
    const error = new InvalidCredentialsError('Login failed');

    expect(error.message).toBe('Login failed');
  });
});

describe('TokenExpiredError', () => {
  it('should create error with default message', () => {
    const error = new TokenExpiredError();

    expect(error.message).toBe('Token has expired');
    expect(error.code).toBe(ApiErrorCode.TOKEN_EXPIRED);
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(error.name).toBe('TokenExpiredError');
  });

  it('should create error with custom message', () => {
    const error = new TokenExpiredError('Session expired');

    expect(error.message).toBe('Session expired');
  });
});

describe('TokenInvalidError', () => {
  it('should create error with default message', () => {
    const error = new TokenInvalidError();

    expect(error.message).toBe('Invalid or malformed token');
    expect(error.code).toBe(ApiErrorCode.TOKEN_INVALID);
    expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(error.name).toBe('TokenInvalidError');
  });

  it('should create error with custom message', () => {
    const error = new TokenInvalidError('Bad token format');

    expect(error.message).toBe('Bad token format');
  });
});

describe('InternalServerError', () => {
  it('should create error with default message', () => {
    const error = new InternalServerError();

    expect(error.message).toBe('Internal server error');
    expect(error.code).toBe(ApiErrorCode.INTERNAL_SERVER_ERROR);
    expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(error.name).toBe('InternalServerError');
  });

  it('should create error with custom message and details', () => {
    const details = { originalError: 'Database connection failed' };
    const error = new InternalServerError('Database error', details);

    expect(error.message).toBe('Database error');
    expect(error.details).toEqual(details);
  });
});

describe('ServiceUnavailableError', () => {
  it('should create error with default message', () => {
    const error = new ServiceUnavailableError();

    expect(error.message).toBe('Service temporarily unavailable');
    expect(error.code).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
    expect(error.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(error.name).toBe('ServiceUnavailableError');
  });

  it('should create error with custom message', () => {
    const error = new ServiceUnavailableError('Maintenance in progress');

    expect(error.message).toBe('Maintenance in progress');
  });
});

describe('Error Inheritance Chain', () => {
  it('should maintain proper inheritance for all error classes', () => {
    const errors = [
      new ValidationError('test'),
      new NotFoundError(),
      new UnauthorizedError(),
      new ForbiddenError(),
      new ConflictError('test'),
      new BusinessRuleError('test'),
      new InvalidCredentialsError(),
      new TokenExpiredError(),
      new TokenInvalidError(),
      new InternalServerError(),
      new ServiceUnavailableError(),
    ];

    errors.forEach((error) => {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
    });
  });
});

describe('Error instanceof Checks', () => {
  it('should correctly identify error types with instanceof', () => {
    const validationError = new ValidationError('test');
    const notFoundError = new NotFoundError();

    expect(validationError instanceof ValidationError).toBe(true);
    expect(validationError instanceof NotFoundError).toBe(false);
    expect(notFoundError instanceof NotFoundError).toBe(true);
    expect(notFoundError instanceof ValidationError).toBe(false);
  });
});
