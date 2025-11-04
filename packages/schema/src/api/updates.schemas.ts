/**
 * Updates API Schemas
 * Request and response schemas for career transition updates
 */

import { z } from 'zod';

import { NetworkingType } from '../enums';
import { paginationSchema } from './common.schemas';

// ============================================================================
// Request Schemas
// ============================================================================

// Base networking activity schema
const baseNetworkingActivitySchema = z.object({
  timestamp: z.string(),
});

// Cold outreach activity schema
const coldOutreachActivitySchema = baseNetworkingActivitySchema.extend({
  networkingType: z.literal(NetworkingType.ColdOutreach),
  whom: z.array(z.string().min(1).max(100)).min(1),
  channels: z.array(z.string().min(1).max(50)).min(1),
  exampleOnHow: z.string().max(500),
});

// Reconnected activity schema
const reconnectedActivitySchema = baseNetworkingActivitySchema.extend({
  networkingType: z.literal(NetworkingType.ReconnectedWithSomeone),
  contacts: z.array(z.string().min(1).max(100)).min(1),
  notes: z.string().max(500),
});

// Networking event activity schema
const networkingEventActivitySchema = baseNetworkingActivitySchema.extend({
  networkingType: z.literal(NetworkingType.AttendedNetworkingEvent),
  event: z.string().min(1).max(100),
  notes: z.string().max(500),
});

// Informational interview activity schema
const informationalInterviewActivitySchema =
  baseNetworkingActivitySchema.extend({
    networkingType: z.literal(NetworkingType.InformationalInterview),
    contact: z.string().min(1).max(100),
    notes: z.string().max(500),
  });

// Discriminated union for all networking activities
const networkingActivitySchema = z.discriminatedUnion('networkingType', [
  coldOutreachActivitySchema,
  reconnectedActivitySchema,
  networkingEventActivitySchema,
  informationalInterviewActivitySchema,
]);

// Networking data container for wizard payload
export const networkingWizardPayloadSchema = z.object({
  activities: z.array(networkingActivitySchema).min(1),
});

// ============================================================================
// TypeScript Types (Derived from Zod Schemas)
// ============================================================================

/**
 * Cold outreach networking activity
 * Derived from coldOutreachActivitySchema
 */
export type ColdOutreachActivity = z.infer<typeof coldOutreachActivitySchema>;

/**
 * Reconnection networking activity
 * Derived from reconnectedActivitySchema
 */
export type ReconnectedActivity = z.infer<typeof reconnectedActivitySchema>;

/**
 * Networking event activity
 * Derived from networkingEventActivitySchema
 */
export type NetworkingEventActivity = z.infer<
  typeof networkingEventActivitySchema
>;

/**
 * Informational interview activity
 * Derived from informationalInterviewActivitySchema
 */
export type InformationalInterviewActivity = z.infer<
  typeof informationalInterviewActivitySchema
>;

/**
 * Discriminated union of all networking activity types
 * TypeScript automatically narrows based on networkingType field
 * Derived from networkingActivitySchema
 */
export type NetworkingActivity = z.infer<typeof networkingActivitySchema>;

/**
 * Wizard payload for networking activities (used during wizard submission)
 * Derived from networkingWizardPayloadSchema
 */
export type NetworkingWizardPayload = z.infer<
  typeof networkingWizardPayloadSchema
>;

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
      // Networking data moved to node.meta.networkingActivities (no longer stored in updates)
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
