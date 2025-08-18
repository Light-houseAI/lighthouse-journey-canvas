/**
 * Shared Permissions System
 * Defines comprehensive role-based and permission-based authorization
 */

export enum Permission {
  // Profile permissions
  PROFILE_READ_OWN = 'profile:read:own',
  PROFILE_WRITE_OWN = 'profile:write:own',
  
  // Node permissions
  NODE_CREATE = 'node:create',
  NODE_READ_OWN = 'node:read:own',
  NODE_UPDATE_OWN = 'node:update:own',
  NODE_DELETE_OWN = 'node:delete:own'
}

export enum Role {
  USER = 'user'
}

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.PROFILE_READ_OWN,
    Permission.PROFILE_WRITE_OWN,
    Permission.NODE_CREATE,
    Permission.NODE_READ_OWN,
    Permission.NODE_UPDATE_OWN,
    Permission.NODE_DELETE_OWN
  ]
};

/**
 * Check if user has required permission(s)
 * @param userPermissions Array of permissions the user has
 * @param requiredPermission Single permission or array of permissions required
 * @returns true if user has all required permissions
 */
export function hasPermission(
  userPermissions: Permission[],
  requiredPermission: Permission | Permission[]
): boolean {
  const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  return required.every(permission => userPermissions.includes(permission));
}

/**
 * Check if user role is authorized for required roles
 * @param userRole The user's role
 * @param requiredRoles Array of roles that are allowed access
 * @returns true if user role is in the required roles list, or if no roles are required
 */
export function canUserAccess(userRole: Role, requiredRoles: Role[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.includes(userRole);
}

// Type definitions for user context
export interface UserContext {
  id: number;
  email: string;
  role: Role;
  permissions: Permission[];
}

export interface AuthContext {
  method: 'session' | 'header' | 'dev_mode';
  sessionId?: string;
  userId?: number;
}

export interface AuthenticatedUser {
  user: UserContext;
  context: AuthContext;
}