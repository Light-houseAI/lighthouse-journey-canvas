/**
 * Type-Safe Response Builder Utilities
 *
 * This module provides type-safe builder functions for creating consistent
 * API responses across all endpoints in the Lighthouse application.
 */

import {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  ApiError,
  ApiMeta,
  PaginationMeta,
  HttpStatusCode,
  ErrorCode,
} from '../core/api-responses';

/**
 * Options for creating success responses
 */
interface SuccessOptions {
  /** Additional metadata to include */
  meta?: Partial<ApiMeta>;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Options for creating error responses
 */
interface ErrorOptions {
  /** Error code (defaults to appropriate code based on error type) */
  code?: ErrorCode;
  /** Additional error details */
  details?: any;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  meta?: Partial<ApiMeta>;
}

/**
 * Options for creating paginated responses
 */
interface PaginationOptions {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items available */
  total: number;
  /** Additional metadata */
  meta?: Partial<ApiMeta>;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  options: SuccessOptions = {}
): ApiSuccessResponse<T> {
  const { meta = {}, requestId } = options;

  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...requestId && { requestId },
      ...meta,
    },
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  message: string,
  options: ErrorOptions = {}
): ApiErrorResponse {
  const {
    code = ErrorCode.INTERNAL_SERVER_ERROR,
    details,
    requestId,
    meta = {}
  } = options;

  return {
    success: false,
    error: {
      code,
      message,
      ...details && { details },
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...requestId && { requestId },
      ...meta,
    },
  };
}

/**
 * Create an error response from an Error object
 */
export function createErrorResponseFromError(
  error: Error,
  options: Omit<ErrorOptions, 'code'> & { code?: ErrorCode } = {}
): ApiErrorResponse {
  let errorCode = options.code;

  // Auto-detect error code based on error type/message if not provided
  if (!errorCode) {
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      errorCode = ErrorCode.VALIDATION_ERROR;
    } else if (error.name === 'AuthenticationError' || error.message.includes('authentication required')) {
      errorCode = ErrorCode.AUTHENTICATION_REQUIRED;
    } else if (error.message.includes('not found') || error.message.includes('Not found')) {
      errorCode = ErrorCode.NOT_FOUND;
    } else if (error.message.includes('unauthorized') || error.message.includes('access denied')) {
      errorCode = ErrorCode.ACCESS_DENIED;
    } else if (error.message.includes('already exists')) {
      errorCode = ErrorCode.ALREADY_EXISTS;
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      errorCode = ErrorCode.DATABASE_ERROR;
    } else {
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  return createErrorResponse(error.message, {
    ...options,
    code: errorCode,
    details: process.env.NODE_ENV === 'development' ? {
      name: error.name,
      stack: error.stack,
    } : undefined,
  });
}

/**
 * Create a paginated list response
 */
export function createPaginatedResponse<T>(
  items: T[],
  options: PaginationOptions
): PaginatedResponse<T> {
  const { page, limit, total, meta = {}, requestId } = options;

  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const pagination: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };

  return {
    success: true,
    data: items,
    meta: {
      timestamp: new Date().toISOString(),
      pagination,
      count: items.length,
      ...requestId && { requestId },
      ...meta,
    },
  };
}

/**
 * Create a "not found" error response
 */
export function createNotFoundResponse(
  resource: string = 'Resource',
  requestId?: string
): ApiErrorResponse {
  return createErrorResponse(`${resource} not found`, {
    code: ErrorCode.NOT_FOUND,
    requestId,
  });
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  message: string,
  details?: any,
  requestId?: string
): ApiErrorResponse {
  return createErrorResponse(message, {
    code: ErrorCode.VALIDATION_ERROR,
    details,
    requestId,
  });
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedResponse(
  message: string = 'Authentication required',
  requestId?: string
): ApiErrorResponse {
  return createErrorResponse(message, {
    code: ErrorCode.AUTHENTICATION_REQUIRED,
    requestId,
  });
}

/**
 * Create a forbidden error response
 */
export function createForbiddenResponse(
  message: string = 'Access denied',
  requestId?: string
): ApiErrorResponse {
  return createErrorResponse(message, {
    code: ErrorCode.ACCESS_DENIED,
    requestId,
  });
}

/**
 * Create a conflict error response
 */
export function createConflictResponse(
  message: string,
  requestId?: string
): ApiErrorResponse {
  return createErrorResponse(message, {
    code: ErrorCode.RESOURCE_CONFLICT,
    requestId,
  });
}

/**
 * Create a "created" response (HTTP 201)
 */
export function createCreatedResponse<T>(
  data: T,
  options: SuccessOptions = {}
): ApiSuccessResponse<T> {
  return createSuccessResponse(data, options);
}

/**
 * Create a "no content" response (HTTP 204)
 */
export function createNoContentResponse(
  options: SuccessOptions = {}
): ApiSuccessResponse<null> {
  return createSuccessResponse(null, options);
}

/**
 * Response builder class for fluent API
 */
export class ResponseBuilder {
  private requestId?: string;

  constructor(requestId?: string) {
    this.requestId = requestId;
  }

  /**
   * Create a success response
   */
  success<T>(data: T, meta?: Partial<ApiMeta>): ApiSuccessResponse<T> {
    return createSuccessResponse(data, { meta, requestId: this.requestId });
  }

  /**
   * Create a created response
   */
  created<T>(data: T, meta?: Partial<ApiMeta>): ApiSuccessResponse<T> {
    return createCreatedResponse(data, { meta, requestId: this.requestId });
  }

  /**
   * Create a no content response
   */
  noContent(meta?: Partial<ApiMeta>): ApiSuccessResponse<null> {
    return createNoContentResponse({ meta, requestId: this.requestId });
  }

  /**
   * Create an error response
   */
  error(message: string, code?: ErrorCode, details?: any): ApiErrorResponse {
    return createErrorResponse(message, {
      code,
      details,
      requestId: this.requestId,
    });
  }

  /**
   * Create an error response from Error object
   */
  errorFromException(error: Error, code?: ErrorCode): ApiErrorResponse {
    return createErrorResponseFromError(error, {
      code,
      requestId: this.requestId,
    });
  }

  /**
   * Create a paginated response
   */
  paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
    meta?: Partial<ApiMeta>
  ): PaginatedResponse<T> {
    return createPaginatedResponse(items, {
      page,
      limit,
      total,
      meta,
      requestId: this.requestId,
    });
  }

  /**
   * Create a not found response
   */
  notFound(resource?: string): ApiErrorResponse {
    return createNotFoundResponse(resource, this.requestId);
  }

  /**
   * Create a validation error response
   */
  validationError(message: string, details?: any): ApiErrorResponse {
    return createValidationErrorResponse(message, details, this.requestId);
  }

  /**
   * Create an unauthorized response
   */
  unauthorized(message?: string): ApiErrorResponse {
    return createUnauthorizedResponse(message, this.requestId);
  }

  /**
   * Create a forbidden response
   */
  forbidden(message?: string): ApiErrorResponse {
    return createForbiddenResponse(message, this.requestId);
  }

  /**
   * Create a conflict response
   */
  conflict(message: string): ApiErrorResponse {
    return createConflictResponse(message, this.requestId);
  }
}

/**
 * Create a new response builder instance
 */
export function createResponseBuilder(requestId?: string): ResponseBuilder {
  return new ResponseBuilder(requestId);
}

/**
 * Get HTTP status code for an API response
 */
export function getStatusCodeForResponse(response: ApiResponse): number {
  if (response.success) {
    // Check if it's a creation response by looking at the data
    if (response.data !== null && response.data !== undefined) {
      return HttpStatusCode.OK;
    }
    return HttpStatusCode.NO_CONTENT;
  }

  // Map error codes to HTTP status codes
  switch (response.error?.code) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_REQUEST:
    case ErrorCode.MISSING_REQUIRED_FIELD:
      return HttpStatusCode.BAD_REQUEST;

    case ErrorCode.AUTHENTICATION_REQUIRED:
    case ErrorCode.INVALID_CREDENTIALS:
      return HttpStatusCode.UNAUTHORIZED;

    case ErrorCode.ACCESS_DENIED:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
    case ErrorCode.PERMISSION_DENIED:
      return HttpStatusCode.FORBIDDEN;

    case ErrorCode.NOT_FOUND:
    case ErrorCode.NODE_NOT_FOUND:
    case ErrorCode.ORGANIZATION_NOT_FOUND:
      return HttpStatusCode.NOT_FOUND;

    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.RESOURCE_CONFLICT:
    case ErrorCode.BUSINESS_RULE_ERROR:
    case ErrorCode.CIRCULAR_REFERENCE:
      return HttpStatusCode.CONFLICT;

    case ErrorCode.INVALID_OPERATION:
    case ErrorCode.OPERATION_NOT_ALLOWED:
    case ErrorCode.INVALID_HIERARCHY:
    case ErrorCode.MAX_DEPTH_EXCEEDED:
    case ErrorCode.INVALID_PERMISSION_POLICY:
      return HttpStatusCode.UNPROCESSABLE_ENTITY;

    default:
      return HttpStatusCode.INTERNAL_SERVER_ERROR;
  }
}
