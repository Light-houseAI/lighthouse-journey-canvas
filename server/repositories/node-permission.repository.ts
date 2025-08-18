/**
 * NodePermissionRepository
 * Database access layer for node permissions and policies
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger';
import { 
  nodePolicies,
  timelineNodes,
  NodePolicy,
  NodePolicyCreateDTO,
  VisibilityLevel,
  PermissionAction
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export class NodePermissionRepository {
  constructor({ database, logger }: { database: NodePgDatabase<any>; logger: Logger }) {
    this.database = database;
    this.logger = logger;
  }

  private readonly database: NodePgDatabase<any>;
  private readonly logger: Logger;

  /**
   * Check if a user can access a node at a specific level using PostgreSQL function
   * Leverages database function for optimal performance
   */
  async canAccess(
    userId: number | null,
    nodeId: string,
    action: PermissionAction = PermissionAction.View,
    level: VisibilityLevel = VisibilityLevel.Overview
  ): Promise<boolean> {
    try {
      this.validateNodeId(nodeId);
      this.validateUserId(userId);

      const startTime = Date.now();

      const result = await this.database.execute(
        sql`SELECT can_access_node(${userId}, ${nodeId}::uuid, ${action}::permission_action, ${level}::visibility_level) as can_access`
      );

      const duration = Date.now() - startTime;

      if (duration > 50) { // Log slow queries
        this.logger.warn('Slow permission check detected', {
          userId,
          nodeId,
          action,
          level,
          duration
        });
      }

      const canAccess = result.rows[0]?.can_access || false;

      if (!canAccess && userId) {
        this.logger.warn('Access denied', {
          userId,
          nodeId,
          action,
          level
        });
      }

      return canAccess;
    } catch (error) {
      this.logger.error('Error checking node access', {
        userId,
        nodeId,
        action,
        level,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }



  /**
   * Get all policies for a specific node
   */
  async getNodePolicies(nodeId: string): Promise<NodePolicy[]> {
    try {
      this.validateNodeId(nodeId);

      const policies = await this.database
        .select()
        .from(nodePolicies)
        .where(eq(nodePolicies.nodeId, nodeId))
        .orderBy(nodePolicies.createdAt);

      return policies;
    } catch (error) {
      this.logger.error('Error getting node policies', {
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Set policies for a node (replaces existing policies)
   */
  async setNodePolicies(
    nodeId: string,
    grantedBy: number,
    policies: NodePolicyCreateDTO[]
  ): Promise<void> {
    try {
      this.validateNodeId(nodeId);
      this.validateUserId(grantedBy);

      await this.database.transaction(async (tx) => {
        // Remove existing policies for this node
        await tx
          .delete(nodePolicies)
          .where(eq(nodePolicies.nodeId, nodeId));

        // Insert new policies if any
        if (policies.length > 0) {
          const policyInserts = policies.map(policy => ({
            nodeId,
            level: policy.level,
            action: policy.action,
            subjectType: policy.subjectType,
            subjectId: policy.subjectId,
            effect: policy.effect,
            grantedBy,
            expiresAt: policy.expiresAt ? new Date(policy.expiresAt) : null
          }));

          await tx
            .insert(nodePolicies)
            .values(policyInserts);
        }
      });

      this.logger.info('Node policies updated', {
        nodeId,
        grantedBy,
        policyCount: policies.length
      });
    } catch (error) {
      this.logger.error('Error setting node policies', {
        nodeId,
        grantedBy,
        policies,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete a specific policy
   */
  async deletePolicy(policyId: string, userId: number): Promise<void> {
    try {
      // Verify user can delete this policy (must be owner of the node)
      const policy = await this.database
        .select({
          nodeId: nodePolicies.nodeId,
          nodeOwner: timelineNodes.userId
        })
        .from(nodePolicies)
        .innerJoin(timelineNodes, eq(nodePolicies.nodeId, timelineNodes.id))
        .where(eq(nodePolicies.id, policyId))
        .limit(1);

      if (policy.length === 0) {
        throw new Error('Policy not found');
      }

      if (policy[0].nodeOwner !== userId) {
        throw new Error('Only node owner can delete policies');
      }

      await this.database
        .delete(nodePolicies)
        .where(eq(nodePolicies.id, policyId));

      this.logger.info('Policy deleted', {
        policyId,
        userId,
        nodeId: policy[0].nodeId
      });
    } catch (error) {
      this.logger.error('Error deleting policy', {
        policyId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }







  /**
   * Check if a user is the owner of a node
   */
  async isNodeOwner(userId: number, nodeId: string): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateNodeId(nodeId);

      const result = await this.database
        .select({ userId: timelineNodes.userId })
        .from(timelineNodes)
        .where(eq(timelineNodes.id, nodeId))
        .limit(1);

      return result.length > 0 && result[0].userId === userId;
    } catch (error) {
      this.logger.error('Error checking node ownership', {
        userId,
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }



  /**
   * Validate node ID format
   */
  private validateNodeId(nodeId: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(nodeId)) {
      throw new Error('Invalid node ID format');
    }
  }

  /**
   * Validate user ID
   */
  private validateUserId(userId: number | null): void {
    if (userId !== null && (typeof userId !== 'number' || userId <= 0)) {
      throw new Error('Invalid user ID');
    }
  }
}