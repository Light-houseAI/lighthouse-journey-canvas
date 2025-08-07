/**
 * Request Validation Middleware
 * 
 * Provides Zod-based validation for API requests with standardized error handling.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation targets for different parts of the request
 */
export type ValidationTarget = 'body' | 'params' | 'query';

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
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid validation target',
            },
          });
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
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      }
      
      // Unexpected error
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
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
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      }
      
      console.error('Multi-validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
    }
  };
}