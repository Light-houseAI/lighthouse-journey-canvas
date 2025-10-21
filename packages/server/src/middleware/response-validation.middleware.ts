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

import { apiSuccessResponseSchema, validateResponse } from '@journey/schema';
import { type ZodTypeAny } from 'zod';

/**
 * API Success Response type
 */
export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

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
   * @returns Validated response for Express
   */
  withSchema<TSchema extends ZodTypeAny>(
    dataSchema: TSchema
  ): ValidatedResponse<T> {
    // Validate entire ApiSuccessResponse structure
    const compositeSchema = apiSuccessResponseSchema(dataSchema);
    const validated = validateResponse(compositeSchema, this.response);
    return new ValidatedResponse(validated);
  }

  /**
   * Get raw response without validation (for testing).
   */
  unwrap(): ApiSuccessResponse<T> {
    return this.response;
  }
}

/**
 * Validated response wrapper for Express serialization.
 * Holds validated ApiSuccessResponse<T>, ready for res.json().
 */
export class ValidatedResponse<T> {
  constructor(private readonly response: ApiSuccessResponse<T>) {}

  /**
   * Called by Express res.json() to serialize the response.
   * Returns the validated ApiSuccessResponse<T> structure.
   */
  toJSON(): ApiSuccessResponse<T> {
    return this.response;
  }

  /**
   * Get validated response (for testing).
   */
  getData(): ApiSuccessResponse<T> {
    return this.response;
  }
}
