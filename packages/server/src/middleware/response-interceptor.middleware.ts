/**
 * Response Interceptor Middleware
 *
 * Automatically wraps legacy responses that don't use the standardized ApiResponse<T> format.
 * This middleware ensures backward compatibility while transitioning to the new response standard.
 *
 * Features:
 * - Auto-wraps legacy responses in ApiResponse format
 * - Injects request IDs and metadata
 * - Maintains backward compatibility
 * - Preserves existing response headers and status codes
 */

import { ApiSuccessResponse } from '@journey/schema';
import { NextFunction, Request, Response } from 'express';

/**
 * Check if a response body is already in ApiResponse format
 */
function isApiResponse(body: unknown): body is ApiSuccessResponse {
  return (
    body !== null &&
    typeof body === 'object' &&
    typeof (body as any).success === 'boolean' &&
    (body as any).data !== undefined
  );
}

/**
 * Check if the response looks like a legacy success response
 */
function isLegacySuccessResponse(body: unknown, statusCode: number): boolean {
  // If it's already in ApiResponse format, don't treat as legacy
  if (isApiResponse(body)) {
    return false;
  }

  // Status codes that typically indicate success
  return statusCode >= 200 && statusCode < 400;
}

/**
 * Response interceptor middleware
 *
 * This middleware intercepts responses before they're sent to the client
 * and wraps them in the standardized ApiResponse format if needed.
 */
export const responseInterceptorMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json;

  // Override the json method to intercept responses
  res.json = function (body: unknown): Response {
    // If already in ApiResponse format, send as-is
    if (isApiResponse(body)) {
      return originalJson.call(this, body);
    }

    // Get current status code (default to 200 if not set)
    const statusCode = res.statusCode || 200;

    // If it's a successful response, wrap in ApiSuccessResponse
    if (isLegacySuccessResponse(body, statusCode)) {
      const wrappedResponse: ApiSuccessResponse<unknown> = {
        success: true,
        data: body,
      };

      return originalJson.call(this, wrappedResponse);
    }

    // For error responses, let the error handler middleware deal with them
    // This middleware only handles successful responses that need wrapping
    return originalJson.call(this, body);
  };

  next();
};

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
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Set the request ID in headers if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = requestId;
  }

  // Add request ID to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);

  next();
};
