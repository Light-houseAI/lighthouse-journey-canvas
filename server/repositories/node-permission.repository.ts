/**
 * NodePermissionRepository
 * Database access layer for node permissions and policies
 */

import { PermissionAction, VisibilityLevel } from '@shared/enums';
import { nodePolicies, timelineNodes } from '@shared/schema';
import * as schema from '@shared/schema';
import {
  NodePolicy,
  NodePolicyCreateDTO,
  NodePolicyUpdateDTO,
} from '@shared/types';
import { eq, sql, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger';

export class NodePermissionRepository {
  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
    logger: Logger;
  }) {
    this.database = database;
    this.logger = logger;
  }

  private readonly database: NodePgDatabase<typeof schema>;
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

      if (duration > 50) {
        // Log slow queries
        this.logger.warn('Slow permission check detected', {
          userId,
          nodeId,
          action,
          level,
          duration,
        });
      }

      const canAccess = result.rows[0]?.can_access || false;

      if (!canAccess && userId) {
        this.logger.warn('Access denied', {
          userId,
          nodeId,
          action,
          level,
        });
      }

      return canAccess;
    } catch (error) {
      this.logger.error('Error checking node access', {
        userId,
        nodeId,
        action,
        level,
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set policies for nodes (replaces existing policies)
   */
  async setNodePolicies(
    grantedBy: number,
    policies: NodePolicyCreateDTO[]
  ): Promise<void> {
    try {
      this.validateUserId(grantedBy);

      // Group policies by nodeId to clear existing policies per node
      const nodeIds = [...new Set(policies.map((p) => p.nodeId!))];

      // Validate all nodeIds
      for (const nodeId of nodeIds) {
        this.validateNodeId(nodeId);
      }

      await this.database.transaction(async (tx) => {
        // Group policies by node and subject to only clear specific subject policies
        const policiesByNodeAndSubject = new Map<
          string,
          Map<string, NodePolicyCreateDTO[]>
        >();

        for (const policy of policies) {
          const nodeId = policy.nodeId!;
          const subjectKey =
            policy.subjectType === 'public'
              ? 'public'
              : `${policy.subjectType}-${policy.subjectId}`;

          if (!policiesByNodeAndSubject.has(nodeId)) {
            policiesByNodeAndSubject.set(nodeId, new Map());
          }

          const nodeSubjects = policiesByNodeAndSubject.get(nodeId)!;
          if (!nodeSubjects.has(subjectKey)) {
            nodeSubjects.set(subjectKey, []);
          }

          nodeSubjects.get(subjectKey)!.push(policy);
        }

        // Clear existing policies only for the specific subjects being updated
        for (const [nodeId, subjects] of policiesByNodeAndSubject) {
          for (const [subjectKey, _] of subjects) {
            if (subjectKey === 'public') {
              await tx
                .delete(nodePolicies)
                .where(
                  and(
                    eq(nodePolicies.nodeId, nodeId),
                    eq(nodePolicies.subjectType, 'public')
                  )
                );
            } else {
              const [subjectType, subjectId] = subjectKey.split('-');
              await tx
                .delete(nodePolicies)
                .where(
                  and(
                    eq(nodePolicies.nodeId, nodeId),
                    eq(nodePolicies.subjectType, subjectType),
                    eq(nodePolicies.subjectId, parseInt(subjectId))
                  )
                );
            }
          }
        }

        // Insert new policies if any
        if (policies.length > 0) {
          const policyInserts = policies.map((policy) => ({
            nodeId: policy.nodeId!,
            level: policy.level,
            action: policy.action,
            subjectType: policy.subjectType,
            subjectId: policy.subjectId,
            effect: policy.effect,
            grantedBy,
            expiresAt: policy.expiresAt ? new Date(policy.expiresAt) : null,
          }));

          await tx.insert(nodePolicies).values(policyInserts);
        }
      });

      this.logger.info('Node policies updated', {
        nodeCount: nodeIds.length,
        grantedBy,
        policyCount: policies.length,
      });
    } catch (error) {
      this.logger.error('Error setting node policies', {
        grantedBy,
        nodeCount: policies.length,
        error: error instanceof Error ? error.message : String(error),
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
          nodeOwner: timelineNodes.userId,
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
        nodeId: policy[0].nodeId,
      });
    } catch (error) {
      this.logger.error('Error deleting policy', {
        policyId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update a specific policy
   */
  async updatePolicy(
    policyId: string,
    updates: NodePolicyUpdateDTO,
    userId: number
  ): Promise<void> {
    try {
      // Verify user can update this policy (must be owner of the node)
      const policy = await this.database
        .select({
          nodeId: nodePolicies.nodeId,
          nodeOwner: timelineNodes.userId,
        })
        .from(nodePolicies)
        .innerJoin(timelineNodes, eq(nodePolicies.nodeId, timelineNodes.id))
        .where(eq(nodePolicies.id, policyId))
        .limit(1);

      if (policy.length === 0) {
        throw new Error('Policy not found');
      }

      if (policy[0].nodeOwner !== userId) {
        throw new Error('Only node owner can update policies');
      }

      // Build the update object, only including fields that are provided
      const updateData: any = {};
      if (updates.level !== undefined) updateData.level = updates.level;
      if (updates.action !== undefined) updateData.action = updates.action;
      if (updates.effect !== undefined) updateData.effect = updates.effect;
      if (updates.expiresAt !== undefined) {
        updateData.expiresAt = updates.expiresAt
          ? new Date(updates.expiresAt)
          : null;
      }

      // Only update if there are actual changes
      if (Object.keys(updateData).length > 0) {
        await this.database
          .update(nodePolicies)
          .set(updateData)
          .where(eq(nodePolicies.id, policyId));
      }

      this.logger.info('Policy updated', {
        policyId,
        userId,
        nodeId: policy[0].nodeId,
        updates: updateData,
      });
    } catch (error) {
      this.logger.error('Error updating policy', {
        policyId,
        userId,
        updates,
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate node ID format
   */
  private validateNodeId(nodeId: string): void {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
