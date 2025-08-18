/**
 * Authentication Service
 * Handles user authentication via sessions and dev mode
 * Updated for Awilix dependency injection
 */

import { Role, Permission, RolePermissions, UserContext, AuthContext, AuthenticatedUser } from '@shared/permissions';
import { storage } from './storage.service';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger';

export interface AuthResult {
  success: boolean;
  reason?: string;
  user?: UserContext;
  context?: AuthContext;
}

export class AuthService {
  private database: NodePgDatabase<any>;
  private logger: Logger;

  constructor({ database, logger }: { database: NodePgDatabase<any>, logger: Logger }) {
    this.database = database;
    this.logger = logger;
  }
  async validateSession(userId: number): Promise<AuthResult> {
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        return { success: false, reason: 'user_not_found' };
      }

      // For now, default to USER role - will be enhanced when role system is added to schema
      const userRole = Role.USER;
      const permissions = RolePermissions[userRole] || [];
      
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: userRole,
          permissions
        },
        context: {
          method: 'session',
          sessionId: `session_${userId}_${Date.now()}`
        }
      };
    } catch (error) {
      return { success: false, reason: 'validation_error' };
    }
  }


  async getDevModeUser(): Promise<AuthResult> {
    // Simplified dev mode - no complex setup
    let devUser = await storage.getUserById(17);
    if (!devUser) {
      throw new Error('Dev mode user not found');
    }

    // Ensure user has proper onboarding flags set for dev mode
    if (!devUser.interest) {
      console.log('🚧 DEV_MODE: Setting user interest to find_job');
      devUser = await storage.updateUserInterest(17, 'find_job');
    }
    if (!devUser.hasCompletedOnboarding) {
      console.log('🚧 DEV_MODE: Marking onboarding as complete');
      devUser = await storage.completeOnboarding(17);
    }

    const userRole = Role.USER;
    const permissions = RolePermissions[userRole] || [];

    return {
      success: true,
      user: {
        id: devUser.id,
        email: devUser.email,
        role: userRole,
        permissions
      },
      context: {
        method: 'dev_mode'
      }
    };
  }

  async checkResourceOwnership(userId: number, resourceId: string, resourceType: string): Promise<boolean> {
    // For now, implement basic resource ownership check
    // This can be expanded based on specific resource types
    return true;
  }

  /**
   * Create a test session for Playwright testing
   * Provides session-based authentication for tests
   */
  async createTestSession(userId: number = 17): Promise<{ sessionId: string; user: any }> {
    const user = await storage.getUserById(userId);
    if (!user) {
      throw new Error('Test user not found');
    }
    
    const sessionId = `test_session_${userId}_${Date.now()}`;
    return { sessionId, user };
  }
}