/**
 * NodePermissionRepository Interface
 * Contract for node permission database operations
 */

import {
  NodePolicy,
  NodePolicyCreateDTO,
  PermissionAction,
  VisibilityLevel} from '@shared/schema';

export interface INodePermissionRepository {
  /**
   * Check if a user can access a node at a specific level
   */
  canAccess(
    userId: number | null,
    nodeId: string,
    action?: PermissionAction,
    level?: VisibilityLevel
  ): Promise<boolean>;

/**
   * Set policies for nodes (replaces existing policies)
   */
  setNodePolicies(
    grantedBy: number,
    policies: NodePolicyCreateDTO[]
  ): Promise<void>;

  /**
   * Check if a user is the owner of a node
   */
  isNodeOwner(userId: number, nodeId: string): Promise<boolean>;

  /**
   * Get all policies for a specific node
   */
  getNodePolicies(nodeId: string): Promise<NodePolicy[]>;

  /**
   * Delete a specific policy
   */
  deletePolicy(policyId: string, userId: number): Promise<void>;
}