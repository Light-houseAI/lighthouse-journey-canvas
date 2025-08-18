/**
 * Node Sharing Scenarios - End-to-End Integration Tests
 *
 * This test demonstrates the complete refactoring journey from mocked dependencies
 * to true end-to-end service integration following the AAA (Arrange/Act/Assert) pattern.
 *
 * ARCHITECTURE:
 * - Real services (NodePermissionService, OrganizationService)
 * - In-memory repositories for isolated testing
 * - Complete workflow integration (create org → add members → create nodes → test permissions)
 *
 * PATTERN: Enhanced AAA with Real Services
 * - ARRANGE: Use real services to establish realistic test state
 * - ACT: Execute the specific operation being tested
 * - ASSERT: Verify complete outcomes including cross-service effects
 *
 * KEY PRINCIPLE: "Test the real workflow, not the test workflow"
 * We follow the exact same code paths as production, using real service methods
 * rather than test-specific simulation or mocked behaviors.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { createContainer, asValue, asClass, InjectionMode } from 'awilix';
import {
  VisibilityLevel,
  PermissionAction,
  SubjectType,
  PolicyEffect,
  OrganizationType,
  OrgMemberRole,
  TimelineNodeType,
  SetNodePermissionsDTO,
  PermissionPresets,
  NodePolicy
} from '@shared/schema';

// Import actual services
import { NodePermissionService } from '../services/node-permission.service';
import { OrganizationService } from '../services/organization.service';
import { type CreateNodeDTO } from '../services/hierarchy-service';

// Import in-memory repository implementations
import { InMemoryNodePermissionRepository } from './in-memory-repositories/node-permission.repository.inmemory';
import { InMemoryOrganizationRepository } from './in-memory-repositories/organization.repository.inmemory';
import { InMemoryHierarchyRepository } from './in-memory-repositories/hierarchy.repository.inmemory';
import { InMemoryHierarchyService } from './in-memory-repositories/hierarchy.service.inmemory';

describe('Node Sharing Scenarios - Integration Tests', () => {
  let container: any;
  let nodePermissionService: NodePermissionService;
  let organizationService: OrganizationService;
  let hierarchyService: InMemoryHierarchyService;

  // In-memory repository instances
  let nodePermissionRepository: InMemoryNodePermissionRepository;
  let organizationRepository: InMemoryOrganizationRepository;
  let hierarchyRepository: InMemoryHierarchyRepository;

  // Test data
  const testUsers = {
    nodeOwner: { id: 1, email: 'owner@example.com' },
    orgMember: { id: 2, email: 'member@example.com' },
    publicUser: { id: 3, email: 'public@example.com' },
    anonymousUser: null
  };

  let testNodeId: string;
  let organizationId: number;

  beforeAll(async () => {
    organizationId = 1;

    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };

    // Create in-memory repository instances
    organizationRepository = new InMemoryOrganizationRepository({ logger: mockLogger });
    hierarchyRepository = new InMemoryHierarchyRepository({ logger: mockLogger });
    nodePermissionRepository = new InMemoryNodePermissionRepository({
      logger: mockLogger,
      organizationRepository
    });

    // Create in-memory hierarchy service
    hierarchyService = new InMemoryHierarchyService({
      hierarchyRepository,
      nodePermissionRepository,
      logger: mockLogger
    });

    // Setup container with real services and in-memory repositories
    container = createContainer({
      injectionMode: InjectionMode.PROXY
    });

    container.register({
      logger: asValue(mockLogger),
      nodePermissionRepository: asValue(nodePermissionRepository),
      organizationRepository: asValue(organizationRepository),
      hierarchyRepository: asValue(hierarchyRepository),
      hierarchyService: asValue(hierarchyService),
      nodePermissionService: asClass(NodePermissionService).singleton(),
      organizationService: asClass(OrganizationService).singleton()
    });

    nodePermissionService = container.resolve('nodePermissionService');
    organizationService = container.resolve('organizationService');
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear all previous test data
    nodePermissionRepository.clearAll();
    organizationRepository.clearAll();
    hierarchyService.clearAll();

    // Set up fresh test data in in-memory repositories

    // Set up complete end-to-end scenario using real services

    // 1. Create organization using real service
    const techCorp = await organizationService.createOrganization({
      name: 'Tech Corp',
      type: OrganizationType.Company,
      metadata: {}
    });

    // 2. Add members to organization using real service
    await organizationService.addMember(techCorp.id, {
      userId: testUsers.nodeOwner.id,
      role: OrgMemberRole.Member
    });

    await organizationService.addMember(techCorp.id, {
      userId: testUsers.orgMember.id,
      role: OrgMemberRole.Member
    });

    // 3. Create a test node using real HierarchyService - this establishes ownership
    const testNode = await hierarchyService.createNode({
      type: 'project',
      meta: {
        title: 'Test Project Node',
        description: 'A test project for permission scenarios'
      }
    }, testUsers.nodeOwner.id);

    // Store the created node ID for use in tests
    testNodeId = testNode.id;

    organizationId = techCorp.id;
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // No cleanup needed for mocked repositories
  });

  describe('🌍 Public Node Sharing Scenarios', () => {
    it('should allow complete public sharing workflow - overview level', async () => {
      // 🔧 ARRANGE - Verify initial state using real services
      // This follows our "Enhanced AAA Pattern" - use real services to establish state

      // 1. Initially, only owner should have access
      const initialOwnerAccess = await nodePermissionService.canAccess(
        testUsers.nodeOwner.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(initialOwnerAccess).toBe(true);

      const initialPublicAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(initialPublicAccess).toBe(false);

      // ⚡ ACT - Execute the main operation being tested
      // 2. Owner sets node to public overview
      const publicPolicies: SetNodePermissionsDTO = {
        policies: PermissionPresets.PUBLIC_OVERVIEW
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        publicPolicies
      );

      // ✅ ASSERT - Verify complete outcomes including cross-service effects
      // 3. Anonymous user can now access overview
      const publicOverviewAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(publicOverviewAccess).toBe(true);

      // 4. Anonymous user still cannot access full details
      const publicFullAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(publicFullAccess).toBe(false);

      // 5. Authenticated users also get overview access
      const userOverviewAccess = await nodePermissionService.canAccess(
        testUsers.publicUser.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(userOverviewAccess).toBe(true);

      // 6. Check access levels
      const anonymousAccessLevel = await nodePermissionService.getAccessLevel(
        testUsers.anonymousUser,
        testNodeId
      );
      expect(anonymousAccessLevel).toBe(VisibilityLevel.Overview);
    });

    it('should handle public full access sharing', async () => {
      // Set node to public full access (dangerous but should work)
      const publicFullPolicies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        publicFullPolicies
      );

      // Anonymous user should have full access
      const publicFullAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(publicFullAccess).toBe(true);

      const accessLevel = await nodePermissionService.getAccessLevel(
        testUsers.anonymousUser,
        testNodeId
      );
      expect(accessLevel).toBe(VisibilityLevel.Full);
    });
  });

  describe('🏢 Organization Sharing Scenarios', () => {
    it('should allow organization members to access org-shared nodes', async () => {
      // 1. Initially org member has no access
      const initialOrgMemberAccess = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(initialOrgMemberAccess).toBe(false);

      // 2. Owner shares with organization
      const orgPolicies: SetNodePermissionsDTO = {
        policies: PermissionPresets.ORG_VIEWABLE(organizationId)
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        orgPolicies
      );

      // 3. Organization member can now access
      const orgMemberAccess = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(orgMemberAccess).toBe(true);

      // 4. Non-member still cannot access
      const nonMemberAccess = await nodePermissionService.canAccess(
        testUsers.publicUser.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(nonMemberAccess).toBe(false);

      // 5. Anonymous user cannot access
      const anonymousAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(anonymousAccess).toBe(false);

      // 6. Check access levels
      const orgMemberAccessLevel = await nodePermissionService.getAccessLevel(
        testUsers.orgMember.id,
        testNodeId
      );
      expect(orgMemberAccessLevel).toBe(VisibilityLevel.Full);
    });

    it('should handle organization edit permissions', async () => {
      // Share with org including edit permissions
      const orgEditPolicies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: organizationId,
          effect: PolicyEffect.Allow
        }, {
          level: VisibilityLevel.Full,
          action: PermissionAction.Edit,
          subjectType: SubjectType.Organization,
          subjectId: organizationId,
          effect: PolicyEffect.Allow
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        orgEditPolicies
      );

      // Org member should have edit access
      const canEdit = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.Edit,
        VisibilityLevel.Full
      );
      expect(canEdit).toBe(true);

      // Get comprehensive access info
      const accessInfo = await nodePermissionService.getNodeAccessLevel(
        testUsers.orgMember.id,
        testNodeId
      );
      expect(accessInfo.canView).toBe(true);
      expect(accessInfo.canEdit).toBe(true);
      expect(accessInfo.visibilityLevel).toBe(VisibilityLevel.Full);
    });
  });

  describe('🚫 DENY Policy Override Scenarios', () => {
    it('should handle DENY policy overriding ALLOW policy', async () => {
      // 1. First set ALLOW policy for user
      const allowPolicy: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: testUsers.orgMember.id,
          effect: PolicyEffect.Allow
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        allowPolicy
      );

      // User should have access
      const accessAfterAllow = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterAllow).toBe(true);

      // 2. Set DENY policy for same user
      const denyPolicy: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: testUsers.orgMember.id,
          effect: PolicyEffect.Deny
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        denyPolicy
      );

      // 3. User should now be denied access (DENY overrides ALLOW)
      const accessAfterDeny = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterDeny).toBe(false);
    });

    it('should handle user-specific ALLOW overriding org DENY', async () => {
      // 🔧 ARRANGE - Complex multi-policy scenario using real services
      // This demonstrates cross-service integration: NodePermissionService + OrganizationService

      // 1. Set organization DENY policy
      const orgDenyPolicy: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: organizationId,
          effect: PolicyEffect.Deny
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        orgDenyPolicy
      );

      // Org member should be denied access
      const accessAfterOrgDeny = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterOrgDeny).toBe(false);

      // 2. Set user-specific ALLOW policy (should override org policy)
      const userAllowPolicy: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.User,
          subjectId: testUsers.orgMember.id,
          effect: PolicyEffect.Allow
        }]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        userAllowPolicy
      );

      // ✅ ASSERT - Verify complete outcomes including cross-service effects
      // 3. User should now have access (user policy overrides org policy)
      const accessAfterUserAllow = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(accessAfterUserAllow).toBe(true);
    });
  });

  describe('👥 Complex Multi-Policy Scenarios', () => {
    it('should handle combined public and organization policies correctly', async () => {
      // 🔧 ARRANGE - Multi-layer policy scenario with public and organization access
      // This tests the policy precedence system: Org members get Full, others get Overview

      // ⚡ ACT - Set both public overview and org full access
      const combinedPolicies: SetNodePermissionsDTO = {
        policies: [
          ...PermissionPresets.PUBLIC_OVERVIEW,
          ...PermissionPresets.ORG_VIEWABLE(organizationId)
        ]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        combinedPolicies
      );

      // ✅ ASSERT - Verify policy precedence works correctly across user types
      // Anonymous user gets overview
      const anonymousAccess = await nodePermissionService.getAccessLevel(
        testUsers.anonymousUser,
        testNodeId
      );
      expect(anonymousAccess).toBe(VisibilityLevel.Overview);

      // Org member gets full access
      const orgMemberAccess = await nodePermissionService.getAccessLevel(
        testUsers.orgMember.id,
        testNodeId
      );
      expect(orgMemberAccess).toBe(VisibilityLevel.Full);

      // Public user (non-org member) gets overview
      const publicUserAccess = await nodePermissionService.getAccessLevel(
        testUsers.publicUser.id,
        testNodeId
      );
      expect(publicUserAccess).toBe(VisibilityLevel.Overview);
    });

    it('should handle specific user overrides in complex scenarios', async () => {
      // 🔧 ARRANGE - Complex scenario testing user-specific DENY overriding public ALLOW
      // This demonstrates the highest-priority user policies can block public access

      // ⚡ ACT - Set combined policies: public overview + user-specific deny
      const combinedPolicies: SetNodePermissionsDTO = {
        policies: [
          ...PermissionPresets.PUBLIC_OVERVIEW,
          {
            level: VisibilityLevel.Overview,
            action: PermissionAction.View,
            subjectType: SubjectType.User,
            subjectId: testUsers.publicUser.id,
            effect: PolicyEffect.Deny
          }
        ]
      };

      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        combinedPolicies
      );

      // ✅ ASSERT - Verify user-specific DENY blocks access while public policy remains effective
      // Anonymous user should still have overview access
      const anonymousAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(anonymousAccess).toBe(true);

      // Denied user should not have access
      const deniedUserAccess = await nodePermissionService.canAccess(
        testUsers.publicUser.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(deniedUserAccess).toBe(false);

      // Org member should still have access through public policy
      const orgMemberAccess = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(orgMemberAccess).toBe(true);
    });
  });

  describe('🔒 Security Validation Scenarios', () => {
    it('should prevent non-owners from setting permissions', async () => {
      // 🔧 ARRANGE - Security test: non-owner attempts to set malicious permissions
      // This validates our ownership-based access control

      // ⚡ ACT & ✅ ASSERT - Attempt should fail with ownership error
      const maliciousPolicies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.Edit,
          subjectType: SubjectType.User,
          subjectId: testUsers.publicUser.id,
          effect: PolicyEffect.Allow
        }]
      };

      // Non-owner should not be able to set permissions
      await expect(
        nodePermissionService.setNodePermissions(
          testNodeId,
          testUsers.publicUser.id,
          maliciousPolicies
        )
      ).rejects.toThrow('Only node owner can set permissions');
    });

    it('should validate organization membership for org policies', async () => {
      // 🔧 ARRANGE - Security test: owner attempts to share with org they don't belong to
      // This validates our organization membership requirements

      // Create another organization
      const anotherOrg = await organizationService.createOrganization({
        name: 'Another Corp',
        type: OrganizationType.Company,
        metadata: {}
      });

      // ⚡ ACT & ✅ ASSERT - Attempt should fail with membership validation error
      const invalidOrgPolicy: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: anotherOrg.id, // Owner is not a member of this org
          effect: PolicyEffect.Allow
        }]
      };

      // Should fail because owner is not a member of anotherOrg
      await expect(
        nodePermissionService.setNodePermissions(
          testNodeId,
          testUsers.nodeOwner.id,
          invalidOrgPolicy
        )
      ).rejects.toThrow('User is not a member of the specified organization');
    });
  });


  describe('📋 Policy Management', () => {
    it('should allow owners to set permissions', async () => {
      // 🔧 ARRANGE - Basic permission setting by legitimate owner
      // This validates the happy path for permission management

      // ⚡ ACT - Set some policies
      const policies: SetNodePermissionsDTO = {
        policies: [
          ...PermissionPresets.PUBLIC_OVERVIEW,
          ...PermissionPresets.ORG_VIEWABLE(organizationId)
        ]
      };

      // This should succeed without throwing
      await nodePermissionService.setNodePermissions(
        testNodeId,
        testUsers.nodeOwner.id,
        policies
      );

      // ✅ ASSERT - Verify policies are working by testing access
      const publicAccess = await nodePermissionService.canAccess(
        testUsers.anonymousUser,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(publicAccess).toBe(true);

      const orgMemberAccess = await nodePermissionService.canAccess(
        testUsers.orgMember.id,
        testNodeId,
        PermissionAction.View,
        VisibilityLevel.Full
      );
      expect(orgMemberAccess).toBe(true);
    });
  });
});
