/**
 * In-Memory HierarchyRepository Implementation
 * For integration testing without database dependencies
 */

import { TimelineNode, TimelineNodeType } from '@shared/schema';
import type {
  IHierarchyRepository,
  CreateNodeRequest,
  UpdateNodeRequest,
  BatchAuthorizationResult,
} from '../../repositories/interfaces/hierarchy.repository.interface';
import { NodeFilter } from '../../repositories/filters/node-filter';
import { randomUUID } from 'crypto';

export class InMemoryHierarchyRepository implements IHierarchyRepository {
  private nodes: Map<string, TimelineNode> = new Map();
  private logger: any;

  constructor({ logger }: { logger: any }) {
    this.logger = logger;
  }

  /**
   * Create a new node
   */
  async createNode(request: CreateNodeRequest): Promise<TimelineNode> {
    const node: TimelineNode = {
      id: randomUUID(),
      type: request.type as TimelineNodeType,
      parentId: request.parentId || null,
      userId: request.userId,
      meta: request.meta,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.nodes.set(node.id, node);

    this.logger.info('Node created in memory', {
      nodeId: node.id,
      userId: request.userId,
      type: request.type,
    });

    return node;
  }

  /**
   * Get node by ID
   */
  async getById(nodeId: string, userId: number): Promise<TimelineNode | null> {
    const node = this.nodes.get(nodeId);
    if (!node || node.userId !== userId) {
      return null;
    }
    return node;
  }

  /**
   * Update a node
   */
  async updateNode(request: UpdateNodeRequest): Promise<TimelineNode | null> {
    const existing = this.nodes.get(request.id);
    if (!existing || existing.userId !== request.userId) {
      return null;
    }

    const updated: TimelineNode = {
      ...existing,
      ...(request.meta && { meta: request.meta }),
      updatedAt: new Date(),
    };

    this.nodes.set(request.id, updated);
    return updated;
  }

  /**
   * Delete a node
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node || node.userId !== userId) {
      return false;
    }

    this.nodes.delete(nodeId);
    return true;
  }

  /**
   * Get all nodes based on filter criteria
   */
  async getAllNodes(filter: NodeFilter): Promise<TimelineNode[]> {
    const { currentUserId, targetUserId } = filter;

    if (currentUserId === targetUserId) {
      // Return all nodes for the user
      return Array.from(this.nodes.values()).filter(
        (node) => node.userId === targetUserId
      );
    }

    // For testing: simulate permission checks
    return Array.from(this.nodes.values()).filter((node) => {
      if (node.userId !== targetUserId) return false;

      // Check if current user has permission (simplified for testing)
      return (
        this.hasPermissionOnNode(currentUserId, node.id) ||
        (node.parentId &&
          this.hasPermissionOnNode(currentUserId, node.parentId))
      );
    });
  }

  /**
   * Check permissions for multiple nodes efficiently
   * In-memory implementation for testing
   */
  async checkBatchAuthorization(
    filter: NodeFilter
  ): Promise<BatchAuthorizationResult> {
    const { currentUserId, targetUserId, nodeIds } = filter;

    if (!nodeIds || nodeIds.length === 0) {
      return { authorized: [], unauthorized: [], notFound: [] };
    }

    const result: BatchAuthorizationResult = {
      authorized: [],
      unauthorized: [],
      notFound: [],
    };

    for (const nodeId of nodeIds) {
      const node = this.nodes.get(nodeId);

      if (!node || node.userId !== targetUserId) {
        result.notFound.push(nodeId);
        continue;
      }

      if (currentUserId === targetUserId) {
        // User can access their own nodes
        result.authorized.push(nodeId);
      } else {
        // Check permissions (simplified for testing)
        if (
          this.hasPermissionOnNode(currentUserId, nodeId) ||
          (node.parentId &&
            this.hasPermissionOnNode(currentUserId, node.parentId))
        ) {
          result.authorized.push(nodeId);
        } else {
          result.unauthorized.push(nodeId);
        }
      }
    }

    return result;
  }

  private hasPermissionOnNode(userId: number, nodeId: string): boolean {
    // Simplified permission check for testing
    // In real implementation, this would check policies collection
    // For now, return false to simulate no permissions (tests can override this behavior)
    return false;
  }
}
