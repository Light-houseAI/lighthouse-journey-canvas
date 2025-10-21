/**
 * Timeline/Hierarchy API Schemas
 * Request and response schemas for timeline node endpoints
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const createTimelineNodeRequestSchema = z.object({
  type: z.enum([
    'job',
    'education',
    'project',
    'event',
    'action',
    'careerTransition',
  ]),
  parentId: z.string().uuid().optional().nullable(),
  meta: z.record(z.unknown()),
});

export const updateTimelineNodeRequestSchema = z.object({
  meta: z.record(z.unknown()).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Timeline Node Response Schema
 */
export const timelineNodeResponseSchema = z
  .object({
    id: z.string(),
    userId: z.number(),
    type: z.string(),
    parentId: z.string().nullable(),
    meta: z.record(z.unknown()),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
  })
  .strict();

export type TimelineNodeResponse = z.infer<typeof timelineNodeResponseSchema>;

/**
 * Hierarchy Response Schema
 */
export const hierarchyResponseSchema = z
  .object({
    nodes: z.array(timelineNodeResponseSchema),
    totalCount: z.number().int().nonnegative(),
  })
  .strict();

export type HierarchyResponse = z.infer<typeof hierarchyResponseSchema>;

/**
 * Career Insight Response Schema
 * Using z.any() for now - will be refined when insight structure is finalized
 */
export const careerInsightResponseSchema = z.any();

export type CareerInsightResponse = z.infer<typeof careerInsightResponseSchema>;
