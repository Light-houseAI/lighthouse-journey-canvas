/**
 * use-interview-chapter Hook Tests
 *
 * Tests for interview chapter page hooks including:
 * - Fetching application node data
 * - Fetching all nodes for sharing
 * - Fetching node permissions
 */

import type { TimelineNode } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hierarchyApi from '../services/hierarchy-api';
import * as permissionApi from '../services/permission-api';
import {
  useAllNodes,
  useApplicationNode,
  useNodePermissions,
} from './use-interview-chapter';

// Mock APIs
vi.mock('../services/hierarchy-api', () => ({
  hierarchyApi: {
    getNode: vi.fn(),
    listNodes: vi.fn(),
  },
}));

vi.mock('../services/permission-api', () => ({
  getNodePermissions: vi.fn(),
}));

const mockHierarchyApi = vi.mocked(hierarchyApi.hierarchyApi);
const mockGetNodePermissions = vi.mocked(permissionApi.getNodePermissions);

// Test data
const mockApplicationId = 'app-123';
const mockApplicationNode: TimelineNode = {
  id: mockApplicationId,
  type: 'application',
  title: 'Software Engineer at Tech Corp',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  meta: {
    company: 'Tech Corp',
    position: 'Software Engineer',
  },
};

const mockAllNodes: TimelineNode[] = [
  mockApplicationNode,
  {
    id: 'node-2',
    type: 'job',
    title: 'Previous Job',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    meta: {},
  },
];

const mockPermissions = [
  {
    id: 'perm-1',
    nodeId: mockApplicationId,
    userId: 'user-1',
    role: 'viewer',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// Helper to create query client wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useApplicationNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch application node successfully', async () => {
    mockHierarchyApi.getNode.mockResolvedValue(mockApplicationNode);

    const { result } = renderHook(() => useApplicationNode(mockApplicationId), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockApplicationNode);
    expect(mockHierarchyApi.getNode).toHaveBeenCalledWith(mockApplicationId);
  });

  it('should return null when applicationId is undefined', async () => {
    const { result } = renderHook(() => useApplicationNode(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHierarchyApi.getNode).not.toHaveBeenCalled();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useApplicationNode(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHierarchyApi.getNode).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch node');
    mockHierarchyApi.getNode.mockRejectedValue(error);

    const { result } = renderHook(() => useApplicationNode(mockApplicationId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should cache node data with stale time', async () => {
    mockHierarchyApi.getNode.mockResolvedValue(mockApplicationNode);

    const { result, rerender } = renderHook(
      () => useApplicationNode(mockApplicationId),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockHierarchyApi.getNode.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockHierarchyApi.getNode).toHaveBeenCalledTimes(firstCallCount);
  });

  it('should refetch when applicationId changes', async () => {
    mockHierarchyApi.getNode.mockResolvedValue(mockApplicationNode);

    const { result, rerender } = renderHook(
      ({ id }) => useApplicationNode(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: mockApplicationId },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Change applicationId
    const newNode = { ...mockApplicationNode, id: 'app-456' };
    mockHierarchyApi.getNode.mockResolvedValue(newNode);

    rerender({ id: 'app-456' });

    await waitFor(() => {
      expect(mockHierarchyApi.getNode).toHaveBeenCalledWith('app-456');
    });
  });
});

describe('useAllNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all nodes successfully', async () => {
    mockHierarchyApi.listNodes.mockResolvedValue(mockAllNodes);

    const { result } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockAllNodes);
    expect(result.current.data).toHaveLength(2);
    expect(mockHierarchyApi.listNodes).toHaveBeenCalled();
  });

  it('should handle empty nodes list', async () => {
    mockHierarchyApi.listNodes.mockResolvedValue([]);

    const { result } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch nodes');
    mockHierarchyApi.listNodes.mockRejectedValue(error);

    const { result } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should cache nodes with stale time', async () => {
    mockHierarchyApi.listNodes.mockResolvedValue(mockAllNodes);

    const { result, rerender } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockHierarchyApi.listNodes.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockHierarchyApi.listNodes).toHaveBeenCalledTimes(firstCallCount);
  });

  it('should refetch nodes when needed', async () => {
    mockHierarchyApi.listNodes.mockResolvedValue(mockAllNodes);

    const { result } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(mockHierarchyApi.listNodes.mock.calls.length).toBeGreaterThan(1);
    });
  });
});

describe('useNodePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch permissions when user is owner', async () => {
    mockGetNodePermissions.mockResolvedValue(mockPermissions as any);

    const { result } = renderHook(
      () => useNodePermissions(mockApplicationId, true),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockPermissions);
    expect(mockGetNodePermissions).toHaveBeenCalledWith(mockApplicationId);
  });

  it('should not fetch when user is not owner', async () => {
    const { result } = renderHook(
      () => useNodePermissions(mockApplicationId, false),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockGetNodePermissions).not.toHaveBeenCalled();
  });

  it('should not fetch when applicationId is undefined', async () => {
    const { result } = renderHook(() => useNodePermissions(undefined, true), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockGetNodePermissions).not.toHaveBeenCalled();
  });

  it('should return empty array on permission fetch error', async () => {
    mockGetNodePermissions.mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(
      () => useNodePermissions(mockApplicationId, true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('should cache permissions with stale time', async () => {
    mockGetNodePermissions.mockResolvedValue(mockPermissions as any);

    const { result, rerender } = renderHook(
      () => useNodePermissions(mockApplicationId, true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockGetNodePermissions.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockGetNodePermissions).toHaveBeenCalledTimes(firstCallCount);
  });

  it('should refetch when isOwner changes to true', async () => {
    mockGetNodePermissions.mockResolvedValue(mockPermissions as any);

    const { result, rerender } = renderHook(
      ({ isOwner }) => useNodePermissions(mockApplicationId, isOwner),
      {
        wrapper: createWrapper(),
        initialProps: { isOwner: false },
      }
    );

    expect(mockGetNodePermissions).not.toHaveBeenCalled();

    // Change to owner
    rerender({ isOwner: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetNodePermissions).toHaveBeenCalledWith(mockApplicationId);
  });

  it('should handle empty permissions list', async () => {
    mockGetNodePermissions.mockResolvedValue([]);

    const { result } = renderHook(
      () => useNodePermissions(mockApplicationId, true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

describe('Integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch application node and permissions together', async () => {
    mockHierarchyApi.getNode.mockResolvedValue(mockApplicationNode);
    mockGetNodePermissions.mockResolvedValue(mockPermissions as any);

    const wrapper = createWrapper();

    // Fetch node
    const { result: nodeResult } = renderHook(
      () => useApplicationNode(mockApplicationId),
      { wrapper }
    );

    await waitFor(() => expect(nodeResult.current.isSuccess).toBe(true));

    // Fetch permissions
    const { result: permissionsResult } = renderHook(
      () => useNodePermissions(mockApplicationId, true),
      { wrapper }
    );

    await waitFor(() => expect(permissionsResult.current.isSuccess).toBe(true));

    expect(nodeResult.current.data).toEqual(mockApplicationNode);
    expect(permissionsResult.current.data).toEqual(mockPermissions);
  });

  it('should fetch all nodes for sharing functionality', async () => {
    mockHierarchyApi.listNodes.mockResolvedValue(mockAllNodes);

    const { result } = renderHook(() => useAllNodes(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].type).toBe('application');
    expect(result.current.data?.[1].type).toBe('job');
  });
});
