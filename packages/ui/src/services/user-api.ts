/**
 * User API Service
 *
 * Handles communication with user endpoints
 * Uses schema validation for type safety
 * Returns server response format (success/error)
 */

import type { UserSearchResult } from '@journey/schema';
// Import schema types and validators
import { userSearchRequestSchema } from '@journey/schema';

import { httpClient } from './http-client';

// Helper function to make API requests to user endpoints
async function userRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/users${path}`;
  return httpClient.request<T>(url, init);
}

// Re-export UserSearchResult for other modules
export type { UserSearchResult };

/**
 * Search for users by name
 * Searches by first name, last name, or full name (partial match, case-insensitive)
 * Validates request and response using Zod schemas
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Validate request (let Zod errors bubble to error boundary)
  const validatedRequest = userSearchRequestSchema.parse({
    q: query.trim(),
  });

  return userRequest<UserSearchResult[]>(
    `/search?q=${encodeURIComponent(validatedRequest.q)}`
  );
}
