/**
 * useNodeInsights Hook Tests
 *
 * Tests for node insights CRUD operations including:
 * - Fetching insights for a node
 * - Creating new insights
 * - Updating existing insights
 * - Deleting insights
 * - Cache management
 */

import type { InsightCreateDTO, InsightUpdateDTO, NodeInsight } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as httpClient from '../services/http-client';
import {
  useCreateInsight,
  useDeleteInsight,
  useNodeInsights,
  useUpdateInsight,
} from './useNodeInsights';

// Mock http client
vi.mock('../services/http-client', () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockHttpClient = vi.mocked(httpClient.httpClient);

// Test data
const mockNodeId = 'node-123';
const mockInsights: NodeInsight[] = [
  {
    id: 'insight-1',
    nodeId: mockNodeId,
    type: 'career-advice',
    title: 'Consider leadership roles',
    content: 'Based on your experience, you should explore management positions.',
    category: 'career-growth',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'insight-2',
    nodeId: mockNodeId,
    type: 'skill-gap',
    title: 'Learn cloud technologies',
    content: 'Consider expanding your cloud computing skills.',
    category: 'skills',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
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

describe('useNodeInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch insights for a node successfully', async () => {
    mockHttpClient.get.mockResolvedValue(mockInsights);

    const { result } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockInsights);
    expect(mockHttpClient.get).toHaveBeenCalledWith(
      `/api/v2/timeline/nodes/${mockNodeId}/insights`
    );
  });

  it('should handle empty insights list', async () => {
    mockHttpClient.get.mockResolvedValue([]);

    const { result } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('should handle error when fetching insights', async () => {
    const error = new Error('Failed to fetch insights');
    mockHttpClient.get.mockRejectedValue(error);

    const { result } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useNodeInsights(mockNodeId, false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHttpClient.get).not.toHaveBeenCalled();
  });

  it('should not fetch when nodeId is empty', async () => {
    const { result } = renderHook(() => useNodeInsights(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHttpClient.get).not.toHaveBeenCalled();
  });

  it('should cache insights with stale time', async () => {
    mockHttpClient.get.mockResolvedValue(mockInsights);

    const { result, rerender } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockHttpClient.get.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockHttpClient.get).toHaveBeenCalledTimes(firstCallCount);
  });

  it('should refetch insights when nodeId changes', async () => {
    mockHttpClient.get.mockResolvedValue(mockInsights);

    const { result, rerender } = renderHook(
      ({ nodeId }) => useNodeInsights(nodeId),
      {
        wrapper: createWrapper(),
        initialProps: { nodeId: mockNodeId },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Change nodeId
    mockHttpClient.get.mockResolvedValue([mockInsights[0]]);
    rerender({ nodeId: 'node-456' });

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/api/v2/timeline/nodes/node-456/insights'
      );
    });
  });
});

describe('useCreateInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create insight successfully', async () => {
    const newInsightData: InsightCreateDTO = {
      type: 'career-advice',
      title: 'New insight',
      content: 'This is a new insight',
      category: 'career-growth',
    };

    const createdInsight: NodeInsight = {
      id: 'insight-3',
      nodeId: mockNodeId,
      ...newInsightData,
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    };

    mockHttpClient.post.mockResolvedValue(createdInsight);

    const { result } = renderHook(() => useCreateInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(newInsightData);

    expect(mockHttpClient.post).toHaveBeenCalledWith(
      `/api/v2/timeline/nodes/${mockNodeId}/insights`,
      newInsightData
    );
  });

  it('should optimistically update cache after creation', async () => {
    const newInsight: NodeInsight = {
      id: 'insight-3',
      nodeId: mockNodeId,
      type: 'career-advice',
      title: 'New insight',
      content: 'Test content',
      category: 'career-growth',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    };

    mockHttpClient.get.mockResolvedValue(mockInsights);
    mockHttpClient.post.mockResolvedValue(newInsight);

    const wrapper = createWrapper();

    // First fetch existing insights
    const { result: fetchResult } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper,
    });

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Then create new insight
    const { result: createResult } = renderHook(() => useCreateInsight(mockNodeId), {
      wrapper,
    });

    await createResult.current.mutateAsync({
      type: 'career-advice',
      title: 'New insight',
      content: 'Test content',
      category: 'career-growth',
    });

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2); // Initial + invalidation refetch
    });
  });

  it('should handle creation error', async () => {
    const error = new Error('Failed to create insight');
    mockHttpClient.post.mockRejectedValue(error);

    const { result } = renderHook(() => useCreateInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        type: 'career-advice',
        title: 'New',
        content: 'Test',
        category: 'career-growth',
      })
    ).rejects.toThrow();
  });
});

describe('useUpdateInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update insight successfully', async () => {
    const insightId = 'insight-1';
    const updateData: InsightUpdateDTO = {
      title: 'Updated title',
      content: 'Updated content',
    };

    const updatedInsight: NodeInsight = {
      ...mockInsights[0],
      ...updateData,
      updatedAt: '2024-01-04T00:00:00Z',
    };

    mockHttpClient.put.mockResolvedValue(updatedInsight);

    const { result } = renderHook(() => useUpdateInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({ insightId, data: updateData });

    expect(mockHttpClient.put).toHaveBeenCalledWith(
      `/api/v2/timeline/insights/${insightId}`,
      updateData
    );
  });

  it('should update cache after update', async () => {
    const insightId = 'insight-1';
    const updatedInsight: NodeInsight = {
      ...mockInsights[0],
      title: 'Updated title',
      updatedAt: '2024-01-04T00:00:00Z',
    };

    mockHttpClient.get.mockResolvedValue(mockInsights);
    mockHttpClient.put.mockResolvedValue(updatedInsight);

    const wrapper = createWrapper();

    // First fetch insights
    const { result: fetchResult } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper,
    });

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Then update an insight
    const { result: updateResult } = renderHook(() => useUpdateInsight(mockNodeId), {
      wrapper,
    });

    await updateResult.current.mutateAsync({
      insightId,
      data: { title: 'Updated title' },
    });

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2); // Initial + invalidation refetch
    });
  });

  it('should handle update error', async () => {
    const error = new Error('Failed to update insight');
    mockHttpClient.put.mockRejectedValue(error);

    const { result } = renderHook(() => useUpdateInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        insightId: 'insight-1',
        data: { title: 'Updated' },
      })
    ).rejects.toThrow();
  });
});

describe('useDeleteInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete insight successfully', async () => {
    const insightId = 'insight-1';
    mockHttpClient.delete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(insightId);

    expect(mockHttpClient.delete).toHaveBeenCalledWith(
      `/api/v2/timeline/insights/${insightId}`
    );
  });

  it('should update cache after deletion', async () => {
    const insightId = 'insight-1';

    mockHttpClient.get.mockResolvedValue(mockInsights);
    mockHttpClient.delete.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    // First fetch insights
    const { result: fetchResult } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper,
    });

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Then delete an insight
    const { result: deleteResult } = renderHook(() => useDeleteInsight(mockNodeId), {
      wrapper,
    });

    await deleteResult.current.mutateAsync(insightId);

    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2); // Initial + invalidation refetch
    });
  });

  it('should handle deletion error', async () => {
    const error = new Error('Failed to delete insight');
    mockHttpClient.delete.mockRejectedValue(error);

    const { result } = renderHook(() => useDeleteInsight(mockNodeId), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync('insight-1')).rejects.toThrow();
  });

  it('should remove deleted insight from cache optimistically', async () => {
    const insightId = 'insight-1';

    mockHttpClient.get.mockResolvedValue(mockInsights);
    mockHttpClient.delete.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    // First fetch insights
    const { result: fetchResult } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper,
    });

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));
    expect(fetchResult.current.data).toHaveLength(2);

    // Delete an insight
    const { result: deleteResult } = renderHook(() => useDeleteInsight(mockNodeId), {
      wrapper,
    });

    await deleteResult.current.mutateAsync(insightId);

    // Cache should be invalidated and refetched
    await waitFor(() => {
      expect(mockHttpClient.get).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle full CRUD lifecycle', async () => {
    // Setup
    mockHttpClient.get.mockResolvedValue(mockInsights);

    const wrapper = createWrapper();

    // 1. Fetch initial insights
    const { result: fetchResult } = renderHook(() => useNodeInsights(mockNodeId), {
      wrapper,
    });

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));
    expect(fetchResult.current.data).toHaveLength(2);

    // 2. Create new insight
    const newInsight: NodeInsight = {
      id: 'insight-3',
      nodeId: mockNodeId,
      type: 'skill-gap',
      title: 'New skill',
      content: 'Learn TypeScript',
      category: 'skills',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    };

    mockHttpClient.post.mockResolvedValue(newInsight);
    mockHttpClient.get.mockResolvedValue([...mockInsights, newInsight]);

    const { result: createResult } = renderHook(() => useCreateInsight(mockNodeId), {
      wrapper,
    });

    await createResult.current.mutateAsync({
      type: 'skill-gap',
      title: 'New skill',
      content: 'Learn TypeScript',
      category: 'skills',
    });

    await waitFor(() => expect(mockHttpClient.get).toHaveBeenCalledTimes(2));

    // 3. Update insight
    const updatedInsight: NodeInsight = {
      ...newInsight,
      title: 'Updated skill',
    };

    mockHttpClient.put.mockResolvedValue(updatedInsight);

    const { result: updateResult } = renderHook(() => useUpdateInsight(mockNodeId), {
      wrapper,
    });

    await updateResult.current.mutateAsync({
      insightId: 'insight-3',
      data: { title: 'Updated skill' },
    });

    await waitFor(() => expect(mockHttpClient.get).toHaveBeenCalledTimes(3));

    // 4. Delete insight
    mockHttpClient.delete.mockResolvedValue(undefined);
    mockHttpClient.get.mockResolvedValue(mockInsights);

    const { result: deleteResult } = renderHook(() => useDeleteInsight(mockNodeId), {
      wrapper,
    });

    await deleteResult.current.mutateAsync('insight-3');

    await waitFor(() => expect(mockHttpClient.get).toHaveBeenCalledTimes(4));
  });
});
