/**
 * Authentication API Schemas
 * Request and response schemas for auth endpoints
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const signUpRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  userName: z.string().min(1).optional(),
});

export const signInRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const profileUpdateRequestSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  userName: z.string().min(1).optional(),
  interest: z.string().optional(),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Onboarding Type Schema
 * Defines how the user completed their initial setup
 */
export const onboardingTypeSchema = z.enum(['linkedin', 'desktop']);

/**
 * User Profile Schema
 */
export const userProfileSchema = z
  .object({
    id: z.number(),
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    userName: z.string().nullable(),
    interest: z.string().nullable(),
    hasCompletedOnboarding: z.boolean().nullable(),
    onboardingType: onboardingTypeSchema.nullable(),
    createdAt: z.union([z.string(), z.date()]),
  })
  .strict();

export type UserProfile = z.infer<typeof userProfileSchema>;

/**
 * Token Pair Schema
 */
export const tokenPairSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
  })
  .strict();

export type TokenPair = z.infer<typeof tokenPairSchema>;

/**
 * Auth Response Schema
 */
export const authResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    user: userProfileSchema,
  })
  .strict();

export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * Token Info Schema (for debugging)
 */
export const tokenInfoSchema = z.object({
  tokenId: z.string(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});

/**
 * Logout Response Schema
 */
export const logoutResponseSchema = z.object({
  message: z.string(),
});

/**
 * Revoke All Tokens Response Schema
 */
export const revokeAllTokensResponseSchema = z.object({
  message: z.string(),
  revokedCount: z.number(),
});

/**
 * Debug Tokens Response Schema
 */
export const debugTokensResponseSchema = z.object({
  userTokens: z.array(tokenInfoSchema),
  stats: z.any(),
});

export type TokenInfo = z.infer<typeof tokenInfoSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type RevokeAllTokensResponse = z.infer<
  typeof revokeAllTokensResponseSchema
>;
export type DebugTokensResponse = z.infer<typeof debugTokensResponseSchema>;
