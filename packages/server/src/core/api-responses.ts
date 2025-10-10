/**
 * Standardized API Response Types
 * 
 * This module defines consistent response interfaces for all API endpoints
 * across the Lighthouse application, ensuring predictable client integration.
 */

/**
 * Standard error response structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details (validation errors, stack traces in dev) */
  details?: any;
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items available */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * Common metadata for API responses
 */
export interface ApiMeta {
  /** ISO timestamp of when the response was generated */
  timestamp: string;
  /** Request ID for tracing (optional) */
  requestId?: string;
  /** Pagination info for list responses */
  pagination?: PaginationMeta;
  /** Number of items in the current response */
  count?: number;
  /** Username when viewing another user's data */
  viewingUser?: string;
  /** Additional metadata specific to the endpoint */
  [key: string]: any;
}

/**
 * Base API response structure
 * All API endpoints must return responses conforming to this interface
 */
export interface ApiResponse<TData = any> {
  /** Indicates whether the request was successful */
  success: boolean;
  /** Response data (only present on success) */
  data?: TData;
  /** Error information (only present on failure) */
  error?: ApiError;
  /** Response metadata */
  meta?: ApiMeta;
}

/**
 * Success response type (data is required)
 */
export interface ApiSuccessResponse<TData = any> extends ApiResponse<TData> {
  success: true;
  data: TData;
  error?: never;
}

/**
 * Error response type (error is required)
 */
export interface ApiErrorResponse extends ApiResponse {
  success: false;
  data?: never;
  error: ApiError;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<TItem = any> extends ApiSuccessResponse<TItem[]> {
  meta: ApiMeta & {
    pagination: PaginationMeta;
    count: number;
  };
}

// Re-export enhanced HTTP status and error codes from dedicated modules
export { HttpStatus, HttpStatus as HttpStatusCode } from './http-status';
export { ErrorCode } from './error-codes';

/**
 * Type guard to check if a response is successful
 */
export const isSuccessResponse = <T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> => {
  return response.success === true;
};

/**
 * Type guard to check if a response is an error
 */
export const isErrorResponse = (
  response: ApiResponse
): response is ApiErrorResponse => {
  return response.success === false;
};

/**
 * Type guard to check if a response is paginated
 */
export const isPaginatedResponse = <T>(
  response: ApiResponse<T[]>
): response is PaginatedResponse<T> => {
  return (
    isSuccessResponse(response) &&
    Array.isArray(response.data) &&
    response.meta?.pagination !== undefined
  );
};