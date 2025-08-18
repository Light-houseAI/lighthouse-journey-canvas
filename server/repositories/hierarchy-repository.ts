import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { timelineNodes, nodeMetaSchema } from '../../shared/schema';
import type { Logger } from '../core/logger';
import type { IHierarchyRepository, CreateNodeRequest, UpdateNodeRequest } from './interfaces/hierarchy.repository.interface';

// Types inferred from shared schema
type TimelineNode = typeof timelineNodes.$inferSelect;
type InsertTimelineNode = typeof timelineNodes.$inferInsert;

export class HierarchyRepository implements IHierarchyRepository {
  private db: NodePgDatabase<any>;
  private logger: Logger;

  constructor({ database, logger }: {
    database: NodePgDatabase<any>;
    logger: Logger;
  }) {
    this.db = database;
    this.logger = logger;
  }

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

    // Validate and parse metadata
    const meta = this.validateNodeMeta(request.type, request.meta);

    const insertData: InsertTimelineNode = {
      id: nodeId,
      type: request.type,
      parentId: request.parentId,
      meta,
      userId: request.userId
    };

    const [created] = await this.db
      .insert(timelineNodes)
      .values(insertData)
      .returning();

    this.logger.info('Node created successfully', { nodeId: created.id, userId: request.userId });
    return created;
  }

  /**
   * Get node by ID (user-scoped for security)
   */
  async getById(nodeId: string, userId: number): Promise<TimelineNode | null> {
    const [node] = await this.db
      .select()
      .from(timelineNodes)
      .where(and(eq(timelineNodes.id, nodeId), eq(timelineNodes.userId, userId)))
      .limit(1);

    return node || null;
  }

  /**
   * Update an existing node
   */
  async updateNode(request: UpdateNodeRequest): Promise<TimelineNode | null> {
    this.logger.debug('Updating node:', request);

    // Build update data object
    const updateData: Partial<InsertTimelineNode> = {
      updatedAt: new Date()
    };

    // Only include meta if provided
    if (request.meta !== undefined) {
      updateData.meta = request.meta;
    }

    const [updated] = await this.db
      .update(timelineNodes)
      .set(updateData)
      .where(and(eq(timelineNodes.id, request.id), eq(timelineNodes.userId, request.userId)))
      .returning();

    if (!updated) {
      this.logger.warn('Node not found for update', { id: request.id, userId: request.userId });
      return null;
    }

    this.logger.info('Node updated successfully', { nodeId: updated.id, userId: request.userId });
    return updated;
  }

  /**
   * Delete a node by ID (user-scoped for security)
   * Also orphans children by setting their parentId to null
   */
  async deleteNode(nodeId: string, userId: number): Promise<boolean> {
    this.logger.debug('Deleting node:', { nodeId, userId });

    // Start transaction for cascading operations
    return await this.db.transaction(async (tx) => {
      // First, orphan all children of this node
      await tx
        .update(timelineNodes)
        .set({ parentId: null, updatedAt: new Date() })
        .where(eq(timelineNodes.parentId, nodeId));

      // Then delete the node itself
      const deletedRows = await tx
        .delete(timelineNodes)
        .where(and(eq(timelineNodes.id, nodeId), eq(timelineNodes.userId, userId)));

      const success = deletedRows.rowCount > 0;
      
      if (success) {
        this.logger.info('Node deleted successfully', { nodeId, userId });
      } else {
        this.logger.warn('Node not found for deletion', { nodeId, userId });
      }

      return success;
    });
  }

  /**
   * Get all nodes for a user (flat list)
   */
  async getAllNodes(userId: number): Promise<TimelineNode[]> {
    return await this.db
      .select()
      .from(timelineNodes)
      .where(eq(timelineNodes.userId, userId))
      .orderBy(timelineNodes.createdAt);
  }

  /**
   * Validate node metadata against schema for the given node type
   */
  private validateNodeMeta(nodeType: string, meta: Record<string, unknown>): Record<string, unknown> {
    try {
      // Validate using the centralized schema
      const validatedData = nodeMetaSchema.parse({ type: nodeType, meta });
      return validatedData.meta;
    } catch (error: any) {
      this.logger.error('Node metadata validation failed', {
        nodeType,
        meta,
        errors: this.formatZodErrors(error)
      });
      throw new Error(`Invalid metadata for node type '${nodeType}': ${this.formatZodErrors(error)}`);
    }
  }

  /**
   * Format Zod validation errors for logging
   */
  private formatZodErrors(error: any): string {
    if (error.errors) {
      return error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    }
    return error.message;
  }
}
