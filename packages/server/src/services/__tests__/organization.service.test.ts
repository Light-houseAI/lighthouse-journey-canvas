/**
 * Organization Service Tests
 *
 * Comprehensive test coverage for organization service layer including:
 * - Organization CRUD operations
 * - Member management workflows
 * - Permission validation and error handling
 * - Data extraction and migration utilities
 */

import {
  type Organization,
  type OrganizationCreateDTO,
  OrganizationType,
  type OrganizationUpdateDTO,
  type OrgMember,
  type OrgMemberCreateDTO,
  OrgMemberRole,
  TimelineNodeType,
} from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger.js';
import type { OrganizationRepository } from '../../repositories/organization.repository.js';
import { OrganizationService } from '../organization.service.js';

describe('Organization Service Tests', () => {
  let service: OrganizationService;
  let mockRepository: MockProxy<OrganizationRepository>;
  let mockLogger: MockProxy<Logger>;

  const createTestOrganization = (
    overrides: Partial<Organization> = {}
  ): Organization => ({
    id: 1,
    name: 'Test Company',
    type: OrganizationType.Company,
    metadata: {},
    createdAt: new Date('2024-01-01'),
    ...overrides,
  });

  const createTestMember = (overrides: Partial<OrgMember> = {}): OrgMember => ({
    id: 1,
    organizationId: 1,
    userId: 1,
    role: OrgMemberRole.Member,
    joinedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    mockLogger = mock<Logger>();
    mockRepository = mock<OrganizationRepository>();

    service = new OrganizationService({
      organizationRepository: mockRepository,
      logger: mockLogger,
    });
  });

  describe('createOrganization', () => {
    it('should create organization with valid data', async () => {
      // Arrange
      const orgData: OrganizationCreateDTO = {
        name: 'New Company',
        type: OrganizationType.Company,
        metadata: { industry: 'tech' },
      };
      const expectedOrg = createTestOrganization(orgData);
      mockRepository.create.mockResolvedValue(expectedOrg);

      // Act
      const result = await service.createOrganization(orgData);

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith(orgData);
      expect(result).toEqual(expectedOrg);
    });

    it('should handle repository errors and log them', async () => {
      // Arrange
      const orgData: OrganizationCreateDTO = {
        name: 'Failed Company',
        type: OrganizationType.Company,
        metadata: {},
      };
      const error = new Error('Database connection failed');
      mockRepository.create.mockRejectedValue(error);

      // Act & Assert
      await expect(service.createOrganization(orgData)).rejects.toThrow(
        'Database connection failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating organization',
        expect.objectContaining({
          data: orgData,
          error: 'Database connection failed',
        })
      );
    });
  });

  describe('getOrganizationById', () => {
    it('should get organization by valid ID', async () => {
      // Arrange
      const orgId = 1;
      const expectedOrg = createTestOrganization({ id: orgId });
      mockRepository.getById.mockResolvedValue(expectedOrg);

      // Act
      const result = await service.getOrganizationById(orgId);

      // Assert
      expect(mockRepository.getById).toHaveBeenCalledWith(orgId);
      expect(result).toEqual(expectedOrg);
    });

    it('should throw error when organization not found', async () => {
      // Arrange
      const orgId = 999;
      mockRepository.getById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrganizationById(orgId)).rejects.toThrow(
        'Organization not found'
      );
      expect(mockRepository.getById).toHaveBeenCalledWith(orgId);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting organization',
        expect.objectContaining({
          id: orgId,
          error: 'Organization not found',
        })
      );
    });

    it('should throw error for invalid organization ID', async () => {
      // Arrange
      const invalidId = -1;

      // Act & Assert
      await expect(service.getOrganizationById(invalidId)).rejects.toThrow(
        'Invalid organization ID'
      );
      expect(mockRepository.getById).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting organization',
        expect.objectContaining({
          id: invalidId,
          error: 'Invalid organization ID',
        })
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update organization with valid data', async () => {
      // Arrange
      const orgId = 1;
      const updateData: OrganizationUpdateDTO = {
        name: 'Updated Company',
        metadata: { industry: 'finance' },
      };
      const updatedOrg = createTestOrganization({
        id: orgId,
        name: 'Updated Company',
        metadata: { industry: 'finance' },
      });
      mockRepository.update.mockResolvedValue(updatedOrg);

      // Act
      const result = await service.updateOrganization(orgId, updateData);

      // Assert
      expect(mockRepository.update).toHaveBeenCalledWith(orgId, updateData);
      expect(result).toEqual(updatedOrg);
      expect(mockLogger.info).toHaveBeenCalledWith('Organization updated', {
        organizationId: orgId,
        changes: updateData,
      });
    });
  });

  describe('addMember', () => {
    it('should add member to organization successfully', async () => {
      // Arrange
      const orgId = 1;
      const memberData: OrgMemberCreateDTO = {
        userId: 2,
        role: OrgMemberRole.Member,
      };
      const expectedMember = createTestMember({
        organizationId: orgId,
        userId: 2,
        role: OrgMemberRole.Member,
      });
      mockRepository.isUserMemberOfOrg.mockResolvedValue(false);
      mockRepository.addMember.mockResolvedValue(expectedMember);

      // Act
      const result = await service.addMember(orgId, memberData);

      // Assert
      expect(mockRepository.isUserMemberOfOrg).toHaveBeenCalledWith(2, orgId);
      expect(mockRepository.addMember).toHaveBeenCalledWith(orgId, memberData);
      expect(result).toEqual(expectedMember);
      expect(mockLogger.info).toHaveBeenCalledWith('Member added', {
        organizationId: orgId,
        userId: 2,
        role: OrgMemberRole.Member,
      });
    });

    it('should throw error when user is already a member', async () => {
      // Arrange
      const orgId = 1;
      const memberData: OrgMemberCreateDTO = {
        userId: 2,
        role: OrgMemberRole.Member,
      };
      mockRepository.isUserMemberOfOrg.mockResolvedValue(true);

      // Act & Assert
      await expect(service.addMember(orgId, memberData)).rejects.toThrow(
        'User is already a member of this organization'
      );
      expect(mockRepository.isUserMemberOfOrg).toHaveBeenCalledWith(2, orgId);
      expect(mockRepository.addMember).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreateByName', () => {
    it('should find or create organization by name and type', async () => {
      // Arrange
      const name = 'Test University';
      const type = OrganizationType.EducationalInstitution;
      const expectedOrg = createTestOrganization({
        name: 'Test University',
        type: OrganizationType.EducationalInstitution,
      });
      mockRepository.create.mockResolvedValue(expectedOrg);

      // Act
      const result = await service.findOrCreateByName(name, type);

      // Assert
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: 'Test University',
        type: OrganizationType.EducationalInstitution,
        metadata: {},
      });
      expect(result).toEqual(expectedOrg);
    });
  });

  describe('extractOrganizationFromMetadata', () => {
    it('should extract organization from job metadata with company field', async () => {
      // Arrange
      const metadata = { company: 'Test Corp' };
      const nodeType = TimelineNodeType.Job;

      // Act
      const result = await service.extractOrganizationFromMetadata(
        metadata,
        nodeType
      );

      // Assert
      expect(result).toEqual({
        name: 'Test Corp',
        type: OrganizationType.Company,
        metadata: {},
      });
    });
  });
});
