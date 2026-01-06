/**
 * Onboarding API Service
 *
 * Handles communication with onboarding endpoints
 * Uses schema validation for type safety
 */

import type { ProfileData } from '@journey/schema';
import { z } from 'zod';

import { httpClient } from './http-client';

// Import schema types from schema package
// Note: Schema types are defined in @journey/schema but not re-exported at package level
// So we define the types here based on the schema definitions
const usernameInputSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .regex(
      /^[a-zA-Z0-9-_]+$/,
      'Username can only contain letters, numbers, hyphens, and underscores'
    ),
});

const interestSchema = z.object({
  interest: z.enum(
    ['find-job', 'grow-career', 'change-careers', 'start-startup'],
    {
      errorMap: () => ({ message: 'Please select your interest' }),
    }
  ),
});

const insertProfileSchema = z.object({
  username: z.string(),
  rawData: z.custom<ProfileData>(),
  filteredData: z.custom<ProfileData>(),
});

export type UsernameInput = z.infer<typeof usernameInputSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;

export interface ProfileDataResponse {
  profile: ProfileData;
}

export interface UserUpdateResponse {
  user: any; // Defined in auth-store
}

/**
 * Extract profile data from LinkedIn username
 * Validates request and response using Zod schemas
 */
export async function extractProfile(
  username: string
): Promise<ProfileDataResponse> {
  // Validate request
  const validated = usernameInputSchema.parse({ username });

  return httpClient.post<ProfileDataResponse>(
    '/api/onboarding/extract-profile',
    validated
  );
}

/**
 * Save user's interest during onboarding
 * Validates request using Zod schema
 */
export async function saveInterest(
  interest: 'find-job' | 'grow-career' | 'change-careers' | 'start-startup'
): Promise<UserUpdateResponse> {
  // Validate request
  const validated = interestSchema.parse({ interest });

  return httpClient.post<UserUpdateResponse>(
    '/api/onboarding/interest',
    validated
  );
}

/**
 * Save profile data during onboarding
 * Validates request using Zod schema
 */
export async function saveProfile(
  data: InsertProfile
): Promise<{ success: boolean }> {
  // Validate request
  const validated = insertProfileSchema.parse(data);

  return httpClient.post<{ success: boolean }>(
    '/api/onboarding/save-profile',
    validated
  );
}

/**
 * Complete onboarding process
 * Marks user as having completed onboarding
 */
export async function completeOnboarding(): Promise<UserUpdateResponse> {
  return httpClient.post<UserUpdateResponse>('/api/onboarding/complete');
}

/**
 * Desktop track data structure
 * Matches what the desktop app will send
 */
export interface DesktopTrackData {
  companyName: string;
  role: string;
  startDate: string; // YYYY-MM format
  endDate?: string; // YYYY-MM format
  description?: string;
  location?: string;
}

/**
 * Response data from desktop track creation
 * Note: httpClient.post automatically unwraps the 'data' field from the server response
 */
export interface DesktopTrackResponse {
  nodeId: string;
  type: string;
  meta: Record<string, any>;
  onboardingCompleted: boolean;
}

/**
 * Create a track from desktop app data
 * This API is called by the desktop app or mock button during testing
 */
export async function createDesktopTrack(
  trackData: DesktopTrackData
): Promise<DesktopTrackResponse> {
  return httpClient.post<DesktopTrackResponse>(
    '/api/v2/desktop/track',
    trackData
  );
}
