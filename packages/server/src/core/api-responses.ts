/**
 * Standardized API Response Types
 *
 * This module defines consistent response interfaces for all API endpoints
 * across the Lighthouse application, ensuring predictable client integration.
 */

import type { ErrorCode } from './error-codes';

/**
 * Standard error response structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details (validation errors, stack traces in dev) */
  details?: any;
}

/**
 * Success response type (data is required)
 */
export interface ApiSuccessResponse<TData = any> {
  success: true;
  data: TData;
}

/**
 * Error response type (error is required)
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

// Re-export enhanced HTTP status and error codes from dedicated modules
export { ErrorCode } from './error-codes';
export { HttpStatus, HttpStatus as HttpStatusCode } from './http-status';