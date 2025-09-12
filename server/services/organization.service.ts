/**
 * OrganizationService
 * Business logic layer for organization and membership management
 */

import {
  OrganizationType,
  TimelineNodeType,
} from '@shared/enums';
import {
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMember,
  OrgMemberCreateDTO,
} from '@shared/types';

import type { Logger } from '../core/logger';
import { OrganizationRepository } from '../repositories/organization.repository';

export { OrganizationType } from '@shared/enums';

export class OrganizationService {
  constructor({
    organizationRepository,
    logger,
  }: {
    organizationRepository: OrganizationRepository;
    logger: Logger;
  }) {
    this.organizationRepository = organizationRepository;
    this.logger = logger;
  }

  private readonly organizationRepository: OrganizationRepository;
  private readonly logger: Logger;

  /**
   * Create a new organization
   */
  async createOrganization(data: OrganizationCreateDTO): Promise<Organization> {
    try {
      return await this.organizationRepository.create(data);
    } catch (error) {
      this.logger.error('Error creating organization', {
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update an organization
   */
  async updateOrganization(
    id: number,
    data: OrganizationUpdateDTO
  ): Promise<Organization> {
    try {
      this.validateOrganizationId(id);

      const organization = await this.organizationRepository.update(id, data);

      this.logger.info('Organization updated', {
        organizationId: id,
        changes: data,
      });

      return organization;
    } catch (error) {
      this.logger.error('Error updating organization', {
        id,
        data,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(id: number): Promise<void> {
    try {
      this.validateOrganizationId(id);

      await this.organizationRepository.delete(id);

      this.logger.info('Organization deleted', {
        organizationId: id,
      });
    } catch (error) {
      this.logger.error('Error deleting organization', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: number): Promise<Organization> {
    try {
      this.validateOrganizationId(id);

      const organization = await this.organizationRepository.getById(id);
      if (!organization) {
        throw new Error('Organization not found');
      }

      return organization;
    } catch (error) {
      this.logger.error('Error getting organization', {
        id,
        error: error instanceof Error ? error.message : String(error),
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

      // Check if user is already a member
      const isMember = await this.organizationRepository.isUserMemberOfOrg(
        data.userId,
        orgId
      );
      if (isMember) {
        throw new Error('User is already a member of this organization');
      }

      const member = await this.organizationRepository.addMember(orgId, data);

      this.logger.info('Member added', {
        organizationId: orgId,
        userId: data.userId,
        role: data.role,
      });

      return member;
    } catch (error) {
      this.logger.error('Error adding member', {
        orgId,
        data,
        error: error instanceof Error ? error.message : String(error),
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

      await this.organizationRepository.removeMember(orgId, userId);

      this.logger.info('Member removed', {
        organizationId: orgId,
        userId,
      });
    } catch (error) {
      this.logger.error('Error removing member', {
        orgId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get user's organizations
   */

  /**
   * Check if user is member of organization
   */
  async isUserMemberOfOrg(userId: number, orgId: number): Promise<boolean> {
    try {
      this.validateUserId(userId);
      this.validateOrganizationId(orgId);

      return await this.organizationRepository.isUserMemberOfOrg(userId, orgId);
    } catch (error) {
      this.logger.error('Error checking membership', {
        userId,
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get user's role in organization
   */

  /**
   * Add member with admin privileges (only admins can add members)
   */

  /**
   * Remove member with admin privileges
   */

  /**
   * Extract organization data from timeline node metadata
   * Used for data migration from legacy nodes
   */
  async extractOrganizationFromMetadata(
    metadata: Record<string, any>,
    nodeType: string
  ): Promise<OrganizationCreateDTO | null> {
    try {
      // For job and education nodes, orgId should be in metadata
      if (
        (nodeType === TimelineNodeType.Job ||
          nodeType === TimelineNodeType.Education) &&
        metadata.orgId
      ) {
        // If orgId exists, look up the organization
        try {
          const org = await this.getOrganizationById(metadata.orgId);
          return {
            name: org.name,
            type: org.type,
            metadata: org.metadata,
          };
        } catch (error) {
          // Organization not found, return null
          this.logger.warn('Organization not found for orgId', {
            orgId: metadata.orgId,
            nodeType,
            error,
          });
          return null;
        }
      }

      // Fallback: Extract from legacy company/institution fields for migration purposes
      let orgName: string | null = null;
      let orgType: OrganizationType = OrganizationType.Other;

      if (nodeType === TimelineNodeType.Job && metadata.company) {
        orgName = metadata.company;
        orgType = OrganizationType.Company;
      } else if (
        nodeType === TimelineNodeType.Education &&
        metadata.institution
      ) {
        orgName = metadata.institution;
        orgType = OrganizationType.EducationalInstitution;
      }

      if (!orgName || typeof orgName !== 'string' || orgName.trim() === '') {
        return null;
      }

      return {
        name: orgName.trim(),
        type: orgType,
        metadata: {},
      };
    } catch (error) {
      this.logger.error('Error extracting organization from metadata', {
        metadata,
        nodeType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Find an organization by name and type, or create it if it doesn't exist
   * This is used when processing external data (resumes, LinkedIn) that has organization names
   */
  async findOrCreateByName(
    name: string,
    type: OrganizationType
  ): Promise<Organization> {
    try {
      // Validate name is not empty
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Organization name cannot be empty');
      }

      // Repository's create method now handles finding existing organizations
      const orgData: OrganizationCreateDTO = {
        name: name.trim(),
        type,
        metadata: {},
      };

      return await this.organizationRepository.create(orgData);
    } catch (error) {
      this.logger.error('Error finding or creating organization', {
        name,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get organization name from a timeline node, supporting both new orgId and legacy company/institution fields
   */
  async getOrganizationNameFromNode(node: {
    type: string;
    meta: Record<string, any>;
  }): Promise<string | null> {
    try {
      // Try new orgId field first
      if (node.meta.orgId) {
        const org = await this.getOrganizationById(node.meta.orgId);
        return org.name;
      }

      // Fallback to legacy fields
      if (node.type === 'job' && node.meta.company) {
        return node.meta.company;
      }

      if (node.type === 'education' && node.meta.institution) {
        return node.meta.institution;
      }

      return null;
    } catch (error) {
      // If org lookup fails, fallback to legacy fields
      if (node.type === 'job' && node.meta.company) {
        return node.meta.company;
      }

      if (node.type === 'education' && node.meta.institution) {
        return node.meta.institution;
      }
      this.logger.error('Error getting organization name from node', {
        node,
        error: error instanceof Error ? error.message : String(error),
      });

      return null;
    }
  }

  /**
   * Get organization statistics
   */

  /**
   * Validate organization ID
   */
  private validateOrganizationId(id: number): void {
    if (typeof id !== 'number' || id <= 0 || isNaN(id)) {
      throw new Error('Invalid organization ID');
    }
  }

  /**
   * Validate user ID
   */
  private validateUserId(id: number): void {
    if (typeof id !== 'number' || id <= 0 || isNaN(id)) {
      throw new Error('Invalid user ID');
    }
  }
}
