/**
 * Response Validation Helpers (LIG-208)
 *
 * Provides MappedResponse wrapper for fluent validation API.
 * Mappers construct ApiSuccessResponse<T> and validate entire structure.
 *
 * Pattern: Mapper.to(data).withSchema(dataSchema) → res.json()
 * - Mapper wraps data in ApiSuccessResponse<T> format
 * - .withSchema(dataSchema) validates entire ApiSuccessResponse<T>
 * - Uses apiSuccessResponseSchema(dataSchema) for validation
 * - Express serializes via toJSON()
 */

import {
  ApiSuccessResponse,
  apiSuccessResponseSchema,
  validateResponse,
} from '@journey/schema';
import { type ZodTypeAny } from 'zod';

/**
 * Wrapper for mapped responses providing fluent validation.
 * Constructs ApiSuccessResponse<T> and validates entire structure.
 */
export class MappedResponse<T> {
  private readonly response: ApiSuccessResponse<T>;

  constructor(data: T) {
    this.response = {
      success: true,
      data,
    };
  }

  /**
   * Validates entire ApiSuccessResponse<T> structure.
   * Uses apiSuccessResponseSchema(dataSchema) to validate both envelope and data.
   *
   * @param dataSchema - Zod schema for the data field
   * @param schemaName - Optional schema name for error tracking
   * @returns Validated response for Express
   */
  withSchema<TSchema extends ZodTypeAny>(
    dataSchema: TSchema,
    schemaName?: string
  ): ApiSuccessResponse<T> {
    // Validate entire ApiSuccessResponse structure
    const compositeSchema = apiSuccessResponseSchema(dataSchema);
    const validated = validateResponse(compositeSchema, this.response, {
      schemaName: schemaName || 'ApiSuccessResponse',
    });
    return validated;
  }

  /**
   * Get raw response without validation (for testing).
   */
  unwrap(): ApiSuccessResponse<T> {
    return this.response;
  }
}
