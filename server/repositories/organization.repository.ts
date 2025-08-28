/**
 * OrganizationRepository
 * Database access layer for organizations and membership management
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger';
import * as schema from '@shared/schema';
import {
  organizations,
  orgMembers,
  users,
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMember,
  OrgMemberCreateDTO,
  OrgMemberUpdateDTO,
  OrgMemberRole,
  OrganizationType
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';



export class OrganizationRepository {
  constructor({ database, logger }: { database: NodePgDatabase<typeof schema>; logger: Logger }) {
    this.database = database;
    this.logger = logger;
  }

  private readonly database: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  /**
   * Create a new organization
   */
  async create(data: OrganizationCreateDTO): Promise<Organization> {
    try {
      // Check if organization already exists first
      const existing = await this.getByName(data.name);
      if (existing && existing.type === data.type) {
        this.logger.debug('Organization already exists, returning existing', {
          organizationId: existing.id,
          name: data.name,
          type: data.type
        });
        return existing;
      }

      // Create new organization if it doesn't exist
      const result = await this.database
        .insert(organizations)
        .values({
          name: data.name,
          type: data.type,
          metadata: data.metadata
        })
        .returning();

      if (Array.isArray(result) && result.length === 0) {
        throw new Error('Failed to create organization');
      }

      const organization = Array.isArray(result) ? result[0] : result;

      this.logger.info('Organization created', {
        organizationId: organization.id,
        name: data.name,
        type: data.type
      });

      return organization;
    } catch (error) {
      this.logger.error('Error creating organization', {
        data,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update an organization
   */
  async update(id: number, data: OrganizationUpdateDTO): Promise<Organization> {
    try {
      this.validateOrganizationId(id);

      // If updating name, check for duplicates
      if (data.name) {
        const existing = await this.getByName(data.name);
        if (existing && existing.id !== id) {
          throw new Error('Organization with this name already exists');
        }
      }

      const result = await this.database
        .update(organizations)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, id))
        .returning();

      if (result.length === 0) {
        throw new Error('Organization not found');
      }

      this.logger.info('Organization updated', {
        organizationId: id,
        changes: data
      });

      return result[0];
    } catch (error) {
      this.logger.error('Error updating organization', {
        id,
        data,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete an organization
   */
  async delete(id: number): Promise<void> {
    try {
      this.validateOrganizationId(id);

      const result = await this.database
        .delete(organizations)
        .where(eq(organizations.id, id));

      if (result.rowCount === 0) {
        throw new Error('Organization not found');
      }

      this.logger.info('Organization deleted', { organizationId: id });
    } catch (error) {
      this.logger.error('Error deleting organization', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getById(id: number): Promise<Organization | null> {
    try {
      this.validateOrganizationId(id);

      const result = await this.database
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error('Error getting organization by ID', {
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Add a member to an organization
   */
  async addMember(orgId: number, data: OrgMemberCreateDTO): Promise<OrgMember> {
    try {
      this.validateOrganizationId(orgId);
      this.validateUserId(data.userId);

      const result = await this.database
        .insert(orgMembers)
        .values({
          orgId,
          userId: data.userId,
          role: data.role
        })
        .returning();

      if (result.length === 0) {
        throw new Error('Failed to add member');
      }

      this.logger.info('Member added to organization', {
        organizationId: orgId,
        userId: data.userId,
        role: data.role
      });

      return result[0];
    } catch (error) {
      this.logger.error('Error adding member', {
        orgId,
        data,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: number, userId: number): Promise<void> {
    try {
      this.validateOrganizationId(orgId);
      this.validateUserId(userId);

      const result = await this.database
        .delete(orgMembers)
        .where(and(
          eq(orgMembers.orgId, orgId),
          eq(orgMembers.userId, userId)
        ));

      if (result.rowCount === 0) {
        throw new Error('Member not found in organization');
      }

      this.logger.info('Member removed from organization', {
        organizationId: orgId,
        userId
      });
    } catch (error) {
      this.logger.error('Error removing member', {
        orgId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if a user is a member of an organization
   */
  async isUserMemberOfOrg(userId: number, orgId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateOrganizationId(orgId);

      const result = await this.database
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(and(
          eq(orgMembers.userId, userId),
          eq(orgMembers.orgId, orgId)
        ))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.logger.error('Error checking organization membership', {
        userId,
        orgId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate organization ID
   */
  /**
   * Get organization by name (private method for internal use)
   */
  private async getByName(name: string): Promise<Organization | null> {
    try {
      const result = await this.database
        .select()
        .from(organizations)
        .where(eq(organizations.name, name))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error('Error getting organization by name', {
        name,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private validateOrganizationId(id: number): void {
    if (typeof id !== 'number' || id <= 0) {
      throw new Error('Invalid organization ID');
    }
  }

  /**
   * Validate user ID
   */
  private validateUserId(id: number): void {
    if (typeof id !== 'number' || id <= 0) {
      throw new Error('Invalid user ID');
    }
  }

  /**
   * Get organizations that a user is a member of
   */
  async getUserOrganizations(userId: number): Promise<Organization[]> {
    try {
      this.validateUserId(userId);

      const result = await this.database
        .select({
          id: organizations.id,
          name: organizations.name,
          type: organizations.type,
          metadata: organizations.metadata,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        })
        .from(organizations)
        .innerJoin(orgMembers, eq(organizations.id, orgMembers.orgId))
        .where(eq(orgMembers.userId, userId))
        .orderBy(organizations.name);

      return result;
    } catch (error) {
      this.logger.error('Error getting user organizations', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Search organizations by name
   */
  async searchOrganizations(query: string, limit: number = 10): Promise<Organization[]> {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = `%${query.trim().toLowerCase()}%`;
      
      const result = await this.database
        .select()
        .from(organizations)
        .where(
          // Search by name (case-insensitive)
          sql`LOWER(${organizations.name}) LIKE ${searchTerm}`
        )
        .limit(limit)
        .orderBy(organizations.name);

      return result;
    } catch (error) {
      this.logger.error('Error searching organizations', {
        query,
        limit,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
