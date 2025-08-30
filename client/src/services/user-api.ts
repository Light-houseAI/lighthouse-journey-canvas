/**
 * User API Service
 * 
 * Handles communication with user endpoints
 */

import { httpClient } from './http-client';

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  details?: any;
}

// User search result type
export interface UserSearchResult {
  id: number;
  email: string;
  userName: string;
}

// Helper function to make API requests to user endpoints
async function userRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/users${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Search for users by username or email
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  return userRequest<UserSearchResult[]>(`/search?q=${encodeURIComponent(query.trim())}`);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number): Promise<UserSearchResult | null> {
  try {
    return await userRequest<UserSearchResult>(`/${userId}`);
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    return null;
  }
}

/**
 * Get multiple users by their IDs
 */
export async function getUsersByIds(userIds: number[]): Promise<UserSearchResult[]> {
  if (userIds.length === 0) {
    return [];
  }

  try {
    const userPromises = userIds.map(id => getUserById(id));
    const users = await Promise.all(userPromises);
    return users.filter((user): user is UserSearchResult => user !== null);
  } catch (error) {
    console.error('Failed to fetch users by IDs:', error);
    return [];
  }
}
