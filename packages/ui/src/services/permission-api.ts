/**
 * Permission API Service
 *
 * Handles communication with node permission endpoints
 */

import {
  NodePolicy,
  NodePolicyCreateDTO,
  NodePolicyUpdateDTO,
  SetNodePermissionsDTO,
} from '@journey/schema';

import { httpClient } from './http-client';

// Extended NodePolicy type that includes user info when subjectType is 'user'
export interface EnrichedNodePolicy extends NodePolicy {
  userInfo?: {
    id: number;
    userName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    experienceLine?: string;
    avatarUrl?: string;
  };
}

export interface BulkPermissionsResponse {
  nodeId: string;
  policies: EnrichedNodePolicy[];
}

// Helper function to make API requests to timeline endpoints
async function timelineRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `/api/v2/timeline${path}`;
  return httpClient.request<T>(url, init);
}

/**
 * Get permissions for a specific node
 */
export async function getNodePermissions(
  nodeId: string
): Promise<NodePolicy[]> {
  return timelineRequest<NodePolicy[]>(`/nodes/${nodeId}/permissions`);
}

/**
 * Get permissions for multiple nodes in bulk
 * When permissions have subjectType='user', the response will include userInfo
 */
export async function getBulkNodePermissions(
  nodeIds: string[]
): Promise<BulkPermissionsResponse[]> {
  if (nodeIds.length === 0) {
    return [];
  }

  return timelineRequest<BulkPermissionsResponse[]>('/nodes/permissions/bulk', {
    method: 'POST',
    body: JSON.stringify({ nodeIds }),
  });
}

/**
 * Set permissions for nodes (supports bulk operations)
 */
export async function setNodePermissions(
  policies: NodePolicyCreateDTO[],
  nodeId?: string
): Promise<void> {
  const payload: SetNodePermissionsDTO = {
    policies: policies.map((policy) => ({
      ...policy,
      nodeId: policy.nodeId || nodeId, // Ensure nodeId is set for bulk operations
    })),
  };

  return timelineRequest<void>(`/nodes/${nodeId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Set permissions for multiple nodes (bulk operation)
 */
export async function setBulkNodePermissions(
  policies: NodePolicyCreateDTO[]
): Promise<void> {
  if (policies.length === 0) {
    return;
  }

  // Use the first node's ID as the endpoint (all policies must include nodeId)
  const firstNodeId = policies[0].nodeId;
  if (!firstNodeId) {
    throw new Error('All policies must include a nodeId for bulk operations');
  }

  const payload: SetNodePermissionsDTO = {
    policies,
  };

  return timelineRequest<void>(`/nodes/${firstNodeId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a specific permission policy (requires nodeId)
 */
export async function deleteNodePermissionById(
  nodeId: string,
  policyId: string
): Promise<void> {
  return timelineRequest<void>(`/nodes/${nodeId}/permissions/${policyId}`, {
    method: 'DELETE',
  });
}

/**
 * Delete a permission policy by ID only (for store usage)
 */
export async function deleteNodePermission(
  nodeId: string,
  policyId: string
): Promise<void> {
  return timelineRequest<void>(`/nodes/${nodeId}/permissions/${policyId}`, {
    method: 'DELETE',
  });
}

/**
 * Update a permission policy
 */
export async function updateNodePermission(
  policyId: string,
  updates: NodePolicyUpdateDTO
): Promise<void> {
  return timelineRequest<void>(`/permissions/${policyId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Update multiple policies in bulk for better performance
 */
export async function updateBulkNodePermissions(
  updates: Array<{ policyId: string; updates: NodePolicyUpdateDTO }>
): Promise<void> {
  return timelineRequest<void>('/permissions/bulk', {
    method: 'PUT',
    body: JSON.stringify({ updates }),
  });
}
