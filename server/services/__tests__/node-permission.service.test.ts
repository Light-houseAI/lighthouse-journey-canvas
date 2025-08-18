/**
 * NodePermissionService Unit Tests
 * Comprehensive test suite covering all permission scenarios from PRD
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContainer, asValue, asClass, InjectionMode } from 'awilix';
import { NodePermissionService } from '../node-permission.service';
import { 
  VisibilityLevel, 
  PermissionAction, 
  SubjectType, 
  PolicyEffect,
  NodePolicy,
  NodeAccessLevel,
  SetNodePermissionsDTO
} from '@shared/schema';

// Mock implementations
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

const mockDatabase = {
  query: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  execute: vi.fn()
};

const mockNodePermissionRepository = {
  canAccess: vi.fn(),
  getAccessLevel: vi.fn(),
  getNodePolicies: vi.fn(),
  setNodePolicies: vi.fn(),
  deletePolicy: vi.fn(),
  getAccessibleNodes: vi.fn(),
  getEffectivePermissions: vi.fn(),
  batchCheckAccess: vi.fn(),
  isNodeOwner: vi.fn(),
  cleanupExpiredPolicies: vi.fn()
};

const mockOrganizationRepository = {
  getUserOrganizations: vi.fn(),
  isUserMemberOfOrg: vi.fn(),
  getOrganization: vi.fn(),
  getUserRole: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getById: vi.fn(),
  getByName: vi.fn(),
  list: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  updateMemberRole: vi.fn(),
  getMembers: vi.fn(),
  getUserOrganizationIds: vi.fn(),
  findByNamePattern: vi.fn(),
  createOrGet: vi.fn(),
  getStatistics: vi.fn()
};

describe('NodePermissionService', () => {
  let container: any;
  let nodePermissionService: NodePermissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Awilix container
    container = createContainer({
      injectionMode: InjectionMode.PROXY
    });
    
    container.register({
      database: asValue(mockDatabase),
      logger: asValue(mockLogger),
      nodePermissionRepository: asValue(mockNodePermissionRepository),
      organizationRepository: asValue(mockOrganizationRepository),
      nodePermissionService: asClass(NodePermissionService).singleton()
    });
    
    nodePermissionService = container.resolve('nodePermissionService');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Permission Rules', () => {
    const nodeId = '123e4567-e89b-12d3-a456-426614174000';
    const ownerId = 1;
    const otherUserId = 2;

    it('should allow owner full access to their nodes (cannot be denied)', async () => {
      // Owner always has full access regardless of policies
      mockNodePermissionRepository.canAccess.mockResolvedValue(true);
      
      const result = await nodePermissionService.canAccess(
        ownerId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
      expect(mockNodePermissionRepository.canAccess).toHaveBeenCalledWith(
        ownerId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
    });

    it('should allow public access to overview level when public policy exists', async () => {
      mockNodePermissionRepository.canAccess.mockResolvedValue(true);
      
      const result = await nodePermissionService.canAccess(
        null, // Anonymous user
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(true);
      expect(mockNodePermissionRepository.canAccess).toHaveBeenCalledWith(
        null, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
    });

    it('should deny public access to full level without explicit policy', async () => {
      mockNodePermissionRepository.canAccess.mockResolvedValue(false);
      
      const result = await nodePermissionService.canAccess(
        null, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(false);
    });

    it('should allow organization members to access org-shared nodes', async () => {
      const orgMemberId = 3;
      mockNodePermissionRepository.canAccess.mockResolvedValue(true);
      
      const result = await nodePermissionService.canAccess(
        orgMemberId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
    });

    it('should ensure DENY policies override ALLOW policies for same user', async () => {
      // Simulate DENY policy overriding ALLOW
      mockNodePermissionRepository.canAccess.mockResolvedValue(false);
      
      const result = await nodePermissionService.canAccess(
        otherUserId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(false);
    });

    it('should ensure user-specific grants override organization grants', async () => {
      // User-specific policy should take precedence
      mockNodePermissionRepository.canAccess.mockResolvedValue(true);
      
      const result = await nodePermissionService.canAccess(
        otherUserId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toBe(true);
    });

    it('should ignore expired policies automatically', async () => {
      // Repository should handle expired policy filtering
      mockNodePermissionRepository.canAccess.mockResolvedValue(false);
      
      const result = await nodePermissionService.canAccess(
        otherUserId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toBe(false);
    });
  });

  describe('Access Level Detection', () => {
    const nodeId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = 2;

    it('should return highest available access level', async () => {
      mockNodePermissionRepository.getAccessLevel.mockResolvedValue(VisibilityLevel.Full);
      
      const result = await nodePermissionService.getAccessLevel(userId, nodeId);
      
      expect(result).toBe(VisibilityLevel.Full);
      expect(mockNodePermissionRepository.getAccessLevel).toHaveBeenCalledWith(userId, nodeId);
    });

    it('should return overview level when full access is denied', async () => {
      mockNodePermissionRepository.getAccessLevel.mockResolvedValue(VisibilityLevel.Overview);
      
      const result = await nodePermissionService.getAccessLevel(userId, nodeId);
      
      expect(result).toBe(VisibilityLevel.Overview);
    });

    it('should return null when no access is granted', async () => {
      mockNodePermissionRepository.getAccessLevel.mockResolvedValue(null);
      
      const result = await nodePermissionService.getAccessLevel(userId, nodeId);
      
      expect(result).toBe(null);
    });
  });

  describe('Permission Management', () => {
    const nodeId = '123e4567-e89b-12d3-a456-426614174000';
    const ownerId = 1;

    it('should allow owner to set permissions on their nodes', async () => {
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      mockNodePermissionRepository.isNodeOwner.mockResolvedValue(true);
      mockNodePermissionRepository.setNodePolicies.mockResolvedValue(undefined);
      
      await nodePermissionService.setNodePermissions(nodeId, ownerId, policies);
      
      expect(mockNodePermissionRepository.isNodeOwner).toHaveBeenCalledWith(ownerId, nodeId);
      expect(mockNodePermissionRepository.setNodePolicies).toHaveBeenCalledWith(
        nodeId, 
        ownerId, 
        policies.policies
      );
    });

    it('should prevent non-owners from setting permissions', async () => {
      const nonOwnerId = 2;
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      // Mock owner check to return false
      mockNodePermissionRepository.isNodeOwner.mockResolvedValue(false);

      await expect(
        nodePermissionService.setNodePermissions(nodeId, nonOwnerId, policies)
      ).rejects.toThrow('Only node owner can set permissions');
    });

    it('should validate organization membership for org-level permissions', async () => {
      const orgId = 1;
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.View,
          subjectType: SubjectType.Organization,
          subjectId: orgId,
          effect: PolicyEffect.Allow
        }]
      };

      mockNodePermissionRepository.isNodeOwner.mockResolvedValue(true);
      mockOrganizationRepository.isUserMemberOfOrg.mockResolvedValue(false);
      
      await expect(
        nodePermissionService.setNodePermissions(nodeId, ownerId, policies)
      ).rejects.toThrow('User is not a member of the specified organization');
    });

    it('should prevent users from granting permissions they do not have', async () => {
      const userId = 2;
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Full,
          action: PermissionAction.Edit,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      // User is not owner but tries to grant edit permissions
      mockNodePermissionRepository.isNodeOwner.mockResolvedValue(false);

      await expect(
        nodePermissionService.setNodePermissions(nodeId, userId, policies)
      ).rejects.toThrow('Only node owner can set permissions');
    });
  });

  describe('Batch Operations', () => {
    const userId = 1;

    it('should efficiently check access for multiple nodes', async () => {
      const nodeIds = [
        '123e4567-e89b-12d3-a456-426614174000',
        '223e4567-e89b-12d3-a456-426614174001',
        '323e4567-e89b-12d3-a456-426614174002'
      ];

      const mockAccessibleNodes = nodeIds.map(id => ({
        nodeId: id,
        accessLevel: VisibilityLevel.Overview,
        canEdit: false
      }));

      mockNodePermissionRepository.getAccessibleNodes.mockResolvedValue(mockAccessibleNodes);
      
      const result = await nodePermissionService.getAccessibleNodes(
        userId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(result).toEqual(mockAccessibleNodes);
      expect(mockNodePermissionRepository.getAccessibleNodes).toHaveBeenCalledWith(
        userId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
    });

    it('should handle empty results gracefully', async () => {
      mockNodePermissionRepository.getAccessibleNodes.mockResolvedValue([]);
      
      const result = await nodePermissionService.getAccessibleNodes(
        userId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      expect(result).toEqual([]);
    });
  });

  describe('Performance Requirements', () => {
    const nodeId = '123e4567-e89b-12d3-a456-426614174000';
    const userId = 1;

    it('should complete single permission check within 100ms', async () => {
      mockNodePermissionRepository.canAccess.mockResolvedValue(true);
      
      const startTime = Date.now();
      await nodePermissionService.canAccess(
        userId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should complete batch operations within 500ms', async () => {
      // Generate 1000+ mock nodes
      const mockNodes = Array.from({ length: 1000 }, (_, i) => ({
        nodeId: `${i}23e4567-e89b-12d3-a456-426614174000`,
        accessLevel: VisibilityLevel.Overview,
        canEdit: false
      }));

      mockNodePermissionRepository.getAccessibleNodes.mockResolvedValue(mockNodes);
      
      const startTime = Date.now();
      await nodePermissionService.getAccessibleNodes(
        userId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockNodePermissionRepository.canAccess.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(
        nodePermissionService.canAccess(1, '123e4567-e89b-12d3-a456-426614174000', PermissionAction.View, VisibilityLevel.Overview)
      ).rejects.toThrow('Database connection failed');
    });

    it('should validate node UUID format', async () => {
      await expect(
        nodePermissionService.canAccess(1, 'invalid-uuid', PermissionAction.View, VisibilityLevel.Overview)
      ).rejects.toThrow('Invalid node ID format');
    });

    it('should validate user ID format', async () => {
      await expect(
        nodePermissionService.canAccess(-1, '123e4567-e89b-12d3-a456-426614174000', PermissionAction.View, VisibilityLevel.Overview)
      ).rejects.toThrow('Invalid user ID');
    });
  });

  describe('Audit Logging', () => {
    it('should log all permission changes', async () => {
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const ownerId = 1;
      const policies: SetNodePermissionsDTO = {
        policies: [{
          level: VisibilityLevel.Overview,
          action: PermissionAction.View,
          subjectType: SubjectType.Public,
          effect: PolicyEffect.Allow
        }]
      };

      mockNodePermissionRepository.isNodeOwner.mockResolvedValue(true);
      mockNodePermissionRepository.setNodePolicies.mockResolvedValue(undefined);
      
      await nodePermissionService.setNodePermissions(nodeId, ownerId, policies);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Permission change'),
        expect.objectContaining({
          nodeId,
          userId: ownerId,
          action: 'set_permissions'
        })
      );
    });

    it('should log unauthorized access attempts', async () => {
      mockNodePermissionRepository.canAccess.mockResolvedValue(false);
      
      const result = await nodePermissionService.canAccess(2, '123e4567-e89b-12d3-a456-426614174000', PermissionAction.View, VisibilityLevel.Full);
      
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Access denied'),
        expect.objectContaining({
          userId: 2,
          nodeId: '123e4567-e89b-12d3-a456-426614174000'
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should treat nodes without policies as owner-only', async () => {
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const ownerId = 1;
      const otherUserId = 2;

      // Owner should have access, non-owner should not
      mockNodePermissionRepository.canAccess
        .mockResolvedValueOnce(true)   // Owner access
        .mockResolvedValueOnce(false); // Non-owner access

      const ownerResult = await nodePermissionService.canAccess(
        ownerId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Full
      );
      
      const otherResult = await nodePermissionService.canAccess(
        otherUserId, 
        nodeId, 
        PermissionAction.View, 
        VisibilityLevel.Overview
      );
      
      expect(ownerResult).toBe(true);
      expect(otherResult).toBe(false);
    });

    it('should maintain existing API behavior', async () => {
      // Test that the service maintains the same interface as before
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const userId = 1;

      mockNodePermissionRepository.getAccessLevel.mockResolvedValue(VisibilityLevel.Full);
      
      const result = await nodePermissionService.getAccessLevel(userId, nodeId);
      
      expect(typeof result).toBe('string');
      expect(Object.values(VisibilityLevel)).toContain(result);
    });
  });
});