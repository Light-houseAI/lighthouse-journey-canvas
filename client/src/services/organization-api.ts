/**
 * Organization API Service
 *
 * Handles communication with organization endpoints
 */

import { OrganizationType } from '@shared/enums';
import { Organization } from '@shared/schema';

import { httpClient } from './http-client';

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  error?: string;
  details?: any;
}

// Helper function to make API requests to organization endpoints
async function organizationRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `/api/v2/organizations${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Get user's organizations (organizations they are a member of)
 */
export async function getUserOrganizations(): Promise<Organization[]> {
  return organizationRequest<Organization[]>('/');
}

/**
 * Search organizations by name
 */
export async function searchOrganizations(
  query: string
): Promise<Organization[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  return organizationRequest<Organization[]>(
    `/search?q=${encodeURIComponent(query.trim())}`
  );
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  orgId: number
): Promise<Organization | null> {
  try {
    return await organizationRequest<Organization>(`/${orgId}`);
  } catch (error) {
    console.error('Failed to fetch organization by ID:', error);
    return null;
  }
}

/**
 * Get multiple organizations by their IDs
 */
export async function getOrganizationsByIds(
  orgIds: number[]
): Promise<Organization[]> {
  if (orgIds.length === 0) {
    return [];
  }

  try {
    const orgPromises = orgIds.map((id) => getOrganizationById(id));
    const orgs = await Promise.all(orgPromises);
    return orgs.filter((org): org is Organization => org !== null);
  } catch (error) {
    console.error('Failed to fetch organizations by IDs:', error);
    return [];
  }
}

/**
 * Create a new organization
 */
export async function createOrganization(data: {
  name: string;
  type: OrganizationType;
  description?: string;
  website?: string;
  location?: string;
}): Promise<Organization> {
  const response = await httpClient<ApiResponse<Organization>>('/', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create organization');
  }

  if (!response.data) {
    throw new Error('No organization data returned from server');
  }

  return response.data;
}

/**
 * Get all available organizations (for display in UI)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  return organizationRequest<Organization[]>('');
}
