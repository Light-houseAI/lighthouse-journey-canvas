import { ApiErrorResponse, ErrorCode, HttpStatusCode, isApiError, toApiError } from '@journey/schema';
import type { ErrorRequestHandler } from 'express';
import type { ZodError } from 'zod';

/**
 * Map error codes to HTTP status codes
 */
function getHttpStatusCode(errorCode: string): number {
  switch (errorCode) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_REQUEST:
    case ErrorCode.MISSING_REQUIRED_FIELD:
    case 'INVALID_JSON':
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

/**
 * Global error handling middleware
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (
  err,
  req,
  res,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next
) => {
  // Set headers
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  res.setHeader('X-Request-ID', requestId);
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Convert error to ApiError format
  let apiError;
  if (isApiError(err)) {
    apiError = err.toApiError();
  } else if (err.name === 'ZodError') {
    // Extract validation errors from Zod
    const zodError = err as ZodError;
    apiError = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Invalid input data',
      details: zodError.errors,
    };
  } else {
    apiError = toApiError(err);
  }

  // Build response with metadata
  const apiErrorResponse: ApiErrorResponse = {
    success: false,
    error: apiError,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          originalError: err.message,
          errorName: err.name,
        },
      }),
    },
  };

  // Determine status code from error code
  const statusCode = isApiError(err) ? err.statusCode : getHttpStatusCode(apiError.code);

  res.status(statusCode).json(apiErrorResponse);
};
