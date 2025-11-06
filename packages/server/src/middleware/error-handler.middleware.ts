import {
  ApiError,
  ApiErrorCode,
  ApiErrorResponse,
  HTTP_STATUS,
} from '@journey/schema';
import { NextFunction, Request, Response } from 'express';

// Extended error interface to include all possible error properties
interface ExtendedError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  cause?: any;
  details?: any;
  constraint?: string;
  table?: string;
  column?: string;
  statusText?: string;
  error?: any;
  response?: {
    data?: any;
    error?: any;
  };
  resolutionPath?: string;
}

/**
 * Global error handler middleware
 * Catches all uncaught errors and returns standardized API error responses
 */
export const errorHandlerMiddleware = (
  err: ExtendedError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // Handle ApiError instances (from @journey/schema)
  if (err instanceof ApiError) {
    const response = err.toJSON();
    res.status(err.statusCode).json(response);
    return;
  }

  // Determine error code and HTTP status for other errors
  let errorCode: ApiErrorCode;
  let httpStatus: number;
  const message = err.message || 'Internal Server Error';

  // Check if error has a custom code property first
  if (
    (err as any).code &&
    Object.values(ApiErrorCode).includes((err as any).code as ApiErrorCode)
  ) {
    errorCode = (err as any).code as ApiErrorCode;
  } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
    errorCode = ApiErrorCode.VALIDATION_ERROR;
  } else if (
    err.message?.includes('not found') ||
    err.message?.includes('Not found')
  ) {
    errorCode = ApiErrorCode.NOT_FOUND;
  } else if (
    err.message?.includes('unauthorized') ||
    err.message?.includes('authentication')
  ) {
    errorCode = ApiErrorCode.UNAUTHORIZED;
  } else if (
    err.message?.includes('forbidden') ||
    err.message?.includes('access denied')
  ) {
    errorCode = ApiErrorCode.FORBIDDEN;
  } else if (
    err.message?.includes('already exists') ||
    err.message?.includes('conflict')
  ) {
    errorCode = ApiErrorCode.ALREADY_EXISTS;
  } else if (err.name === 'AwilixResolutionError') {
    // Map to INTERNAL_SERVER_ERROR since schema doesn't have DEPENDENCY_INJECTION_ERROR
    errorCode = ApiErrorCode.INTERNAL_SERVER_ERROR;
  } else if (err.code === 'ECONNREFUSED' || err.message?.includes('database')) {
    // Map to INTERNAL_SERVER_ERROR since schema doesn't have DATABASE_ERROR
    errorCode = ApiErrorCode.INTERNAL_SERVER_ERROR;
  } else if (err.message?.includes('timeout')) {
    // Map to INTERNAL_SERVER_ERROR since schema doesn't have REQUEST_TIMEOUT
    errorCode = ApiErrorCode.INTERNAL_SERVER_ERROR;
  } else {
    errorCode = ApiErrorCode.INTERNAL_SERVER_ERROR;
  }

  // Map error codes to HTTP status codes
  switch (errorCode) {
    case ApiErrorCode.VALIDATION_ERROR:
      httpStatus = HTTP_STATUS.BAD_REQUEST;
      break;
    case ApiErrorCode.UNAUTHORIZED:
      httpStatus = HTTP_STATUS.UNAUTHORIZED;
      break;
    case ApiErrorCode.FORBIDDEN:
      httpStatus = HTTP_STATUS.FORBIDDEN;
      break;
    case ApiErrorCode.NOT_FOUND:
      httpStatus = HTTP_STATUS.NOT_FOUND;
      break;
    case ApiErrorCode.ALREADY_EXISTS:
    case ApiErrorCode.CONFLICT:
      httpStatus = HTTP_STATUS.CONFLICT;
      break;
    case ApiErrorCode.BUSINESS_RULE_VIOLATION:
      httpStatus = HTTP_STATUS.UNPROCESSABLE_ENTITY;
      break;
    case ApiErrorCode.INTERNAL_SERVER_ERROR:
    case ApiErrorCode.SERVICE_UNAVAILABLE:
    default:
      httpStatus = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }

  // Create standardized error response
  const apiErrorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(err.name === 'ZodError' ? { details: (err as any).errors } : {}),
    },
  };

  // Set response headers
  res.setHeader('Content-Type', 'application/json');
  res.status(httpStatus).json(apiErrorResponse);
};
