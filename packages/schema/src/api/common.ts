/**
 * Common HTTP status codes used across the API
 */
export declare enum HttpStatusCode {
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
    BAD_GATEWAY = 502,
    SERVICE_UNAVAILABLE = 503
}
/**
 * Simple success response without meta field
 * Use this for standard API responses
 */
export interface SuccessResponse<TData = any> {
    success: true;
    data: TData;
}
/**
 * Standard error codes used across the API
 */
export declare enum ErrorCode {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_REQUEST = "INVALID_REQUEST",
    MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
    AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    ACCESS_DENIED = "ACCESS_DENIED",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    NOT_FOUND = "NOT_FOUND",
    ALREADY_EXISTS = "ALREADY_EXISTS",
    RESOURCE_CONFLICT = "RESOURCE_CONFLICT",
    BUSINESS_RULE_ERROR = "BUSINESS_RULE_ERROR",
    INVALID_OPERATION = "INVALID_OPERATION",
    OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    DEPENDENCY_INJECTION_ERROR = "DEPENDENCY_INJECTION_ERROR",
    REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    NODE_NOT_FOUND = "NODE_NOT_FOUND",
    INVALID_HIERARCHY = "INVALID_HIERARCHY",
    CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
    MAX_DEPTH_EXCEEDED = "MAX_DEPTH_EXCEEDED",
    ORGANIZATION_NOT_FOUND = "ORGANIZATION_NOT_FOUND",
    INVALID_PERMISSION_POLICY = "INVALID_PERMISSION_POLICY",
    PERMISSION_DENIED = "PERMISSION_DENIED"
}
/**
 * Standard error response structure
 */
export interface ApiError {
    /** Error code for programmatic handling */
    code: ErrorCode | string;
    /** Human-readable error message */
    message: string;
    /** Additional error details (validation errors, stack traces in dev) */
    details?: any;
}
/**
 * Error response type
 * Used to enforce that error responses have the correct shape
 */
export interface ApiErrorResponse {
    success: false;
    error: ApiError;
}
//# sourceMappingURL=common.d.ts.map