/**
 * NodePermissionService
 * Business logic layer for node permissions and access control
 */

import type { Logger } from '../core/logger';
import type { INodePermissionRepository } from '../repositories/interfaces/node-permission.repository.interface';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface';
import {
  VisibilityLevel,
  PermissionAction,
  SubjectType,
  NodePolicyCreateDTO,
  SetNodePermissionsDTO
} from '@shared/schema';

export class NodePermissionService {
  constructor({
    nodePermissionRepository,
    organizationRepository,
    logger
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
    userId: number | null,
    nodeId: string,
    action: PermissionAction = PermissionAction.View,
    level: VisibilityLevel = VisibilityLevel.Overview
  ): Promise<boolean> {
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
          timestamp: new Date().toISOString()
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
   * Set permissions for a node
   * Only node owner can set permissions
   */
  async setNodePermissions(
    nodeId: string,
    grantedBy: number,
    data: SetNodePermissionsDTO
  ): Promise<void> {
    try {
      this.validateInput(grantedBy, nodeId);

      // Verify user is owner of the node
      const isOwner = await this.nodePermissionRepository.isNodeOwner(grantedBy, nodeId);
      if (!isOwner) {
        throw new Error('Only node owner can set permissions');
      }

      // Validate all policies
      await this.validatePolicies(grantedBy, data.policies);

      // Set the policies
      await this.nodePermissionRepository.setNodePolicies(
        nodeId,
        grantedBy,
        data.policies
      );

      this.logger.info('Permission change', {
        nodeId,
        userId: grantedBy,
        action: 'set_permissions',
        policyCount: data.policies.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error setting node permissions', {
        nodeId,
        grantedBy,
        policies: data.policies,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if user is owner of a node
   */
  async isNodeOwner(userId: number, nodeId: string): Promise<boolean> {
    try {
      this.validateInput(userId, nodeId);

      return await this.nodePermissionRepository.isNodeOwner(userId, nodeId);
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
   * Get all policies for a node (owner only)
   */
  async getNodePolicies(nodeId: string, userId: number) {
    try {
      this.validateInput(userId, nodeId);
      
      // Verify user is owner of the node
      const isOwner = await this.nodePermissionRepository.isNodeOwner(userId, nodeId);
      if (!isOwner) {
        throw new Error('Only node owner can view policies');
      }

      return await this.nodePermissionRepository.getNodePolicies(nodeId);
    } catch (error) {
      this.logger.error('Error getting node policies', {
        userId,
        nodeId,
        error: error instanceof Error ? error.message : String(error)
      });
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
        timestamp: new Date().toISOString()
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
   * Validate policies before setting them
   */
  private async validatePolicies(grantedBy: number, policies: NodePolicyCreateDTO[]): Promise<void> {
    // Use centralized security limits validation
    this.validateSecurityLimits(policies);

    for (const policy of policies) {
      await this.validateSinglePolicy(grantedBy, policy);
    }
  }

  /**
   * Validate a single policy
   */
  private async validateSinglePolicy(grantedBy: number, policy: NodePolicyCreateDTO): Promise<void> {
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
      throw new Error(`Subject ID is required for ${policy.subjectType} policies`);
    }

    // Validate policy action and level combinations
    if (policy.action === PermissionAction.Edit && policy.level === VisibilityLevel.Overview) {
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



  /**
   * Validate that policies don't exceed security limits
   */
  private validateSecurityLimits(policies: NodePolicyCreateDTO[]): void {
    const policyLimits = {
      maxPoliciesPerNode: 50,
      maxExpirationDays: 365,
      maxBatchSize: 1000
    };

    if (policies.length > policyLimits.maxPoliciesPerNode) {
      throw new Error(`Maximum ${policyLimits.maxPoliciesPerNode} policies per node allowed`);
    }

    for (const policy of policies) {
      if (policy.expiresAt) {
        const expirationDate = new Date(policy.expiresAt);
        const maxExpiration = new Date();
        maxExpiration.setDate(maxExpiration.getDate() + policyLimits.maxExpirationDays);
        
        if (expirationDate > maxExpiration) {
          throw new Error(`Expiration date cannot be more than ${policyLimits.maxExpirationDays} days in the future`);
        }
      }
    }
  }

}