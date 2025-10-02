/**
 * OrganizationRepository Interface
 * Contract for organization and membership database operations
 */

import {
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMember,
  OrgMemberCreateDTO
} from '@journey/schema';

export interface IOrganizationRepository {
  /**
   * Create a new organization
   */
  create(data: OrganizationCreateDTO): Promise<Organization>;

  /**
   * Update an organization
   */
  update(id: number, data: OrganizationUpdateDTO): Promise<Organization>;

  /**
   * Delete an organization
   */
  delete(id: number): Promise<void>;

  /**
   * Get organization by ID
   */
  getById(id: number): Promise<Organization | null>;

  /**
   * Add a member to an organization
   */
  addMember(orgId: number, data: OrgMemberCreateDTO): Promise<OrgMember>;

  /**
   * Remove a member from an organization
   */
  removeMember(orgId: number, userId: number): Promise<void>;

  /**
   * Check if a user is a member of an organization
   */
  isUserMemberOfOrg(userId: number, orgId: number): Promise<boolean>;

  /**
   * Get organizations that a user is a member of
   */
  getUserOrganizations(userId: number): Promise<Organization[]>;

  /**
   * Search organizations by name
   */
  searchOrganizations(query: string, limit?: number): Promise<Organization[]>;
}
