/**
 * Unit Tests for useNetworkingActivities Hook
 *
 * Tests the hook that fetches and flattens networking activities from node metadata
 */

import type { TimelineNode } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the hierarchy API
vi.mock('../../services/hierarchy-api', () => ({
  hierarchyApi: {
    getNode: vi.fn(),
  },
}));

import { hierarchyApi } from '../../services/hierarchy-api';
import { useNetworkingActivities } from '../useNetworkingActivities';

const mockGetNode = vi.mocked(hierarchyApi.getNode);

// Test data
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';

const mockNodeWithNetworkingData: Partial<TimelineNode> = {
  id: TEST_NODE_ID,
  type: 'careerTransition' as any,
  meta: {
    networkingData: {
      activities: {
        'Cold outreach': [
          {
            networkingType: 'Cold outreach',
            timestamp: '2024-01-01T00:00:00.000Z',
            whom: ['Person A'],
            channels: ['LinkedIn'],
            exampleOnHow: 'Hello',
          },
          {
            networkingType: 'Cold outreach',
            timestamp: '2024-01-02T00:00:00.000Z',
            whom: ['Person B'],
            channels: ['Email'],
            exampleOnHow: 'Hi there',
          },
        ],
        'Attended networking event': [
          {
            networkingType: 'Attended networking event',
            timestamp: '2024-01-03T00:00:00.000Z',
            event: 'Tech Meetup',
            notes: 'Met engineers',
          },
        ],
      },
      overallSummary: 'Overall summary',
      summaries: {
        'Cold outreach': 'Cold outreach summary',
      },
      keyPoints: {
        'Cold outreach': ['Point 1', 'Point 2'],
      },
    },
  },
  userId: 1,
};

const mockNodeWithoutNetworkingData: Partial<TimelineNode> = {
  id: TEST_NODE_ID,
  type: 'careerTransition' as any,
  meta: {},
  userId: 1,
};

// Create wrapper for hooks
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useNetworkingActivities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and flatten activities from networkingData.activities', async () => {
    mockGetNode.mockResolvedValue(mockNodeWithNetworkingData as TimelineNode);

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0].networkingType).toBeDefined();
  });

  it('should sort activities by timestamp (newest first)', async () => {
    mockGetNode.mockResolvedValue(mockNodeWithNetworkingData as TimelineNode);

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const activities = result.current.data || [];
    expect(activities).toHaveLength(3);

    // Should be sorted newest first
    expect(new Date(activities[0].timestamp).getTime()).toBeGreaterThan(
      new Date(activities[1].timestamp).getTime()
    );
    expect(new Date(activities[1].timestamp).getTime()).toBeGreaterThan(
      new Date(activities[2].timestamp).getTime()
    );
  });

  it('should return empty array when no networkingData', async () => {
    mockGetNode.mockResolvedValue(
      mockNodeWithoutNetworkingData as TimelineNode
    );

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should handle invalid timestamps gracefully', async () => {
    const nodeWithInvalidTimestamp: Partial<TimelineNode> = {
      id: TEST_NODE_ID,
      type: 'careerTransition' as any,
      meta: {
        networkingData: {
          activities: {
            'Cold outreach': [
              {
                networkingType: 'Cold outreach',
                timestamp: 'invalid-date',
                whom: ['Person A'],
                channels: ['LinkedIn'],
                exampleOnHow: 'Hello',
              },
              {
                networkingType: 'Cold outreach',
                timestamp: '2024-01-01T00:00:00.000Z',
                whom: ['Person B'],
                channels: ['Email'],
                exampleOnHow: 'Hi',
              },
            ],
          },
        },
      },
      userId: 1,
    };

    mockGetNode.mockResolvedValue(nodeWithInvalidTimestamp as TimelineNode);

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should still return activities, with invalid timestamp items at end
    expect(result.current.data).toHaveLength(2);
  });

  it('should not enable query when nodeId is undefined', () => {
    const { result } = renderHook(() => useNetworkingActivities(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockGetNode).not.toHaveBeenCalled();
  });

  it('should use correct query key for caching', async () => {
    mockGetNode.mockResolvedValue(mockNodeWithNetworkingData as TimelineNode);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Check that data is cached with correct key
    const cachedData = queryClient.getQueryData([
      'networking-activities',
      TEST_NODE_ID,
    ]);
    expect(cachedData).toBeDefined();
    expect(Array.isArray(cachedData)).toBe(true);
  });

  it('should handle API errors', async () => {
    mockGetNode.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should flatten activities from multiple networking types', async () => {
    mockGetNode.mockResolvedValue(mockNodeWithNetworkingData as TimelineNode);

    const { result } = renderHook(() => useNetworkingActivities(TEST_NODE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const activities = result.current.data || [];

    // Should have activities from both types
    const coldOutreachActivities = activities.filter(
      (a) => a.networkingType === 'Cold outreach'
    );
    const eventActivities = activities.filter(
      (a) => a.networkingType === 'Attended networking event'
    );

    expect(coldOutreachActivities).toHaveLength(2);
    expect(eventActivities).toHaveLength(1);
  });
});
