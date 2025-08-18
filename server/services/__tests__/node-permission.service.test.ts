/**
 * NodePermissionService Integration Tests
 * 
 * Testing with real in-memory repositories instead of mocks.
 * This provides better test coverage and eliminates DRY violations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodePermissionService } from '../node-permission.service';
import { OrganizationService } from '../organization.service';
import { HierarchyService } from '../hierarchy-service';
import { TestContainer } from '../../core/test-container-setup';
import { 
  VisibilityLevel, 
  PermissionAction, 
  SubjectType, 
  PolicyEffect,
  SetNodePermissionsDTO,
  OrganizationType,
  OrgMemberRole,
  PermissionPresets
} from '@shared/schema';

// Test constants
const TEST_USERS = {
  owner: 1,
  member: 2,
  outsider: 3
};

describe('NodePermissionService Integration Tests', () => {
  let container: any;
  let nodePermissionService: NodePermissionService;
  let organizationService: OrganizationService;
  let hierarchyService: HierarchyService;
  
  let testNodeId: string;
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
    nodePermissionService = container.resolve('nodePermissionService');
    organizationService = container.resolve('organizationService');
    hierarchyService = container.resolve('hierarchyService');

    // Set up test data using real services
    const testOrg = await organizationService.createOrganization({
      name: 'Test Organization',
      type: OrganizationType.Company,
      metadata: {}
    });
    testOrgId = testOrg.id;

    // Add members to organization
    await organizationService.addMember(testOrgId, {
      userId: TEST_USERS.owner,
      role: OrgMemberRole.Member
    });
    await organizationService.addMember(testOrgId, {
      userId: TEST_USERS.member,
      role: OrgMemberRole.Member
    });

    // Create test node
    const testNode = await hierarchyService.createNode({
      type: 'project',
      meta: { title: 'Test Project Node' }
    }, TEST_USERS.owner);
    testNodeId = testNode.id;
  });

  afterEach(() => {
    vi.resetAllMocks();
    TestContainer.reset();
  });

  describe('Core Permission Rules', () => {
    it('should allow owner full access to their nodes (cannot be denied)', async () => {
      const result = await nodePermissionService.canAccess(
        TEST_USERS.owner, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
    });

    it('should deny non-owner access without policies', async () => {
      const result = await nodePermissionService.canAccess(
        TEST_USERS.outsider, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(false);
    });

    it('should allow public access to overview level when public policy exists', async () => {
      // Set public overview policy
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: PermissionPresets.PUBLIC_OVERVIEW
      });
      
      const result = await nodePermissionService.canAccess(
        null, // Anonymous user
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(true);
    });

    it('should deny public access to full level without explicit policy', async () => {
      // Set only overview access
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: PermissionPresets.PUBLIC_OVERVIEW
      });
      
      const result = await nodePermissionService.canAccess(
        null, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(false);
    });

    it('should allow organization members to access org-shared nodes', async () => {
      // Set organization viewable policy
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: PermissionPresets.ORG_VIEWABLE(testOrgId)
      });
      
      const result = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
    });

    it('should ensure DENY policies override ALLOW policies for same user', async () => {
      // First set ALLOW policy
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: TEST_USERS.member,
          effect: PolicyEffect.Allow
        }]
      });

      // Verify user has access
      let result = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      expect(result).toBe(true);

      // Set DENY policy for same user
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: TEST_USERS.member,
          effect: PolicyEffect.Deny
        }]
      });
      
      // User should now be denied
      result = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(false);
    });

    it('should ensure user-specific grants override organization grants', async () => {
      // Set organization DENY policy
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: testOrgId,
          effect: PolicyEffect.Deny
        }]
      });

      // Verify org member is denied
      let result = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      expect(result).toBe(false);

      // Set user-specific ALLOW policy
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: TEST_USERS.member,
          effect: PolicyEffect.Allow
        }]
      });
      
      // User-specific policy should override org policy
      result = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
    });
  });

  describe('Permission Management', () => {
    it('should allow owner to set permissions on their nodes', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      // Should not throw
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies);
      
      // Verify policy is effective
      const result = await nodePermissionService.canAccess(
        null, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(result).toBe(true);
    });

    it('should prevent non-owners from setting permissions', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.outsider, policies)
      ).rejects.toThrow('Only node owner can set permissions');
    });

    it('should validate organization membership for org-level permissions', async () => {
      // Create another org that owner is not a member of
      const otherOrg = await organizationService.createOrganization({
        name: 'Other Organization',
        type: OrganizationType.Company,
        metadata: {}
      });

      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: otherOrg.id,
          effect: PolicyEffect.Allow
        }]
      };
      
      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies)
      ).rejects.toThrow('User is not a member of the specified organization');
    });

    it('should prevent edit permissions with overview visibility', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.Edit,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies)
      ).rejects.toThrow('Edit permissions require Full visibility level');
    });
  });

  describe('Policy Management', () => {
    it('should allow owner to view node policies', async () => {
      // Set some policies first
      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, {
        policies: PermissionPresets.PUBLIC_OVERVIEW
      });

      const policies = await nodePermissionService.getNodePolicies(testNodeId, TEST_USERS.owner);
      
      expect(policies).toBeDefined();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should prevent non-owners from viewing policies', async () => {
      await expect(
        nodePermissionService.getNodePolicies(testNodeId, TEST_USERS.outsider)
      ).rejects.toThrow('Only node owner can view policies');
    });
  });

  describe('Error Handling', () => {
    it('should validate node UUID format', async () => {
      await expect(
        nodePermissionService.canAccess(TEST_USERS.owner, 'invalid-uuid', PermissionAction.View, VisibilityLevel.Overview)
      ).rejects.toThrow('Invalid node ID format');
    });

    it('should validate user ID format', async () => {
      await expect(
        nodePermissionService.canAccess(-1, testNodeId, PermissionAction.View, VisibilityLevel.Overview)
      ).rejects.toThrow('Invalid user ID');
    });

    it('should handle non-existent nodes gracefully', async () => {
      const nonExistentNodeId = '12345678-1234-5678-9abc-123456789abc';
      
      const result = await nodePermissionService.canAccess(
        TEST_USERS.owner, 
        nonExistentNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(false);
    });
  });

  describe('Security Validation', () => {
    it('should enforce security limits on policy count', async () => {
      // Create too many policies
      const policies: SetNodePermissionsDTO = {
        policies: Array.from({ length: 51 }, (_, i) => ({
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: i + 100,
          effect: PolicyEffect.Allow
        }))
      };

      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies)
      ).rejects.toThrow('Maximum 50 policies per node allowed');
    });

    it('should validate expiration dates are in the future', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }]
      };

      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies)
      ).rejects.toThrow('Expiration date must be in the future');
    });

    it('should validate expiration dates are not too far in the future', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow,
          expiresAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000) // 400 days from now
        }]
      };

      await expect(
        nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies)
      ).rejects.toThrow('Expiration date cannot be more than 365 days in the future');
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle mixed public and organization policies correctly', async () => {
      // Set both public overview and org full access
      const combinedPolicies: SetNodePermissionsDTO = {
        policies: [
          ...PermissionPresets.PUBLIC_OVERVIEW,
          ...PermissionPresets.ORG_VIEWABLE(testOrgId)
        ]
      };

      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, combinedPolicies);

      // Anonymous user gets overview access
      const anonymousResult = await nodePermissionService.canAccess(
        null, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(anonymousResult).toBe(true);

      // Org member gets full access
      const memberResult = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      expect(memberResult).toBe(true);

      // Non-org member gets only overview access
      const outsiderOverviewResult = await nodePermissionService.canAccess(
        TEST_USERS.outsider, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(outsiderOverviewResult).toBe(true);

      const outsiderFullResult = await nodePermissionService.canAccess(
        TEST_USERS.outsider, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      expect(outsiderFullResult).toBe(false);
    });

    it('should handle user-specific deny overriding public allow', async () => {
      // Set public overview + user-specific deny
      const policies: SetNodePermissionsDTO = {
        policies: [
          ...PermissionPresets.PUBLIC_OVERVIEW,
          {
            level: VisibilityLevel.Overview,
            action: PermissionAction.View,
            subjectType: SubjectType.User,
            subjectId: TEST_USERS.outsider,
            effect: PolicyEffect.Deny
          }
        ]
      };

      await nodePermissionService.setNodePermissions(testNodeId, TEST_USERS.owner, policies);

      // Anonymous user should have access
      const anonymousResult = await nodePermissionService.canAccess(
        null, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(anonymousResult).toBe(true);

      // Denied user should not have access
      const deniedResult = await nodePermissionService.canAccess(
        TEST_USERS.outsider, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(deniedResult).toBe(false);

      // Org member should still have access
      const memberResult = await nodePermissionService.canAccess(
        TEST_USERS.member, 
        testNodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      expect(memberResult).toBe(true);
    });
  });

  describe('Node Ownership Validation', () => {
    it('should correctly identify node owner', async () => {
      const result = await nodePermissionService.isNodeOwner(TEST_USERS.owner, testNodeId);
      expect(result).toBe(true);
    });

    it('should correctly identify non-owner', async () => {
      const result = await nodePermissionService.isNodeOwner(TEST_USERS.outsider, testNodeId);
      expect(result).toBe(false);
    });
  });
});