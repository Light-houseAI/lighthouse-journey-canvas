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
import { 
  INodePermissionRepository
} from '../../repositories/interfaces/node-permission.repository.interface';
import { IOrganizationRepository } from '../../repositories/interfaces/organization.repository.interface';

export class InMemoryNodePermissionRepository implements INodePermissionRepository {
  private policies: Map<string, NodePolicy[]> = new Map();
  private nodeOwners: Map<string, number> = new Map();
  private logger: any;
  private orgRepository: IOrganizationRepository;

  constructor({ logger, organizationRepository }: { 
    logger: any; 
    organizationRepository: IOrganizationRepository;
  }) {
    this.logger = logger;
    this.orgRepository = organizationRepository;
  }

  /**
   * Clear all test data - not part of interface
   */
  clearAll(): void {
    this.policies.clear();
    this.nodeOwners.clear();
  }

  /**
   * Establish node ownership as would happen during real node creation
   * This simulates the HierarchyService.createNode() establishing ownership
   */
  establishNodeOwnership(nodeId: string, ownerId: number): void {
    this.nodeOwners.set(nodeId, ownerId);
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
    // Owner always has access
    const owner = this.nodeOwners.get(nodeId);
    if (owner && userId === owner) {
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
   * Get the highest access level a user has for a node
   */
  async getAccessLevel(userId: number | null, nodeId: string): Promise<VisibilityLevel | null> {
    // Owner always has full access
    const owner = this.nodeOwners.get(nodeId);
    if (owner && userId === owner) {
      return VisibilityLevel.Full;
    }

    // Check access levels in descending order
    const canAccessFull = await this.canAccess(userId, nodeId, PermissionAction.View, VisibilityLevel.Full);
    if (canAccessFull) return VisibilityLevel.Full;

    const canAccessOverview = await this.canAccess(userId, nodeId, PermissionAction.View, VisibilityLevel.Overview);
    if (canAccessOverview) return VisibilityLevel.Overview;

    return null;
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
    const nodePolicies: NodePolicy[] = policies.map((policy, index) => ({
      id: `policy-${nodeId}-${index}-${Date.now()}`,
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
    const owner = this.nodeOwners.get(nodeId);
    return owner === userId;
  }
}