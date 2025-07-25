export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, true);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable') {
    super(message, 503, true);
  }
}

// Error handler middleware factory
export function createErrorHandler(logger: any) {
  return (error: Error, req: any, res: any, next: any) => {
    // Log the error
    if (error instanceof AppError) {
      if (error.isOperational) {
        logger.warn(`Operational error: ${error.message}`, { 
          path: req.path, 
          method: req.method,
          statusCode: error.statusCode 
        });
      } else {
        logger.error(`Non-operational error: ${error.message}`, error, {
          path: req.path,
          method: req.method,
          statusCode: error.statusCode
        });
      }

      return res.status(error.statusCode).json({
        error: {
          message: error.message,
          statusCode: error.statusCode,
        },
      });
    }

    // Handle unexpected errors
    logger.error('Unexpected error:', error, {
      path: req.path,
      method: req.method,
    });

    return res.status(500).json({
      error: {
        message: 'Internal Server Error',
        statusCode: 500,
      },
    });
  };
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}