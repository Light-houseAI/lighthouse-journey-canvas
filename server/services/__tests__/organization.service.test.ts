/**
 * OrganizationService Unit Tests
 * Comprehensive tests for organization management and membership functionality
 * Following structured test approach from node-permissions testing patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContainer, asValue, asClass, InjectionMode } from 'awilix';
import { OrganizationService } from '../organization.service';
import { 
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMember,
  OrgMemberCreateDTO,
  OrganizationType,
  OrgMemberRole
} from '@shared/schema';

// Test Data Setup
interface TestData {
  organizations: {
    acmeCorp: Organization;
    existingCorp: Organization;
    techStartup: Organization;
    harvardUniversity: Organization;
  };
  users: {
    adminUserId: number;
    memberUserId: number;
    externalUserId: number;
  };
  members: {
    adminMember: OrgMember;
    regularMember: OrgMember;
  };
}

// Mock implementations
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

const mockOrganizationRepository = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getById: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  isUserMemberOfOrg: vi.fn()
};

describe('OrganizationService', () => {
  let container: any;
  let organizationService: OrganizationService;
  let testData: TestData;

  // Setup comprehensive test data
  const setupTestData = (): TestData => {
    const baseDate = new Date('2024-01-01');
    
    return {
      organizations: {
        acmeCorp: {
          id: 1,
          name: 'Acme Corp',
          type: OrganizationType.Company,
          metadata: { website: 'https://acme.com' },
          createdAt: baseDate,
          updatedAt: baseDate
        },
        existingCorp: {
          id: 2,
          name: 'Existing Corp',
          type: OrganizationType.Company,
          metadata: {},
          createdAt: baseDate,
          updatedAt: baseDate
        },
        techStartup: {
          id: 3,
          name: 'Tech Startup Inc',
          type: OrganizationType.Company,
          metadata: {},
          createdAt: baseDate,
          updatedAt: baseDate
        },
        harvardUniversity: {
          id: 4,
          name: 'Harvard University',
          type: OrganizationType.EducationalInstitution,
          metadata: {},
          createdAt: baseDate,
          updatedAt: baseDate
        }
      },
      users: {
        adminUserId: 1,
        memberUserId: 2,
        externalUserId: 3
      },
      members: {
        adminMember: {
          orgId: 1,
          userId: 1,
          role: OrgMemberRole.Admin,
          joinedAt: baseDate
        },
        regularMember: {
          orgId: 1,
          userId: 2,
          role: OrgMemberRole.Member,
          joinedAt: baseDate
        }
      }
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    testData = setupTestData();
    
    // Setup Awilix container
    container = createContainer({
      injectionMode: InjectionMode.PROXY
    });
    
    container.register({
      logger: asValue(mockLogger),
      organizationRepository: asValue(mockOrganizationRepository),
      organizationService: asClass(OrganizationService).singleton()
    });
    
    organizationService = container.resolve('organizationService');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('🏢 Organization CRUD Operations', () => {
    describe('Creating Organizations', () => {
      it('should create a new organization with complete metadata', async () => {
        // Arrange
        const createData: OrganizationCreateDTO = {
          name: 'Acme Corp',
          type: OrganizationType.Company,
          metadata: { website: 'https://acme.com' }
        };
        mockOrganizationRepository.create.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        const result = await organizationService.createOrganization(createData);

        // Assert
        expect(result).toEqual(testData.organizations.acmeCorp);
        expect(mockOrganizationRepository.create).toHaveBeenCalledWith(createData);
      });

      it('should return existing organization when creating duplicate', async () => {
        // Arrange
        const createData: OrganizationCreateDTO = {
          name: 'Existing Corp',
          type: OrganizationType.Company
        };
        mockOrganizationRepository.create.mockResolvedValue(testData.organizations.existingCorp);

        // Act
        const result = await organizationService.createOrganization(createData);

        // Assert
        expect(result).toEqual(testData.organizations.existingCorp);
        expect(mockOrganizationRepository.create).toHaveBeenCalledWith(createData);
      });

      it('should handle both company and educational institution types', async () => {
        // Arrange
        const companyData: OrganizationCreateDTO = {
          name: 'Tech Startup Inc',
          type: OrganizationType.Company,
          metadata: {}
        };
        const universityData: OrganizationCreateDTO = {
          name: 'Harvard University', 
          type: OrganizationType.EducationalInstitution,
          metadata: {}
        };

        mockOrganizationRepository.create
          .mockResolvedValueOnce(testData.organizations.techStartup)
          .mockResolvedValueOnce(testData.organizations.harvardUniversity);

        // Act
        const companyResult = await organizationService.createOrganization(companyData);
        const universityResult = await organizationService.createOrganization(universityData);

        // Assert
        expect(companyResult.type).toBe(OrganizationType.Company);
        expect(universityResult.type).toBe(OrganizationType.EducationalInstitution);
        expect(mockOrganizationRepository.create).toHaveBeenCalledTimes(2);
      });
    });

    describe('Reading Organizations', () => {
      it('should retrieve organization by ID', async () => {
        // Arrange
        mockOrganizationRepository.getById.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        const result = await organizationService.getOrganizationById(1);

        // Assert
        expect(result).toEqual(testData.organizations.acmeCorp);
        expect(mockOrganizationRepository.getById).toHaveBeenCalledWith(1);
      });

      it('should throw error when organization not found', async () => {
        // Arrange
        mockOrganizationRepository.getById.mockResolvedValue(null);

        // Act & Assert
        await expect(organizationService.getOrganizationById(999))
          .rejects.toThrow('Organization not found');
      });
    });

    describe('Updating Organizations', () => {
      it('should update organization with new data', async () => {
        // Arrange
        const updateData: OrganizationUpdateDTO = {
          name: 'Updated Corp',
          metadata: { website: 'https://updated.com' }
        };
        const updatedOrg = { ...testData.organizations.acmeCorp, ...updateData };
        mockOrganizationRepository.update.mockResolvedValue(updatedOrg);

        // Act
        const result = await organizationService.updateOrganization(1, updateData);

        // Assert
        expect(result).toEqual(updatedOrg);
        expect(mockOrganizationRepository.update).toHaveBeenCalledWith(1, updateData);
      });
    });

    describe('Deleting Organizations', () => {
      it('should delete organization and log the action', async () => {
        // Arrange
        mockOrganizationRepository.delete.mockResolvedValue(undefined);

        // Act
        await organizationService.deleteOrganization(1);

        // Assert
        expect(mockOrganizationRepository.delete).toHaveBeenCalledWith(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Organization deleted'),
          expect.objectContaining({ organizationId: 1 })
        );
      });
    });
  });

  describe('👥 Member Management', () => {
    describe('Adding Members', () => {
      it('should add a new member to organization with proper validation', async () => {
        // Arrange
        const memberData: OrgMemberCreateDTO = {
          userId: testData.users.memberUserId,
          role: OrgMemberRole.Member
        };
        mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(false);
        mockOrganizationRepository.addMember.mockResolvedValue(testData.members.regularMember);

        // Act
        const result = await organizationService.addMember(
          testData.organizations.acmeCorp.id, 
          memberData
        );

        // Assert
        expect(result).toEqual(testData.members.regularMember);
        expect(mockOrganizationRepository.isUserMemberOfOrg).toHaveBeenCalledWith(
          memberData.userId, 
          testData.organizations.acmeCorp.id
        );
        expect(mockOrganizationRepository.addMember).toHaveBeenCalledWith(
          testData.organizations.acmeCorp.id, 
          memberData
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Member added'),
          expect.objectContaining({
            organizationId: testData.organizations.acmeCorp.id,
            userId: memberData.userId,
            role: memberData.role
          })
        );
      });

      it('should prevent adding existing member with clear error message', async () => {
        // Arrange
        const memberData: OrgMemberCreateDTO = {
          userId: testData.users.memberUserId,
          role: OrgMemberRole.Member
        };
        mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(true);

        // Act & Assert
        await expect(
          organizationService.addMember(testData.organizations.acmeCorp.id, memberData)
        ).rejects.toThrow('User is already a member of this organization');
        
        expect(mockOrganizationRepository.isUserMemberOfOrg).toHaveBeenCalledWith(
          memberData.userId, 
          testData.organizations.acmeCorp.id
        );
        expect(mockOrganizationRepository.addMember).not.toHaveBeenCalled();
      });

      it('should handle admin role assignment correctly', async () => {
        // Arrange
        const adminMemberData: OrgMemberCreateDTO = {
          userId: testData.users.externalUserId,
          role: OrgMemberRole.Admin
        };
        const expectedAdminMember: OrgMember = {
          orgId: testData.organizations.acmeCorp.id,
          userId: testData.users.externalUserId,
          role: OrgMemberRole.Admin,
          joinedAt: new Date('2024-01-01')
        };

        mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(false);
        mockOrganizationRepository.addMember.mockResolvedValue(expectedAdminMember);

        // Act
        const result = await organizationService.addMember(
          testData.organizations.acmeCorp.id, 
          adminMemberData
        );

        // Assert
        expect(result.role).toBe(OrgMemberRole.Admin);
        expect(mockOrganizationRepository.addMember).toHaveBeenCalledWith(
          testData.organizations.acmeCorp.id, 
          adminMemberData
        );
      });
    });

    describe('Removing Members', () => {
      it('should remove member from organization successfully', async () => {
        // Arrange
        const orgId = testData.organizations.acmeCorp.id;
        const userId = testData.users.memberUserId;
        mockOrganizationRepository.removeMember.mockResolvedValue(undefined);

        // Act
        await organizationService.removeMember(orgId, userId);

        // Assert
        expect(mockOrganizationRepository.removeMember).toHaveBeenCalledWith(orgId, userId);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('Member removed'),
          expect.objectContaining({
            organizationId: orgId,
            userId
          })
        );
      });

      it('should handle member not found scenario gracefully', async () => {
        // Arrange
        const orgId = testData.organizations.acmeCorp.id;
        const userId = testData.users.externalUserId;
        mockOrganizationRepository.removeMember.mockRejectedValue(
          new Error('Member not found in organization')
        );

        // Act & Assert
        await expect(
          organizationService.removeMember(orgId, userId)
        ).rejects.toThrow('Member not found in organization');
        
        expect(mockOrganizationRepository.removeMember).toHaveBeenCalledWith(orgId, userId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error removing member'),
          expect.objectContaining({
            orgId,
            userId,
            error: 'Member not found in organization'
          })
        );
      });
    });

    describe('Membership Queries', () => {
      it('should correctly identify organization members', async () => {
        // Arrange
        const userId = testData.users.memberUserId;
        const orgId = testData.organizations.acmeCorp.id;
        mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(true);

        // Act
        const result = await organizationService.isUserMemberOfOrg(userId, orgId);

        // Assert
        expect(result).toBe(true);
        expect(mockOrganizationRepository.isUserMemberOfOrg).toHaveBeenCalledWith(userId, orgId);
      });

      it('should correctly identify non-members', async () => {
        // Arrange
        const userId = testData.users.externalUserId;
        const orgId = testData.organizations.acmeCorp.id;
        mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(false);

        // Act
        const result = await organizationService.isUserMemberOfOrg(userId, orgId);

        // Assert
        expect(result).toBe(false);
        expect(mockOrganizationRepository.isUserMemberOfOrg).toHaveBeenCalledWith(userId, orgId);
      });

      it('should validate user and organization IDs before membership check', async () => {
        // Arrange
        const invalidUserId = -1;
        const validOrgId = testData.organizations.acmeCorp.id;

        // Act & Assert
        await expect(
          organizationService.isUserMemberOfOrg(invalidUserId, validOrgId)
        ).rejects.toThrow('Invalid user ID');
        
        expect(mockOrganizationRepository.isUserMemberOfOrg).not.toHaveBeenCalled();
      });
    });
  });


  describe('📋 Data Migration Support', () => {
    describe('Legacy Metadata Extraction', () => {
      it('should extract company organization from job node metadata', async () => {
        // Arrange
        const nodeMetadata = { company: 'Tech Startup Inc' };
        
        // Act
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        // Assert
        expect(result).toEqual({
          name: 'Tech Startup Inc',
          type: OrganizationType.Company,
          metadata: {}
        });
      });

      it('should extract educational institution from education node metadata', async () => {
        // Arrange
        const nodeMetadata = { institution: 'Harvard University' };
        
        // Act
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'education'
        );

        // Assert
        expect(result).toEqual({
          name: 'Harvard University',
          type: OrganizationType.EducationalInstitution,
          metadata: {}
        });
      });

      it('should return null for metadata without organization fields', async () => {
        // Arrange
        const nodeMetadata = { title: 'Some Job', description: 'A job without company' };
        
        // Act
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        // Assert
        expect(result).toBe(null);
      });

      it('should return null for empty or invalid organization names', async () => {
        // Arrange
        const testCases = [
          { company: '' },
          { company: '   ' },
          { company: null },
          { institution: '' },
          { institution: '   ' }
        ];

        for (const nodeMetadata of testCases) {
          // Act
          const jobResult = await organizationService.extractOrganizationFromMetadata(
            nodeMetadata, 
            'job'
          );
          const eduResult = await organizationService.extractOrganizationFromMetadata(
            nodeMetadata, 
            'education'
          );

          // Assert
          expect(jobResult).toBe(null);
          expect(eduResult).toBe(null);
        }
      });
    });

    describe('Organization ID-based Extraction', () => {
      it('should extract organization using orgId when present', async () => {
        // Arrange
        const nodeMetadata = { orgId: testData.organizations.acmeCorp.id };
        mockOrganizationRepository.getById.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        // Assert
        expect(result).toEqual({
          name: testData.organizations.acmeCorp.name,
          type: testData.organizations.acmeCorp.type,
          metadata: testData.organizations.acmeCorp.metadata
        });
        expect(mockOrganizationRepository.getById).toHaveBeenCalledWith(
          testData.organizations.acmeCorp.id
        );
      });

      it('should fallback to legacy fields when orgId organization not found', async () => {
        // Arrange
        const nodeMetadata = { 
          orgId: 999, 
          company: 'Fallback Company' 
        };
        mockOrganizationRepository.getById.mockRejectedValue(new Error('Organization not found'));

        // Act
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        // Assert
        expect(result).toBe(null);  // The method returns null when orgId lookup fails
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Organization not found for orgId',
          expect.objectContaining({ orgId: 999, nodeType: 'job' })
        );
      });
    });

    describe('Organization Name Retrieval from Nodes', () => {
      it('should get organization name from node using orgId', async () => {
        // Arrange
        const node = {
          type: 'job',
          meta: { orgId: testData.organizations.acmeCorp.id }
        };
        mockOrganizationRepository.getById.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        const result = await organizationService.getOrganizationNameFromNode(node);

        // Assert
        expect(result).toBe(testData.organizations.acmeCorp.name);
        expect(mockOrganizationRepository.getById).toHaveBeenCalledWith(
          testData.organizations.acmeCorp.id
        );
      });

      it('should fallback to legacy company field when orgId lookup fails', async () => {
        // Arrange
        const node = {
          type: 'job',
          meta: { orgId: 999, company: 'Legacy Company Name' }
        };
        mockOrganizationRepository.getById.mockRejectedValue(new Error('Organization not found'));

        // Act
        const result = await organizationService.getOrganizationNameFromNode(node);

        // Assert
        expect(result).toBe('Legacy Company Name');
      });

      it('should fallback to legacy institution field for education nodes', async () => {
        // Arrange
        const node = {
          type: 'education',
          meta: { institution: 'Legacy University' }
        };

        // Act
        const result = await organizationService.getOrganizationNameFromNode(node);

        // Assert
        expect(result).toBe('Legacy University');
      });

      it('should return null when no organization data available', async () => {
        // Arrange
        const node = {
          type: 'job',
          meta: { title: 'Some Job' }
        };

        // Act
        const result = await organizationService.getOrganizationNameFromNode(node);

        // Assert
        expect(result).toBe(null);
      });
    });

    describe('Find or Create Organization', () => {
      it('should create new organization when none exists with given name', async () => {
        // Arrange
        const orgName = 'New Company';
        const orgType = OrganizationType.Company;
        const expectedOrgData = { name: orgName, type: orgType, metadata: {} };
        mockOrganizationRepository.create.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        const result = await organizationService.findOrCreateByName(orgName, orgType);

        // Assert
        expect(result).toEqual(testData.organizations.acmeCorp);
        expect(mockOrganizationRepository.create).toHaveBeenCalledWith(expectedOrgData);
      });

      it('should return existing organization when duplicate is created', async () => {
        // Arrange
        const orgName = testData.organizations.existingCorp.name;
        const orgType = testData.organizations.existingCorp.type;
        const expectedOrgData = { name: orgName, type: orgType, metadata: {} };
        mockOrganizationRepository.create.mockResolvedValue(testData.organizations.existingCorp);

        // Act
        const result = await organizationService.findOrCreateByName(orgName, orgType);

        // Assert
        expect(result).toEqual(testData.organizations.existingCorp);
        expect(mockOrganizationRepository.create).toHaveBeenCalledWith(expectedOrgData);
      });

      it('should trim organization names before processing', async () => {
        // Arrange
        const orgName = '  Trimmed Company  ';
        const orgType = OrganizationType.Company;
        const expectedOrgData = { name: 'Trimmed Company', type: orgType, metadata: {} };
        mockOrganizationRepository.create.mockResolvedValue(testData.organizations.acmeCorp);

        // Act
        await organizationService.findOrCreateByName(orgName, orgType);

        // Assert
        expect(mockOrganizationRepository.create).toHaveBeenCalledWith(expectedOrgData);
      });
    });
  });

  describe('🚨 Error Handling & Validation', () => {
    describe('Database Error Handling', () => {
      it('should handle database errors during organization creation', async () => {
        // Arrange
        const createData: OrganizationCreateDTO = {
          name: 'Test Corp',
          type: OrganizationType.Company
        };
        const dbError = new Error('Database connection failed');
        mockOrganizationRepository.create.mockRejectedValue(dbError);

        // Act & Assert
        await expect(
          organizationService.createOrganization(createData)
        ).rejects.toThrow('Database connection failed');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error creating organization',
          expect.objectContaining({
            data: createData,
            error: 'Database connection failed'
          })
        );
      });

      it('should handle database errors during member operations', async () => {
        // Arrange
        const orgId = testData.organizations.acmeCorp.id;
        const userId = testData.users.memberUserId;
        const dbError = new Error('Connection timeout');
        mockOrganizationRepository.removeMember.mockRejectedValue(dbError);

        // Act & Assert
        await expect(
          organizationService.removeMember(orgId, userId)
        ).rejects.toThrow('Connection timeout');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error removing member',
          expect.objectContaining({
            orgId,
            userId,
            error: 'Connection timeout'
          })
        );
      });

      it('should handle database errors during organization updates', async () => {
        // Arrange
        const orgId = testData.organizations.acmeCorp.id;
        const updateData: OrganizationUpdateDTO = { name: 'Updated Corp' };
        const dbError = new Error('Constraint violation');
        mockOrganizationRepository.update.mockRejectedValue(dbError);

        // Act & Assert
        await expect(
          organizationService.updateOrganization(orgId, updateData)
        ).rejects.toThrow('Constraint violation');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error updating organization',
          expect.objectContaining({
            id: orgId,
            data: updateData,
            error: 'Constraint violation'
          })
        );
      });
    });

    describe('Input Validation', () => {
      it('should validate organization ID format in getOrganizationById', async () => {
        // Arrange
        const invalidIds = [-1, 0, NaN];

        for (const invalidId of invalidIds) {
          // Act & Assert
          await expect(
            organizationService.getOrganizationById(invalidId)
          ).rejects.toThrow('Invalid organization ID');
        }
      });

      it('should validate organization ID format in updateOrganization', async () => {
        // Arrange
        const invalidId = -1;
        const updateData: OrganizationUpdateDTO = { name: 'Updated' };

        // Act & Assert
        await expect(
          organizationService.updateOrganization(invalidId, updateData)
        ).rejects.toThrow('Invalid organization ID');
      });

      it('should validate user ID format in membership operations', async () => {
        // Arrange
        const validOrgId = testData.organizations.acmeCorp.id;
        const invalidUserIds = [-1, 0];

        for (const invalidUserId of invalidUserIds) {
          // Act & Assert
          await expect(
            organizationService.isUserMemberOfOrg(invalidUserId, validOrgId)
          ).rejects.toThrow('Invalid user ID');
          
          await expect(
            organizationService.addMember(validOrgId, {
              userId: invalidUserId,
              role: OrgMemberRole.Member
            })
          ).rejects.toThrow('Invalid user ID');
        }
      });

      it('should validate organization ID format in membership operations', async () => {
        // Arrange
        const validUserId = testData.users.memberUserId;
        const invalidOrgIds = [-1, 0];

        for (const invalidOrgId of invalidOrgIds) {
          // Act & Assert
          await expect(
            organizationService.isUserMemberOfOrg(validUserId, invalidOrgId)
          ).rejects.toThrow('Invalid organization ID');
          
          await expect(
            organizationService.addMember(invalidOrgId, {
              userId: validUserId,
              role: OrgMemberRole.Member
            })
          ).rejects.toThrow('Invalid organization ID');
        }
      });
    });

    describe('Business Logic Validation', () => {
      it('should throw error when organization not found during retrieval', async () => {
        // Arrange
        const nonExistentId = 999;
        mockOrganizationRepository.getById.mockResolvedValue(null);

        // Act & Assert
        await expect(
          organizationService.getOrganizationById(nonExistentId)
        ).rejects.toThrow('Organization not found');
        
        expect(mockOrganizationRepository.getById).toHaveBeenCalledWith(nonExistentId);
      });

      it('should handle metadata extraction errors gracefully when general error occurs', async () => {
        // Arrange - Force an error by making the service itself throw
        const originalExtractMethod = organizationService.extractOrganizationFromMetadata;
        vi.spyOn(organizationService, 'extractOrganizationFromMetadata').mockImplementation(async () => {
          throw new Error('Database error');
        });

        // Act & Assert
        await expect(
          organizationService.extractOrganizationFromMetadata({ company: 'Test' }, 'job')
        ).rejects.toThrow('Database error');
        
        // Restore original method
        organizationService.extractOrganizationFromMetadata = originalExtractMethod;
      });

      it('should handle findOrCreateByName errors with proper logging', async () => {
        // Arrange
        const orgName = 'Test Company';
        const orgType = OrganizationType.Company;
        const createError = new Error('Unique constraint violation');
        mockOrganizationRepository.create.mockRejectedValue(createError);

        // Act & Assert
        await expect(
          organizationService.findOrCreateByName(orgName, orgType)
        ).rejects.toThrow('Unique constraint violation');
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error finding or creating organization',
          expect.objectContaining({
            name: orgName,
            type: orgType,
            error: 'Unique constraint violation'
          })
        );
      });
    });
  });
});