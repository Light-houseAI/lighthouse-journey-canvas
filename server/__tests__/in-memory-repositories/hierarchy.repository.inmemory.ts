/**
 * In-Memory HierarchyRepository Implementation
 * For integration testing without database dependencies
 */

import { TimelineNode, TimelineNodeType } from '@shared/schema';
import type { CreateNodeRequest, UpdateNodeRequest } from '../../repositories/hierarchy-repository';

export class InMemoryHierarchyRepository {
  private nodes: Map<string, TimelineNode> = new Map();
  private logger: any;
  private nextId: number = 1;

  constructor({ logger }: { logger: any }) {
    this.logger = logger;
  }

  /**
   * Clear all test data - not part of interface
   */
  clearAll(): void {
    this.nodes.clear();
    this.nextId = 1;
  }

  /**
   * Create a new node
   */
  async createNode(request: CreateNodeRequest): Promise<TimelineNode> {
    const nodeId = this.generateNodeId();
    
    const node: TimelineNode = {
      id: nodeId,
      type: request.type as TimelineNodeType,
      parentId: request.parentId || null,
      userId: request.userId,
      meta: request.meta,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.nodes.set(nodeId, node);
    
    this.logger.info('Node created in memory', {
      nodeId,
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
  async updateNode(nodeId: string, request: UpdateNodeRequest, userId: number): Promise<TimelineNode | null> {
    const existing = this.nodes.get(nodeId);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const updated: TimelineNode = {
      ...existing,
      ...request,
      updatedAt: new Date()
    };

    this.nodes.set(nodeId, updated);
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

  /**
   * Generate a unique node ID in UUID format
   */
  private generateNodeId(): string {
    // Generate a proper UUID v4 format for testing
    const id = this.nextId++;
    return `123e4567-e89b-12d3-a456-42661417${id.toString().padStart(4, '0')}`;
  }
}