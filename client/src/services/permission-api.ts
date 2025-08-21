/**
 * Permission API Service
 * 
 * Handles communication with node permission endpoints
 */

import { NodePolicyCreateDTO, NodePolicy, SetNodePermissionsDTO, NodePolicyUpdateDTO } from '@shared/schema';

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

// HTTP client with error handling
async function httpClient<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/timeline${path}`;
  
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
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorData = JSON.parse(errorText) as ApiResponse;
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get permissions for a specific node
 */
export async function getNodePermissions(nodeId: string): Promise<NodePolicy[]> {
  const response = await httpClient<ApiResponse<NodePolicy[]>>(`/nodes/${nodeId}/permissions`);
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch node permissions');
  }

  return response.data || [];
}

/**
 * Get permissions for multiple nodes in bulk
 */
export async function getBulkNodePermissions(nodeIds: string[]): Promise<{ nodeId: string; policies: NodePolicy[] }[]> {
  if (nodeIds.length === 0) {
    return [];
  }

  const response = await httpClient<ApiResponse<{ nodeId: string; policies: NodePolicy[] }[]>>('/nodes/permissions/bulk', {
    method: 'POST',
    body: JSON.stringify({ nodeIds }),
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch bulk node permissions');
  }

  return response.data || [];
}

/**
 * Set permissions for nodes (supports bulk operations)
 */
export async function setNodePermissions(
  nodeId: string,
  policies: NodePolicyCreateDTO[]
): Promise<void> {
  const payload: SetNodePermissionsDTO = {
    policies: policies.map(policy => ({
      ...policy,
      nodeId: policy.nodeId || nodeId // Ensure nodeId is set for bulk operations
    }))
  };

  const response = await httpClient<ApiResponse>(`/nodes/${nodeId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to set node permissions');
  }
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
    policies
  };

  const response = await httpClient<ApiResponse>(`/nodes/${firstNodeId}/permissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to set bulk node permissions');
  }
}

/**
 * Delete a specific permission policy (requires nodeId)
 */
export async function deleteNodePermissionById(
  nodeId: string,
  policyId: string
): Promise<void> {
  const response = await httpClient<ApiResponse>(`/nodes/${nodeId}/permissions/${policyId}`, {
    method: 'DELETE',
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete node permission');
  }
}

/**
 * Delete a permission policy by ID only (for store usage)
 */
export async function deleteNodePermission(nodeId: string, policyId: string): Promise<void> {
  const response = await httpClient<ApiResponse>(`/nodes/${nodeId}/permissions/${policyId}`, {
    method: 'DELETE',
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete permission');
  }
}

/**
 * Update a permission policy
 */
export async function updateNodePermission(
  policyId: string, 
  updates: NodePolicyUpdateDTO
): Promise<void> {
  const response = await httpClient<ApiResponse>(`/permissions/${policyId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to update permission');
  }
}

/**
 * Update multiple policies in bulk for better performance
 */
export async function updateBulkNodePermissions(
  updates: Array<{ policyId: string; updates: NodePolicyUpdateDTO }>
): Promise<void> {
  const response = await httpClient<ApiResponse>('/permissions/bulk', {
    method: 'PUT',
    body: JSON.stringify({ updates }),
  });
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to update permissions');
  }
}
