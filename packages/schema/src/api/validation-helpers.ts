/**
 * Validation Helper Functions
 *
 * Utilities for validating requests/responses and formatting errors.
 */

import { z } from 'zod';

/**
 * Formatted validation error (field-level)
 */
export interface FieldValidationError {
  field: string;
  message: string;
}

/**
 * Format Zod validation errors into user-friendly format
 * Converts Zod error paths to dot notation and extracts messages
 */
export function formatValidationErrors(
  error: z.ZodError
): FieldValidationError[] {
  return error.errors
    .map((err) => {
      // Handle unrecognized_keys error - extract field from message
      if (err.code === 'unrecognized_keys') {
        const keys = (err as z.ZodError['errors'][0] & { keys?: string[] })
          .keys;
        if (keys && keys.length > 0) {
          // Return an error for each unrecognized key
          return keys.map((key) => ({
            field: key,
            message: `Unrecognized key(s) in object: '${key}'`,
          }));
        }
      }

      // Format path with array indices in bracket notation
      const formattedPath = err.path
        .map((segment, index) => {
          if (typeof segment === 'number') {
            // Array index - use bracket notation
            return `[${segment}]`;
          }
          // Object key - use dot notation (except for first segment)
          return index === 0 ? String(segment) : `.${String(segment)}`;
        })
        .join('')
        .replace(/\.\[/g, '['); // Clean up ".[]" to "[]"

      return {
        field: formattedPath,
        message: err.message,
      };
    })
    .flat(); // Flatten in case unrecognized_keys returns multiple errors
}

/**
 * Validate request data against a Zod schema
 * Throws error with formatted validation messages on failure
 */
export function validateRequest<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatValidationErrors(error);
      const errorMessages = errors
        .map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Validate response data against a Zod schema
 * In production: logs warning but doesn't throw
 * In development/test: throws error
 */
export function validateResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatValidationErrors(error);
      const errorMessages = errors
        .map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      const errorMsg = `Response validation failed: ${errorMessages}`;

      // In production, log warning but don't throw
      if (process.env.NODE_ENV === 'production') {
        console.warn(errorMsg);
        return data as z.infer<T>;
      }

      // In development/test, throw error
      throw new Error(errorMsg);
    }
    throw error;
  }
}
