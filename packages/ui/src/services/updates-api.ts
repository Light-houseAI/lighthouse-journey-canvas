/**
 * Updates API Service
 * Uses schema validation for type safety
 * Returns server response format (success/error)
 */

import type {
  CreateUpdateRequest,
  Update,
  UpdatesListResponse,
} from '@journey/schema';
import {
  createUpdateRequestSchema,
  updateUpdateRequestSchema,
} from '@journey/schema';

import { httpClient } from './http-client';

/**
 * Create a new update for a career transition node
 * Validates request using schema
 */
export async function createUpdate(
  nodeId: string,
  data: CreateUpdateRequest
): Promise<Update> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = createUpdateRequestSchema.parse(data);

  return httpClient.request<Update>(`/api/nodes/${nodeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
  });
}

/**
 * Get paginated updates for a node
 */
export async function getUpdatesByNodeId(
  nodeId: string,
  options: { page?: number; limit?: number }
): Promise<UpdatesListResponse> {
  const { page = 1, limit = 20 } = options;
  return httpClient.request<UpdatesListResponse>(
    `/api/nodes/${nodeId}/updates?page=${page}&limit=${limit}`
  );
}

/**
 * Get a single update by ID
 */
export async function getUpdateById(
  nodeId: string,
  updateId: string
): Promise<Update> {
  return httpClient.request<Update>(`/api/nodes/${nodeId}/updates/${updateId}`);
}

/**
 * Update an existing update
 * Validates request using schema
 */
export async function updateUpdate(
  nodeId: string,
  updateId: string,
  data: Partial<CreateUpdateRequest>
): Promise<Update> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = updateUpdateRequestSchema.parse(data);

  return httpClient.request<Update>(
    `/api/nodes/${nodeId}/updates/${updateId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData),
    }
  );
}

/**
 * Delete an update (soft delete)
 */
export async function deleteUpdate(
  nodeId: string,
  updateId: string
): Promise<void> {
  return httpClient.request<void>(`/api/nodes/${nodeId}/updates/${updateId}`, {
    method: 'DELETE',
  });
}
