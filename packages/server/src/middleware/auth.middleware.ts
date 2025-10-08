/**
 * Complete Authentication and Authorization System
 *
 * Provides JWT-based authentication with dev mode support,
 * plus role and permission-based authorization middleware.
 */

import { Permission, Role, RolePermissions } from '@journey/schema';
import { NextFunction, Request, Response } from 'express';

import { Container } from '../core/container-setup.js';
import { JWTService } from '../services/jwt.service';
import { UserService } from '../services/user-service';

declare module 'express' {
  interface Request {
    user?: any;
    userId?: number;
  }
}

/**
 * Helper functions to get services from container
 */
const getUserService = (): UserService => {
  const container = Container.getContainer();
  return container.resolve<UserService>('userService');
};

const getJWTService = (): JWTService => {
  const container = Container.getContainer();
  return container.resolve<JWTService>('jwtService');
};

/**
 * Extract JWT token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * JWT authentication middleware with dev mode support
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authorization token required',
        },
      });
    }

    // Verify and decode the JWT token
    const jwtService = getJWTService();
    const payload = jwtService.verifyAccessToken(token);

    // Fetch full user details from database
    const userService = getUserService();
    const user = await userService.getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Invalid token - user not found',
        },
      });
    }

    // Attach user with role and permissions for authorization middleware
    const userRole = Role.USER; // Default role - will be enhanced when role system is added to schema
    const permissions = RolePermissions[userRole] || [];

    (req as any).user = {
      ...user,
      role: userRole,
      permissions,
    };

    req.userId = user.id;

    next();
  } catch (error: any) {
    console.error('Error in JWT auth middleware:', error);

    // Handle specific JWT errors
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    }

    if (
      error.message.includes('Invalid') ||
      error.message.includes('invalid')
    ) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authorization token',
        },
      });
    }

    // JWT malformed, decode error, or verification failures - all auth issues
    if (
      error.message.includes('jwt') ||
      error.message.includes('malformed') ||
      error.message.includes('signature') ||
      error.message.includes('decode')
    ) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authorization token format',
        },
      });
    }

    // Only return 500 for actual server errors (database down, etc.)
    // All token/auth related errors should be 401
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      },
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    // No token provided - continue as anonymous user
    return next();
  }

  try {
    const jwtService = getJWTService();
    const payload = jwtService.verifyAccessToken(token);

    const userService = getUserService();
    const user = await userService.getUserById(payload.userId);

    if (user) {
      const userRole = Role.USER;
      const permissions = RolePermissions[userRole] || [];

      (req as any).user = {
        ...user,
        role: userRole,
        permissions,
      };

      req.userId = user.id;
    }
  } catch (error) {
    // Ignore token errors for optional auth - continue as anonymous
    console.warn('Optional JWT auth failed:', error);
  }

  next();
};

export const requireGuest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = extractBearerToken(req.headers.authorization);

  if (token) {
    try {
      const jwtService = getJWTService();
      jwtService.verifyAccessToken(token);

      // Token is valid, user is authenticated
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_AUTHENTICATED',
          message: 'Already authenticated',
        },
      });
    } catch {
      // Token is invalid or expired, continue as guest
    }
  }

  next();
};

/**
 * Permission middleware - checks if user has required permissions
 * Usage: router.post('/admin/users', requireAuth, requirePermission(Permission.USER_MANAGE), handler)
 */
export const requirePermission = (...permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const hasAllPermissions = permissions.every((permission) =>
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          required: permissions,
        },
      });
    }
    next();
  };
};

/**
 * Role middleware - checks if user has required role
 * Usage: router.get('/admin/dashboard', requireAuth, requireRole(Role.ADMIN), handler)
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    if (!roles.includes(user.role as Role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: 'Insufficient role',
          required: roles,
          current: user.role,
        },
      });
    }
    next();
  };
};

/**
 * Resource access middleware - checks ownership/sharing permissions
 * Usage: router.get('/projects/:projectId', requireAuth, requireResourceAccess('project', 'projectId', 'read'), handler)
 */
export const requireResourceAccess = (
  resourceType: string,
  paramName: string,
  permissionType: string = 'read'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const resourceId = req.params[paramName];
    const scope = (req as any).scope; // Awilix scope

    if (!scope) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CONTAINER_ERROR',
          message: 'Request scope not available',
        },
      });
    }

    try {
      // For now, basic ownership check (user can only access their own resources)
      // This will be enhanced with the resource sharing system
      const isOwner = resourceId === String(user.id);

      if (!isOwner) {
        // TODO: Implement resource ownership service for more sophisticated checks
        // try {
        //   const resourceOwnershipService = scope.resolve(SERVICE_TOKENS.RESOURCE_OWNERSHIP_SERVICE);
        //   const ownershipResult = await resourceOwnershipService.checkOwnership(user, resourceType, resourceId);
        // } catch (error) {
        //   // Resource ownership service not available, fall back to basic check
        // }

        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Access denied - insufficient permissions',
            required: { resourceType, resourceId, permissionType },
          },
        });
      }

      // Set resource access context for the controller
      (req as any).resourceAccess = {
        resourceType,
        resourceId,
        permissionType,
        accessType: 'owner', // Will be enhanced with sharing system
      };

      next();
    } catch (error) {
      console.error('Resource access check failed:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization check failed',
        },
      });
    }
  };
};

/**
 * Ownership middleware - simplified check for user ID parameter
 * Usage: router.get('/users/:userId/profile', requireAuth, requireOwnership('userId'), handler)
 */
export const requireOwnership = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const resourceUserId = req.params[paramName];
    if (String(user.id) !== String(resourceUserId)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Access denied - can only access own resources',
        },
      });
    }

    next();
  };
};
