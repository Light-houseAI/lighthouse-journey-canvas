/**
 * Tests for useBrandBuildingActivities hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { BrandActivity } from '@journey/schema';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import * as hierarchyApi from '../../services/hierarchy-api';
import { useBrandBuildingActivities } from '../useBrandBuildingActivities';

// Mock the hierarchy API
vi.mock('../../services/hierarchy-api', () => ({
  hierarchyApi: {
    getNode: vi.fn(),
  },
}));

describe('useBrandBuildingActivities', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should return empty activities when node has no brand building data', async () => {
    const mockNode = {
      id: 'node-1',
      meta: {},
    };

    vi.mocked(hierarchyApi.hierarchyApi.getNode).mockResolvedValue(mockNode as any);

    const { result } = renderHook(
      () => useBrandBuildingActivities('node-1'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should return flattened activities from all platforms', async () => {
    const mockActivities: Record<string, BrandActivity[]> = {
      LinkedIn: [
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/in/test',
          screenshots: [
            {
              storageKey: 'key1',
              filename: 'screenshot1.png',
              mimeType: 'image/png',
              sizeBytes: 1024,
              notes: 'Test screenshot 1',
            },
          ],
          notes: 'LinkedIn activity 1',
          timestamp: '2025-01-15T10:00:00Z',
        },
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/in/test',
          screenshots: [],
          notes: 'LinkedIn activity 2',
          timestamp: '2025-01-14T10:00:00Z',
        },
      ],
      X: [
        {
          platform: 'X',
          profileUrl: 'https://x.com/test',
          screenshots: [],
          notes: 'X activity',
          timestamp: '2025-01-13T10:00:00Z',
        },
      ],
    };

    const mockNode = {
      id: 'node-1',
      meta: {
        brandBuildingData: {
          activities: mockActivities,
        },
      },
    };

    vi.mocked(hierarchyApi.hierarchyApi.getNode).mockResolvedValue(mockNode as any);

    const { result } = renderHook(
      () => useBrandBuildingActivities('node-1'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toHaveLength(3);
    expect(result.current.activities[0].platform).toBe('LinkedIn');
    expect(result.current.activities[1].platform).toBe('LinkedIn');
    expect(result.current.activities[2].platform).toBe('X');
  });

  it('should sort activities by timestamp (newest first)', async () => {
    const mockActivities: Record<string, BrandActivity[]> = {
      LinkedIn: [
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/in/test',
          screenshots: [],
          notes: 'Oldest',
          timestamp: '2025-01-10T10:00:00Z',
        },
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/in/test',
          screenshots: [],
          notes: 'Newest',
          timestamp: '2025-01-15T10:00:00Z',
        },
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/in/test',
          screenshots: [],
          notes: 'Middle',
          timestamp: '2025-01-12T10:00:00Z',
        },
      ],
    };

    const mockNode = {
      id: 'node-1',
      meta: {
        brandBuildingData: {
          activities: mockActivities,
        },
      },
    };

    vi.mocked(hierarchyApi.hierarchyApi.getNode).mockResolvedValue(mockNode as any);

    const { result } = renderHook(
      () => useBrandBuildingActivities('node-1'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toHaveLength(3);
    expect(result.current.activities[0].notes).toBe('Newest');
    expect(result.current.activities[1].notes).toBe('Middle');
    expect(result.current.activities[2].notes).toBe('Oldest');
  });

  it('should handle API errors', async () => {
    const mockError = new Error('Network error');
    vi.mocked(hierarchyApi.hierarchyApi.getNode).mockRejectedValue(mockError);

    const { result } = renderHook(
      () => useBrandBuildingActivities('node-1'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.activities).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it('should use correct query key', async () => {
    const mockNode = {
      id: 'node-1',
      meta: {},
    };

    vi.mocked(hierarchyApi.hierarchyApi.getNode).mockResolvedValue(mockNode as any);

    const { result } = renderHook(
      () => useBrandBuildingActivities('test-node-id'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(hierarchyApi.hierarchyApi.getNode).toHaveBeenCalledWith('test-node-id');
  });
});
