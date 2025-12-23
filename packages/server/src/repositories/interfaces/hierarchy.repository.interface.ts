/**
 * HierarchyRepository Interface
 * Contract for timeline node database operations
 */

import type { TimelineNode } from '@journey/schema';

import { NodeFilter } from '../filters/node-filter.js';

export interface CreateNodeRequest {
  type: string;
  parentId?: string | null;
  meta: Record<string, unknown>;
  userId: number;
}

export interface UpdateNodeRequest {
  id: string;
  meta?: Record<string, unknown>;
  parentId?: string | null;
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
   * Get all nodes based on filter criteria
   */
  getAllNodes(filter: NodeFilter): Promise<TimelineNode[]>;

  /**
   * Get nodes by type for a user (for session classification)
   */
  getNodesByType(userId: number, nodeType: string): Promise<TimelineNode[]>;

  /**
   * Check permissions for multiple nodes efficiently
   * Prevents N+1 query problems when loading lists
   */
  checkBatchAuthorization(
    filter: NodeFilter
  ): Promise<BatchAuthorizationResult>;
}

/**
 * Batch authorization result for efficient permission checking
 */
export interface BatchAuthorizationResult {
  authorized: string[]; // Node IDs the user has permission for
  unauthorized: string[]; // Node IDs the user lacks permission for
  notFound: string[]; // Node IDs that don't exist
}
