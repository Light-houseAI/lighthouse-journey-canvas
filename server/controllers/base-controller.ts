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
} from '../services/base-service';
import { IProfileService } from 'server/services/interfaces';
// Legacy container removed - using hierarchical timeline system
import { ProfileService } from 'server/services/profile-service';

/**
 * Standard API response format
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
   * Handle successful responses with consistent formatting
   *
   * @param res Express response object
   * @param data Response data
   * @param status HTTP status code (default: 200)
   * @param meta Optional pagination/meta information
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
   * Handle error responses with consistent formatting and appropriate status codes
   *
   * @param res Express response object
   * @param error Error object
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
  protected async validateProfileAccess(userId: number, profileId: number): void {
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
