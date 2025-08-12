/**
 * Request Validation Middleware
 * 
 * Provides Zod-based validation for API requests with standardized error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { APIResponse } from '../controllers/base-controller';

/**
 * Validation targets for different parts of the request
 */
export type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Create a standardized validation error response
 */
function createValidationErrorResponse(
  message: string = 'Request validation failed',
  details?: any
): APIResponse {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Create a standardized internal server error response
 */
function createInternalErrorResponse(
  message: string = 'Internal server error'
): APIResponse {
  return {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
  };
}

/**
 * Validate request data against a Zod schema
 * 
 * @param schema Zod schema to validate against
 * @param target Which part of the request to validate (body, params, or query)
 * @returns Express middleware function
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        default:
          return res.status(400).json(createValidationErrorResponse('Invalid validation target'));
      }
      
      // Parse and validate the data
      const parsed = schema.parse(dataToValidate);
      
      // Replace the original data with the validated/transformed data
      switch (target) {
        case 'body':
          req.body = parsed;
          break;
        case 'params':
          req.params = parsed;
          break;
        case 'query':
          req.query = parsed;
          break;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return res.status(400).json(createValidationErrorResponse('Request validation failed', details));
      }
      
      // Unexpected error
      console.error('Validation middleware error:', error);
      return res.status(500).json(createInternalErrorResponse());
    }
  };
}

/**
 * Validate multiple request parts in one middleware
 * 
 * @param validations Array of validation configurations
 * @returns Express middleware function
 */
export function validateMultiple(
  validations: Array<{ schema: ZodSchema; target: ValidationTarget }>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const { schema, target } of validations) {
        let dataToValidate;
        
        switch (target) {
          case 'body':
            dataToValidate = req.body;
            break;
          case 'params':
            dataToValidate = req.params;
            break;
          case 'query':
            dataToValidate = req.query;
            break;
        }
        
        const parsed = schema.parse(dataToValidate);
        
        switch (target) {
          case 'body':
            req.body = parsed;
            break;
          case 'params':
            req.params = parsed;
            break;
          case 'query':
            req.query = parsed;
            break;
        }
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        return res.status(400).json(createValidationErrorResponse('Request validation failed', details));
      }
      
      console.error('Multi-validation middleware error:', error);
      return res.status(500).json(createInternalErrorResponse());
    }
  };
}