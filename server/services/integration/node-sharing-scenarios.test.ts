/**
 * Node Sharing Scenarios Integration Tests
 *
 * Tests complete permission workflows using real services and database following memory patterns:
 * 1. Public sharing workflows (overview and full access)
 * 2. Organization access patterns with member roles
 * 3. Complex permission precedence (DENY overrides ALLOW, user overrides org)
 * 4. Security validation and unauthorized access prevention
 *
 * PATTERN: Enhanced AAA with Real Services (from memory)
 * - ARRANGE: Use real services to establish realistic test state
 * - ACT: Execute specific permission operations being tested
 * - ASSERT: Verify complete outcomes including cross-service effects
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';

import { nodePolicies } from '@shared/schema';
import { 
  PermissionAction, 
  PolicyEffect, 
  SubjectType, 
  VisibilityLevel,
  TimelineNodeType,
  OrganizationType,
  OrgMemberRole,
  type SetNodePermissionsDTO 
} from '@shared/schema';
import { setupIntegrationTestContext, createAAAHelper, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks';
import type { NodePermissionService } from '../../../services/node-permission.service';
import type { HierarchyService } from '../../../services/hierarchy.service';
import type { OrganizationService } from '../../../services/organization.service';

describe('Node Sharing Scenarios Integration Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'node-sharing',
    withTestData: false // We'll create specific permission test data
  });

  let nodePermissionService: NodePermissionService;
  let hierarchyService: HierarchyService;
  let organizationService: OrganizationService;
  let aaaHelper: ReturnType<typeof createAAAHelper>;

  // Test users for different scenarios
  let testUsers: {
    nodeOwner: any;
    orgAdmin: any;
    orgMember: any;
    publicUser: any;
    anonymousUser: null;
  };

  let testOrganization: any;
  let testNode: any;

  beforeAll(async () => {
    const { container } = testContext.getContext();
    nodePermissionService = container.resolve<NodePermissionService>('nodePermissionService');
    hierarchyService = container.resolve<HierarchyService>('hierarchyService');
    organizationService = container.resolve<OrganizationService>('organizationService');
    aaaHelper = createAAAHelper(container);

    // Create test users following memory pattern (real service methods)
    const arrange = aaaHelper.arrange();
    
    const nodeOwner = await arrange.createUser('node.owner@example.com', 'Technology');
    const orgAdmin = await arrange.createUser('org.admin@example.com', 'Business');
    const orgMember = await arrange.createUser('org.member@example.com', 'Design');
    const publicUser = await arrange.createUser('public.user@example.com', 'Marketing');

    testUsers = {
      nodeOwner,
      orgAdmin,
      orgMember,
      publicUser,
      anonymousUser: null, // Represents unauthenticated user
    };

    // Create test organization following memory pattern
    testOrganization = await arrange.createOrganization('Test Tech Corp', OrganizationType.Company);

    // Add members to organization using real service
    await arrange.addOrgMember(testOrganization.id, nodeOwner.user.id, OrgMemberRole.Admin);
    await arrange.addOrgMember(testOrganization.id, orgAdmin.user.id, OrgMemberRole.Admin);
    await arrange.addOrgMember(testOrganization.id, orgMember.user.id, OrgMemberRole.Member);

    // Create test node following memory pattern
    testNode = await arrange.createNode(
      TimelineNodeType.Project,
      {
        title: 'Test Project for Sharing',
        description: 'Project used for permission testing scenarios',
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL']
      },
      nodeOwner.user.id
    );
  });

  describe('Public Sharing Workflows', () => {
    it('should allow complete public sharing workflow - overview level', async () => {
      const { db } = testContext.getContext();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Verify initial state (owner has access, public does not)
      const initialOwnerAccess = await assert.canAccess(
        testUsers.nodeOwner.user.id,
        testNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(initialOwnerAccess).toBe(true);

      const initialPublicAccess = await assert.canAccess(
        testUsers.anonymousUser,
        testNode.id,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(initialPublicAccess).toBe(false);

      // ⚡ ACT - Set public overview permissions using real service
      const publicPolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Public,
            subjectId: null,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Overview,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          testNode.id,
          testUsers.nodeOwner.user.id,
          publicPolicies
        );
      });

      // ✅ ASSERT - Verify complete public sharing outcome
      
      // Anonymous user can now access overview
      const publicOverviewAccess = await assert.canAccess(
        testUsers.anonymousUser,
        testNode.id,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(publicOverviewAccess).toBe(true);

      // Anonymous user still cannot access full details
      const publicFullAccess = await assert.canAccess(
        testUsers.anonymousUser,
        testNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(publicFullAccess).toBe(false);

      // Authenticated users also get overview access
      const userOverviewAccess = await assert.canAccess(
        testUsers.publicUser.user.id,
        testNode.id,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(userOverviewAccess).toBe(true);

      // Check access levels using real service
      const anonymousAccessLevel = await assert.getAccessLevel(testUsers.anonymousUser, testNode.id);
      expect(anonymousAccessLevel).toBe(VisibilityLevel.Overview);

      const publicUserAccessLevel = await assert.getAccessLevel(testUsers.publicUser.user.id, testNode.id);
      expect(publicUserAccessLevel).toBe(VisibilityLevel.Overview);

      // Verify in database
      const dbPolicies = await db.select().from(nodePolicies).where(eq(nodePolicies.nodeId, testNode.id));
      expect(dbPolicies).toHaveLength(1);
      expect(dbPolicies[0].subjectType).toBe(SubjectType.Public);
      expect(dbPolicies[0].effect).toBe(PolicyEffect.Allow);
      expect(dbPolicies[0].level).toBe(VisibilityLevel.Overview);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle public full access sharing', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create separate node for full access test
      const fullAccessNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Public Full Access Job',
          company: 'Open Corp',
          description: 'Job shared with full public access'
        },
        testUsers.nodeOwner.user.id
      );

      // ⚡ ACT - Set public full access permissions
      const fullPublicPolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Public,
            subjectId: null,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          fullAccessNode.id,
          testUsers.nodeOwner.user.id,
          fullPublicPolicies
        );
      });

      // ✅ ASSERT - Anonymous users can access full details
      const publicFullAccess = await assert.canAccess(
        testUsers.anonymousUser,
        fullAccessNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(publicFullAccess).toBe(true);

      const anonymousAccessLevel = await assert.getAccessLevel(testUsers.anonymousUser, fullAccessNode.id);
      expect(anonymousAccessLevel).toBe(VisibilityLevel.Full);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle revoking public access', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create node with public access first
      const revokeTestNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Revoke Test Project' },
        testUsers.nodeOwner.user.id
      );

      // Set public access initially
      await arrange.setPermissions(revokeTestNode.id, testUsers.nodeOwner.user.id, {
        policies: [
          {
            subjectType: SubjectType.Public,
            subjectId: null,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Overview,
          }
        ]
      });

      // Verify public access granted
      const accessBeforeRevoke = await assert.canAccess(testUsers.anonymousUser, revokeTestNode.id);
      expect(accessBeforeRevoke).toBe(true);

      // ⚡ ACT - Revoke public access (set empty policies)
      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          revokeTestNode.id,
          testUsers.nodeOwner.user.id,
          { policies: [] }
        );
      });

      // ✅ ASSERT - Public access revoked
      const accessAfterRevoke = await assert.canAccess(testUsers.anonymousUser, revokeTestNode.id);
      expect(accessAfterRevoke).toBe(false);

      const accessLevelAfterRevoke = await assert.getAccessLevel(testUsers.anonymousUser, revokeTestNode.id);
      expect(accessLevelAfterRevoke).toBeNull();

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Organization Access Patterns', () => {
    it('should allow organization members access to shared nodes', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create node owned by org admin
      const orgSharedNode = await arrange.createNode(
        TimelineNodeType.Job,
        {
          title: 'Organization Shared Job',
          company: testOrganization.name,
          description: 'Job shared within organization'
        },
        testUsers.orgAdmin.user.id
      );

      // Verify initial state - only owner has access
      const ownerAccess = await assert.canAccess(testUsers.orgAdmin.user.id, orgSharedNode.id);
      expect(ownerAccess).toBe(true);

      const memberAccessBefore = await assert.canAccess(testUsers.orgMember.user.id, orgSharedNode.id);
      expect(memberAccessBefore).toBe(false);

      // ⚡ ACT - Share with organization using real service
      const orgPolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Organization,
            subjectId: testOrganization.id,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          orgSharedNode.id,
          testUsers.orgAdmin.user.id,
          orgPolicies
        );
      });

      // ✅ ASSERT - All organization members can access
      
      // Org admin (also node owner) has access
      const adminAccess = await assert.canAccess(testUsers.orgAdmin.user.id, orgSharedNode.id);
      expect(adminAccess).toBe(true);

      // Org member has access
      const memberAccess = await assert.canAccess(testUsers.orgMember.user.id, orgSharedNode.id);
      expect(memberAccess).toBe(true);

      // Node owner (also org member) has access
      const nodeOwnerAccess = await assert.canAccess(testUsers.nodeOwner.user.id, orgSharedNode.id);
      expect(nodeOwnerAccess).toBe(true);

      // Non-org member does not have access
      const publicUserAccess = await assert.canAccess(testUsers.publicUser.user.id, orgSharedNode.id);
      expect(publicUserAccess).toBe(false);

      // Verify access levels
      expect(await assert.getAccessLevel(testUsers.orgMember.user.id, orgSharedNode.id)).toBe(VisibilityLevel.Full);
      expect(await assert.getAccessLevel(testUsers.publicUser.user.id, orgSharedNode.id)).toBeNull();

      // Verify in database
      const dbPolicies = await db.select().from(nodePolicies).where(eq(nodePolicies.nodeId, orgSharedNode.id));
      expect(dbPolicies).toHaveLength(1);
      expect(dbPolicies[0].subjectType).toBe(SubjectType.Organization);
      expect(dbPolicies[0].subjectId).toBe(testOrganization.id);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle multiple organization policies', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create second organization
      const secondOrg = await arrange.createOrganization('Second Tech Corp', OrganizationType.Company);
      await arrange.addOrgMember(secondOrg.id, testUsers.publicUser.user.id, OrgMemberRole.Member);

      const multiOrgNode = await arrange.createNode(
        TimelineNodeType.Education,
        { title: 'Multi-Org Shared Education' },
        testUsers.nodeOwner.user.id
      );

      // ⚡ ACT - Share with multiple organizations
      const multiOrgPolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Organization,
            subjectId: testOrganization.id,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Overview,
          },
          {
            subjectType: SubjectType.Organization,
            subjectId: secondOrg.id,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          multiOrgNode.id,
          testUsers.nodeOwner.user.id,
          multiOrgPolicies
        );
      });

      // ✅ ASSERT - Members have appropriate access levels
      
      // First org member gets overview access
      const firstOrgAccess = await assert.getAccessLevel(testUsers.orgMember.user.id, multiOrgNode.id);
      expect(firstOrgAccess).toBe(VisibilityLevel.Overview);

      // Second org member gets full access
      const secondOrgAccess = await assert.getAccessLevel(testUsers.publicUser.user.id, multiOrgNode.id);
      expect(secondOrgAccess).toBe(VisibilityLevel.Full);

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Complex Permission Precedence', () => {
    it('should handle user-specific ALLOW overriding organization DENY', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create node for precedence testing
      const precedenceNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Precedence Test Project' },
        testUsers.nodeOwner.user.id
      );

      // Set organization DENY policy first
      await arrange.setPermissions(precedenceNode.id, testUsers.nodeOwner.user.id, {
        policies: [
          {
            subjectType: SubjectType.Organization,
            subjectId: testOrganization.id,
            effect: PolicyEffect.Deny,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      });

      // Verify org member is denied access
      const accessAfterOrgDeny = await assert.canAccess(
        testUsers.orgMember.user.id,
        precedenceNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterOrgDeny).toBe(false);

      // ⚡ ACT - Add user-specific ALLOW (should override org DENY)
      const userOverridePolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Organization,
            subjectId: testOrganization.id,
            effect: PolicyEffect.Deny,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          },
          {
            subjectType: SubjectType.User,
            subjectId: testUsers.orgMember.user.id,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          precedenceNode.id,
          testUsers.nodeOwner.user.id,
          userOverridePolicies
        );
      });

      // ✅ ASSERT - User should now have access (user policy overrides org policy)
      const accessAfterUserAllow = await assert.canAccess(
        testUsers.orgMember.user.id,
        precedenceNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterUserAllow).toBe(true);

      // Other org members should still be denied
      const otherMemberAccess = await assert.canAccess(
        testUsers.orgAdmin.user.id,
        precedenceNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(otherMemberAccess).toBe(false);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle DENY policies overriding ALLOW policies', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create node for DENY precedence testing
      const denyPrecedenceNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'DENY Precedence Test Job' },
        testUsers.nodeOwner.user.id
      );

      // ⚡ ACT - Set both ALLOW and DENY policies (DENY should win)
      const conflictingPolicies: SetNodePermissionsDTO = {
        policies: [
          {
            subjectType: SubjectType.Organization,
            subjectId: testOrganization.id,
            effect: PolicyEffect.Allow,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          },
          {
            subjectType: SubjectType.User,
            subjectId: testUsers.orgMember.user.id,
            effect: PolicyEffect.Deny,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      };

      await aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          denyPrecedenceNode.id,
          testUsers.nodeOwner.user.id,
          conflictingPolicies
        );
      });

      // ✅ ASSERT - DENY should override ALLOW
      const memberAccess = await assert.canAccess(
        testUsers.orgMember.user.id,
        denyPrecedenceNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(memberAccess).toBe(false);

      // Other org members should still have access via org ALLOW
      const adminAccess = await assert.canAccess(
        testUsers.orgAdmin.user.id,
        denyPrecedenceNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(adminAccess).toBe(true);

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Security Validation and Edge Cases', () => {
    it('should prevent unauthorized permission changes', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create node owned by different user
      const protectedNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Protected Node' },
        testUsers.orgAdmin.user.id
      );

      // ⚡ ACT & ✅ ASSERT - Non-owner cannot change permissions
      await expect(aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          protectedNode.id,
          testUsers.orgMember.user.id, // Not the owner
          { policies: [TestDataBuilders.publicPermissions().policies[0]] }
        );
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle invalid organization IDs gracefully', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create node for invalid org test
      const invalidOrgNode = await arrange.createNode(
        TimelineNodeType.Project,
        { title: 'Invalid Org Test' },
        testUsers.nodeOwner.user.id
      );

      // ⚡ ACT & ✅ ASSERT - Invalid organization ID should be rejected
      await expect(aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          invalidOrgNode.id,
          testUsers.nodeOwner.user.id,
          {
            policies: [
              {
                subjectType: SubjectType.Organization,
                subjectId: 'invalid-org-id',
                effect: PolicyEffect.Allow,
                action: PermissionAction.View,
                level: VisibilityLevel.Full,
              }
            ]
          }
        );
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle non-existent node IDs', async () => {
      // ⚡ ACT & ✅ ASSERT - Non-existent node should be rejected
      await expect(aaaHelper.act(async () => {
        return await nodePermissionService.setNodePermissions(
          'non-existent-node-id',
          testUsers.nodeOwner.user.id,
          { policies: [] }
        );
      })).rejects.toThrow();

      await expect(aaaHelper.act(async () => {
        return await nodePermissionService.canAccess(
          testUsers.nodeOwner.user.id,
          'non-existent-node-id'
        );
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should ensure owner always has access regardless of policies', async () => {
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Create node
      const ownerTestNode = await arrange.createNode(
        TimelineNodeType.Job,
        { title: 'Owner Access Test' },
        testUsers.nodeOwner.user.id
      );

      // ⚡ ACT - Try to deny access to owner (should not be possible)
      await arrange.setPermissions(ownerTestNode.id, testUsers.nodeOwner.user.id, {
        policies: [
          {
            subjectType: SubjectType.User,
            subjectId: testUsers.nodeOwner.user.id,
            effect: PolicyEffect.Deny,
            action: PermissionAction.View,
            level: VisibilityLevel.Full,
          }
        ]
      });

      // ✅ ASSERT - Owner should still have access (ownership overrides all policies)
      const ownerAccess = await assert.canAccess(
        testUsers.nodeOwner.user.id,
        ownerTestNode.id,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(ownerAccess).toBe(true);

      const ownerAccessLevel = await assert.getAccessLevel(testUsers.nodeOwner.user.id, ownerTestNode.id);
      expect(ownerAccessLevel).toBe(VisibilityLevel.Full);

    }, TEST_TIMEOUTS.INTEGRATION);
  });
});