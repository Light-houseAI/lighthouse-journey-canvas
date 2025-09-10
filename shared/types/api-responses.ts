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

/**
 * Common HTTP status codes used across the API
 */
export enum HttpStatusCode {
  // Success codes
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  
  // Client error codes
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  
  // Server error codes
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Standard error codes used across the API
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Business logic errors
  BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',
  INVALID_OPERATION = 'INVALID_OPERATION',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  
  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DEPENDENCY_INJECTION_ERROR = 'DEPENDENCY_INJECTION_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  
  // Timeline-specific errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  INVALID_HIERARCHY = 'INVALID_HIERARCHY',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  
  // Permission-specific errors
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  INVALID_PERMISSION_POLICY = 'INVALID_PERMISSION_POLICY',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

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