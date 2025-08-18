/**
 * In-Memory OrganizationRepository Implementation
 * For integration testing without database dependencies
 */

import {
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMember,
  OrgMemberCreateDTO,
  OrgMemberUpdateDTO,
  OrganizationType,
  OrgMemberRole
} from '@shared/schema';
import { IOrganizationRepository } from '../../repositories/interfaces/organization.repository.interface';

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  private organizations: Map<number, Organization> = new Map();
  private members: Map<string, OrgMember> = new Map(); // key: `${orgId}-${userId}`
  private nextOrgId: number = 1;
  private logger: any;

  constructor({ logger }: { logger: any }) {
    this.logger = logger;
  }

  /**
   * Clear all test data - not part of interface
   */
  clearAll(): void {
    this.organizations.clear();
    this.members.clear();
    this.nextOrgId = 1;
  }

  /**
   * Set up test data - not part of interface
   */
  seedOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
    if (org.id >= this.nextOrgId) {
      this.nextOrgId = org.id + 1;
    }
  }

  /**
   * Set up test membership - not part of interface
   */
  seedMembership(orgId: number, userId: number, role: OrgMemberRole = OrgMemberRole.Member): void {
    const key = `${orgId}-${userId}`;
    this.members.set(key, {
      orgId,
      userId,
      role,
      joinedAt: new Date()
    });
  }

  /**
   * Create a new organization
   */
  async create(data: OrganizationCreateDTO): Promise<Organization> {
    // Check if organization already exists
    for (const org of this.organizations.values()) {
      if (org.name === data.name && org.type === data.type) {
        this.logger.debug('Organization already exists, returning existing', {
          organizationId: org.id,
          name: data.name,
          type: data.type
        });
        return org;
      }
    }

    // Create new organization
    const newOrg: Organization = {
      id: this.nextOrgId++,
      name: data.name,
      type: data.type,
      metadata: data.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.organizations.set(newOrg.id, newOrg);

    this.logger.info('Organization created', {
      organizationId: newOrg.id,
      name: data.name,
      type: data.type
    });

    return newOrg;
  }

  /**
   * Update an organization
   */
  async update(id: number, data: OrganizationUpdateDTO): Promise<Organization> {
    const existing = this.organizations.get(id);
    if (!existing) {
      throw new Error('Organization not found');
    }

    // Check for name conflicts if updating name
    if (data.name && data.name !== existing.name) {
      for (const org of this.organizations.values()) {
        if (org.id !== id && org.name === data.name) {
          throw new Error('Organization with this name already exists');
        }
      }
    }

    const updated: Organization = {
      ...existing,
      ...data,
      updatedAt: new Date()
    };

    this.organizations.set(id, updated);

    this.logger.info('Organization updated', {
      organizationId: id,
      changes: data
    });

    return updated;
  }

  /**
   * Delete an organization
   */
  async delete(id: number): Promise<void> {
    if (!this.organizations.has(id)) {
      throw new Error('Organization not found');
    }

    this.organizations.delete(id);

    // Remove all memberships for this organization
    for (const [key, member] of this.members.entries()) {
      if (member.orgId === id) {
        this.members.delete(key);
      }
    }

    this.logger.info('Organization deleted', { organizationId: id });
  }

  /**
   * Get organization by ID
   */
  async getById(id: number): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  /**
   * Add a member to an organization
   */
  async addMember(orgId: number, data: OrgMemberCreateDTO): Promise<OrgMember> {
    if (!this.organizations.has(orgId)) {
      throw new Error('Organization not found');
    }

    const key = `${orgId}-${data.userId}`;
    const member: OrgMember = {
      orgId,
      userId: data.userId,
      role: data.role,
      joinedAt: new Date()
    };

    this.members.set(key, member);

    this.logger.info('Member added to organization', {
      organizationId: orgId,
      userId: data.userId,
      role: data.role
    });

    return member;
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: number, userId: number): Promise<void> {
    const key = `${orgId}-${userId}`;
    
    if (!this.members.has(key)) {
      throw new Error('Member not found in organization');
    }

    this.members.delete(key);

    this.logger.info('Member removed from organization', {
      organizationId: orgId,
      userId
    });
  }

  /**
   * Check if a user is a member of an organization
   */
  async isUserMemberOfOrg(userId: number, orgId: number): Promise<boolean> {
    const key = `${orgId}-${userId}`;
    return this.members.has(key);
  }
}