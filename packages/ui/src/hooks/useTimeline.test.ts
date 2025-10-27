/**
 * useTimeline Hooks Tests
 *
 * Tests for timeline management hooks including:
 * - useTimelineNodes: Fetch timeline nodes
 * - useCreateNode: Create timeline nodes
 * - useUpdateNode: Update timeline nodes
 * - useDeleteNode: Delete timeline nodes
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hierarchyApi from '../services/hierarchy-api';
import {
  timelineKeys,
  useBulkDeleteNodes,
  useCreateNode,
  useDeleteNode,
  useTimelineNodes,
  useUpdateNode,
} from './useTimeline';

// Mock dependencies
vi.mock('../services/hierarchy-api');
const mockHierarchyApi = vi.mocked(hierarchyApi);

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

describe('useTimeline Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useTimelineNodes', () => {
    it('should fetch timeline nodes successfully', async () => {
      const mockNodes = [
        {
          id: 'node-1',
          type: 'job',
          title: 'Software Engineer',
          userId: 1,
          createdAt: new Date(),
        },
        {
          id: 'node-2',
          type: 'education',
          title: 'University',
          userId: 1,
          createdAt: new Date(),
        },
      ];

      mockHierarchyApi.listNodesWithPermissions.mockResolvedValue(
        mockNodes as any
      );

      const { result } = renderHook(() => useTimelineNodes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockHierarchyApi.listNodesWithPermissions).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockNodes);
    });

    it('should handle fetch errors', async () => {
      mockHierarchyApi.listNodesWithPermissions.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useTimelineNodes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should cache timeline nodes', async () => {
      const mockNodes = [{ id: 'node-1', type: 'job' }];

      mockHierarchyApi.listNodesWithPermissions.mockResolvedValue(
        mockNodes as any
      );

      const { result } = renderHook(() => useTimelineNodes(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should only call API once due to caching
      expect(mockHierarchyApi.listNodesWithPermissions).toHaveBeenCalledTimes(1);
    });
  });

  describe('useCreateNode', () => {
    it('should create node successfully', async () => {
      const newNode = {
        id: 'new-node',
        type: 'job',
        title: 'New Job',
        userId: 1,
        createdAt: new Date(),
      };

      mockHierarchyApi.createNode.mockResolvedValue(newNode as any);

      const { result } = renderHook(() => useCreateNode(), {
        wrapper: createWrapper(),
      });

      const nodeData = {
        type: 'job' as const,
        title: 'New Job',
        meta: { company: 'Tech Corp' },
      };

      result.current.mutate(nodeData);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockHierarchyApi.createNode).toHaveBeenCalledWith(nodeData);
    });

    it('should return created node via mutateAsync', async () => {
      const newNode = {
        id: 'new-node',
        type: 'job',
        title: 'New Job',
      };

      mockHierarchyApi.createNode.mockResolvedValue(newNode as any);

      const { result } = renderHook(() => useCreateNode(), {
        wrapper: createWrapper(),
      });

      const created = await result.current.mutateAsync({
        type: 'job',
        title: 'New Job',
        meta: {},
      });

      expect(created).toEqual(newNode);
    });

    it('should handle create errors', async () => {
      mockHierarchyApi.createNode.mockRejectedValue(
        new Error('Validation failed')
      );

      const { result } = renderHook(() => useCreateNode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        type: 'job',
        title: 'Test',
        meta: {},
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Validation failed');
    });

    it('should invalidate queries after successful create', async () => {
      const newNode = { id: 'new', type: 'job' };
      mockHierarchyApi.createNode.mockResolvedValue(newNode as any);

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateNode(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate({ type: 'job', title: 'Test', meta: {} });

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({ queryKey: timelineKeys.nodes() });
      });
    });
  });

  describe('useUpdateNode', () => {
    it('should update node successfully', async () => {
      const updatedNode = {
        id: 'node-1',
        type: 'job',
        title: 'Updated Title',
      };

      mockHierarchyApi.updateNode.mockResolvedValue(updatedNode as any);

      const { result } = renderHook(() => useUpdateNode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: 'node-1',
        updates: { title: 'Updated Title' },
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockHierarchyApi.updateNode).toHaveBeenCalledWith('node-1', {
        title: 'Updated Title',
      });
    });

    it('should handle update errors', async () => {
      mockHierarchyApi.updateNode.mockRejectedValue(
        new Error('Node not found')
      );

      const { result } = renderHook(() => useUpdateNode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: 'invalid-id',
        updates: { title: 'Test' },
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Node not found');
    });

    it('should invalidate queries after update', async () => {
      const updatedNode = { id: 'node-1', title: 'Updated' };
      mockHierarchyApi.updateNode.mockResolvedValue(updatedNode as any);

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateNode(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate({ id: 'node-1', updates: { title: 'Updated' } });

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({ queryKey: timelineKeys.nodes() });
      });
    });
  });

  describe('useDeleteNode', () => {
    it('should delete node successfully', async () => {
      mockHierarchyApi.deleteNode.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteNode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('node-to-delete');

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockHierarchyApi.deleteNode).toHaveBeenCalledWith('node-to-delete');
    });

    it('should handle delete errors', async () => {
      mockHierarchyApi.deleteNode.mockRejectedValue(
        new Error('Permission denied')
      );

      const { result } = renderHook(() => useDeleteNode(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('node-1');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Permission denied');
    });

    it('should invalidate queries after delete', async () => {
      mockHierarchyApi.deleteNode.mockResolvedValue(undefined);

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteNode(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate('node-1');

      await waitFor(() => {
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe('useBulkDeleteNodes', () => {
    it('should delete multiple nodes', async () => {
      mockHierarchyApi.deleteNode.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkDeleteNodes(), {
        wrapper: createWrapper(),
      });

      const nodeIds = ['node-1', 'node-2', 'node-3'];
      result.current.mutate(nodeIds);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockHierarchyApi.deleteNode).toHaveBeenCalledTimes(3);
      expect(mockHierarchyApi.deleteNode).toHaveBeenCalledWith('node-1');
      expect(mockHierarchyApi.deleteNode).toHaveBeenCalledWith('node-2');
      expect(mockHierarchyApi.deleteNode).toHaveBeenCalledWith('node-3');
    });

    it('should handle partial failures in bulk delete', async () => {
      mockHierarchyApi.deleteNode
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useBulkDeleteNodes(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(['node-1', 'node-2', 'node-3']);

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe('Query Keys', () => {
    it('should generate consistent query keys', () => {
      expect(timelineKeys.all).toEqual(['timeline']);
      expect(timelineKeys.nodes()).toEqual(['timeline', 'nodes']);
      expect(timelineKeys.node('node-1')).toEqual(['timeline', 'nodes', 'node-1']);
      expect(timelineKeys.userNodes('username')).toEqual([
        'timeline',
        'nodes',
        'user',
        'username',
      ]);
    });
  });
});
