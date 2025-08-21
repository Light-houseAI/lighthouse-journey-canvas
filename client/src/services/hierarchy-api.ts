/**
 * Simplified Hierarchy API Service
 *
 * Handles communication with the v2 timeline API and provides client-side
 * hierarchy building logic. Uses shared Zod schemas for type safety.
 */

import {
  TimelineNode,
  CreateTimelineNodeDTO,
  UpdateTimelineNodeDTO,
  TimelineNodeWithPermissions,
} from '@shared/schema';

// API payload interfaces - use shared schema types
export type CreateNodePayload = CreateTimelineNodeDTO;
export type UpdateNodePayload = UpdateTimelineNodeDTO;

// API response wrapper
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
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

  const response = await fetch(url, {
    headers,
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}`;

    try {
      const errorData = JSON.parse(errorText) as ApiResponse;
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  const result = (await response.json()) as ApiResponse<T>;

  if (!result.success) {
    throw new Error(result.error?.message || 'API request failed');
  }

  return result.data!;
}

/**
 * Simplified Hierarchy API Service
 *
 * Provides essential CRUD operations and client-side hierarchy building.
 * All complex tree operations are handled client-side for better performance
 * and reduced server complexity.
 */
export class HierarchyApiService {
  /**
   * Create a new node
   */
  async createNode(payload: CreateNodePayload): Promise<TimelineNode> {
    return httpClient<TimelineNode>('/nodes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update an existing node
   */
  async updateNode(
    id: string,
    patch: UpdateNodePayload
  ): Promise<TimelineNode> {
    return httpClient<TimelineNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<void> {
    return httpClient<void>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all nodes for the current user
   */
  async listNodes(): Promise<TimelineNode[]> {
    return httpClient<TimelineNode[]>('/nodes');
  }

  /**
   * Get all visible nodes for a specific user by username
   * Applies permission filtering on the backend
   */
  async listUserNodes(username: string): Promise<TimelineNode[]> {
    return httpClient<TimelineNode[]>(
      `/nodes?username=${encodeURIComponent(username)}`
    );
  }

  /**
   * Get all nodes for the current user with permissions (server-driven permissions)
   */
  async listNodesWithPermissions(): Promise<TimelineNodeWithPermissions[]> {
    return httpClient<TimelineNodeWithPermissions[]>('/nodes');
  }

  /**
   * Get all visible nodes for a specific user by username with permissions
   * Applies permission filtering on the backend and includes permission metadata
   */
  async listUserNodesWithPermissions(username: string): Promise<TimelineNodeWithPermissions[]> {
    return httpClient<TimelineNodeWithPermissions[]>(
      `/nodes?username=${encodeURIComponent(username)}`
    );
  }

  /**
   * Get a single node by ID
   */
  async getNode(id: string): Promise<TimelineNode> {
    return httpClient<TimelineNode>(`/nodes/${id}`);
  }
}

// Export singleton instance
export const hierarchyApi = new HierarchyApiService();
export default hierarchyApi;
