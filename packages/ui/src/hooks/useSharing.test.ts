/**
 * useSharing Hooks Tests
 *
 * Tests for permission/sharing management hooks
 */

import { VisibilityLevel } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as permissionApi from '../services/permission-api';
import {
  sharingKeys,
  useCurrentPermissions,
  useRemovePermission,
  useSharePermissions,
  useUpdatePermission,
} from './useSharing';

// Mock dependencies
vi.mock('../services/permission-api');
vi.mock('../services/organization-api', () => ({
  getOrganizationsByIds: vi.fn().mockResolvedValue([]),
}));

const mockPermissionApi = vi.mocked(permissionApi);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSharing Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCurrentPermissions', () => {
    it('should fetch current permissions for nodes', async () => {
      const mockPolicies = [
        {
          nodeId: 'node-1',
          policies: [
            {
              id: 'policy-1',
              subjectType: 'user' as const,
              subjectId: 2,
              level: VisibilityLevel.Full,
              action: 'view' as const,
              effect: 'allow' as const,
              userInfo: {
                firstName: 'John',
                lastName: 'Doe',
                userName: 'johndoe',
                email: 'john@example.com',
              },
            },
          ],
        },
      ];

      mockPermissionApi.getBulkNodePermissions.mockResolvedValue(
        mockPolicies as any
      );

      const userNodes = [
        {
          id: 'node-1',
          type: 'job',
          title: 'Job',
          meta: { company: 'Tech Corp' },
        },
      ] as any;

      const { result } = renderHook(
        () => useCurrentPermissions(['node-1'], userNodes),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockPermissionApi.getBulkNodePermissions).toHaveBeenCalledWith([
        'node-1',
      ]);
      expect(result.current.data?.users).toHaveLength(1);
      expect(result.current.data?.users[0].name).toBe('John Doe');
    });

    it('should return empty permissions for no nodes', async () => {
      const { result } = renderHook(
        () => useCurrentPermissions([], []),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not make API call for empty nodes
      expect(result.current.data).toBeUndefined();
      expect(mockPermissionApi.getBulkNodePermissions).not.toHaveBeenCalled();
    });

    it('should aggregate permissions across multiple nodes', async () => {
      const mockPolicies = [
        {
          nodeId: 'node-1',
          policies: [
            {
              id: 'policy-1',
              subjectType: 'user' as const,
              subjectId: 2,
              level: VisibilityLevel.Full,
              action: 'view' as const,
              effect: 'allow' as const,
              userInfo: { firstName: 'John', lastName: 'Doe' },
            },
          ],
        },
        {
          nodeId: 'node-2',
          policies: [
            {
              id: 'policy-2',
              subjectType: 'user' as const,
              subjectId: 2,
              level: VisibilityLevel.Overview,
              action: 'view' as const,
              effect: 'allow' as const,
              userInfo: { firstName: 'John', lastName: 'Doe' },
            },
          ],
        },
      ];

      mockPermissionApi.getBulkNodePermissions.mockResolvedValue(
        mockPolicies as any
      );

      const userNodes = [
        { id: 'node-1', type: 'job', meta: { company: 'Corp 1' } },
        { id: 'node-2', type: 'job', meta: { company: 'Corp 2' } },
      ] as any;

      const { result } = renderHook(
        () => useCurrentPermissions(['node-1', 'node-2'], userNodes),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should aggregate same user across nodes
      expect(result.current.data?.users).toHaveLength(1);
      expect(result.current.data?.users[0].nodes).toHaveLength(2);
      expect(result.current.data?.users[0].policyIds).toHaveLength(2);
    });
  });

  describe('useSharePermissions', () => {
    it('should share nodes with targets', async () => {
      mockPermissionApi.getBulkNodePermissions.mockResolvedValue([]);
      mockPermissionApi.setBulkNodePermissions.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSharePermissions(), {
        wrapper: createWrapper(),
      });

      const config = {
        selectedNodes: ['node-1'],
        shareAllNodes: false,
        targets: [
          {
            type: 'user' as const,
            id: 2,
            name: 'John Doe',
            email: 'john@example.com',
            accessLevel: VisibilityLevel.Full,
          },
        ],
      };

      const userNodes = [{ id: 'node-1', type: 'job' }] as any;

      result.current.mutate({ config, userNodes });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockPermissionApi.setBulkNodePermissions).toHaveBeenCalled();
    });

    it('should throw error if no targets selected', async () => {
      const { result } = renderHook(() => useSharePermissions(), {
        wrapper: createWrapper(),
      });

      const config = {
        selectedNodes: ['node-1'],
        shareAllNodes: false,
        targets: [],
      };

      result.current.mutate({ config, userNodes: [] as any });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain(
        'select at least one target'
      );
    });

    it('should throw error if no nodes selected', async () => {
      const { result } = renderHook(() => useSharePermissions(), {
        wrapper: createWrapper(),
      });

      const config = {
        selectedNodes: [],
        shareAllNodes: false,
        targets: [
          {
            type: 'user' as const,
            id: 2,
            name: 'John',
            accessLevel: VisibilityLevel.Full,
          },
        ],
      };

      result.current.mutate({ config, userNodes: [] as any });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain('No nodes selected');
    });
  });

  describe('useRemovePermission', () => {
    it('should remove user permission', async () => {
      mockPermissionApi.deleteNodePermission.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRemovePermission(), {
        wrapper: createWrapper(),
      });

      const currentPermissions = {
        users: [
          {
            id: 2,
            name: 'John Doe',
            accessLevel: VisibilityLevel.Full,
            policyIds: ['policy-1'],
            nodes: [{ nodeId: 'node-1', nodeTitle: 'Job', nodeType: 'job' }],
          },
        ],
        organizations: [],
        public: null,
      };

      result.current.mutate({
        subjectKey: 'user-2',
        nodeId: 'node-1',
        currentPermissions,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockPermissionApi.deleteNodePermission).toHaveBeenCalledWith(
        'node-1',
        'policy-1'
      );
    });

    it('should handle remove errors', async () => {
      mockPermissionApi.deleteNodePermission.mockRejectedValue(
        new Error('Permission denied')
      );

      const { result } = renderHook(() => useRemovePermission(), {
        wrapper: createWrapper(),
      });

      const currentPermissions = {
        users: [
          {
            id: 2,
            name: 'John',
            accessLevel: VisibilityLevel.Full,
            policyIds: ['policy-1'],
            nodes: [{ nodeId: 'node-1', nodeTitle: 'Job', nodeType: 'job' }],
          },
        ],
        organizations: [],
        public: null,
      };

      result.current.mutate({
        subjectKey: 'user-2',
        currentPermissions,
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('useUpdatePermission', () => {
    it('should update permission level', async () => {
      mockPermissionApi.updateNodePermission.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdatePermission(), {
        wrapper: createWrapper(),
      });

      const currentPermissions = {
        users: [
          {
            id: 2,
            name: 'John Doe',
            accessLevel: VisibilityLevel.Overview,
            policyIds: ['policy-1'],
            nodes: [{ nodeId: 'node-1', nodeTitle: 'Job', nodeType: 'job' }],
          },
        ],
        organizations: [],
        public: null,
      };

      result.current.mutate({
        subjectKey: 'user-2',
        newLevel: VisibilityLevel.Full,
        nodeId: 'node-1',
        currentPermissions,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockPermissionApi.updateNodePermission).toHaveBeenCalledWith(
        'policy-1',
        { level: VisibilityLevel.Full }
      );
    });

    it('should handle update errors', async () => {
      mockPermissionApi.updateNodePermission.mockRejectedValue(
        new Error('Validation failed')
      );

      const { result } = renderHook(() => useUpdatePermission(), {
        wrapper: createWrapper(),
      });

      const currentPermissions = {
        users: [
          {
            id: 2,
            name: 'John',
            accessLevel: VisibilityLevel.Overview,
            policyIds: ['policy-1'],
            nodes: [{ nodeId: 'node-1', nodeTitle: 'Job', nodeType: 'job' }],
          },
        ],
        organizations: [],
        public: null,
      };

      result.current.mutate({
        subjectKey: 'user-2',
        newLevel: VisibilityLevel.Full,
        currentPermissions,
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('Query Keys', () => {
    it('should generate consistent query keys', () => {
      expect(sharingKeys.all).toEqual(['sharing']);
      expect(sharingKeys.permissions(['node-1', 'node-2'])).toEqual([
        'sharing',
        'permissions',
        ['node-1', 'node-2'],
      ]);
    });
  });
});
