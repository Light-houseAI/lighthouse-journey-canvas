/**
 * In-Memory NodePermissionRepository Implementation
 * For integration testing without database dependencies
 */

import { 
  NodePolicy,
  NodePolicyCreateDTO,
  VisibilityLevel,
  PermissionAction,
  SubjectType,
  PolicyEffect
} from '@shared/schema';
import { randomUUID } from 'crypto';
import { 
  INodePermissionRepository
} from '../../repositories/interfaces/node-permission.repository.interface';
import { IOrganizationRepository } from '../../repositories/interfaces/organization.repository.interface';

export class InMemoryNodePermissionRepository implements INodePermissionRepository {
  private policies: Map<string, NodePolicy[]> = new Map();
  private nodeOwners: Map<string, number> = new Map();
  private logger: any;
  private orgRepository: IOrganizationRepository;
  private hierarchyRepository: any; // Reference to hierarchy repository for ownership checks
  
  // Mock database property for interface compatibility
  database: any = null;

  constructor({ logger, organizationRepository, hierarchyRepository }: { 
    logger: any; 
    organizationRepository: IOrganizationRepository;
    hierarchyRepository?: any; // Optional for testing
  }) {
    this.logger = logger;
    this.orgRepository = organizationRepository;
    this.hierarchyRepository = hierarchyRepository;
  }

  /**
   * Check if a user can access a node at a specific level
   */
  async canAccess(
    userId: number | null,
    nodeId: string,
    action: PermissionAction = PermissionAction.View,
    level: VisibilityLevel = VisibilityLevel.Overview
  ): Promise<boolean> {
    this.validateNodeId(nodeId);
    this.validateUserId(userId);
    
    // Owner always has access
    const isOwner = await this.isNodeOwner(userId as number, nodeId);
    if (isOwner) {
      return true;
    }

    // Get policies for this node
    const nodePolicies = this.policies.get(nodeId) || [];
    
    // Process policies in priority order: User-specific, Organization, Public
    const userPolicies = nodePolicies.filter(p => p.subjectType === SubjectType.User && p.subjectId === userId);
    const orgPolicies = nodePolicies.filter(p => p.subjectType === SubjectType.Organization);
    const publicPolicies = nodePolicies.filter(p => p.subjectType === SubjectType.Public);

    // Check user-specific policies first (highest priority)
    for (const policy of userPolicies) {
      if (policy.action === action) {
        if (policy.effect === PolicyEffect.Deny) {
          return false; // DENY always overrides
        }
        if (policy.effect === PolicyEffect.Allow) {
          // Check level requirement
          if (level === VisibilityLevel.Overview || 
              (level === VisibilityLevel.Full && policy.level === VisibilityLevel.Full)) {
            return true;
          }
        }
      }
    }

    // Check organization policies with membership check
    if (userId) {
      for (const policy of orgPolicies) {
        if (policy.action === action && policy.subjectId) {
          const isMember = await this.orgRepository.isUserMemberOfOrg(userId, policy.subjectId);
          if (isMember) {
            if (policy.effect === PolicyEffect.Deny) {
              return false;
            }
            if (policy.effect === PolicyEffect.Allow) {
              if (level === VisibilityLevel.Overview || 
                  (level === VisibilityLevel.Full && policy.level === VisibilityLevel.Full)) {
                return true;
              }
            }
          }
        }
      }
    }

    // Check public policies (lowest priority)
    for (const policy of publicPolicies) {
      if (policy.action === action && policy.effect === PolicyEffect.Allow) {
        if (level === VisibilityLevel.Overview || 
            (level === VisibilityLevel.Full && policy.level === VisibilityLevel.Full)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Set node policies
   */
  async setNodePolicies(
    nodeId: string, 
    grantedBy: number, 
    policies: NodePolicyCreateDTO[]
  ): Promise<void> {
    // If this node has no owner yet, make the grantedBy user the owner
    if (!this.nodeOwners.has(nodeId)) {
      this.nodeOwners.set(nodeId, grantedBy);
    }

    // Convert DTOs to NodePolicy objects
    const nodePolicies: NodePolicy[] = policies.map((policy) => ({
      id: randomUUID(), // Generate proper UUID
      nodeId,
      level: policy.level,
      action: policy.action,
      subjectType: policy.subjectType,
      subjectId: policy.subjectId ?? null,
      effect: policy.effect,
      grantedBy,
      expiresAt: policy.expiresAt ? new Date(policy.expiresAt) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    this.policies.set(nodeId, nodePolicies);
  }

  /**
   * Check if user is owner of a node
   */
  async isNodeOwner(userId: number, nodeId: string): Promise<boolean> {
    // First check our explicit ownership map
    const owner = this.nodeOwners.get(nodeId);
    if (owner !== undefined) {
      return owner === userId;
    }

    // If not found, check with hierarchy repository (simulates real DB query)
    if (this.hierarchyRepository) {
      try {
        const node = await this.hierarchyRepository.getById(nodeId, userId);
        if (node && node.userId === userId) {
          // Cache the ownership for future checks
          this.nodeOwners.set(nodeId, userId);
          return true;
        }
      } catch (error) {
        // Node not found or access denied
        return false;
      }
    }

    return false;
  }

  /**
   * Get all policies for a node
   */
  async getNodePolicies(nodeId: string): Promise<NodePolicy[]> {
    return this.policies.get(nodeId) || [];
  }

  /**
   * Delete a specific policy
   */
  async deletePolicy(policyId: string, userId: number): Promise<void> {
    // Find the policy across all nodes
    for (const [nodeId, policies] of this.policies.entries()) {
      const policyIndex = policies.findIndex(p => p.id === policyId);
      if (policyIndex !== -1) {
        // Check if user is owner of the node
        const isOwner = await this.isNodeOwner(userId, nodeId);
        if (!isOwner) {
          throw new Error('Only node owner can delete policies');
        }
        
        // Remove the policy
        policies.splice(policyIndex, 1);
        return;
      }
    }
    
    throw new Error('Policy not found');
  }

  /**
   * Validate node ID format
   */
  private validateNodeId(nodeId: string): void {
    if (!nodeId || typeof nodeId !== 'string') {
      throw new Error('Invalid node ID format');
    }
    
    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(nodeId)) {
      throw new Error('Node ID must be a valid UUID');
    }
  }

  /**
   * Validate user ID
   */
  private validateUserId(userId: number | null): void {
    if (userId !== null && (!Number.isInteger(userId) || userId <= 0)) {
      throw new Error('User ID must be a positive integer');
    }
  }
}