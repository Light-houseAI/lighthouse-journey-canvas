/**
 * Permissions Tests
 * Tests for role-based and permission-based authorization system
 */

import { describe, expect, it } from 'vitest';

import {
  canUserAccess,
  hasPermission,
  Permission,
  Role,
  RolePermissions,
  type AuthContext,
  type AuthenticatedUser,
  type UserContext,
} from '../permissions';

// Constants
const PERMISSION_COUNT = 6;
const ROLE_COUNT = 1;
const USER_ROLE_PERMISSION_COUNT = 6;

describe('Permission Enum', () => {
  it('should have correct permission values', () => {
    expect(Permission.PROFILE_READ_OWN).toBe('profile:read:own');
    expect(Permission.PROFILE_WRITE_OWN).toBe('profile:write:own');
    expect(Permission.NODE_CREATE).toBe('node:create');
    expect(Permission.NODE_READ_OWN).toBe('node:read:own');
    expect(Permission.NODE_UPDATE_OWN).toBe('node:update:own');
    expect(Permission.NODE_DELETE_OWN).toBe('node:delete:own');
  });

  it('should contain all expected permissions', () => {
    const permissions = Object.values(Permission);
    expect(permissions).toHaveLength(PERMISSION_COUNT);
  });
});

describe('Role Enum', () => {
  it('should have correct role values', () => {
    expect(Role.USER).toBe('user');
  });

  it('should contain all expected roles', () => {
    const roles = Object.values(Role);
    expect(roles).toHaveLength(ROLE_COUNT);
  });
});

describe('RolePermissions Mapping', () => {
  it('should map USER role to all user permissions', () => {
    const userPermissions = RolePermissions[Role.USER];

    expect(userPermissions).toContain(Permission.PROFILE_READ_OWN);
    expect(userPermissions).toContain(Permission.PROFILE_WRITE_OWN);
    expect(userPermissions).toContain(Permission.NODE_CREATE);
    expect(userPermissions).toContain(Permission.NODE_READ_OWN);
    expect(userPermissions).toContain(Permission.NODE_UPDATE_OWN);
    expect(userPermissions).toContain(Permission.NODE_DELETE_OWN);
    expect(userPermissions).toHaveLength(USER_ROLE_PERMISSION_COUNT);
  });

  it('should have all roles defined in RolePermissions', () => {
    const roles = Object.values(Role);
    roles.forEach((role) => {
      expect(RolePermissions[role]).toBeDefined();
      expect(Array.isArray(RolePermissions[role])).toBe(true);
    });
  });
});

describe('hasPermission Function', () => {
  describe('Single Permission Check', () => {
    it('should return true when user has the required permission', () => {
      const userPermissions = [
        Permission.PROFILE_READ_OWN,
        Permission.NODE_CREATE,
      ];

      expect(
        hasPermission(userPermissions, Permission.PROFILE_READ_OWN)
      ).toBe(true);
      expect(hasPermission(userPermissions, Permission.NODE_CREATE)).toBe(
        true
      );
    });

    it('should return false when user does not have the required permission', () => {
      const userPermissions = [Permission.PROFILE_READ_OWN];

      expect(hasPermission(userPermissions, Permission.NODE_CREATE)).toBe(
        false
      );
      expect(hasPermission(userPermissions, Permission.NODE_DELETE_OWN)).toBe(
        false
      );
    });

    it('should return false when user has empty permissions', () => {
      const userPermissions: Permission[] = [];

      expect(
        hasPermission(userPermissions, Permission.PROFILE_READ_OWN)
      ).toBe(false);
    });
  });

  describe('Multiple Permissions Check', () => {
    it('should return true when user has all required permissions', () => {
      const userPermissions = [
        Permission.PROFILE_READ_OWN,
        Permission.PROFILE_WRITE_OWN,
        Permission.NODE_CREATE,
      ];

      expect(
        hasPermission(userPermissions, [
          Permission.PROFILE_READ_OWN,
          Permission.NODE_CREATE,
        ])
      ).toBe(true);
    });

    it('should return false when user is missing any required permission', () => {
      const userPermissions = [Permission.PROFILE_READ_OWN];

      expect(
        hasPermission(userPermissions, [
          Permission.PROFILE_READ_OWN,
          Permission.NODE_CREATE,
        ])
      ).toBe(false);
    });

    it('should return true when checking empty permissions array', () => {
      const userPermissions = [Permission.PROFILE_READ_OWN];

      expect(hasPermission(userPermissions, [])).toBe(true);
    });

    it('should return false when user has no permissions and checking multiple', () => {
      const userPermissions: Permission[] = [];

      expect(
        hasPermission(userPermissions, [
          Permission.PROFILE_READ_OWN,
          Permission.NODE_CREATE,
        ])
      ).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle checking all possible permissions', () => {
      const allPermissions = Object.values(Permission);
      const userPermissions = [...allPermissions];

      expect(hasPermission(userPermissions, allPermissions)).toBe(true);
    });

    it('should be case-sensitive', () => {
      const userPermissions = [Permission.PROFILE_READ_OWN];

      // TypeScript will prevent this, but testing runtime behavior
      expect(
        hasPermission(
          userPermissions,
          'PROFILE:READ:OWN' as unknown as Permission
        )
      ).toBe(false);
    });
  });
});

describe('canUserAccess Function', () => {
  it('should return true when user role is in required roles', () => {
    expect(canUserAccess(Role.USER, [Role.USER])).toBe(true);
  });

  it('should return false when user role is not in required roles', () => {
    // This test is a bit artificial with only one role, but demonstrates the logic
    const otherRole = 'admin' as Role;
    expect(canUserAccess(Role.USER, [otherRole])).toBe(false);
  });

  it('should return true when no roles are required (public access)', () => {
    expect(canUserAccess(Role.USER, [])).toBe(true);
  });

  it('should handle multiple required roles', () => {
    const otherRole = 'admin' as Role;
    expect(canUserAccess(Role.USER, [Role.USER, otherRole])).toBe(true);
    expect(canUserAccess(otherRole, [Role.USER])).toBe(false);
  });
});

describe('TypeScript Interfaces', () => {
  describe('UserContext Interface', () => {
    it('should accept valid user context', () => {
      const userContext: UserContext = {
        id: 1,
        email: 'test@example.com',
        role: Role.USER,
        permissions: [Permission.PROFILE_READ_OWN, Permission.NODE_CREATE],
      };

      expect(userContext.id).toBe(1);
      expect(userContext.email).toBe('test@example.com');
      expect(userContext.role).toBe(Role.USER);
      expect(userContext.permissions).toHaveLength(2);
    });
  });

  describe('AuthContext Interface', () => {
    it('should accept session auth context', () => {
      const authContext: AuthContext = {
        method: 'session',
        sessionId: 'session-123',
        userId: 1,
      };

      expect(authContext.method).toBe('session');
      expect(authContext.sessionId).toBe('session-123');
      expect(authContext.userId).toBe(1);
    });

    it('should accept header auth context', () => {
      const authContext: AuthContext = {
        method: 'header',
        userId: 1,
      };

      expect(authContext.method).toBe('header');
      expect(authContext.userId).toBe(1);
    });

    it('should accept dev_mode auth context', () => {
      const authContext: AuthContext = {
        method: 'dev_mode',
      };

      expect(authContext.method).toBe('dev_mode');
    });
  });

  describe('AuthenticatedUser Interface', () => {
    it('should combine user and auth context', () => {
      const authenticatedUser: AuthenticatedUser = {
        user: {
          id: 1,
          email: 'test@example.com',
          role: Role.USER,
          permissions: RolePermissions[Role.USER],
        },
        context: {
          method: 'session',
          sessionId: 'session-123',
          userId: 1,
        },
      };

      expect(authenticatedUser.user.id).toBe(1);
      expect(authenticatedUser.context.method).toBe('session');
    });
  });
});

describe('Integration Scenarios', () => {
  it('should validate a complete authorization flow', () => {
    // Create a user with USER role
    const user: UserContext = {
      id: 1,
      email: 'user@example.com',
      role: Role.USER,
      permissions: RolePermissions[Role.USER],
    };

    // Check if user can access USER-only resources
    expect(canUserAccess(user.role, [Role.USER])).toBe(true);

    // Check if user has permission to read their own profile
    expect(hasPermission(user.permissions, Permission.PROFILE_READ_OWN)).toBe(
      true
    );

    // Check if user has permission to create nodes
    expect(hasPermission(user.permissions, Permission.NODE_CREATE)).toBe(true);

    // Check if user has all required permissions for a complex operation
    expect(
      hasPermission(user.permissions, [
        Permission.NODE_READ_OWN,
        Permission.NODE_UPDATE_OWN,
      ])
    ).toBe(true);
  });

  it('should handle authenticated user with full context', () => {
    const authenticatedUser: AuthenticatedUser = {
      user: {
        id: 1,
        email: 'test@example.com',
        role: Role.USER,
        permissions: RolePermissions[Role.USER],
      },
      context: {
        method: 'session',
        sessionId: 'abc123',
        userId: 1,
      },
    };

    // Verify user has all USER role permissions
    const allUserPerms = RolePermissions[Role.USER];
    expect(hasPermission(authenticatedUser.user.permissions, allUserPerms)).toBe(
      true
    );

    // Verify role access
    expect(canUserAccess(authenticatedUser.user.role, [Role.USER])).toBe(true);
  });
});
