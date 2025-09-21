/**
 * NodePermissionService
 * Business logic layer for node permissions and access control
 */

import { PermissionAction, SubjectType, VisibilityLevel } from '@journey/schema';
import { NodePolicyCreateDTO, NodePolicyUpdateDTO, SetNodePermissionsDTO } from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { INodePermissionRepository } from '../repositories/interfaces/node-permission.repository.interface.js';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface.js';
import type { INodePermissionService } from './interfaces.js';

export class NodePermissionService implements INodePermissionService {
  constructor({
    nodePermissionRepository,
    organizationRepository,
    logger,
  }: {
    nodePermissionRepository: INodePermissionRepository;
    organizationRepository: IOrganizationRepository;
    logger: Logger;
  }) {
    this.nodePermissionRepository = nodePermissionRepository;
    this.organizationRepository = organizationRepository;
    this.logger = logger;
  }

  private readonly nodePermissionRepository: INodePermissionRepository;
  private readonly organizationRepository: IOrganizationRepository;
  private readonly logger: Logger;

  /**
   * Check if a user can access a node at a specific level
   * Core permission checking method used throughout the application
   */
  async canAccess(
    nodeId: string,
    userId: number,
    requiredPermission?: string
  ): Promise<boolean> {
    const action: PermissionAction = requiredPermission as any || PermissionAction.View;
    const level: VisibilityLevel = VisibilityLevel.Overview;
    try {
      this.validateInput(userId, nodeId);

      const canAccess = await this.nodePermissionRepository.canAccess(
        userId,
        nodeId,
        action,
        level
      );

      // Log access attempts for audit (only log denials to avoid spam)
      if (!canAccess && userId) {
        this.logger.warn('Access denied', {
          userId,
          nodeId,
          action,
          level,
          timestamp: new Date().toISOString(),
        });
      }

      return canAccess;
    } catch (error) {
      this.logger.error('Error checking node access', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Set permissions for nodes
   * Only node owner can set permissions
   */
  async setNodePermissions(
    nodeId: string,
    permissions: unknown,
    userId: number
  ): Promise<unknown> {
    const grantedBy = userId;
    const data = permissions as any;
    try {
      // Group policies by nodeId for ownership validation
      const policiesByNode = new Map<string, NodePolicyCreateDTO[]>();

      for (const policy of data.policies) {
        const nodeId = policy.nodeId;
        this.validateInput(grantedBy, nodeId);

        if (!policiesByNode.has(nodeId)) {
          policiesByNode.set(nodeId, []);
        }
        const policies = policiesByNode.get(nodeId);
        if (policies) {
          policies.push(policy);
        }
      }

      // Verify ownership for all unique nodes
      for (const nodeId of policiesByNode.keys()) {
        const isOwner = await this.nodePermissionRepository.isNodeOwner(
          grantedBy,
          nodeId
        );
        if (!isOwner) {
          throw new Error(
            `Only node owner can set permissions for node: ${nodeId}`
          );
        }
      }

      // Validate all policies
      await this.validatePolicies(grantedBy, data.policies);

      // Set policies (repository handles the iteration)
      await this.nodePermissionRepository.setNodePolicies(
        grantedBy,
        data.policies
      );

      this.logger.info('Permissions updated', {
        userId: grantedBy,
        action: 'set_permissions',
        nodeCount: policiesByNode.size,
        policyCount: data.policies.length,
        timestamp: new Date().toISOString(),
      });
      return {};
    } catch (error) {
      this.logger.error('Error setting node permissions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Check if user is owner of a node
   */
  async isNodeOwner(nodeId: string, userId: number): Promise<boolean> {
    try {
      this.validateInput(userId, nodeId);

      return await this.nodePermissionRepository.isNodeOwner(userId, nodeId);
    } catch (error) {
      this.logger.error('Error checking node ownership', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get node permissions for interface compatibility
   */
  async getNodePermissions(nodeId: string, userId: number): Promise<unknown> {
    return this.getNodePolicies(nodeId, userId);
  }

  /**
   * Delete node policy for interface compatibility
   */
  async deleteNodePolicy(nodeId: string, policyId: string, userId: number): Promise<boolean> {
    await this.deletePolicy(policyId, userId);
    return true;
  }

  /**
   * Get all policies for a node (owner only)
   */
  async getNodePolicies(nodeId: string, userId: number) {
    try {
      this.validateInput(userId, nodeId);

      // Verify user is owner of the node
      const isOwner = await this.nodePermissionRepository.isNodeOwner(
        userId,
        nodeId
      );
      if (!isOwner) {
        throw new Error('Only node owner can view policies');
      }

      return await this.nodePermissionRepository.getNodePolicies(nodeId);
    } catch (error) {
      this.logger.error('Error getting node policies', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a policy (owner only)
   */
  async deletePolicy(policyId: string, userId: number): Promise<void> {
    try {
      // The repository method already validates ownership
      await this.nodePermissionRepository.deletePolicy(policyId, userId);

      this.logger.info('Policy deleted', {
        policyId,
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error deleting policy', error instanceof Error ? error : new Error(String(error)));
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
      // The repository method should validate ownership
      await this.nodePermissionRepository.updatePolicy(
        policyId,
        updates as any,
        userId
      );

      this.logger.info('Policy updated', {
        policyId,
        userId,
        updates,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Error updating policy', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Validate policies before setting them
   */
  private async validatePolicies(
    grantedBy: number,
    policies: NodePolicyCreateDTO[]
  ): Promise<void> {
    // Use centralized security limits validation
    this.validateSecurityLimits(policies);

    for (const policy of policies) {
      await this.validateSinglePolicy(grantedBy, policy);
    }
  }

  /**
   * Validate a single policy
   */
  private async validateSinglePolicy(
    grantedBy: number,
    policy: NodePolicyCreateDTO
  ): Promise<void> {
    // Validate organization membership for org-level policies
    if (policy.subjectType === SubjectType.Organization && policy.subjectId) {
      const isMember = await this.organizationRepository.isUserMemberOfOrg(
        grantedBy,
        policy.subjectId
      );
      if (!isMember) {
        throw new Error('User is not a member of the specified organization');
      }
    }

    // Validate user exists for user-specific policies
    if (policy.subjectType === SubjectType.User && policy.subjectId) {
      // Note: We could add user existence validation here if needed
      // const userExists = await this.userRepository.exists(policy.subjectId);
      // if (!userExists) throw new Error('Target user does not exist');
    }

    // Validate expiration date is in the future and not too far
    if (policy.expiresAt) {
      const expirationDate = new Date(policy.expiresAt);
      if (expirationDate <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }
    }

    // Validate subject ID is provided when required
    if (policy.subjectType !== SubjectType.Public && !policy.subjectId) {
      throw new Error(
        `Subject ID is required for ${policy.subjectType} policies`
      );
    }

    // Validate policy action and level combinations
    if (
      policy.action === PermissionAction.Edit &&
      policy.level === VisibilityLevel.Overview
    ) {
      throw new Error('Edit permissions require Full visibility level');
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(userId: number | null, nodeId: string): void {
    this.validateUserId(userId);
    this.validateNodeId(nodeId);
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

  /**
   * Validate that policies don't exceed security limits
   */
  private validateSecurityLimits(policies: NodePolicyCreateDTO[]): void {
    const policyLimits = {
      maxPoliciesPerNode: 50,
      maxExpirationDays: 365,
      maxBatchSize: 1000,
    };

    if (policies.length > policyLimits.maxPoliciesPerNode) {
      throw new Error(
        `Maximum ${policyLimits.maxPoliciesPerNode} policies per node allowed`
      );
    }

    for (const policy of policies) {
      if (policy.expiresAt) {
        const expirationDate = new Date(policy.expiresAt);
        const maxExpiration = new Date();
        maxExpiration.setDate(
          maxExpiration.getDate() + policyLimits.maxExpirationDays
        );

        if (expirationDate > maxExpiration) {
          throw new Error(
            `Expiration date cannot be more than ${policyLimits.maxExpirationDays} days in the future`
          );
        }
      }
    }
  }
}
