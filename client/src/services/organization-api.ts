/**
 * Organization API Service
 * 
 * Handles communication with organization endpoints
 */

import { Organization } from '@shared/schema';

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  details?: any;
}

// HTTP client with error handling
async function httpClient<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/organizations${path}`;
  
  // Get test user ID from localStorage
  const testUserId = localStorage.getItem('test-user-id');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };
  
  // Only add X-User-Id header if set in localStorage
  if (testUserId) {
    headers['X-User-Id'] = testUserId;
  }
  
  const config: RequestInit = {
    headers,
    ...init,
  };

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Get user's organizations (organizations they are a member of)
 */
export async function getUserOrganizations(): Promise<Organization[]> {
  const response = await httpClient<ApiResponse<Organization[]>>('/');
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch user organizations');
  }

  return response.data || [];
}

/**
 * Search organizations by name
 */
export async function searchOrganizations(query: string): Promise<Organization[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const response = await httpClient<ApiResponse<Organization[]>>(`/search?q=${encodeURIComponent(query.trim())}`);
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to search organizations');
  }

  return response.data || [];
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(orgId: number): Promise<Organization | null> {
  try {
    const response = await httpClient<ApiResponse<Organization>>(`/${orgId}`);
    
    if (!response.success) {
      return null;
    }

    return response.data || null;
  } catch (error) {
    console.error('Failed to fetch organization by ID:', error);
    return null;
  }
}

/**
 * Get multiple organizations by their IDs
 */
export async function getOrganizationsByIds(orgIds: number[]): Promise<Organization[]> {
  if (orgIds.length === 0) {
    return [];
  }

  try {
    const orgPromises = orgIds.map(id => getOrganizationById(id));
    const orgs = await Promise.all(orgPromises);
    return orgs.filter((org): org is Organization => org !== null);
  } catch (error) {
    console.error('Failed to fetch organizations by IDs:', error);
    return [];
  }
}
