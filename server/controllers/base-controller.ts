/**
 * Base Controller
 *
 * Provides common patterns for all API controllers including:
 * - Standardized success/error response handling
 * - Profile ownership validation
 * - Common HTTP status codes
 * - Response format consistency
 */

import { Request, Response } from 'express';
import {
  ValidationError,
  BusinessRuleError,
  NotFoundError
} from '../core/errors';
import {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedResponse,
  ErrorCode,
  HttpStatusCode,
} from '../../shared/types/api-responses';
import {
  ResponseBuilder,
  createResponseBuilder,
  getStatusCodeForResponse,
} from '../../shared/utils/response-builder';

// Profile service removed - using hierarchical timeline system via UserOnboarding controller

/**
 * @deprecated Use ApiResponse from shared/types/api-responses.ts instead
 * Standard API response format (kept for backward compatibility)
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  }
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  }
}

/**
 * Base controller providing common functionality for all API controllers
 */
export abstract class BaseController {
  /**
   * Create a response builder for the current request
   */
  protected createResponseBuilder(req: Request): ResponseBuilder {
    const requestId = req.headers['x-request-id'] as string;
    return createResponseBuilder(requestId);
  }

  /**
   * Send a standardized API response with appropriate HTTP status code
   */
  protected sendResponse(res: Response, response: ApiResponse): Response {
    const statusCode = getStatusCodeForResponse(response);
    return res.status(statusCode).json(response);
  }

  /**
   * Handle successful responses with consistent formatting
   *
   * @param res Express response object
   * @param data Response data
   * @param status HTTP status code (default: auto-detected)
   * @param meta Optional pagination/meta information
   */
  protected success<T>(
    res: Response,
    data: T,
    req?: Request,
    meta?: { total?: number; page?: number; limit?: number }
  ): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.success(data, meta);
    return this.sendResponse(res, response);
  }

  /**
   * Handle created responses (HTTP 201)
   */
  protected created<T>(
    res: Response,
    data: T,
    req?: Request,
    meta?: { total?: number; page?: number; limit?: number }
  ): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.created(data, meta);
    return res.status(HttpStatusCode.CREATED).json(response);
  }

  /**
   * Handle no content responses (HTTP 204)
   */
  protected noContent(res: Response, req?: Request): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.noContent();
    return res.status(HttpStatusCode.NO_CONTENT).json(response);
  }

  /**
   * Handle paginated responses
   */
  protected paginated<T>(
    res: Response,
    items: T[],
    page: number,
    limit: number,
    total: number,
    req?: Request,
    meta?: Record<string, any>
  ): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.paginated(items, page, limit, total, meta);
    return this.sendResponse(res, response);
  }

  /**
   * Handle error responses with consistent formatting and appropriate status codes
   *
   * @param res Express response object
   * @param error Error object or string message
   * @param req Request object for context
   * @param errorCode Optional specific error code
   */
  protected error(
    res: Response,
    error: Error | string,
    req?: Request,
    errorCode?: ErrorCode
  ): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    
    let response: ApiErrorResponse;
    if (typeof error === 'string') {
      response = builder.error(error, errorCode);
    } else {
      response = builder.errorFromException(error, errorCode);
    }
    
    return this.sendResponse(res, response);
  }

  /**
   * Handle not found responses
   */
  protected notFound(res: Response, resource?: string, req?: Request): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.notFound(resource);
    return this.sendResponse(res, response);
  }

  /**
   * Handle validation error responses
   */
  protected validationError(
    res: Response,
    message: string,
    details?: any,
    req?: Request
  ): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.validationError(message, details);
    return this.sendResponse(res, response);
  }

  /**
   * Handle unauthorized responses
   */
  protected unauthorized(res: Response, message?: string, req?: Request): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.unauthorized(message);
    return this.sendResponse(res, response);
  }

  /**
   * Handle forbidden responses
   */
  protected forbidden(res: Response, message?: string, req?: Request): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.forbidden(message);
    return this.sendResponse(res, response);
  }

  /**
   * Handle conflict responses
   */
  protected conflict(res: Response, message: string, req?: Request): Response {
    const builder = req ? this.createResponseBuilder(req) : createResponseBuilder();
    const response = builder.conflict(message);
    return this.sendResponse(res, response);
  }

  /**
   * @deprecated Use success() method instead
   * Handle successful responses with consistent formatting
   */
  protected handleSuccess(
    res: Response,
    data: any,
    status: number = 200,
    meta?: { total?: number; page?: number; limit?: number }
  ): Response {
    const response: APIResponse = {
      success: true,
      data,
    }

    if (meta) {
      response.meta = meta;
    }

    return res.status(status).json(response);
  }

  /**
   * @deprecated Use error() method instead
   * Handle error responses with consistent formatting and appropriate status codes
   */
  protected handleError(res: Response, error: Error): Response {
    let status = 500;
    let code = 'INTERNAL_SERVER_ERROR';

    // Map custom error types to appropriate HTTP status codes
    if (error instanceof ValidationError) {
      status = 400;
      code = 'VALIDATION_ERROR';
    } else if (error instanceof BusinessRuleError) {
      status = 409;
      code = 'BUSINESS_RULE_ERROR';
    } else if (error instanceof NotFoundError) {
      status = 404;
      code = 'NOT_FOUND';
    }

    const response: APIResponse = {
      success: false,
      error: {
        code,
        message: error.message,
      },
    }

    // Include error details if available
    if ('details' in error && error.details) {
      response.error!.details = error.details;
    }

    return res.status(status).json(response);
  }

  /**
   * Validate that a user can only access their own profile data
   *
   * @param userId User ID from the authenticated request
   * @param profileId Profile ID from the request parameters
   * @throws Error if access is not authorized
   */
  protected async validateProfileAccess(userId: number, profileId: number): Promise<void> {
    return;
  }

  /**
   * Extract and validate numeric ID from request parameters
   *
   * @param value Parameter value to validate
   * @param paramName Parameter name for error messages
   * @returns Validated numeric ID
   * @throws ValidationError if ID is invalid
   */
  protected validateId(value: string | undefined, paramName: string): number {
    if (!value) {
      throw new ValidationError(`${paramName} is required`);
    }

    const id = parseInt(value, 10);
    if (isNaN(id) || id <= 0) {
      throw new ValidationError(`Invalid ${paramName}: must be a positive integer`);
    }

    return id;
  }

  /**
   * Parse and validate pagination parameters
   *
   * @param query Request query parameters
   * @returns Validated pagination parameters
   */
  protected parsePagination(query: any): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Parse sorting parameters
   *
   * @param query Request query parameters
   * @param allowedFields Array of allowed field names for sorting
   * @returns Validated sorting parameters
   */
  protected parseSorting(
    query: any,
    allowedFields: string[]
  ): { field?: string; order: 'ASC' | 'DESC' } {
    const sort = query.sort as string;
    const order = (query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Validate sort field if provided
    if (sort && !allowedFields.includes(sort)) {
      throw new ValidationError(`Invalid sort field. Allowed fields: ${allowedFields.join(', ')}`);
    }

    return { field: sort, order };
  }

  /**
   * Extract user from authenticated request
   *
   * @param req Express request object
   * @returns User object with ID
   * @throws ValidationError if user is not authenticated
   */
  protected getAuthenticatedUser(req: Request): { id: number } {
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new ValidationError('Authentication required');
    }

    return { id: user.id };
  }
}
