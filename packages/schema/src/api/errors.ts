import type { ApiError } from './common';
import { ErrorCode, HttpStatusCode } from './common';

/**
 * Base class for all API errors
 * Ensures all errors follow the ApiError interface and work with existing error handler
 */
export class BaseApiError extends Error implements ApiError {
    readonly code: string;
    readonly message: string;
    readonly details?: any;
    readonly statusCode: number;

    constructor(code: string, message: string, statusCode: number, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.message = message;
        this.statusCode = statusCode;
        this.details = details;
        Object.setPrototypeOf(this, BaseApiError.prototype);
    }

    /**
     * Convert error to ApiError format
     */
    toApiError(): ApiError {
        return {
            code: this.code,
            message: this.message,
            details: this.details
        };
    }
}

/**
 * 400 - Validation Error
 * Used when request data fails validation (Zod, etc.)
 */
export class ValidationError extends BaseApiError {
    constructor(message: string = 'Validation error', details?: any, code: string = ErrorCode.VALIDATION_ERROR) {
        super(code, message, HttpStatusCode.BAD_REQUEST, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * 401 - Authentication Required
 * Used when user is not authenticated
 */
export class AuthenticationError extends BaseApiError {
    constructor(message: string = 'Authentication required') {
        super(ErrorCode.AUTHENTICATION_REQUIRED, message, HttpStatusCode.UNAUTHORIZED);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

/**
 * 403 - Access Denied / Forbidden
 * Used when user is authenticated but lacks permission
 */
export class ForbiddenError extends BaseApiError {
    constructor(message: string = 'Access denied') {
        super(ErrorCode.ACCESS_DENIED, message, HttpStatusCode.FORBIDDEN);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

/**
 * 404 - Not Found
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends BaseApiError {
    constructor(message: string = 'Resource not found', code: string = ErrorCode.NOT_FOUND) {
        super(code, message, HttpStatusCode.NOT_FOUND);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * 404 - Node Not Found
 * Used specifically when a hierarchy node doesn't exist
 */
export class NodeNotFoundError extends BaseApiError {
    constructor(message: string = 'Node not found') {
        super(ErrorCode.NODE_NOT_FOUND, message, HttpStatusCode.NOT_FOUND);
        Object.setPrototypeOf(this, NodeNotFoundError.prototype);
    }
}

/**
 * 400 - Business Rule Error
 * Used when request violates business rules (e.g., duplicate email)
 */
export class BusinessRuleError extends BaseApiError {
    constructor(message: string, details?: any) {
        super(ErrorCode.BUSINESS_RULE_ERROR, message, HttpStatusCode.BAD_REQUEST, details);
        Object.setPrototypeOf(this, BusinessRuleError.prototype);
    }
}

/**
 * 500 - Internal Server Error
 * Used for unexpected errors
 */
export class InternalError extends BaseApiError {
    constructor(message: string = 'Internal server error', details?: any) {
        super(ErrorCode.INTERNAL_SERVER_ERROR, message, HttpStatusCode.INTERNAL_SERVER_ERROR, details);
        Object.setPrototypeOf(this, InternalError.prototype);
    }
}

/**
 * 503 - Service Unavailable
 * Used when service/dependency is unavailable
 */
export class ServiceUnavailableError extends BaseApiError {
    constructor(message: string = 'Service unavailable') {
        super(ErrorCode.SERVICE_UNAVAILABLE, message, HttpStatusCode.SERVICE_UNAVAILABLE);
        Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
    }
}

/**
 * Type guard to check if error is a BaseApiError
 */
export function isApiError(error: unknown): error is BaseApiError {
    return error instanceof BaseApiError;
}

/**
 * Helper to convert any error to ApiError format
 */
export function toApiError(error: unknown): ApiError {
    if (isApiError(error)) {
        return error.toApiError();
    }

    if (error instanceof Error) {
        return {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: error.message,
            details: undefined
        };
    }

    return {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unknown error occurred',
        details: undefined
    };
}