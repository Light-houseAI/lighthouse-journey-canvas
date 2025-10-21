/**
 * Common API Schemas
 * Shared schemas used across multiple endpoints
 */

import { z } from 'zod';

// ============================================================================
// Generic API Response Wrappers
// ============================================================================

/**
 * Generic success response wrapper
 */
export const apiSuccessResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
    })
    .strict();

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

/**
 * Error response schema
 */
export const apiErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/**
 * Pagination metadata schema
 */
export const paginationSchema = z
  .object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
  })
  .strict();

export type Pagination = z.infer<typeof paginationSchema>;
