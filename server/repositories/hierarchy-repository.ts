import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { timelineNodes, nodeMetaSchema } from '../../shared/schema';
import type { Logger } from '../core/logger';

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


export interface HierarchyQueryOptions {
  userId: number;
  includeChildren?: boolean;
  maxDepth?: number;
}

export class HierarchyRepository {
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

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      this.logger.info('Node deleted successfully', { nodeId, userId });
    }

    return deleted;
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
   * Validate node metadata against type-specific schema
   */
  private validateNodeMeta(data: { type: string; meta: Record<string, unknown> }): Record<string, unknown> {
    try {
      const validationResult = nodeMetaSchema.parse(data);
      return validationResult.meta;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = this.formatZodErrors(error);
        this.logger.warn('Node metadata validation failed', { 
          type: data.type, 
          errors: formattedErrors 
        });
        
        throw new Error(`Validation failed: ${formattedErrors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Format Zod validation errors into consistent structure
   */
  private formatZodErrors(error: z.ZodError): Array<{ path: string[]; message: string; code: string }> {
    return error.issues.map((issue) => ({
      path: issue.path.map((p) => String(p)),
      message: issue.message,
      code: issue.code
    }));
  }
}
