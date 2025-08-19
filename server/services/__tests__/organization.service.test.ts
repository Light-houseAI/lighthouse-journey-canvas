/**
 * OrganizationService Integration Tests
 * 
 * Testing with real in-memory repositories instead of mocks.
 * This provides better test coverage and eliminates DRY violations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrganizationService } from '../organization.service';
import { TestContainer } from '../../core/test-container-setup';
import { SERVICE_TOKENS } from '../../core/container-tokens';
import { 
  Organization,
  OrganizationCreateDTO,
  OrganizationUpdateDTO,
  OrgMemberCreateDTO,
  OrganizationType,
  OrgMemberRole
} from '@shared/schema';

// Test constants
const TEST_USERS = {
  admin: 1,
  member: 2,
  outsider: 3
};

describe('OrganizationService Integration Tests', () => {
  let container: any;
  let organizationService: OrganizationService;
  
  let testOrgId: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up test container with in-memory repositories
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    container = TestContainer.configure(mockLogger);
    organizationService = container.resolve(SERVICE_TOKENS.ORGANIZATION_SERVICE);
  });

  afterEach(() => {
    vi.resetAllMocks();
    TestContainer.reset();
  });

  describe('🏢 Organization CRUD Operations', () => {
    describe('Creating Organizations', () => {
      it('should create a new organization with complete metadata', async () => {
        const createData: OrganizationCreateDTO = {
          name: 'Acme Corp',
          type: OrganizationType.Company,
          metadata: { website: 'https://acme.com' }
        };

        const result = await organizationService.createOrganization(createData);

        expect(result).toBeDefined();
        expect(result.name).toBe('Acme Corp');
        expect(result.type).toBe(OrganizationType.Company);
        expect(result.metadata).toEqual({ website: 'https://acme.com' });
        expect(result.id).toBeDefined();
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();
      });

      it('should create organizations with different types', async () => {
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

        const companyResult = await organizationService.createOrganization(companyData);
        const universityResult = await organizationService.createOrganization(universityData);

        expect(companyResult.type).toBe(OrganizationType.Company);
        expect(universityResult.type).toBe(OrganizationType.EducationalInstitution);
        expect(companyResult.name).toBe('Tech Startup Inc');
        expect(universityResult.name).toBe('Harvard University');
      });

      it('should handle creating organization with minimal data', async () => {
        const createData: OrganizationCreateDTO = {
          name: 'Minimal Corp',
          type: OrganizationType.Company
        };

        const result = await organizationService.createOrganization(createData);

        expect(result.name).toBe('Minimal Corp');
        expect(result.type).toBe(OrganizationType.Company);
        expect(result.metadata).toEqual({});
      });
    });

    describe('Reading Organizations', () => {
      beforeEach(async () => {
        const org = await organizationService.createOrganization({
          name: 'Test Organization',
          type: OrganizationType.Company,
          metadata: {}
        });
        testOrgId = org.id;
      });

      it('should retrieve organization by ID', async () => {
        const result = await organizationService.getOrganizationById(testOrgId);

        expect(result).toBeDefined();
        expect(result.id).toBe(testOrgId);
        expect(result.name).toBe('Test Organization');
        expect(result.type).toBe(OrganizationType.Company);
      });

      it('should throw error when organization not found', async () => {
        await expect(organizationService.getOrganizationById(999))
          .rejects.toThrow('Organization not found');
      });
    });

    describe('Updating Organizations', () => {
      beforeEach(async () => {
        const org = await organizationService.createOrganization({
          name: 'Original Name',
          type: OrganizationType.Company,
          metadata: { website: 'https://original.com' }
        });
        testOrgId = org.id;
      });

      it('should update organization with new data', async () => {
        const updateData: OrganizationUpdateDTO = {
          name: 'Updated Corp',
          metadata: { website: 'https://updated.com' }
        };

        const result = await organizationService.updateOrganization(testOrgId, updateData);

        expect(result).toBeDefined();
        expect(result.name).toBe('Updated Corp');
        expect(result.metadata).toEqual({ website: 'https://updated.com' });
        expect(result.id).toBe(testOrgId);
      });

      it('should update only specified fields', async () => {
        const updateData: OrganizationUpdateDTO = {
          name: 'New Name Only'
        };

        const result = await organizationService.updateOrganization(testOrgId, updateData);

        expect(result.name).toBe('New Name Only');
        expect(result.metadata).toEqual({ website: 'https://original.com' }); // Unchanged
      });
    });

    describe('Deleting Organizations', () => {
      beforeEach(async () => {
        const org = await organizationService.createOrganization({
          name: 'To Be Deleted',
          type: OrganizationType.Company,
          metadata: {}
        });
        testOrgId = org.id;
      });

      it('should delete organization successfully', async () => {
        await organizationService.deleteOrganization(testOrgId);

        // Verify organization is deleted
        await expect(organizationService.getOrganizationById(testOrgId))
          .rejects.toThrow('Organization not found');
      });
    });
  });

  describe('👥 Member Management', () => {
    beforeEach(async () => {
      const org = await organizationService.createOrganization({
        name: 'Member Test Org',
        type: OrganizationType.Company,
        metadata: {}
      });
      testOrgId = org.id;
    });

    describe('Adding Members', () => {
      it('should add a new member to organization', async () => {
        const memberData: OrgMemberCreateDTO = {
          userId: TEST_USERS.member,
          role: OrgMemberRole.Member
        };

        const result = await organizationService.addMember(testOrgId, memberData);

        expect(result).toBeDefined();
        expect(result.orgId).toBe(testOrgId);
        expect(result.userId).toBe(TEST_USERS.member);
        expect(result.role).toBe(OrgMemberRole.Member);
        expect(result.joinedAt).toBeDefined();
      });

      it('should prevent adding existing member', async () => {
        const memberData: OrgMemberCreateDTO = {
          userId: TEST_USERS.member,
          role: OrgMemberRole.Member
        };

        // Add member first time
        await organizationService.addMember(testOrgId, memberData);

        // Try to add same member again
        await expect(
          organizationService.addMember(testOrgId, memberData)
        ).rejects.toThrow('User is already a member of this organization');
      });

      it('should handle admin role assignment correctly', async () => {
        const adminMemberData: OrgMemberCreateDTO = {
          userId: TEST_USERS.admin,
          role: OrgMemberRole.Admin
        };

        const result = await organizationService.addMember(testOrgId, adminMemberData);

        expect(result.role).toBe(OrgMemberRole.Admin);
        expect(result.userId).toBe(TEST_USERS.admin);
      });

      it('should add multiple members with different roles', async () => {
        const memberData: OrgMemberCreateDTO = {
          userId: TEST_USERS.member,
          role: OrgMemberRole.Member
        };
        const adminData: OrgMemberCreateDTO = {
          userId: TEST_USERS.admin,
          role: OrgMemberRole.Admin
        };

        const memberResult = await organizationService.addMember(testOrgId, memberData);
        const adminResult = await organizationService.addMember(testOrgId, adminData);

        expect(memberResult.role).toBe(OrgMemberRole.Member);
        expect(adminResult.role).toBe(OrgMemberRole.Admin);
        
        // Verify both are members
        expect(await organizationService.isUserMemberOfOrg(TEST_USERS.member, testOrgId)).toBe(true);
        expect(await organizationService.isUserMemberOfOrg(TEST_USERS.admin, testOrgId)).toBe(true);
      });
    });

    describe('Removing Members', () => {
      beforeEach(async () => {
        // Add a member to remove
        await organizationService.addMember(testOrgId, {
          userId: TEST_USERS.member,
          role: OrgMemberRole.Member
        });
      });

      it('should remove member from organization successfully', async () => {
        await organizationService.removeMember(testOrgId, TEST_USERS.member);

        // Verify member is removed
        const isMember = await organizationService.isUserMemberOfOrg(TEST_USERS.member, testOrgId);
        expect(isMember).toBe(false);
      });

      it('should handle removing non-existent member gracefully', async () => {
        // Should throw an error for non-existent member
        await expect(
          organizationService.removeMember(testOrgId, TEST_USERS.outsider)
        ).rejects.toThrow('Member not found in organization');
        
        // Verify existing member is still there
        const isMember = await organizationService.isUserMemberOfOrg(TEST_USERS.member, testOrgId);
        expect(isMember).toBe(true);
      });
    });

    describe('Membership Queries', () => {
      beforeEach(async () => {
        // Add a member for testing
        await organizationService.addMember(testOrgId, {
          userId: TEST_USERS.member,
          role: OrgMemberRole.Member
        });
      });

      it('should correctly identify organization members', async () => {
        const result = await organizationService.isUserMemberOfOrg(TEST_USERS.member, testOrgId);
        expect(result).toBe(true);
      });

      it('should correctly identify non-members', async () => {
        const result = await organizationService.isUserMemberOfOrg(TEST_USERS.outsider, testOrgId);
        expect(result).toBe(false);
      });
    });
  });

  describe('📋 Data Migration Support', () => {
    describe('Legacy Metadata Extraction', () => {
      it('should extract company organization from job node metadata', async () => {
        const nodeMetadata = { company: 'Tech Startup Inc' };
        
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        expect(result).toEqual({
          name: 'Tech Startup Inc',
          type: OrganizationType.Company,
          metadata: {}
        });
      });

      it('should extract educational institution from education node metadata', async () => {
        const nodeMetadata = { institution: 'Harvard University' };
        
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'education'
        );

        expect(result).toEqual({
          name: 'Harvard University',
          type: OrganizationType.EducationalInstitution,
          metadata: {}
        });
      });

      it('should return null for metadata without organization fields', async () => {
        const nodeMetadata = { title: 'Some Job', description: 'A job without company' };
        
        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        expect(result).toBe(null);
      });

      it('should return null for empty or invalid organization names', async () => {
        const testCases = [
          { company: '' },
          { company: '   ' },
          { institution: '' },
          { institution: '   ' }
        ];

        for (const nodeMetadata of testCases) {
          const jobResult = await organizationService.extractOrganizationFromMetadata(
            nodeMetadata, 
            'job'
          );
          const eduResult = await organizationService.extractOrganizationFromMetadata(
            nodeMetadata, 
            'education'
          );

          expect(jobResult).toBe(null);
          expect(eduResult).toBe(null);
        }
      });
    });

    describe('Organization ID-based Extraction', () => {
      beforeEach(async () => {
        const org = await organizationService.createOrganization({
          name: 'Metadata Test Corp',
          type: OrganizationType.Company,
          metadata: { website: 'https://test.com' }
        });
        testOrgId = org.id;
      });

      it('should extract organization using orgId when present', async () => {
        const nodeMetadata = { orgId: testOrgId };

        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        expect(result).toEqual({
          name: 'Metadata Test Corp',
          type: OrganizationType.Company,
          metadata: { website: 'https://test.com' }
        });
      });

      it('should fallback gracefully when orgId organization not found', async () => {
        const nodeMetadata = { 
          orgId: 999, 
          company: 'Fallback Company' 
        };

        const result = await organizationService.extractOrganizationFromMetadata(
          nodeMetadata, 
          'job'
        );

        expect(result).toBe(null);
      });
    });

    describe('Organization Name Retrieval from Nodes', () => {
      beforeEach(async () => {
        const org = await organizationService.createOrganization({
          name: 'Node Test Corp',
          type: OrganizationType.Company,
          metadata: {}
        });
        testOrgId = org.id;
      });

      it('should get organization name from node using orgId', async () => {
        const node = {
          type: 'job',
          meta: { orgId: testOrgId }
        };

        const result = await organizationService.getOrganizationNameFromNode(node);

        expect(result).toBe('Node Test Corp');
      });

      it('should fallback to legacy company field when orgId lookup fails', async () => {
        const node = {
          type: 'job',
          meta: { orgId: 999, company: 'Legacy Company Name' }
        };

        const result = await organizationService.getOrganizationNameFromNode(node);

        expect(result).toBe('Legacy Company Name');
      });

      it('should fallback to legacy institution field for education nodes', async () => {
        const node = {
          type: 'education',
          meta: { institution: 'Legacy University' }
        };

        const result = await organizationService.getOrganizationNameFromNode(node);

        expect(result).toBe('Legacy University');
      });

      it('should return null when no organization data available', async () => {
        const node = {
          type: 'job',
          meta: { title: 'Some Job' }
        };

        const result = await organizationService.getOrganizationNameFromNode(node);

        expect(result).toBe(null);
      });
    });

    describe('Find or Create Organization', () => {
      it('should create new organization when none exists with given name', async () => {
        const orgName = 'New Company';
        const orgType = OrganizationType.Company;

        const result = await organizationService.findOrCreateByName(orgName, orgType);

        expect(result.name).toBe(orgName);
        expect(result.type).toBe(orgType);
        expect(result.metadata).toEqual({});
        expect(result.id).toBeDefined();
      });

      it('should return existing organization when duplicate name is used', async () => {
        const orgName = 'Duplicate Company';
        const orgType = OrganizationType.Company;

        // Create first organization
        const firstResult = await organizationService.findOrCreateByName(orgName, orgType);

        // Try to create same organization again
        const secondResult = await organizationService.findOrCreateByName(orgName, orgType);

        expect(firstResult.id).toBe(secondResult.id);
        expect(firstResult.name).toBe(secondResult.name);
      });

      it('should trim organization names before processing', async () => {
        const orgName = '  Trimmed Company  ';
        const orgType = OrganizationType.Company;

        const result = await organizationService.findOrCreateByName(orgName, orgType);

        expect(result.name).toBe('Trimmed Company');
      });
    });
  });

  describe('🚨 Error Handling & Validation', () => {
    describe('Input Validation', () => {
      it('should validate organization ID format', async () => {
        const invalidIds = [-1, 0];

        for (const invalidId of invalidIds) {
          await expect(
            organizationService.getOrganizationById(invalidId)
          ).rejects.toThrow('Invalid organization ID');
        }
      });

      it('should validate user ID format in membership operations', async () => {
        const validOrgId = 1;
        const invalidUserIds = [-1, 0];

        for (const invalidUserId of invalidUserIds) {
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
        const validUserId = TEST_USERS.member;
        const invalidOrgIds = [-1, 0];

        for (const invalidOrgId of invalidOrgIds) {
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
        const nonExistentId = 999;

        await expect(
          organizationService.getOrganizationById(nonExistentId)
        ).rejects.toThrow('Organization not found');
      });

      it('should handle non-existent organization updates gracefully', async () => {
        const nonExistentId = 999;
        const updateData: OrganizationUpdateDTO = { name: 'Updated' };

        await expect(
          organizationService.updateOrganization(nonExistentId, updateData)
        ).rejects.toThrow('Organization not found');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty organization names in findOrCreateByName', async () => {
        const emptyNames = ['', '   ', null as any, undefined as any];
        
        for (const emptyName of emptyNames) {
          await expect(
            organizationService.findOrCreateByName(emptyName, OrganizationType.Company)
          ).rejects.toThrow();
        }
      });

      it('should handle concurrent member additions to same organization', async () => {
        const org = await organizationService.createOrganization({
          name: 'Concurrent Test Org',
          type: OrganizationType.Company,
          metadata: {}
        });

        // Add different members concurrently
        const promises = [
          organizationService.addMember(org.id, {
            userId: TEST_USERS.member,
            role: OrgMemberRole.Member
          }),
          organizationService.addMember(org.id, {
            userId: TEST_USERS.admin,
            role: OrgMemberRole.Admin
          })
        ];

        const results = await Promise.all(promises);

        expect(results).toHaveLength(2);
        expect(results[0].userId).toBe(TEST_USERS.member);
        expect(results[1].userId).toBe(TEST_USERS.admin);
      });
    });
  });
});