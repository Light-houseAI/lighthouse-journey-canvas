/**
 * use-application-materials Hook Tests
 *
 * Tests for application materials management including:
 * - Fetching materials
 * - Updating materials with optimistic updates
 * - Resume entry management
 * - Cache invalidation and rollback
 */

import type {
  ApplicationMaterials,
  ResumeVersion,
  TimelineNode,
} from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as hierarchyApi from '../services/hierarchy-api';
import {
  useApplicationMaterials,
  useCareerTransitionNode,
  useRemoveResumeEntry,
  useUpdateApplicationMaterials,
  useUpdateResumeEntry,
} from './use-application-materials';

// Mock hierarchy API
vi.mock('../services/hierarchy-api', () => ({
  hierarchyApi: {
    getApplicationMaterials: vi.fn(),
    updateApplicationMaterials: vi.fn(),
    updateResumeEntry: vi.fn(),
    removeResumeEntry: vi.fn(),
    getNode: vi.fn(),
  },
  applicationMaterialsKeys: {
    materials: (id: string) => ['application-materials', id] as const,
  },
}));

const mockHierarchyApi = vi.mocked(hierarchyApi.hierarchyApi);

// Test data
const mockCareerTransitionId = 'ct-123';
const mockApplicationMaterials: ApplicationMaterials = {
  items: [
    {
      type: 'resume-general',
      title: 'General Resume',
      versions: [
        {
          id: 'v1',
          url: 'https://example.com/resume.pdf',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
  ],
  summary: 'Resume uploaded',
};

const mockNode: TimelineNode = {
  id: mockCareerTransitionId,
  type: 'career-transition',
  title: 'Job Search 2024',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  meta: {},
};

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

describe('useApplicationMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch application materials successfully', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );

    const { result } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockApplicationMaterials);
    expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledWith(
      mockCareerTransitionId
    );
  });

  it('should return null when careerTransitionId is undefined', async () => {
    const { result } = renderHook(() => useApplicationMaterials(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHierarchyApi.getApplicationMaterials).not.toHaveBeenCalled();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useApplicationMaterials(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHierarchyApi.getApplicationMaterials).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch materials');
    mockHierarchyApi.getApplicationMaterials.mockRejectedValue(error);

    const { result } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should cache materials with stale time', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );

    const { result, rerender } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount =
      mockHierarchyApi.getApplicationMaterials.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledTimes(
      firstCallCount
    );
  });
});

describe('useUpdateApplicationMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update application materials successfully', async () => {
    const updatedMaterials: ApplicationMaterials = {
      ...mockApplicationMaterials,
      summary: 'Updated summary',
    };

    mockHierarchyApi.updateApplicationMaterials.mockResolvedValue(
      updatedMaterials
    );

    const { result } = renderHook(
      () => useUpdateApplicationMaterials(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await result.current.mutateAsync({ summary: 'Updated summary' });

    expect(mockHierarchyApi.updateApplicationMaterials).toHaveBeenCalled();
  });

  it('should perform optimistic update', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );
    mockHierarchyApi.updateApplicationMaterials.mockResolvedValue({
      ...mockApplicationMaterials,
      summary: 'New summary',
    });

    const wrapper = createWrapper();

    // First fetch materials
    const { result: fetchResult } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Then update
    const { result: updateResult } = renderHook(
      () => useUpdateApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await updateResult.current.mutateAsync({ summary: 'New summary' });

    await waitFor(() => {
      expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledTimes(2);
    });
  });

  it('should rollback on error', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );

    const error = new Error('Update failed');
    mockHierarchyApi.updateApplicationMaterials.mockRejectedValue(error);

    const wrapper = createWrapper();

    // First fetch materials
    const { result: fetchResult } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Then try to update (will fail)
    const { result: updateResult } = renderHook(
      () => useUpdateApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await expect(
      updateResult.current.mutateAsync({ summary: 'New summary' })
    ).rejects.toThrow();

    // Should invalidate and refetch after error
    await waitFor(() => {
      expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledTimes(2);
    });
  });

  it('should merge partial updates', async () => {
    const existingMaterials: ApplicationMaterials = {
      items: [
        {
          type: 'resume-general',
          title: 'Resume',
          versions: [],
        },
      ],
      summary: 'Original summary',
    };

    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      existingMaterials
    );
    mockHierarchyApi.updateApplicationMaterials.mockImplementation(
      async (_, materials) => materials
    );

    const wrapper = createWrapper();

    // Fetch initial materials
    const { result: fetchResult } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Update only summary
    const { result: updateResult } = renderHook(
      () => useUpdateApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await updateResult.current.mutateAsync({ summary: 'New summary' });

    // Should have merged with existing items
    expect(mockHierarchyApi.updateApplicationMaterials).toHaveBeenCalledWith(
      mockCareerTransitionId,
      expect.objectContaining({
        items: existingMaterials.items,
        summary: 'New summary',
      })
    );
  });
});

describe('useUpdateResumeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update resume entry successfully', async () => {
    const resumeType = 'resume-general';
    const resumeVersion: ResumeVersion = {
      id: 'v2',
      url: 'https://example.com/resume-v2.pdf',
      createdAt: '2024-01-02T00:00:00Z',
    };

    mockHierarchyApi.updateResumeEntry.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useUpdateResumeEntry(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await result.current.mutateAsync({ resumeType, resumeVersion });

    expect(mockHierarchyApi.updateResumeEntry).toHaveBeenCalledWith(
      mockCareerTransitionId,
      resumeType,
      resumeVersion
    );
  });

  it('should invalidate cache after update', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );
    mockHierarchyApi.updateResumeEntry.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    // Fetch materials first
    const { result: fetchResult } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Update resume entry
    const { result: updateResult } = renderHook(
      () => useUpdateResumeEntry(mockCareerTransitionId),
      { wrapper }
    );

    await updateResult.current.mutateAsync({
      resumeType: 'resume-general',
      resumeVersion: {
        id: 'v2',
        url: 'https://example.com/resume-v2.pdf',
        createdAt: '2024-01-02T00:00:00Z',
      },
    });

    // Should refetch after invalidation
    await waitFor(() => {
      expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle update error', async () => {
    const error = new Error('Failed to update resume');
    mockHierarchyApi.updateResumeEntry.mockRejectedValue(error);

    const { result } = renderHook(
      () => useUpdateResumeEntry(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await expect(
      result.current.mutateAsync({
        resumeType: 'resume-general',
        resumeVersion: {
          id: 'v2',
          url: 'test.pdf',
          createdAt: '2024-01-02T00:00:00Z',
        },
      })
    ).rejects.toThrow();
  });
});

describe('useRemoveResumeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove resume entry successfully', async () => {
    const resumeType = 'resume-general';
    mockHierarchyApi.removeResumeEntry.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => useRemoveResumeEntry(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await result.current.mutateAsync(resumeType);

    expect(mockHierarchyApi.removeResumeEntry).toHaveBeenCalledWith(
      mockCareerTransitionId,
      resumeType
    );
  });

  it('should invalidate cache after removal', async () => {
    mockHierarchyApi.getApplicationMaterials.mockResolvedValue(
      mockApplicationMaterials
    );
    mockHierarchyApi.removeResumeEntry.mockResolvedValue(undefined);

    const wrapper = createWrapper();

    // Fetch materials
    const { result: fetchResult } = renderHook(
      () => useApplicationMaterials(mockCareerTransitionId),
      { wrapper }
    );

    await waitFor(() => expect(fetchResult.current.isSuccess).toBe(true));

    // Remove entry
    const { result: removeResult } = renderHook(
      () => useRemoveResumeEntry(mockCareerTransitionId),
      { wrapper }
    );

    await removeResult.current.mutateAsync('resume-general');

    await waitFor(() => {
      expect(mockHierarchyApi.getApplicationMaterials).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle removal error', async () => {
    const error = new Error('Failed to remove resume');
    mockHierarchyApi.removeResumeEntry.mockRejectedValue(error);

    const { result } = renderHook(
      () => useRemoveResumeEntry(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await expect(
      result.current.mutateAsync('resume-general')
    ).rejects.toThrow();
  });
});

describe('useCareerTransitionNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch career transition node successfully', async () => {
    mockHierarchyApi.getNode.mockResolvedValue(mockNode);

    const { result } = renderHook(
      () => useCareerTransitionNode(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockNode);
    expect(mockHierarchyApi.getNode).toHaveBeenCalledWith(
      mockCareerTransitionId
    );
  });

  it('should not fetch when id is undefined', async () => {
    const { result } = renderHook(() => useCareerTransitionNode(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockHierarchyApi.getNode).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch node');
    mockHierarchyApi.getNode.mockRejectedValue(error);

    const { result } = renderHook(
      () => useCareerTransitionNode(mockCareerTransitionId),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });
});
