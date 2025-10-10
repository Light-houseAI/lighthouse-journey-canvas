import { NextFunction, Request, Response } from 'express';

import { ApiErrorResponse, ErrorCode, HttpStatus } from '../core/api-responses';

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
  // Determine error code and HTTP status
  let errorCode: ErrorCode;
  let httpStatus: number;
  const message = err.message || 'Internal Server Error';

  // Check if error has a custom code property first
  if ((err as any).code && Object.values(ErrorCode).includes((err as any).code as ErrorCode)) {
    errorCode = (err as any).code as ErrorCode;
  } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
    errorCode = ErrorCode.VALIDATION_ERROR;
  } else if (err.message?.includes('not found') || err.message?.includes('Not found')) {
    errorCode = ErrorCode.NOT_FOUND;
  } else if (err.message?.includes('unauthorized') || err.message?.includes('authentication')) {
    errorCode = ErrorCode.AUTHENTICATION_REQUIRED;
  } else if (err.message?.includes('forbidden') || err.message?.includes('access denied')) {
    errorCode = ErrorCode.ACCESS_DENIED;
  } else if (err.message?.includes('already exists') || err.message?.includes('conflict')) {
    errorCode = ErrorCode.ALREADY_EXISTS;
  } else if (err.name === 'AwilixResolutionError') {
    errorCode = ErrorCode.DEPENDENCY_INJECTION_ERROR;
  } else if (err.code === 'ECONNREFUSED' || err.message?.includes('database')) {
    errorCode = ErrorCode.DATABASE_ERROR;
  } else if (err.message?.includes('timeout')) {
    errorCode = ErrorCode.REQUEST_TIMEOUT;
  } else {
    errorCode = ErrorCode.INTERNAL_ERROR;
  }

  // Map error codes to HTTP status codes
  switch (errorCode) {
    case ErrorCode.VALIDATION_ERROR:
      httpStatus = HttpStatus.BAD_REQUEST;
      break;
    case ErrorCode.AUTHENTICATION_REQUIRED:
      httpStatus = HttpStatus.UNAUTHORIZED;
      break;
    case ErrorCode.ACCESS_DENIED:
      httpStatus = HttpStatus.FORBIDDEN;
      break;
    case ErrorCode.NOT_FOUND:
      httpStatus = HttpStatus.NOT_FOUND;
      break;
    case ErrorCode.ALREADY_EXISTS:
      httpStatus = HttpStatus.CONFLICT;
      break;
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.DEPENDENCY_INJECTION_ERROR:
    case ErrorCode.REQUEST_TIMEOUT:
    case ErrorCode.INTERNAL_ERROR:
    default:
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
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
