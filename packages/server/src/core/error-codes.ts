/**
 * API Error Codes
 * Standardized error codes for consistent error handling across the API
 *
 * These codes provide machine-readable error identifiers that clients can use
 * for programmatic error handling, while error messages provide human-readable descriptions.
 */

export enum ErrorCode {
  // Authentication (401 - Who are you?)
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',

  // Authorization (403 - You don't have permission)
  FORBIDDEN = 'FORBIDDEN',
  ACCESS_DENIED = 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  OWNER_ACCESS_REQUIRED = 'OWNER_ACCESS_REQUIRED',

  // Validation (VALIDATION_*)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_PARAMETER = 'INVALID_PARAMETER',

  // Resource Errors (RESOURCE_*)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business Logic (BUSINESS_*)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  BUSINESS_RULE_ERROR = 'BUSINESS_RULE_ERROR',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  INVALID_OPERATION = 'INVALID_OPERATION',
  INVALID_STATE = 'INVALID_STATE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Server Errors (INTERNAL_*)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  DEPENDENCY_INJECTION_ERROR = 'DEPENDENCY_INJECTION_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Timeline-specific
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  INVALID_HIERARCHY = 'INVALID_HIERARCHY',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',

  // Permission-specific
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  INVALID_PERMISSION_POLICY = 'INVALID_PERMISSION_POLICY',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error code metadata for additional context
 */
export interface ErrorCodeMetadata {
  code: ErrorCode;
  httpStatus: number;
  description: string;
  category: 'auth' | 'validation' | 'resource' | 'business' | 'server' | 'rate-limit';
}

/**
 * Map error codes to their metadata
 */
export const ERROR_CODE_METADATA: Record<ErrorCode, Omit<ErrorCodeMetadata, 'code'>> = {
  // Authentication (401)
  [ErrorCode.AUTHENTICATION_REQUIRED]: {
    httpStatus: 401,
    description: 'Authentication is required to access this resource',
    category: 'auth',
  },
  [ErrorCode.AUTHENTICATION_FAILED]: {
    httpStatus: 401,
    description: 'Authentication failed',
    category: 'auth',
  },
  [ErrorCode.INVALID_CREDENTIALS]: {
    httpStatus: 401,
    description: 'The provided credentials are invalid',
    category: 'auth',
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    httpStatus: 401,
    description: 'The authentication token has expired',
    category: 'auth',
  },
  [ErrorCode.TOKEN_INVALID]: {
    httpStatus: 401,
    description: 'The authentication token is invalid',
    category: 'auth',
  },
  [ErrorCode.TOKEN_MISSING]: {
    httpStatus: 401,
    description: 'Authentication token is missing',
    category: 'auth',
  },

  // Authorization (403)
  [ErrorCode.FORBIDDEN]: {
    httpStatus: 403,
    description: 'Access forbidden',
    category: 'auth',
  },
  [ErrorCode.ACCESS_DENIED]: {
    httpStatus: 403,
    description: 'Access to this resource is denied',
    category: 'auth',
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    httpStatus: 403,
    description: 'Insufficient permissions to perform this action',
    category: 'auth',
  },
  [ErrorCode.OWNER_ACCESS_REQUIRED]: {
    httpStatus: 403,
    description: 'Only the resource owner can perform this action',
    category: 'auth',
  },

  // Validation
  [ErrorCode.VALIDATION_ERROR]: {
    httpStatus: 400,
    description: 'Request validation failed',
    category: 'validation',
  },
  [ErrorCode.INVALID_REQUEST]: {
    httpStatus: 400,
    description: 'The request is invalid',
    category: 'validation',
  },
  [ErrorCode.INVALID_INPUT]: {
    httpStatus: 400,
    description: 'The provided input is invalid',
    category: 'validation',
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    httpStatus: 400,
    description: 'A required field is missing',
    category: 'validation',
  },
  [ErrorCode.INVALID_FORMAT]: {
    httpStatus: 400,
    description: 'The data format is invalid',
    category: 'validation',
  },
  [ErrorCode.INVALID_PARAMETER]: {
    httpStatus: 400,
    description: 'An invalid parameter was provided',
    category: 'validation',
  },

  // Resource Errors
  [ErrorCode.NOT_FOUND]: {
    httpStatus: 404,
    description: 'The requested resource was not found',
    category: 'resource',
  },
  [ErrorCode.RESOURCE_NOT_FOUND]: {
    httpStatus: 404,
    description: 'The specified resource does not exist',
    category: 'resource',
  },
  [ErrorCode.ALREADY_EXISTS]: {
    httpStatus: 409,
    description: 'The resource already exists',
    category: 'resource',
  },
  [ErrorCode.CONFLICT]: {
    httpStatus: 409,
    description: 'The request conflicts with the current state',
    category: 'resource',
  },

  // Business Logic
  [ErrorCode.BUSINESS_RULE_VIOLATION]: {
    httpStatus: 400,
    description: 'The operation violates a business rule',
    category: 'business',
  },
  [ErrorCode.BUSINESS_RULE_ERROR]: {
    httpStatus: 400,
    description: 'A business rule error occurred',
    category: 'business',
  },
  [ErrorCode.OPERATION_NOT_ALLOWED]: {
    httpStatus: 403,
    description: 'This operation is not allowed',
    category: 'business',
  },
  [ErrorCode.INVALID_OPERATION]: {
    httpStatus: 400,
    description: 'Invalid operation',
    category: 'business',
  },
  [ErrorCode.INVALID_STATE]: {
    httpStatus: 400,
    description: 'The resource is in an invalid state for this operation',
    category: 'business',
  },
  [ErrorCode.QUOTA_EXCEEDED]: {
    httpStatus: 429,
    description: 'Usage quota has been exceeded',
    category: 'business',
  },

  // Server Errors
  [ErrorCode.INTERNAL_ERROR]: {
    httpStatus: 500,
    description: 'An internal server error occurred',
    category: 'server',
  },
  [ErrorCode.INTERNAL_SERVER_ERROR]: {
    httpStatus: 500,
    description: 'Internal server error',
    category: 'server',
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    httpStatus: 503,
    description: 'The service is temporarily unavailable',
    category: 'server',
  },
  [ErrorCode.DATABASE_ERROR]: {
    httpStatus: 500,
    description: 'A database error occurred',
    category: 'server',
  },
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: {
    httpStatus: 502,
    description: 'An external service error occurred',
    category: 'server',
  },
  [ErrorCode.DEPENDENCY_INJECTION_ERROR]: {
    httpStatus: 500,
    description: 'Dependency injection error',
    category: 'server',
  },
  [ErrorCode.REQUEST_TIMEOUT]: {
    httpStatus: 408,
    description: 'Request timeout',
    category: 'server',
  },

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    httpStatus: 429,
    description: 'Rate limit has been exceeded',
    category: 'rate-limit',
  },

  // Timeline-specific
  [ErrorCode.NODE_NOT_FOUND]: {
    httpStatus: 404,
    description: 'Timeline node not found',
    category: 'resource',
  },
  [ErrorCode.INVALID_HIERARCHY]: {
    httpStatus: 400,
    description: 'Invalid hierarchy structure',
    category: 'validation',
  },
  [ErrorCode.CIRCULAR_REFERENCE]: {
    httpStatus: 400,
    description: 'Circular reference detected',
    category: 'validation',
  },
  [ErrorCode.MAX_DEPTH_EXCEEDED]: {
    httpStatus: 400,
    description: 'Maximum depth exceeded',
    category: 'validation',
  },

  // Permission-specific
  [ErrorCode.ORGANIZATION_NOT_FOUND]: {
    httpStatus: 404,
    description: 'Organization not found',
    category: 'resource',
  },
  [ErrorCode.INVALID_PERMISSION_POLICY]: {
    httpStatus: 400,
    description: 'Invalid permission policy',
    category: 'validation',
  },
  [ErrorCode.PERMISSION_DENIED]: {
    httpStatus: 403,
    description: 'Permission denied',
    category: 'auth',
  },

  // Generic
  [ErrorCode.UNKNOWN_ERROR]: {
    httpStatus: 500,
    description: 'An unknown error occurred',
    category: 'server',
  },
};

/**
 * Get metadata for an error code
 */
export function getErrorMetadata(code: ErrorCode): ErrorCodeMetadata {
  return {
    code,
    ...ERROR_CODE_METADATA[code],
  };
}

/**
 * Get HTTP status for an error code
 */
export function getHttpStatus(code: ErrorCode): number {
  return ERROR_CODE_METADATA[code]?.httpStatus || 500;
}
