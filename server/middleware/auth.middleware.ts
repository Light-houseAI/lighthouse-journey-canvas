/**
 * Complete Authentication and Authorization System
 * 
 * Provides session and header-based authentication with dev mode support,
 * plus role and permission-based authorization middleware.
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "../services/storage.service";
import { Permission, Role, RolePermissions } from '@shared/permissions';
import { SERVICE_TOKENS } from '../core/container-tokens';

declare module "express-session" {
  interface SessionData {
    userId?: number;
    user?: any;
  }
}

/**
 * Simplified auth middleware with session and header support
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Check for X-User-Id header first (for testing)
  const userIdHeader = req.headers['x-user-id'] as string;
  
  if (userIdHeader) {
    const userId = parseInt(userIdHeader, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid X-User-Id header" });
    }
    
    console.log('🧪 Using X-User-Id header for authentication:', userId);
    try {
      let user = await storage.getUserById(userId);
      if (user) {
        if (!user.interest) {
          console.log('🔧 Setting user interest to find_job');
          user = await storage.updateUserInterest(userId, 'find_job');
        }
        if (!user.hasCompletedOnboarding) {
          console.log('🔧 Marking onboarding as complete');
          user = await storage.completeOnboarding(userId);
        }
        
        (req as any).user = user;
        req.session.userId = userId;
        return next();
      } else {
        return res.status(401).json({ error: "User not found" });
      }
    } catch (error) {
      console.error(`❌ Error fetching user ${userId}:`, error);
      return res.status(500).json({ error: "Authentication error" });
    }
  }

  // Check for authentication via session
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const userId = req.session.userId || 
                   parseInt(req.headers['X-User-Id'] as string, 10) || 
                   parseInt(req.headers['x-user-id'] as string, 10);
    
    const user = await storage.getUserById(userId);
    if (!user) {
      req.session.userId = undefined;
      return res.status(401).json({ error: "Invalid session" });
    }

    // Attach user with role and permissions for authorization middleware
    const userRole = Role.USER; // Default role - will be enhanced when role system is added to schema
    const permissions = RolePermissions[userRole] || [];
    
    (req as any).user = {
      ...user,
      role: userRole,
      permissions
    };
    next();
  } catch (error) {
    console.error("Error in auth middleware:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const requireGuest = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) {
    return res.status(400).json({ error: "Already authenticated" });
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
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const hasAllPermissions = permissions.every(permission => 
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({ 
        success: false,
        error: { 
          code: 'INSUFFICIENT_PERMISSIONS', 
          message: 'Insufficient permissions',
          required: permissions
        }
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
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    if (!roles.includes(user.role as Role)) {
      return res.status(403).json({ 
        success: false,
        error: { 
          code: 'INSUFFICIENT_ROLE', 
          message: 'Insufficient role',
          required: roles,
          current: user.role
        }
      });
    }
    next();
  };
};

/**
 * Resource access middleware - checks ownership/sharing permissions
 * Usage: router.get('/projects/:projectId', requireAuth, requireResourceAccess('project', 'projectId', 'read'), handler)
 */
export const requireResourceAccess = (resourceType: string, paramName: string, permissionType: string = 'read') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const resourceId = req.params[paramName];
    const scope = (req as any).scope; // Awilix scope
    
    if (!scope) {
      return res.status(500).json({ 
        success: false,
        error: { code: 'CONTAINER_ERROR', message: 'Request scope not available' }
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
            required: { resourceType, resourceId, permissionType }
          }
        });
      }

      // Set resource access context for the controller
      (req as any).resourceAccess = {
        resourceType,
        resourceId,
        permissionType,
        accessType: 'owner' // Will be enhanced with sharing system
      };

      next();
    } catch (error) {
      console.error('Resource access check failed:', error);
      return res.status(500).json({ 
        success: false,
        error: { code: 'AUTHORIZATION_ERROR', message: 'Authorization check failed' }
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
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const resourceUserId = req.params[paramName];
    if (String(user.id) !== String(resourceUserId)) {
      return res.status(403).json({ 
        success: false,
        error: { 
          code: 'ACCESS_DENIED', 
          message: 'Access denied - can only access own resources'
        }
      });
    }

    next();
  };
};