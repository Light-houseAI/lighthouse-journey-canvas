/**
 * User Onboarding API Schemas
 * Request and response schemas for onboarding flow
 */

import { z } from 'zod';

import { userProfileSchema } from './auth.schemas';

// ============================================================================
// Request Schemas
// ============================================================================

export const usernameInputSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
});

export const interestSchema = z.object({
  interest: z.enum(
    ['find-job', 'grow-career', 'change-careers', 'start-startup'],
    {
      errorMap: () => ({ message: 'Please select your interest' }),
    }
  ),
});

export const insertProfileSchema = z.object({
  username: z.string(),
  rawData: z.custom<any>(), // ProfileData type
  filteredData: z.custom<any>(), // ProfileData type
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * User Update Response Schema (for onboarding)
 */
export const userUpdateResponseSchema = z.object({
  user: userProfileSchema,
});

export type UserUpdateResponse = z.infer<typeof userUpdateResponseSchema>;

/**
 * Profile Data Response Schema (for onboarding)
 */
export const profileDataResponseSchema = z.object({
  profile: z.any(), // Will be refined when profile structure is finalized
});

export type ProfileDataResponse = z.infer<typeof profileDataResponseSchema>;

/**
 * Onboarding Completion Response Schema
 */
export const onboardingCompletionResponseSchema = z.any(); // Will be refined

export type OnboardingCompletionResponse = z.infer<
  typeof onboardingCompletionResponseSchema
>;
