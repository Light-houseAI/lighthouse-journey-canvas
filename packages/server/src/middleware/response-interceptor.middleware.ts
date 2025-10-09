/**
 * Request ID Middleware
 *
 * Ensures every request has a unique request ID for tracking and debugging.
 * The request ID is added to both request headers and response headers.
 */

import { NextFunction, Request, Response } from 'express';

/**
 * Generate request ID if not present
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add request ID header middleware
 *
 * Ensures every request has a unique request ID for tracking
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate or use existing request ID
  const requestId =
    (req.headers['x-request-id'] as string) || generateRequestId();

  // Set the request ID in headers if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = requestId;
  }

  // Add request ID to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);

  next();
};

/**
 * Response interceptor middleware
 *
 * Wraps all responses in standardized ApiResponse format with metadata
 */
export const responseInterceptorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to wrap responses
  res.json = function (data: any) {
    const requestId = req.headers['x-request-id'] as string;

    // Check if response is already in ApiResponse format
    const isApiResponse =
      data &&
      typeof data === 'object' &&
      'success' in data &&
      'meta' in data;

    if (isApiResponse) {
      // Already standardized - just ensure requestId is in meta
      const wrappedData = {
        ...data,
        meta: {
          ...data.meta,
          requestId,
        },
      };
      return originalJson(wrappedData);
    }

    // Wrap legacy response in ApiResponse format
    const wrappedResponse = {
      success: true,
      data: typeof data === 'string' ? { message: data } : data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    return originalJson(wrappedResponse);
  };

  next();
};
