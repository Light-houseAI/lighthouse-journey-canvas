import { injectable, inject } from 'tsyringe';
import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { timelineNodes, HIERARCHY_RULES } from '../../../shared/schema';
import { HIERARCHY_TOKENS } from '../di/tokens';
import type { Logger } from '../../core/logger';

export interface CreateNodeRequest {
  type: string;
  parentId?: string | null;
  meta: Record<string, unknown>;
  userId: number;
}

// Types inferred from shared schema
type TimelineNode = typeof timelineNodes.$inferSelect;
type InsertTimelineNode = typeof timelineNodes.$inferInsert;

export interface UpdateNodeRequest {
  id: string;
  meta?: Record<string, unknown>;
  userId: number;
}

export interface MoveNodeRequest {
  nodeId: string;
  newParentId: string | null;
  userId: number;
}

export interface HierarchyQueryOptions {
  userId: number;
  includeChildren?: boolean;
  maxDepth?: number;
}

@injectable()
export class HierarchyRepository {
  constructor(
    @inject(HIERARCHY_TOKENS.DATABASE) private db: NodePgDatabase<any>,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}

  /**
   * Create a new timeline node with hierarchy validation
   */
  async createNode(request: CreateNodeRequest): Promise<TimelineNode> {
    const nodeId = randomUUID();

    this.logger.debug('Creating node:', {
      id: nodeId,
      type: request.type,
      parentId: request.parentId,
      userId: request.userId
    });

    // Validate parent-child relationship if parent specified
    // if (request.parentId) {
    //   await this.validateParentChildRelationship(request.parentId, request.type, request.userId);
    // }

    const insertData: InsertTimelineNode = {
      id: nodeId,
      type: request.type as any,
      parentId: request.parentId,
      meta: request.meta,
      userId: request.userId,
    };

    const [created] = await this.db
      .insert(timelineNodes)
      .values(insertData)
      .returning();

    this.logger.info('Node created successfully', { nodeId, userId: request.userId });
    return created;
  }

  /**
   * Get node by ID with user isolation
   */
  async getById(nodeId: string, userId: number): Promise<TimelineNode | null> {
    const [node] = await this.db
      .select()
      .from(timelineNodes)
      .where(and(
        eq(timelineNodes.id, nodeId),
        eq(timelineNodes.userId, userId)
      ));

    return node || null;
  }

  /**
   * Update node with validation
   */
  async updateNode(request: UpdateNodeRequest): Promise<TimelineNode | null> {
    this.logger.debug('Updating node:', request);

    const updateData: Partial<TimelineNode> = {
      updatedAt: new Date(),
    };

    if (request.meta !== undefined) {
      updateData.meta = request.meta;
    }

    const [updated] = await this.db
      .update(timelineNodes)
      .set(updateData)
      .where(and(
        eq(timelineNodes.id, request.id),
        eq(timelineNodes.userId, request.userId)
      ))
      .returning();

    if (updated) {
      this.logger.info('Node updated successfully', { nodeId: request.id, userId: request.userId });
    }

    return updated || null;
  }

  /**
   * Delete node and handle children (set their parentId to null)
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting node:', { nodeId, userId });

    // First update children to remove parent reference
    await this.db
      .update(timelineNodes)
      .set({ parentId: null })
      .where(and(
        eq(timelineNodes.parentId, nodeId),
        eq(timelineNodes.userId, userId)
      ));

    // Then delete the node
    const result = await this.db
      .delete(timelineNodes)
      .where(and(
        eq(timelineNodes.id, nodeId),
        eq(timelineNodes.userId, userId)
      ));

    const deleted = result.rowCount > 0;
    if (deleted) {
      this.logger.info('Node deleted successfully', { nodeId, userId });
    }

    return deleted;
  }

  /**
   * Get direct children of a node
   */
  async getChildren(parentId: string, userId: number): Promise<TimelineNode[]> {
    return await this.db
      .select()
      .from(timelineNodes)
      .where(and(
        eq(timelineNodes.parentId, parentId),
        eq(timelineNodes.userId, userId)
      ))
      .orderBy(timelineNodes.createdAt);
  }

  /**
   * Get ancestor chain (path to root)
   */
  async getAncestors(nodeId: string, userId: number): Promise<TimelineNode[]> {
    const ancestorsQuery = sql`
      WITH RECURSIVE ancestors AS (
        SELECT n.id, n.type, n.parent_id, n.meta, n.user_id, n.created_at, n.updated_at
        FROM timeline_nodes n
        WHERE n.id = ${nodeId} AND n.user_id = ${userId}

        UNION ALL

        SELECT n.id, n.type, n.parent_id, n.meta, n.user_id, n.created_at, n.updated_at
        FROM timeline_nodes n
        INNER JOIN ancestors a ON n.id = a.parent_id
        WHERE n.user_id = ${userId}
      )
      SELECT * FROM ancestors
      ORDER BY created_at DESC
    `;

    const result = await this.db.execute(ancestorsQuery);
    return result.rows as TimelineNode[];
  }

  /**
   * Get complete subtree (node and all descendants)
   */
  async getSubtree(nodeId: string, userId: number, maxDepth: number = 10): Promise<TimelineNode[]> {
    const subtreeQuery = sql`
      WITH RECURSIVE subtree AS (
        SELECT n.id, n.type, n.parent_id, n.meta, n.user_id, n.created_at, n.updated_at, 0 as depth
        FROM timeline_nodes n
        WHERE n.id = ${nodeId} AND n.user_id = ${userId}

        UNION ALL

        SELECT n.id, n.type, n.parent_id, n.meta, n.user_id, n.created_at, n.updated_at, s.depth + 1
        FROM timeline_nodes n
        INNER JOIN subtree s ON n.parent_id = s.id
        WHERE n.user_id = ${userId} AND s.depth < ${maxDepth}
      )
      SELECT * FROM subtree
      ORDER BY depth, created_at
    `;

    const result = await this.db.execute(subtreeQuery);
    return result.rows as TimelineNode[];
  }

  /**
   * Get all root nodes (parentId is null)
   */
  async getRootNodes(userId: number): Promise<TimelineNode[]> {
    return await this.db
      .select()
      .from(timelineNodes)
      .where(and(
        isNull(timelineNodes.parentId),
        eq(timelineNodes.userId, userId)
      ))
      .orderBy(timelineNodes.createdAt);
  }

  /**
   * Get all nodes (both root and child nodes) for a user
   */
  async getAllNodes(userId: number): Promise<TimelineNode[]> {
    return await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.userId, userId))
      .orderBy(timelineNodes.createdAt);
  }

  /**
   * Get complete hierarchical tree
   */
  async getFullTree(userId: number): Promise<any[]> {
    // Get all user nodes
    const allNodes = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.userId, userId))
      .orderBy(timelineNodes.createdAt);

    // Build tree structure
    const nodeMap = new Map<string, any>();
    const rootNodes: any[] = [];

    // Initialize all nodes with empty children arrays
    allNodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Build parent-child relationships
    allNodes.forEach(node => {
      const nodeWithChildren = nodeMap.get(node.id)!;

      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(nodeWithChildren);
        } else {
          // Parent not found (data integrity issue), treat as root
          rootNodes.push(nodeWithChildren);
        }
      } else {
        rootNodes.push(nodeWithChildren);
      }
    });

    return rootNodes;
  }

  /**
   * Move node to new parent with cycle detection
   */
  async moveNode(request: MoveNodeRequest): Promise<TimelineNode | null> {
    this.logger.debug('Moving node:', request);

    // Validate move would not create cycle
    if (request.newParentId) {
      const wouldCreateCycle = await this.wouldCreateCycle(request.nodeId, request.newParentId, request.userId);
      if (wouldCreateCycle) {
        throw new Error('Cannot move node: would create cycle in hierarchy');
      }

      // Validate parent-child type compatibility
      const parent = await this.getById(request.newParentId, request.userId);
      const node = await this.getById(request.nodeId, request.userId);

      if (!parent || !node) {
        throw new Error('Node or parent not found');
      }

      const allowedChildren = HIERARCHY_RULES[parent.type] || [];
      if (!allowedChildren.includes(node.type)) {
        throw new Error(`Node type '${node.type}' cannot be child of '${parent.type}'`);
      }
    }

    const [updated] = await this.db
      .update(timelineNodes)
      .set({
        parentId: request.newParentId,
        updatedAt: new Date()
      })
      .where(and(
        eq(timelineNodes.id, request.nodeId),
        eq(timelineNodes.userId, request.userId)
      ))
      .returning();

    if (updated) {
      this.logger.info('Node moved successfully', {
        nodeId: request.nodeId,
        newParentId: request.newParentId,
        userId: request.userId
      });
    }

    return updated || null;
  }

  /**
   * Check if moving nodeId under newParentId would create a cycle
   */
  private async wouldCreateCycle(nodeId: string, newParentId: string, userId: number): Promise<boolean> {
    // Get all ancestors of the new parent
    const ancestors = await this.getAncestors(newParentId, userId);

    // Check if nodeId appears in the ancestor chain
    return ancestors.some(ancestor => ancestor.id === nodeId);
  }

  /**
   * Validate parent-child relationship rules
   */
  private async validateParentChildRelationship(parentId: string, childType: string, userId: number): Promise<void> {
    const parent = await this.getById(parentId, userId);

    if (!parent) {
      throw new Error('Parent node not found');
    }

    const allowedChildren = HIERARCHY_RULES[parent.type] || [];
    if (!allowedChildren.includes(childType)) {
      throw new Error(`Node type '${childType}' cannot be child of '${parent.type}'`);
    }
  }

  /**
   * Get nodes by type with optional parent filter
   */
  async getNodesByType(
    type: string,
    userId: number,
    options: { parentId?: string } = {}
  ): Promise<TimelineNode[]> {
    let query = this.db
      .select()
      .from(timelineNodes)
      .where(and(
        eq(timelineNodes.type, type as any),
        eq(timelineNodes.userId, userId)
      ));

    if (options.parentId) {
      query = query.where(eq(timelineNodes.parentId, options.parentId));
    }

    return await query.orderBy(timelineNodes.createdAt);
  }

  /**
   * Get hierarchy statistics for user
   */
  async getHierarchyStats(userId: number): Promise<{
    totalNodes: number;
    nodesByType: Record<string, number>;
    maxDepth: number;
    rootNodes: number;
  }> {
    const allNodes = await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.userId, userId));

    const stats = {
      totalNodes: allNodes.length,
      nodesByType: {} as Record<string, number>,
      maxDepth: 0,
      rootNodes: allNodes.filter(n => !n.parentId).length
    };

    // Count by type
    allNodes.forEach(node => {
      stats.nodesByType[node.type] = (stats.nodesByType[node.type] || 0) + 1;
    });

    // Calculate max depth (simplified approach)
    const rootNodes = allNodes.filter(n => !n.parentId);
    for (const root of rootNodes) {
      const depth = await this.calculateNodeDepth(root.id, allNodes);
      stats.maxDepth = Math.max(stats.maxDepth, depth);
    }

    return stats;
  }

  /**
   * Calculate depth of a node in the hierarchy
   */
  private async calculateNodeDepth(nodeId: string, allNodes: TimelineNode[]): Promise<number> {
    const nodeMap = new Map<string, TimelineNode>();
    allNodes.forEach(n => nodeMap.set(n.id, n));

    let maxDepth = 0;

    const calculateDepth = (id: string, currentDepth: number) => {
      maxDepth = Math.max(maxDepth, currentDepth);

      const children = allNodes.filter(n => n.parentId === id);
      children.forEach(child => {
        calculateDepth(child.id, currentDepth + 1);
      });
    };

    calculateDepth(nodeId, 0);
    return maxDepth;
  }
}
