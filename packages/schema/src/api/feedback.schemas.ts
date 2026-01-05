/**
 * User Feedback API Schemas (Thumbs Up/Down Feature)
 *
 * Zod schemas for user feedback submission APIs.
 * Supports feedback for:
 * - Desktop app: Final Summary in review window
 * - Web app: Workflow Analysis, Top Workflow, AI Usage Overview panels
 */

import { z } from 'zod';

import { FeedbackFeatureType, FeedbackRating } from '../enums';

// ============================================================================
// FEEDBACK REQUEST SCHEMAS
// ============================================================================

/**
 * Submit feedback request body
 */
export const submitUserFeedbackRequestSchema = z.object({
  // What feature is being rated
  featureType: z.nativeEnum(FeedbackFeatureType),

  // The rating (thumbs up or thumbs down)
  rating: z.nativeEnum(FeedbackRating),

  // Optional comment for additional context
  comment: z.string().max(1000).optional(),

  // Context data - stores feature-specific metadata
  contextData: z
    .record(z.any())
    .optional()
    .default({}),

  // Reference to the node this feedback is associated with (if applicable)
  nodeId: z.string().uuid().optional(),

  // For desktop app - reference to the session mapping
  sessionMappingId: z.string().uuid().optional(),
});

export type SubmitUserFeedbackRequest = z.infer<typeof submitUserFeedbackRequestSchema>;

// ============================================================================
// FEEDBACK RESPONSE SCHEMAS
// ============================================================================

/**
 * Feedback item returned from API
 */
export const feedbackItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  featureType: z.nativeEnum(FeedbackFeatureType),
  rating: z.nativeEnum(FeedbackRating),
  comment: z.string().nullable(),
  contextData: z.record(z.any()).nullable(),
  nodeId: z.string().uuid().nullable(),
  sessionMappingId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type FeedbackItem = z.infer<typeof feedbackItemSchema>;

/**
 * Submit feedback response
 */
export const submitUserFeedbackResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    feedback: feedbackItemSchema,
    message: z.string(),
  }),
});

export type SubmitUserFeedbackResponse = z.infer<typeof submitUserFeedbackResponseSchema>;

// ============================================================================
// FEEDBACK QUERY SCHEMAS
// ============================================================================

/**
 * List feedback query parameters
 */
export const listFeedbackQuerySchema = z.object({
  // Filter by feature type
  featureType: z.nativeEnum(FeedbackFeatureType).optional(),

  // Filter by rating
  rating: z.nativeEnum(FeedbackRating).optional(),

  // Filter by node ID
  nodeId: z.string().uuid().optional(),

  // Pagination
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;

/**
 * List feedback response
 */
export const listFeedbackResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    feedback: z.array(feedbackItemSchema),
    total: z.number(),
    hasMore: z.boolean(),
  }),
});

export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;
