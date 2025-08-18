/**
 * NodePermissionRepository
 * Database access layer for node permissions and policies
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger';
import { 
  nodePolicies,
  timelineNodes,
  organizations,
  orgMembers,
  NodePolicy,
  NodePolicyCreateDTO,
  VisibilityLevel,
  PermissionAction,
  SubjectType,
  PolicyEffect,
  EffectivePermissions
} from '@shared/schema';
import { eq, and, or, inArray, sql, isNull } from 'drizzle-orm';

export interface AccessibleNode {
  nodeId: string;
  accessLevel: VisibilityLevel;
  canEdit: boolean;
}

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
   * Get the highest access level a user has for a node
   */
  async getAccessLevel(userId: number | null, nodeId: string): Promise<VisibilityLevel | null> {
    try {
      this.validateNodeId(nodeId);
      this.validateUserId(userId);

      const result = await this.database.execute(
        sql`SELECT get_node_access_level(${userId}, ${nodeId}::uuid) as access_level`
      );

      return result.rows[0]?.access_level || null;
    } catch (error) {
      this.logger.error('Error getting access level', {
        userId,
        nodeId,
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
   * Get all nodes accessible to a user with their access levels
   * Uses PostgreSQL function for optimal performance
   */
  async getAccessibleNodes(
    userId: number | null,
    action: PermissionAction = PermissionAction.View,
    minLevel: VisibilityLevel = VisibilityLevel.Overview
  ): Promise<AccessibleNode[]> {
    try {
      this.validateUserId(userId);

      const startTime = Date.now();

      const result = await this.database.execute(
        sql`
          SELECT node_id, access_level, can_edit 
          FROM get_accessible_nodes(
            ${userId}, 
            ${action}::permission_action, 
            ${minLevel}::visibility_level
          )
        `
      );

      const duration = Date.now() - startTime;

      if (duration > 500) {
        this.logger.warn('Slow batch access check detected', {
          userId,
          action,
          minLevel,
          duration,
          resultCount: result.rows.length
        });
      }

      return result.rows.map(row => ({
        nodeId: row.node_id,
        accessLevel: row.access_level,
        canEdit: row.can_edit
      }));
    } catch (error) {
      this.logger.error('Error getting accessible nodes', {
        userId,
        action,
        minLevel,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Batch check access for multiple nodes
   * For when you have specific node IDs to check
   */
  async batchCheckAccess(
    userId: number | null,
    nodeIds: string[],
    action: PermissionAction = PermissionAction.View,
    level: VisibilityLevel = VisibilityLevel.Overview
  ): Promise<{ nodeId: string; canAccess: boolean }[]> {
    try {
      this.validateUserId(userId);

      if (nodeIds.length === 0) {
        return [];
      }

      // Validate all node IDs
      nodeIds.forEach(nodeId => this.validateNodeId(nodeId));

      const startTime = Date.now();

      // Use UNNEST to check multiple nodes efficiently
      const result = await this.database.execute(
        sql`
          SELECT 
            node_id::text,
            can_access_node(
              ${userId}, 
              node_id::uuid, 
              ${action}::permission_action, 
              ${level}::visibility_level
            ) as can_access
          FROM UNNEST(${nodeIds}::uuid[]) as node_id
        `
      );

      const duration = Date.now() - startTime;

      if (duration > 500) {
        this.logger.warn('Slow batch permission check detected', {
          userId,
          nodeCount: nodeIds.length,
          duration
        });
      }

      return result.rows.map(row => ({
        nodeId: row.node_id,
        canAccess: row.can_access
      }));
    } catch (error) {
      this.logger.error('Error in batch access check', {
        userId,
        nodeCount: nodeIds.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get effective permissions summary for a node
   */
  async getEffectivePermissions(nodeId: string): Promise<EffectivePermissions> {
    try {
      this.validateNodeId(nodeId);

      const policies = await this.database
        .select()
        .from(nodePolicies)
        .where(
          and(
            eq(nodePolicies.nodeId, nodeId),
            eq(nodePolicies.effect, PolicyEffect.Allow),
            or(
              isNull(nodePolicies.expiresAt),
              sql`${nodePolicies.expiresAt} > NOW()`
            )
          )
        );

      const effective: EffectivePermissions = {
        organizations: [],
        users: []
      };

      for (const policy of policies) {
        switch (policy.subjectType) {
          case SubjectType.Public:
            if (!effective.public || policy.level === VisibilityLevel.Full) {
              effective.public = policy.level;
            }
            break;

          case SubjectType.Organization:
            if (policy.subjectId) {
              const existing = effective.organizations.find(o => o.orgId === policy.subjectId);
              if (!existing) {
                effective.organizations.push({
                  orgId: policy.subjectId,
                  level: policy.level
                });
              } else if (policy.level === VisibilityLevel.Full) {
                existing.level = VisibilityLevel.Full;
              }
            }
            break;

          case SubjectType.User:
            if (policy.subjectId) {
              const existing = effective.users.find(u => u.userId === policy.subjectId);
              if (!existing) {
                effective.users.push({
                  userId: policy.subjectId,
                  level: policy.level
                });
              } else if (policy.level === VisibilityLevel.Full) {
                existing.level = VisibilityLevel.Full;
              }
            }
            break;
        }
      }

      return effective;
    } catch (error) {
      this.logger.error('Error getting effective permissions', {
        nodeId,
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
   * Clean up expired policies (maintenance function)
   */
  async cleanupExpiredPolicies(): Promise<number> {
    try {
      const result = await this.database
        .delete(nodePolicies)
        .where(sql`${nodePolicies.expiresAt} <= NOW()`);

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        this.logger.info('Cleaned up expired policies', { count: deletedCount });
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Error cleaning up expired policies', {
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