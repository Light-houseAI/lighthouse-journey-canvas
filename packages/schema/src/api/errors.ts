import type { ApiError } from './common';
/**
 * Base class for all API errors
 * Ensures all errors follow the ApiError interface and work with existing error handler
 */
export declare class BaseApiError extends Error implements ApiError {
    readonly code: string;
    readonly message: string;
    readonly details?: any;
    readonly statusCode: number;
    constructor(code: string, message: string, statusCode: number, details?: any);
    /**
     * Convert error to ApiError format
     */
    toApiError(): ApiError;
}
/**
 * 400 - Validation Error
 * Used when request data fails validation (Zod, etc.)
 */
export declare class ValidationError extends BaseApiError {
    constructor(message?: string, details?: any);
}
/**
 * 401 - Authentication Required
 * Used when user is not authenticated
 */
export declare class AuthenticationError extends BaseApiError {
    constructor(message?: string);
}
/**
 * 403 - Access Denied / Forbidden
 * Used when user is authenticated but lacks permission
 */
export declare class ForbiddenError extends BaseApiError {
    constructor(message?: string);
}
/**
 * 404 - Not Found
 * Used when requested resource doesn't exist
 */
export declare class NotFoundError extends BaseApiError {
    constructor(message?: string);
}
/**
 * 400 - Business Rule Error
 * Used when request violates business rules (e.g., duplicate email)
 */
export declare class BusinessRuleError extends BaseApiError {
    constructor(message: string, details?: any);
}
/**
 * 500 - Internal Server Error
 * Used for unexpected errors
 */
export declare class InternalError extends BaseApiError {
    constructor(message?: string, details?: any);
}
/**
 * 503 - Service Unavailable
 * Used when service/dependency is unavailable
 */
export declare class ServiceUnavailableError extends BaseApiError {
    constructor(message?: string);
}
/**
 * Type guard to check if error is a BaseApiError
 */
export declare function isApiError(error: unknown): error is BaseApiError;
/**
 * Helper to convert any error to ApiError format
 */
export declare function toApiError(error: unknown): ApiError;
//# sourceMappingURL=errors.d.ts.map