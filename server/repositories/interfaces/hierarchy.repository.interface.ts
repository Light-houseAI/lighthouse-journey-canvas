/**
 * HierarchyRepository Interface
 * Contract for timeline node database operations
 */

import type { TimelineNode } from '@shared/schema';

export interface CreateNodeRequest {
  type: string;
  parentId?: string | null;
  meta: Record<string, unknown>;
  userId: number;
}

export interface UpdateNodeRequest {
  id: string;
  meta?: Record<string, unknown>;
  userId: number;
}

export interface IHierarchyRepository {
  /**
   * Create a new timeline node with hierarchy validation
   */
  createNode(request: CreateNodeRequest): Promise<TimelineNode>;

  /**
   * Get node by ID (user-scoped)
   */
  getById(nodeId: string, userId: number): Promise<TimelineNode | null>;

  /**
   * Update an existing node
   */
  updateNode(request: UpdateNodeRequest): Promise<TimelineNode | null>;

  /**
   * Delete a node by ID (user-scoped)
   */
  deleteNode(nodeId: string, userId: number): Promise<boolean>;

  /**
   * Get all nodes for a user
   */
  getAllNodes(userId: number): Promise<TimelineNode[]>;
}