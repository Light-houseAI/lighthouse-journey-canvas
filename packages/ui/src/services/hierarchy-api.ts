/**
 * Simplified Hierarchy API Service
 *
 * Handles communication with the v2 timeline API and provides client-side
 * hierarchy building logic. Uses shared Zod schemas for type safety.
 */

import {
  ApplicationMaterials,
  CreateTimelineNodeDTO,
  EditHistoryEntry,
  ResumeEntry,
  ResumeVersion,
  TimelineNode,
  TimelineNodeWithPermissions,
  UpdateTimelineNodeDTO,
} from '@journey/schema';

import { httpClient } from './http-client';

// API payload interfaces - use shared schema types
export type CreateNodePayload = CreateTimelineNodeDTO;
export type UpdateNodePayload = UpdateTimelineNodeDTO;

// Helper function to make API requests to timeline endpoints
async function timelineRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
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
  async listUserNodesWithPermissions(
    username: string
  ): Promise<TimelineNodeWithPermissions[]> {
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

  /**
   * Application Materials Methods
   */

  /**
   * Update application materials for a career transition node
   * Uses hierarchyApi to patch the node's meta.applicationMaterials field
   */
  async updateApplicationMaterials(
    nodeId: string,
    materials: ApplicationMaterials
  ): Promise<ApplicationMaterials> {
    const updated = await this.updateNode(nodeId, {
      meta: {
        applicationMaterials: materials,
      },
    });

    return updated.meta.applicationMaterials as ApplicationMaterials;
  }

  /**
   * Get application materials for a career transition node
   */
  async getApplicationMaterials(
    nodeId: string
  ): Promise<ApplicationMaterials | undefined> {
    const node = await this.getNode(nodeId);
    return node.meta.applicationMaterials as ApplicationMaterials | undefined;
  }

  /**
   * Update a single resume entry
   * Convenience method that merges the update with existing materials
   */
  async updateResumeEntry(
    nodeId: string,
    resumeType: string,
    resumeVersion: ResumeVersion
  ): Promise<ApplicationMaterials> {
    const existing = await this.getApplicationMaterials(nodeId);

    const items = existing?.items || [];
    const existingIndex = items.findIndex((r) => r.type === resumeType);

    const newResumeEntry: ResumeEntry = {
      type: resumeType,
      resumeVersion,
    };

    const updatedItems =
      existingIndex >= 0
        ? items.map((item, idx) =>
            idx === existingIndex ? newResumeEntry : item
          )
        : [...items, newResumeEntry];

    const updatedMaterials: ApplicationMaterials = {
      items: updatedItems,
      summary: existing?.summary,
    };

    return this.updateApplicationMaterials(nodeId, updatedMaterials);
  }

  /**
   * Remove a resume entry by type
   */
  async removeResumeEntry(
    nodeId: string,
    resumeType: string
  ): Promise<ApplicationMaterials> {
    const existing = await this.getApplicationMaterials(nodeId);

    if (!existing?.items) {
      throw new Error('No resume entries found');
    }

    const updatedItems = existing.items.filter((r) => r.type !== resumeType);

    const updatedMaterials: ApplicationMaterials = {
      items: updatedItems,
      summary: existing.summary,
    };

    return this.updateApplicationMaterials(nodeId, updatedMaterials);
  }

  /**
   * Generate LLM summary for a resume type
   * TODO: Implement when LLM service integration is ready
   */

  async generateResumeSummary(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _nodeId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resumeType: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _editHistory: EditHistoryEntry[]
  ): Promise<string> {
    // Placeholder - will be implemented in Phase 2
    throw new Error('LLM summary generation not yet implemented');
  }

  /**
   * Generate LLM summary for the entire resumes section
   * TODO: Implement when LLM service integration is ready
   */

  async generateResumeSectionSummary(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _nodeId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resumeItems: ResumeEntry[]
  ): Promise<string> {
    // Placeholder - will be implemented in Phase 2
    throw new Error('LLM summary generation not yet implemented');
  }

  /**
   * Generate LLM summary for LinkedIn profile
   * TODO: Implement when LLM service integration is ready
   */

  async generateLinkedInSummary(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _nodeId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _editHistory: EditHistoryEntry[]
  ): Promise<string> {
    // Placeholder - will be implemented in Phase 2
    throw new Error('LLM summary generation not yet implemented');
  }
}

// Query keys for React Query cache management
export const applicationMaterialsKeys = {
  materials: (nodeId: string) => ['applicationMaterials', nodeId] as const,
  resumeSummary: (nodeId: string, resumeType: string) =>
    ['resumeSummary', nodeId, resumeType] as const,
  resumesSection: (nodeId: string) => ['resumesSection', nodeId] as const,
  linkedInSummary: (nodeId: string) => ['linkedInSummary', nodeId] as const,
};

// Export singleton instance
export const hierarchyApi = new HierarchyApiService();
export default hierarchyApi;
