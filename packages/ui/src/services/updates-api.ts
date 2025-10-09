/**
 * Updates API Service
 */

import type { CreateUpdateDTO, UpdateData, UpdatesListData, UpdateUpdateDTO } from '@journey/schema';

import { httpClient } from './http-client';

/**
 * Create a new update for a career transition node
 */
export async function createUpdate(
  nodeId: string,
  data: CreateUpdateDTO
): Promise<UpdateData> {
  return httpClient.request<UpdateData>(`/api/nodes/${nodeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Get paginated updates for a node
 */
export async function getUpdatesByNodeId(
  nodeId: string,
  options: { page?: number; limit?: number }
): Promise<UpdatesListData> {
  const { page = 1, limit = 20 } = options;
  return httpClient.request<UpdatesListData>(
    `/api/nodes/${nodeId}/updates?page=${page}&limit=${limit}`
  );
}

/**
 * Get a single update by ID
 */
export async function getUpdateById(nodeId: string, updateId: string): Promise<UpdateData> {
  return httpClient.request<UpdateData>(`/api/nodes/${nodeId}/updates/${updateId}`);
}

/**
 * Update an existing update
 */
export async function updateUpdate(
  nodeId: string,
  updateId: string,
  data: UpdateUpdateDTO
): Promise<UpdateData> {
  return httpClient.request<UpdateData>(`/api/nodes/${nodeId}/updates/${updateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/**
 * Delete an update (soft delete)
 */
export async function deleteUpdate(nodeId: string, updateId: string): Promise<void> {
  return httpClient.request<void>(`/api/nodes/${nodeId}/updates/${updateId}`, {
    method: 'DELETE',
  });
}
