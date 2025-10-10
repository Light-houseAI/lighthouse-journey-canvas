/**
 * Mappers for Node Permission API
 * Transform between service layer and controller DTOs
 */

import type {
  CheckPermissionDto,
  NodePermissionDto,
  NodePermissionsListDto,
} from '../responses/node-permission.dto';

export class NodePermissionMapper {
  /**
   * Map permission to DTO
   */
  static toNodePermissionDto(permission: any): NodePermissionDto {
    return {
      nodeId: permission.nodeId,
      userId: permission.userId,
      permission: permission.permission,
      grantedAt: permission.grantedAt?.toISOString
        ? permission.grantedAt.toISOString()
        : permission.grantedAt,
      grantedBy: permission.grantedBy,
    };
  }

  /**
   * Map permissions list to DTO
   */
  static toPermissionsListDto(permissions: any[]): NodePermissionsListDto {
    return {
      permissions: permissions.map((p) => this.toNodePermissionDto(p)),
      total: permissions.length,
    };
  }

  /**
   * Map check permission result to DTO
   */
  static toCheckPermissionDto(
    hasAccess: boolean,
    permission?: string
  ): CheckPermissionDto {
    return {
      hasAccess,
      permission: permission as 'read' | 'write' | 'admin' | undefined,
    };
  }
}
