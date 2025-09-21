/**
 * Simplified Hierarchy API Service
 *
 * Handles communication with the v2 timeline API and provides client-side
 * hierarchy building logic. Uses shared Zod schemas for type safety.
 */

import {
  CreateTimelineNodeDTO,
  TimelineNode,
  TimelineNodeWithPermissions,
  UpdateTimelineNodeDTO,
} from '@journey/schema';

import { httpClient } from './http-client';

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

// Helper function to make API requests to timeline endpoints
async function timelineRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `/api/v2/timeline${path}`;
  return httpClient.request<T>(url, init);
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
    return timelineRequest<TimelineNode>('/nodes', {
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
    return timelineRequest<TimelineNode>(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<void> {
    return timelineRequest<void>(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get all nodes for the current user
   */
  async listNodes(): Promise<TimelineNode[]> {
    return timelineRequest<TimelineNode[]>('/nodes');
  }

  /**
   * Get all visible nodes for a specific user by username
   * Applies permission filtering on the backend
   */
  async listUserNodes(username: string): Promise<TimelineNode[]> {
    return timelineRequest<TimelineNode[]>(
      `/nodes?username=${encodeURIComponent(username)}`
    );
  }

  /**
   * Get all nodes for the current user with permissions (server-driven permissions)
   */
  async listNodesWithPermissions(): Promise<TimelineNodeWithPermissions[]> {
    return timelineRequest<TimelineNodeWithPermissions[]>('/nodes');
  }

  /**
   * Get all visible nodes for a specific user by username with permissions
   * Applies permission filtering on the backend and includes permission metadata
   */
  async listUserNodesWithPermissions(username: string): Promise<TimelineNodeWithPermissions[]> {
    return timelineRequest<TimelineNodeWithPermissions[]>(
      `/nodes?username=${encodeURIComponent(username)}`
    );
  }

  /**
   * Get a single node by ID
   */
  async getNode(id: string): Promise<TimelineNode> {
    return timelineRequest<TimelineNode>(`/nodes/${id}`);
  }
}

// Export singleton instance
export const hierarchyApi = new HierarchyApiService();
export default hierarchyApi;
