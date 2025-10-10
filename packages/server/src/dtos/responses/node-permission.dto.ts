/**
 * Response DTOs for Node Permission API
 */

/**
 * Node permission item
 */
export interface NodePermissionDto {
  nodeId: string;
  userId: number;
  permission: 'read' | 'write' | 'admin';
  grantedAt: string;
  grantedBy: number;
}

/**
 * Node permissions list response
 */
export interface NodePermissionsListDto {
  permissions: NodePermissionDto[];
  total: number;
}

/**
 * Check permission response
 */
export interface CheckPermissionDto {
  hasAccess: boolean;
  permission?: 'read' | 'write' | 'admin';
}
