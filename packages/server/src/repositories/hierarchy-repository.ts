import { timelineNodeClosure, timelineNodes } from '@journey/schema';
import * as schema from '@journey/schema';
import { nodeMetaSchema } from '@journey/schema';
import { randomUUID } from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger';
import { NodeFilter } from './filters/node-filter';
import type {
  BatchAuthorizationResult,
  CreateNodeRequest,
  IHierarchyRepository,
  UpdateNodeRequest,
} from './interfaces/hierarchy.repository.interface';
import { buildPermissionCTEForGetAllNodes } from './sql/permission-cte';

// Types inferred from shared schema
type TimelineNode = typeof timelineNodes.$inferSelect;
type InsertTimelineNode = typeof timelineNodes.$inferInsert;
type InsertTimelineNodeClosure = typeof timelineNodeClosure.$inferInsert;

export class HierarchyRepository implements IHierarchyRepository {
  private db: NodePgDatabase<typeof schema>;
  private logger: Logger;

  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
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
      userId: request.userId,
    });

    // Validate and parse metadata
    const meta = this.validateNodeMeta(request.type, request.meta);

    const insertData: InsertTimelineNode = {
      id: nodeId,
      type: request.type,
      parentId: request.parentId,
      meta,
      userId: request.userId,
    };

    // Use transaction to ensure both timeline_nodes and closure table are updated together
    return await this.db.transaction(async (tx) => {
      const results = await tx
        .insert(timelineNodes)
        .values(insertData)
        .returning();
      const created = (results as any[])[0] as any;

      // Update closure table
      if (created.parentId) {
        await this.insertNodeClosure(created.id, created.parentId);
      }

      this.logger.info('Node created successfully with closure table updated', {
        nodeId: created.id,
        userId: request.userId,
      });

      return created;
    });
  }

  /**
   * Get node by ID (user-scoped for security)
   */
  async getById(nodeId: string, userId: number): Promise<TimelineNode | null> {
    const [node] = await this.db
      .select()
      .from(timelineNodes)
      .where(
        and(eq(timelineNodes.id, nodeId), eq(timelineNodes.userId, userId))
      )
      .limit(1);

    return node || null;
  }

  /**
   * Update an existing node
   */
  async updateNode(request: UpdateNodeRequest): Promise<TimelineNode | null> {
    this.logger.debug('Updating node:', request);

    // First get the current node to check if parentId is changing
    const currentNode = await this.getById(request.id, request.userId);
    if (!currentNode) {
      this.logger.warn('Node not found for update', {
        id: request.id,
        userId: request.userId,
      });
      return null;
    }

    // Build update data object
    const updateData: Partial<InsertTimelineNode> = {
      updatedAt: new Date(),
    };

    // Only include meta if provided
    if (request.meta !== undefined) {
      updateData.meta = request.meta;
    }

    return await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(timelineNodes)
        .set(updateData)
        .where(
          and(
            eq(timelineNodes.id, request.id),
            eq(timelineNodes.userId, request.userId)
          )
        )
        .returning();

      if (!updated) {
        this.logger.warn('Node not found for update', {
          id: request.id,
          userId: request.userId,
        });
        return null;
      }

      return updated;
    });
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
        .where(
          and(eq(timelineNodes.id, nodeId), eq(timelineNodes.userId, userId))
        );

      const success = (deletedRows as any).rowCount! > 0;

      if (success) {
        // Update closure table by removing all entries for this node
        await this.deleteNodeClosure(nodeId);

        this.logger.info(
          'Node deleted successfully with closure table updated',
          {
            nodeId,
            userId,
          }
        );
      } else {
        this.logger.warn('Node not found for deletion', { nodeId, userId });
      }

      return success;
    });
  }

  /**
   * Get all nodes for a user (flat list)
   */
  async getAllNodes(filter: NodeFilter): Promise<TimelineNode[]> {
    const { currentUserId, targetUserId } = filter;

    // Case 1: User viewing their own nodes - return all
    if (currentUserId === targetUserId) {
      return await this.db
        .select()
        .from(timelineNodes)
        .where(eq(timelineNodes.userId, targetUserId))
        .orderBy(timelineNodes.createdAt);
    }

    // Case 2: User viewing another user's nodes - apply sophisticated permission evaluation
    // Uses shared CTE logic for consistent permission filtering

    const permissionQuery = sql`
      ${buildPermissionCTEForGetAllNodes(currentUserId, targetUserId, 'view')}
      SELECT
        tn.id,
        tn.user_id as "userId",
        tn.parent_id as "parentId",
        tn.type,
        tn.meta,
        tn.created_at as "createdAt",
        tn.updated_at as "updatedAt"
      FROM timeline_nodes tn
      JOIN authorized_nodes an ON an.node_id = tn.id
      WHERE tn.user_id = ${targetUserId}
      ORDER BY tn.created_at
    `;

    const result = await this.db.execute(permissionQuery);
    return result.rows as TimelineNode[];
  }

  /**
   * Check permissions for multiple nodes efficiently
   * Prevents N+1 query problems when loading lists
   */
  async checkBatchAuthorization(
    filter: NodeFilter
  ): Promise<BatchAuthorizationResult> {
    const { currentUserId, targetUserId, level, nodeIds } = filter;

    if (!nodeIds || nodeIds.length === 0) {
      return { authorized: [], unauthorized: [], notFound: [] };
    }

    this.logger.debug('Performing batch authorization check', {
      currentUserId,
      targetUserId,
      action: 'view', // Fixed action for simplified permission system
      level,
      nodeCount: nodeIds.length,
    });

    // Case 1: User checking their own nodes - all exist nodes are authorized
    if (currentUserId === targetUserId) {
      const existingNodes = await this.db
        .select({ id: timelineNodes.id })
        .from(timelineNodes)
        .where(
          and(
            sql`${timelineNodes.id} = ANY(${nodeIds})`,
            eq(timelineNodes.userId, targetUserId)
          )
        );

      const found = existingNodes.map((n) => n.id);
      const notFound = nodeIds.filter((id) => !found.includes(id));

      return {
        authorized: found,
        unauthorized: [],
        notFound,
      };
    }

    // Case 2: Batch permission check with sophisticated evaluation
    const batchQuery = sql`
      WITH input_nodes AS (
        SELECT unnest(${nodeIds}::uuid[]) as node_id
      ),
      existing_nodes AS (
        -- Check which nodes exist and belong to target user
        SELECT tn.id
        FROM timeline_nodes tn
        JOIN input_nodes inp ON inp.node_id = tn.id
        WHERE tn.user_id = ${targetUserId}
      ),
      subject_keys AS (
        -- Define subject identities in order of specificity (user > group > org > public)
        SELECT subject_type, subject_id, specificity FROM (VALUES
          ('user'::subject_type, ${currentUserId}::integer, 3),
          ('public'::subject_type, NULL::integer, 0)
        ) AS v(subject_type, subject_id, specificity)
      ),
      relevant_policies AS (
        -- Get all policies that could affect this user's access to the specified nodes
        SELECT
          np.id,
          np.node_id,
          np.level,
          np.action,
          np.subject_type,
          np.subject_id,
          np.effect,
          np.created_at,
          tnc.depth as distance,
          sk.specificity,
          tnc.descendant_id
        FROM node_policies np
        JOIN timeline_node_closure tnc ON tnc.ancestor_id = np.node_id
        JOIN input_nodes inp ON inp.node_id = tnc.descendant_id
        JOIN existing_nodes en ON en.id = tnc.descendant_id
        JOIN subject_keys sk ON sk.subject_type = np.subject_type
          AND (sk.subject_id = np.subject_id OR (sk.subject_id IS NULL AND np.subject_id IS NULL))
        WHERE np.action = 'view'::permission_action
          AND np.level = ${level}::visibility_level
          AND (np.expires_at IS NULL OR np.expires_at > NOW())
      ),
      ranked_policies AS (
        -- Apply precedence rules for each descendant node
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY descendant_id
            ORDER BY
              CASE effect WHEN 'DENY' THEN 0 ELSE 1 END, -- DENY first
              distance ASC,                                -- closer first
              specificity DESC,                           -- more specific first
              created_at DESC                             -- newer first
          ) as precedence_rank
        FROM relevant_policies
      ),
      effective_permissions AS (
        -- Get the winning policy for each node
        SELECT descendant_id as node_id, effect
        FROM ranked_policies
        WHERE precedence_rank = 1
      )
      SELECT
        inp.node_id::text,
        CASE
          WHEN en.id IS NULL THEN 'not_found'
          WHEN ep.effect = 'ALLOW' THEN 'authorized'
          ELSE 'unauthorized'
        END as status
      FROM input_nodes inp
      LEFT JOIN existing_nodes en ON en.id = inp.node_id
      LEFT JOIN effective_permissions ep ON ep.node_id = inp.node_id
    `;

    const results = (await this.db.execute(batchQuery)).rows as Array<{
      node_id: string;
      status: 'authorized' | 'unauthorized' | 'not_found';
    }>;

    const response: BatchAuthorizationResult = {
      authorized: [],
      unauthorized: [],
      notFound: [],
    };

    results.forEach((result) => {
      switch (result.status) {
        case 'authorized':
          response.authorized.push(result.node_id);
          break;
        case 'unauthorized':
          response.unauthorized.push(result.node_id);
          break;
        case 'not_found':
          response.notFound.push(result.node_id);
          break;
      }
    });

    this.logger.debug('Batch authorization results', {
      authorized: response.authorized.length,
      unauthorized: response.unauthorized.length,
      notFound: response.notFound.length,
    });

    return response;
  }

  /**
   * Validate node metadata against schema for the given node type
   */
  private validateNodeMeta(
    nodeType: string,
    meta: Record<string, unknown>
  ): Record<string, unknown> {
    try {
      // Validate using the centralized schema
      const validatedData = nodeMetaSchema.parse({ type: nodeType, meta });
      return validatedData.meta;
    } catch (error: any) {
      this.logger.error('Node metadata validation failed', {
        nodeType,
        meta,
        errors: this.formatZodErrors(error),
        originalError: error.message,
      });
      const validationError = new Error(
        `Invalid metadata for node type '${nodeType}': ${this.formatZodErrors(error)}`
      ) as Error & { nodeType: string };
      validationError.nodeType = nodeType;
      throw validationError;
    }
  }

  /**
   * Format Zod validation errors for logging
   */
  private formatZodErrors(error: any): string {
    if (error.errors) {
      return error.errors
        .map((e: any) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
    }
    return error.message;
  }

  // ============================================================================
  // CLOSURE TABLE METHODS
  // ============================================================================

  /**
   * Insert closure entries for a new node
   * This adds:
   * 1. Self-reference (depth 0)
   * 2. All ancestor relationships from parent
   */
  private async insertNodeClosure(
    nodeId: string,
    parentId: string
  ): Promise<void> {
    this.logger.debug('Inserting closure entries for node', {
      nodeId,
      parentId,
    });

    // 1. Insert self-reference (every node is its own ancestor at depth 0)
    const closureData: InsertTimelineNodeClosure = {
      ancestorId: nodeId,
      descendantId: nodeId,
      depth: 0,
    };
    await this.db.insert(timelineNodeClosure).values(closureData);

    // 2. If node has a parent, insert all ancestor relationships
    if (parentId) {
      // Get all ancestors of the parent and insert them as ancestors of this node
      // with depth incremented by 1
      const insertAncestorsQuery = sql`
        INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, ${nodeId}::uuid, depth + 1
        FROM timeline_node_closure
        WHERE descendant_id = ${parentId}::uuid
      `;

      await this.db.execute(insertAncestorsQuery);

      this.logger.debug('Inserted ancestor relationships for node', {
        nodeId,
        parentId,
      });
    }

    this.logger.debug('Closure entries inserted successfully', { nodeId });
  }

  /**
   * Remove all closure entries for a node and its subtree
   */
  private async deleteNodeClosure(nodeId: string): Promise<void> {
    this.logger.debug('Deleting closure entries for node', { nodeId });

    // Get all descendants of this node (including self)
    const descendantsQuery = sql`
      SELECT descendant_id
      FROM timeline_node_closure
      WHERE ancestor_id = ${nodeId}::uuid
    `;
    const descendants = (await this.db.execute(descendantsQuery))
      .rows as Array<{
      descendant_id: string;
    }>;

    const descendantIds = descendants.map((d) => d.descendant_id);

    // Delete all closure entries where any of these nodes are involved
    if (descendantIds.length > 0) {
      const deleteQuery = sql`
        DELETE FROM timeline_node_closure
        WHERE descendant_id = ANY(${descendantIds})
           OR ancestor_id = ANY(${descendantIds})
      `;
      await this.db.execute(deleteQuery);

      this.logger.debug('Deleted closure entries for subtree', {
        nodeId,
        descendantCount: descendantIds.length,
      });
    }

    this.logger.debug('Closure entries deleted successfully', { nodeId });
  }
}
