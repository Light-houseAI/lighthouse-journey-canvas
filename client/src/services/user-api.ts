/**
 * User API Service
 *
 * Handles communication with user endpoints
 */

import { httpClient } from './http-client';

// User search result type
export interface UserSearchResult {
  id: number;
  email?: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  experienceLine?: string;
  avatarUrl?: string;
}

// Helper function to make API requests to user endpoints
async function userRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/users${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Search for users by name
 * Searches by first name, last name, or full name (partial match, case-insensitive)
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // httpClient already unwraps response.data, so we get the array directly
  const results = await userRequest<UserSearchResult[]>(
    `/search?q=${encodeURIComponent(query.trim())}`
  );

  return results || [];
}
