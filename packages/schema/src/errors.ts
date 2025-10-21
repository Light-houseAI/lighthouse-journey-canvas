/**
 * API Error Classes
 * Standardized error handling across all API endpoints
 */

/**
 * Standard error codes used across the API
 */
export enum ApiErrorCode {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Validation (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource Errors (404, 409)
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business Logic (422)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',

  // Server Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * HTTP status codes mapped to error types
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Base API Error class
 * All API errors should extend this class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: any;

  constructor(
    message: string,
    code: ApiErrorCode,
    statusCode: number,
    details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * Specific Error Classes
 */

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(
      message,
      ApiErrorCode.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      details
    );
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(message, ApiErrorCode.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'User authentication required') {
    super(message, ApiErrorCode.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, ApiErrorCode.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, ApiErrorCode.CONFLICT, HTTP_STATUS.CONFLICT, details);
    this.name = 'ConflictError';
  }
}

export class BusinessRuleError extends ApiError {
  constructor(message: string, details?: any) {
    super(
      message,
      ApiErrorCode.BUSINESS_RULE_VIOLATION,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      details
    );
    this.name = 'BusinessRuleError';
  }
}

export class InvalidCredentialsError extends ApiError {
  constructor(message: string = 'Invalid email or password') {
    super(message, ApiErrorCode.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'InvalidCredentialsError';
  }
}

export class TokenExpiredError extends ApiError {
  constructor(message: string = 'Token has expired') {
    super(message, ApiErrorCode.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends ApiError {
  constructor(message: string = 'Invalid or malformed token') {
    super(message, ApiErrorCode.TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    this.name = 'TokenInvalidError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(
      message,
      ApiErrorCode.INTERNAL_SERVER_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      details
    );
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(
      message,
      ApiErrorCode.SERVICE_UNAVAILABLE,
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
    this.name = 'ServiceUnavailableError';
  }
}
