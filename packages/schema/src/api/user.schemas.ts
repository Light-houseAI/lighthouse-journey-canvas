/**
 * User API Schemas
 * Request and response schemas for user endpoints
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const userSearchRequestSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100),
});

export const userUpdateRequestSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  userName: z.string().min(1).optional(),
  interest: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * User Response Schema
 */
export const userResponseSchema = z
  .object({
    id: z.number(),
    email: z.string().email(),
    fullName: z.string().nullable(),
    profilePictureUrl: z.string().nullable(),
    createdAt: z.union([z.string(), z.date()]),
  })
  .strict();

export type UserResponse = z.infer<typeof userResponseSchema>;

/**
 * User Search Result Schema
 */
export const userSearchResultSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    userName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    experienceLine: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .strict();

export type UserSearchResult = z.infer<typeof userSearchResultSchema>;

/**
 * User Search Response Schema
 */
export const userSearchResponseSchema = z
  .object({
    users: z.array(userSearchResultSchema),
    count: z.number().int().nonnegative(),
  })
  .strict();

export type UserSearchResponse = z.infer<typeof userSearchResponseSchema>;
