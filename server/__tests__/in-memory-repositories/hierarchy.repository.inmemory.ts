/**
 * In-Memory HierarchyRepository Implementation
 * For integration testing without database dependencies
 */

import { TimelineNode, TimelineNodeType } from '@shared/schema';
import type { IHierarchyRepository, CreateNodeRequest, UpdateNodeRequest } from '../../repositories/interfaces/hierarchy.repository.interface';
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
      updatedAt: new Date()
    };

    this.nodes.set(node.id, node);
    
    this.logger.info('Node created in memory', {
      nodeId: node.id,
      userId: request.userId,
      type: request.type
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
      updatedAt: new Date()
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
   * Get all nodes for a user
   */
  async getAllNodes(userId: number): Promise<TimelineNode[]> {
    return Array.from(this.nodes.values()).filter(node => node.userId === userId);
  }
}
