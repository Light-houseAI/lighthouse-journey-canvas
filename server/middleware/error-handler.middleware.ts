import { NextFunction, Request, Response } from 'express';

import { ApiErrorResponse, ErrorCode } from '../../shared/types/api-responses';
import {
  createErrorResponseFromError,
  getStatusCodeForResponse,
} from '../../shared/utils/response-builder';

export const errorHandlerMiddleware = (
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // ZodError should return 400 Bad Request
  const status = err.name === 'ZodError' ? 400 : (err.status || err.statusCode || 500);
  const message = err.message || 'Internal Server Error';

  // Extract comprehensive error details
  const errorDetails = {
    // Basic error info
    message,
    name: err.name || 'UnknownError',
    stack: err.stack,
    status,

    // Request context
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      'x-request-id': req.headers['x-request-id'],
    },
    ip: req.ip,
    timestamp: new Date().toISOString(),

    // User context (if available)
    userId: (req as { userId?: number }).userId,
    user: (req as { user?: { id: number; email: string; role: string } }).user
      ? {
          id: (req as { user: { id: number; email: string; role: string } })
            .user.id,
          email: (req as { user: { id: number; email: string; role: string } })
            .user.email,
          role: (req as { user: { id: number; email: string; role: string } })
            .user.role,
        }
      : undefined,

    // Additional error context
    code: (err as Error & { code?: string }).code,
    cause: err.cause,
    details: err.details,

    // Database/ORM specific errors
    constraint: err.constraint,
    table: err.table,
    column: err.column,

    // HTTP specific
    statusText: err.statusText,

    // OpenAI/External API errors
    openaiError: err.error,
    apiError: err.response?.data || err.response?.error,

    // Awilix specific
    resolutionPath: err.resolutionPath,

    // Environment context
    nodeEnv: process.env.NODE_ENV,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };

  // In production, these would be logged to a proper logging service
  // For now, we collect the error details but don't console.log them

  // Force JSON content type for all API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Get or create request ID
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create standardized API error response using the response builder
  let apiErrorResponse: ApiErrorResponse;

  // Map specific error types to appropriate error codes
  let errorCode: ErrorCode | undefined;

  // Check if error has a custom code property first
  if ((err as any).code && Object.values(ErrorCode).includes((err as any).code as ErrorCode)) {
    errorCode = (err as any).code as ErrorCode;
  } else if (status < 500) {
    // Client errors
    if (err.name === 'ValidationError' || err.name === 'ZodError') {
      errorCode = ErrorCode.VALIDATION_ERROR;
    } else if (
      err.message?.includes('not found') ||
      err.message?.includes('Not found')
    ) {
      errorCode = ErrorCode.NOT_FOUND;
    } else if (
      err.message?.includes('unauthorized') ||
      err.message?.includes('authentication')
    ) {
      errorCode = ErrorCode.AUTHENTICATION_REQUIRED;
    } else if (
      err.message?.includes('forbidden') ||
      err.message?.includes('access denied')
    ) {
      errorCode = ErrorCode.ACCESS_DENIED;
    } else if (
      err.message?.includes('already exists') ||
      err.message?.includes('conflict')
    ) {
      errorCode = ErrorCode.ALREADY_EXISTS;
    } else if (
      err.message?.includes('invalid hierarchy') ||
      err.message?.includes('circular')
    ) {
      errorCode = ErrorCode.INVALID_HIERARCHY;
    } else {
      errorCode = ErrorCode.INVALID_REQUEST;
    }
  } else {
    // Server errors (500+)
    if (err.name === 'AwilixResolutionError') {
      errorCode = ErrorCode.DEPENDENCY_INJECTION_ERROR;
    } else if (
      err.code === 'ECONNREFUSED' ||
      err.message?.includes('connect') ||
      err.message?.includes('database')
    ) {
      errorCode = ErrorCode.DATABASE_ERROR;
    } else if (err.message?.includes('timeout')) {
      errorCode = ErrorCode.REQUEST_TIMEOUT;
    } else if (
      err.message?.includes('API key') ||
      err.message?.includes('OpenAI') ||
      err.message?.includes('external')
    ) {
      errorCode = ErrorCode.EXTERNAL_SERVICE_ERROR;
    } else {
      errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }

  // Handle ZodError specially to extract validation errors
  if (err.name === 'ZodError') {
    const zodError = err as any; // ZodError type
    apiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Invalid input data',
        details: zodError.errors // Use the actual errors array
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        // Include additional debug info in development
        ...(process.env.NODE_ENV === 'development'
          ? {
              debug: {
                originalError: 'Validation failed',
                statusCode: 400,
                errorName: 'ZodError',
                userId: (req as any).userId,
                url: req.originalUrl || req.url,
                method: req.method,
                timestamp: errorDetails.timestamp,
              },
            }
          : {}),
      },
    };
  } else {
    // Create standardized error response for non-Zod errors
    apiErrorResponse = createErrorResponseFromError(err, {
      code: errorCode,
      requestId,
      meta: {
        // Include additional debug info in development
        ...(process.env.NODE_ENV === 'development'
          ? {
              debug: {
                originalError: message,
                statusCode: status,
                errorName: err.name,
                userId: (req as any).userId,
                url: req.originalUrl || req.url,
                method: req.method,
                timestamp: errorDetails.timestamp,
              },
            }
          : {}),
      },
    });
  }

  // Get appropriate HTTP status code from the response
  const httpStatusCode = getStatusCodeForResponse(apiErrorResponse);

  // Force JSON content type for all API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Set response headers
  res.setHeader('X-Request-ID', requestId);

  res.status(httpStatusCode).json(apiErrorResponse);
};
