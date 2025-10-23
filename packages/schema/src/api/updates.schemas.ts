/**
 * Updates API Schemas
 * Request and response schemas for career transition updates
 */

import { z } from 'zod';

import { paginationSchema } from './common.schemas';

// ============================================================================
// Request Schemas
// ============================================================================

export const createUpdateRequestSchema = z.object({
  // Notes
  notes: z.string().max(1000).optional(),
  // All activity flags in meta
  meta: z
    .object({
      appliedToJobs: z.boolean().optional(),
      updatedResumeOrPortfolio: z.boolean().optional(),
      networked: z.boolean().optional(),
      developedSkills: z.boolean().optional(),
      pendingInterviews: z.boolean().optional(),
      completedInterviews: z.boolean().optional(),
      practicedMock: z.boolean().optional(),
      receivedOffers: z.boolean().optional(),
      receivedRejections: z.boolean().optional(),
      possiblyGhosted: z.boolean().optional(),
    })
    .optional(),
});

export const updateUpdateRequestSchema = createUpdateRequestSchema.partial();

export const paginationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .default('20'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Update Item Schema
 */
export const updateItemSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  content: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.number().optional(),
});

export type UpdateItem = z.infer<typeof updateItemSchema>;

/**
 * Social Update Response Schema
 */
export const apiUpdateResponseSchema = z
  .object({
    id: z.string(),
    userId: z.number(),
    actorId: z.number(),
    actorName: z.string(),
    actorProfilePictureUrl: z.string().nullable(),
    type: z.enum(['comment', 'like', 'share', 'mention']),
    targetType: z.string(),
    targetId: z.string(),
    metadata: z.record(z.unknown()).nullable(),
    createdAt: z.union([z.string(), z.date()]),
  })
  .strict();

export type ApiUpdateResponse = z.infer<typeof apiUpdateResponseSchema>;

/**
 * Paginated Updates Schema
 */
export const paginatedUpdatesSchema = z
  .object({
    updates: z.array(apiUpdateResponseSchema),
    pagination: paginationSchema,
  })
  .strict();

export type PaginatedUpdates = z.infer<typeof paginatedUpdatesSchema>;

/**
 * Legacy Paginated Updates Schema (for backwards compatibility)
 * TODO: Migrate to paginatedUpdatesSchema structure
 */
export const legacyPaginatedUpdatesSchema = z.object({
  items: z.array(updateItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type LegacyPaginatedUpdates = z.infer<
  typeof legacyPaginatedUpdatesSchema
>;
