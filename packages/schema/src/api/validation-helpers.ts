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
 * Context for validation errors with structured tracking
 */
export interface ValidationErrorContext {
  timestamp: string;
  environment: string;
  schemaName?: string;
  errorCount: number;
  errors: FieldValidationError[];
  sampleData?: string;
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
 * Always throws on validation failure to prevent corrupt data from reaching clients
 * Provides structured error tracking for monitoring and debugging
 */
export function validateResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  options?: {
    schemaName?: string;
    onError?: (context: ValidationErrorContext) => void;
  }
): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatValidationErrors(error);
      const context: ValidationErrorContext = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        schemaName: options?.schemaName,
        errorCount: errors.length,
        errors,
        sampleData: truncateForLogging(data),
      };

      // Structured logging for monitoring
      console.error('[Response Validation Failed]', {
        schema: context.schemaName,
        errorCount: context.errorCount,
        errors: context.errors,
        environment: context.environment,
        timestamp: context.timestamp,
      });

      // Optional callback for custom tracking (metrics, Sentry, etc.)
      options?.onError?.(context);

      const errorMessages = errors
        .map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      const errorMsg = `Response validation failed: ${errorMessages}`;

      // ALWAYS throw - validation failures indicate bugs that must be fixed
      throw new Error(errorMsg);
    }
    throw error;
  }
}

/**
 * Truncate data for safe logging (privacy-conscious)
 */
function truncateForLogging(data: unknown): string {
  try {
    const str = JSON.stringify(data);
    return str.length > 200 ? str.substring(0, 200) + '...' : str;
  } catch {
    return '[Unable to serialize data]';
  }
}
