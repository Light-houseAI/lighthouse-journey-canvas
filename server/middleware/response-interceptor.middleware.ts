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

import { NextFunction, Request, Response } from 'express';

import {
  ApiMeta,
  ApiResponse,
  ApiSuccessResponse,
} from '../../shared/types/api-responses';
import { createSuccessResponse } from '../../shared/utils/response-builder';

/**
 * Check if a response body is already in ApiResponse format
 */
function isApiResponse(body: unknown): body is ApiResponse {
  return (
    body !== null &&
    typeof body === 'object' &&
    typeof body.success === 'boolean' &&
    (body.success === false || body.data !== undefined) &&
    (body.success === true || body.error !== undefined)
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
 * Generate request ID if not present
 */
function getOrCreateRequestId(req: Request): string {
  return (
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
}

/**
 * Extract common metadata from request
 */
function extractRequestMeta(
  req: Request,
  _statusCode: number
): Partial<ApiMeta> {
  const requestId = getOrCreateRequestId(req);

  const meta: Partial<ApiMeta> = {
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Add count for array responses
  if (
    req.method === 'GET' &&
    Array.isArray((req as { _responseBody?: unknown[] })._responseBody)
  ) {
    meta.count = (req as { _responseBody: unknown[] })._responseBody.length;
  }

  return meta;
}

/**
 * Response interceptor middleware
 *
 * This middleware intercepts responses before they're sent to the client
 * and wraps them in the standardized ApiResponse format if needed.
 */
export const responseInterceptorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json;

  // Override the json method to intercept responses
  res.json = function (body: unknown): Response {
    // Store the response body for potential use in meta
    (req as { _responseBody?: unknown })._responseBody = body;

    // If already in ApiResponse format, send as-is but ensure request ID
    if (isApiResponse(body)) {
      // Ensure request ID is present in existing ApiResponse
      if (!body.meta?.requestId) {
        const requestId = getOrCreateRequestId(req);
        body.meta = {
          timestamp: new Date().toISOString(),
          requestId,
          ...body.meta,
        };
      }

      return originalJson.call(this, body);
    }

    // Get current status code (default to 200 if not set)
    const statusCode = res.statusCode || 200;

    // If it's a successful response, wrap in ApiSuccessResponse
    if (isLegacySuccessResponse(body, statusCode)) {
      const meta = extractRequestMeta(req, statusCode);

      // Handle special cases for different response types
      let wrappedResponse: ApiSuccessResponse;

      if (body === null || body === undefined) {
        // Handle null/undefined as no content
        wrappedResponse = createSuccessResponse(null, { meta });
      } else if (typeof body === 'string' && body === 'OK') {
        // Handle simple "OK" responses
        wrappedResponse = createSuccessResponse({ message: 'OK' }, { meta });
      } else if (typeof body === 'object' && body.success === true) {
        // Handle legacy success responses with explicit success flag
        wrappedResponse = createSuccessResponse(body.data || body, { meta });
      } else {
        // Handle normal data responses
        wrappedResponse = createSuccessResponse(body, { meta });
      }

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
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Set the request ID in headers if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = requestId;
  }

  // Add request ID to response headers for client tracking
  res.setHeader('X-Request-ID', requestId);

  next();
};
