/**
 * NodePermissionRepository Interface
 * Contract for node permission database operations
 */

import {
  NodePolicyCreateDTO,
  VisibilityLevel,
  PermissionAction
} from '@shared/schema';

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
   * Get the highest access level a user has for a node
   */
  getAccessLevel(userId: number | null, nodeId: string): Promise<VisibilityLevel | null>;

  /**
   * Set policies for a node (replaces existing policies)
   */
  setNodePolicies(
    nodeId: string,
    grantedBy: number,
    policies: NodePolicyCreateDTO[]
  ): Promise<void>;

  /**
   * Check if a user is the owner of a node
   */
  isNodeOwner(userId: number, nodeId: string): Promise<boolean>;
}