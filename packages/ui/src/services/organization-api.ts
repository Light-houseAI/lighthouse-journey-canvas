/**
 * Organization API Service
 *
 * Handles communication with organization endpoints
 * Uses schema validation for type safety
 * Returns server response format (success/error)
 */

import {
  Organization,
  organizationCreateSchema,
  OrganizationType,
} from '@journey/schema';

import { httpClient } from './http-client';

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
  const response = await organizationRequest<{
    organizations: Organization[];
    count: number;
  }>('/');
  return response.organizations;
}

/**
 * Search organizations by name
 * Validates response using schema
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
 * Validates request using schema
 */
export async function createOrganization(data: {
  name: string;
  type: OrganizationType;
  metadata?: Record<string, unknown>;
}): Promise<Organization> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = organizationCreateSchema.parse(data);

  return organizationRequest<Organization>('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validatedData),
  });
}

/**
 * Get all available organizations (for display in UI)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const response = await organizationRequest<{
    organizations: Organization[];
    count: number;
  }>('');
  return response.organizations;
}
