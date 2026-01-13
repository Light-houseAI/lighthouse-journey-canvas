/**
 * Timeline/Hierarchy API Schemas
 * Request and response schemas for timeline node endpoints
 */

import { z } from 'zod';

import { TimelineNodeType } from '../enums.js';

// ============================================================================
// Request Schemas
// ============================================================================

// Create a Zod enum from TimelineNodeType values
const timelineNodeTypeValues = Object.values(TimelineNodeType) as [string, ...string[]];

export const createTimelineNodeRequestSchema = z.object({
  type: z.enum(timelineNodeTypeValues),
  parentId: z.string().uuid().optional().nullable(),
  meta: z
    .record(z.unknown())
    .refine((meta) => meta && Object.keys(meta).length > 0, {
      message: 'Meta should not be empty object',
    }),
});

export const updateTimelineNodeRequestSchema = z.object({
  meta: z.record(z.unknown()).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const timelineQuerySchema = z.object({
  maxDepth: z.coerce.number().int().min(1).max(20).default(10),
  includeChildren: z.coerce.boolean().default(false),
  type: z.enum(timelineNodeTypeValues).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Timeline Node Response Schema
 * Includes parent/owner references and permissions metadata
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
    // Parent information
    parent: z
      .object({
        id: z.string(),
        type: z.string(),
        title: z.string().optional(), // Optional because job nodes use 'role' instead of 'title'
      })
      .nullable()
      .optional(),
    // Owner information
    owner: z
      .object({
        id: z.number(),
        userName: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string(),
      })
      .nullable()
      .optional(),
    // Permission metadata
    permissions: z
      .object({
        canView: z.boolean(),
        canEdit: z.boolean(),
        canShare: z.boolean(),
        canDelete: z.boolean(),
        accessLevel: z.string(), // VisibilityLevel enum as string
        shouldShowMatches: z.boolean(),
      })
      .nullable()
      .optional(),
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
