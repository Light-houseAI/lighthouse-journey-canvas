/**
 * Validation Middleware - Controller-level validation helpers
 *
 * Implements the pattern where validation happens at controller boundary
 * and services receive already-validated typed data
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../core/errors';

/**
 * Generic validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

/**
 * Validates request data against a schema
 * @param schema Zod schema to validate against
 * @param data Data to validate
 * @returns Validation result with typed data or error
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Formats Zod errors for API response
 * @param error ZodError to format
 * @returns Formatted error details
 */
export function formatZodError(error: z.ZodError): Array<{
  field: string;
  message: string;
  code: string;
}> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
}

/**
 * Creates a validation middleware for a specific schema
 * Use this when you want middleware-based validation (optional pattern)
 *
 * @example
 * ```typescript
 * router.post('/nodes',
 *   validateBody(createNodeSchema),
 *   controller.createNode
 * );
 * ```
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: formatZodError(result.error)
          }
        });
        return;
      }

      // Replace body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Creates a validation middleware for query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: formatZodError(result.error)
          }
        });
        return;
      }

      // Replace query with validated data
      req.query = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Creates a validation middleware for route parameters
 */
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid route parameters',
            details: formatZodError(result.error)
          }
        });
        return;
      }

      // Replace params with validated data
      req.params = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Response validation for development mode
 * Validates API responses against schemas to ensure contracts are met
 *
 * @example
 * ```typescript
 * if (process.env.NODE_ENV === 'development') {
 *   validateResponse(responseSchema, data);
 * }
 * ```
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  if (process.env.NODE_ENV === 'production') {
    // Skip validation in production for performance
    return data as T;
  }

  const result = schema.safeParse(data);

  if (!result.success) {
    console.error('Response validation failed:', {
      errors: formatZodError(result.error),
      data
    });

    // In development, throw to catch contract violations
    throw new Error(`Response validation failed: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Type guard for checking validation success
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard for checking validation failure
 */
export function isValidationError<T>(
  result: ValidationResult<T>
): result is { success: false; error: z.ZodError } {
  return result.success === false;
}