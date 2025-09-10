import { NextFunction, Request, Response } from 'express';

export const errorHandlerMiddleware = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const status = err.status || err.statusCode || 500;
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
    userId: (req as any).userId,
    user: (req as any).user
      ? {
          id: (req as any).user.id,
          email: (req as any).user.email,
          role: (req as any).user.role,
        }
      : undefined,

    // Additional error context
    code: err.code,
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

  // Log complete error details
  console.error('🚨 Global Error Handler - Complete Error Details:', {
    ...errorDetails,
    // Truncate potentially large objects for logging
    body:
      typeof req.body === 'object'
        ? JSON.stringify(req.body).substring(0, 1000) +
          (JSON.stringify(req.body).length > 1000 ? '...[truncated]' : '')
        : req.body,
    stack:
      err.stack?.substring(0, 2000) +
      (err.stack?.length > 2000 ? '...[truncated]' : ''),
  });

  // Also log just the core error for quick scanning
  console.error(`❌ ${req.method} ${req.path} -> ${status}: ${message}`);

  // Log additional context if available
  if ((req as any).userId) {
    console.error(`👤 User ID: ${(req as any).userId}`);
  }

  // Log stack trace separately for better readability
  if (err.stack) {
    console.error('📚 Stack Trace:', err.stack);
  }

  // Force JSON content type for all API routes
  if (req.path.startsWith('/api')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Determine error category and user-friendly message
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let userMessage = 'An internal server error occurred';

  if (status < 500) {
    errorCode = 'BAD_REQUEST';
    userMessage = message;
  } else {
    // Categorize 500+ errors for better debugging
    if (err.name === 'AwilixResolutionError') {
      errorCode = 'DEPENDENCY_INJECTION_ERROR';
      userMessage = 'Service configuration error';
    } else if (
      err.code === 'ECONNREFUSED' ||
      err.message?.includes('connect')
    ) {
      errorCode = 'DATABASE_CONNECTION_ERROR';
      userMessage = 'Database connection failed';
    } else if (err.message?.includes('timeout')) {
      errorCode = 'REQUEST_TIMEOUT';
      userMessage = 'Request timed out';
    } else if (
      err.message?.includes('API key') ||
      err.message?.includes('OpenAI')
    ) {
      errorCode = 'EXTERNAL_SERVICE_ERROR';
      userMessage = 'External service unavailable';
    } else if (err.name === 'ValidationError' || err.name === 'ZodError') {
      errorCode = 'VALIDATION_ERROR';
      userMessage = 'Invalid request data';
    }
  }

  // Return structured JSON error response matching BaseController format
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: userMessage,
    },
    // Include debug info in development
    ...(process.env.NODE_ENV === 'development'
      ? {
          debug: {
            originalError: message,
            statusCode: status,
            timestamp: errorDetails.timestamp,
            requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
          },
        }
      : {}),
    // Always include request ID for tracking
    requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
    timestamp: errorDetails.timestamp,
  };

  res.status(status).json(errorResponse);
};
