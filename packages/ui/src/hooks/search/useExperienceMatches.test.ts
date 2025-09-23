/**
 * Unit Tests for useExperienceMatches Hook (LIG-179)
 *
 * Tests the experience matches hook that fetches and caches match data for timeline nodes.
 * These tests define the expected hook behavior and must FAIL before implementation (TDD approach).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import type { TimelineNode } from '@journey/schema';
import type { GraphRAGSearchResponse } from '../../components/search/types/search.types';

// Mock the experience matches API client
vi.mock('../../services/experience-matches-api', () => ({
  fetchExperienceMatches: vi.fn(),
  canNodeHaveMatches: (nodeType: string, endDate?: string | null) => {
    // Only job and education nodes can have matches
    if (nodeType !== 'job' && nodeType !== 'education') {
      return false;
    }
    // No end date means current
    if (!endDate) {
      return true;
    }
    // Check if end date is in the future
    try {
      const endDateObj = new Date(endDate + '-01');
      const now = new Date();
      return endDateObj > now;
    } catch {
      return false;
    }
  },
}));

import { fetchExperienceMatches } from '../../services/experience-matches-api';
import { useExperienceMatches } from './useExperienceMatches';
import { matchQueryKeys } from './match-query-keys';

const mockFetchExperienceMatches = vi.mocked(fetchExperienceMatches);

// Test data constants
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_USER_ID = 1;

const mockCurrentJobNode: Partial<TimelineNode> = {
  id: TEST_NODE_ID,
  type: 'job',
  meta: {
    orgId: 1,
    role: 'Senior Software Engineer',
    description: 'Building scalable React applications with TypeScript',
    startDate: '2023-01',
    endDate: null, // Current job
  },
  userId: TEST_USER_ID,
};

const mockPastJobNode: Partial<TimelineNode> = {
  id: '222e4567-e89b-12d3-a456-426614174001',
  type: 'job',
  meta: {
    orgId: 1,
    role: 'Junior Developer',
    description: 'Learning web development fundamentals',
    startDate: '2021-01',
    endDate: '2022-12', // Past job
  },
  userId: TEST_USER_ID,
};

const mockProjectNode: Partial<TimelineNode> = {
  id: '333e4567-e89b-12d3-a456-426614174002',
  type: 'project',
  meta: {
    title: 'Portfolio Website',
    description: 'Personal portfolio built with React',
  },
  userId: TEST_USER_ID,
};

const mockMatchData: GraphRAGSearchResponse = {
  query: 'Building scalable React applications with TypeScript',
  totalResults: 2,
  profiles: [
    {
      id: 'profile-123',
      name: 'John Doe',
      email: 'john.doe@techcorp.com',
      currentRole: 'Senior React Developer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      matchScore: '85',
      whyMatched: ['5 years of React experience', 'Expert in TypeScript', 'Scalable architecture'],
      skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      matchedNodes: [
        {
          id: 'node-1',
          type: 'job',
          meta: { role: 'Senior React Developer', company: 'TechCorp' },
          score: 0.85,
          insights: [
            {
              text: 'Built scalable React applications serving 1M+ users',
              category: 'achievement',
              resources: ['https://techcorp.com/case-study']
            }
          ]
        }
      ],
      insightsSummary: ['Led React migration for enterprise platform', 'Mentored team of 5 developers'],
    },
    {
      id: 'opportunity-456',
      name: 'React Engineer',
      email: 'hiring@startupxyz.com',
      currentRole: 'Frontend Engineer',
      company: 'StartupXYZ',
      location: 'Remote',
      matchScore: '78',
      whyMatched: ['Looking for React developers', 'TypeScript required', 'Remote-first team'],
      skills: ['React', 'TypeScript', 'Next.js'],
      matchedNodes: [
        {
          id: 'node-2',
          type: 'job',
          meta: { role: 'Frontend Engineer', company: 'StartupXYZ' },
          score: 0.78,
        }
      ],
    },
  ],
  timestamp: new Date().toISOString(),
};

const mockEmptyMatchData: GraphRAGSearchResponse = {
  query: 'Learning web development fundamentals',
  totalResults: 0,
  profiles: [],
  timestamp: new Date().toISOString(),
};

// Test wrapper with QueryClient
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

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useExperienceMatches Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Current Experience Detection', () => {
    it('should detect current job experiences correctly', () => {
      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isCurrentExperience).toBe(true);
      expect(result.current.shouldShowButton).toBe(true);
    });

    it('should detect past job experiences correctly', () => {
      const { result } = renderHook(
        () => useExperienceMatches(mockPastJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isCurrentExperience).toBe(false);
      expect(result.current.shouldShowButton).toBe(false);
    });

    it('should reject non-experience node types', () => {
      const { result } = renderHook(
        () => useExperienceMatches(mockProjectNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isCurrentExperience).toBe(false);
      expect(result.current.shouldShowButton).toBe(false);
    });

    it('should handle nodes with missing meta gracefully', () => {
      const nodeWithoutMeta = {
        ...mockCurrentJobNode,
        meta: undefined,
      };

      const { result } = renderHook(
        () => useExperienceMatches(nodeWithoutMeta as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isCurrentExperience).toBe(false);
      expect(result.current.shouldShowButton).toBe(false);
    });
  });

  describe('Data Fetching Behavior', () => {
    it('should fetch matches for current experience nodes', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchExperienceMatches).toHaveBeenCalledWith(TEST_NODE_ID);
      expect(result.current.data).toEqual(mockMatchData);
      expect(result.current.error).toBeNull();
    });

    it('should not fetch matches for past experiences', () => {
      const { result } = renderHook(
        () => useExperienceMatches(mockPastJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockFetchExperienceMatches).not.toHaveBeenCalled();
    });

    it('should not fetch matches for non-experience nodes', () => {
      const { result } = renderHook(
        () => useExperienceMatches(mockProjectNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockFetchExperienceMatches).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Failed to fetch matches');
      mockFetchExperienceMatches.mockRejectedValueOnce(apiError);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
      expect(result.current.hasMatches).toBe(false);
    });
  });

  describe('Match Count and Visibility Logic', () => {
    it('should calculate hasMatches correctly for nodes with matches', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMatches).toBe(true);
      expect(result.current.matchCount).toBe(2);
      expect(result.current.shouldShowButton).toBe(true);
    });

    it('should calculate hasMatches correctly for nodes with no matches', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockEmptyMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMatches).toBe(false);
      expect(result.current.matchCount).toBe(0);
      expect(result.current.shouldShowButton).toBe(false);
    });

    it('should show button only for current experiences with matches', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.shouldShowButton).toBe(true);
    });
  });

  describe('Cache Behavior', () => {
    it('should use stale time of 5 minutes for cache management', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First call should fetch data
      expect(mockFetchExperienceMatches).toHaveBeenCalledTimes(1);

      // Re-render with same node should use cache (within stale time)
      const { result: result2 } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      // Should still be only one API call (cached)
      expect(mockFetchExperienceMatches).toHaveBeenCalledTimes(1);
      expect(result2.current.data).toEqual(mockMatchData);
    });

    it('should support manual refresh via refetch', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchExperienceMatches).toHaveBeenCalledTimes(1);

      // Manually refetch
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);
      result.current.refetch();

      await waitFor(() => {
        expect(mockFetchExperienceMatches).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Search Query Extraction', () => {
    it('should extract search query from hook data', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.searchQuery).toBe('Building scalable React applications with TypeScript');
    });

    it('should provide search query for navigation', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Search query should be available for navigation
      expect(result.current.searchQuery).toBeTruthy();
      expect(typeof result.current.searchQuery).toBe('string');
    });
  });

  describe('Hook Return Interface', () => {
    it('should return all required properties', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify hook returns expected interface
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('hasMatches');
      expect(result.current).toHaveProperty('matchCount');
      expect(result.current).toHaveProperty('searchQuery');
      expect(result.current).toHaveProperty('isCurrentExperience');
      expect(result.current).toHaveProperty('shouldShowButton');
      expect(result.current).toHaveProperty('refetch');
    });

    it('should provide correct types for all return properties', async () => {
      mockFetchExperienceMatches.mockResolvedValueOnce(mockMatchData);

      const { result } = renderHook(
        () => useExperienceMatches(mockCurrentJobNode as TimelineNode),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.hasMatches).toBe('boolean');
      expect(typeof result.current.matchCount).toBe('number');
      expect(typeof result.current.isCurrentExperience).toBe('boolean');
      expect(typeof result.current.shouldShowButton).toBe('boolean');
      expect(typeof result.current.refetch).toBe('function');

      if (result.current.searchQuery !== undefined) {
        expect(typeof result.current.searchQuery).toBe('string');
      }
    });
  });
});

describe('Match Query Keys Factory', () => {
  describe('Cache Key Structure', () => {
    it('should generate hierarchical query keys', () => {
      const keys = matchQueryKeys;

      expect(keys.all).toEqual(['experience-matches']);
      expect(keys.lists()).toEqual(['experience-matches', 'list']);
      expect(keys.list()).toEqual(['experience-matches', 'list']);
      expect(keys.details()).toEqual(['experience-matches', 'detail']);
      expect(keys.detail(TEST_NODE_ID)).toEqual(['experience-matches', 'detail', TEST_NODE_ID]);
    });

    it('should create unique keys for different node IDs', () => {
      const nodeId1 = '123e4567-e89b-12d3-a456-426614174000';
      const nodeId2 = '456e7890-e89b-12d3-a456-426614174001';

      const key1 = matchQueryKeys.detail(nodeId1);
      const key2 = matchQueryKeys.detail(nodeId2);

      expect(key1).not.toEqual(key2);
      expect(key1[2]).toBe(nodeId1);
      expect(key2[2]).toBe(nodeId2);
    });

    it('should maintain consistent key structure', () => {
      const detailKey = matchQueryKeys.detail(TEST_NODE_ID);

      // Should have consistent structure: [base, type, id]
      expect(detailKey).toHaveLength(3);
      expect(detailKey[0]).toBe('experience-matches');
      expect(detailKey[1]).toBe('detail');
      expect(detailKey[2]).toBe(TEST_NODE_ID);
    });
  });

  describe('Cache Invalidation Support', () => {
    it('should support invalidating all experience matches', () => {
      const allKey = matchQueryKeys.all;

      // Invalidating this key should clear all experience match caches
      expect(allKey).toEqual(['experience-matches']);
    });

    it('should support invalidating all detail queries', () => {
      const detailsKey = matchQueryKeys.details();

      // Invalidating this key should clear all detail caches but not lists
      expect(detailsKey).toEqual(['experience-matches', 'detail']);
    });

    it('should support invalidating specific node matches', () => {
      const specificKey = matchQueryKeys.detail(TEST_NODE_ID);

      // Invalidating this key should clear only the specific node cache
      expect(specificKey).toEqual(['experience-matches', 'detail', TEST_NODE_ID]);
    });
  });

  describe('Query Key Consistency', () => {
    it('should generate same keys for same inputs', () => {
      const key1 = matchQueryKeys.detail(TEST_NODE_ID);
      const key2 = matchQueryKeys.detail(TEST_NODE_ID);

      expect(key1).toEqual(key2);
    });

    it('should handle undefined node IDs gracefully', () => {
      // This should not throw and should return a valid key structure
      const keyWithUndefined = matchQueryKeys.detail(undefined as any);

      expect(Array.isArray(keyWithUndefined)).toBe(true);
      expect(keyWithUndefined[0]).toBe('experience-matches');
      expect(keyWithUndefined[1]).toBe('detail');
    });

    it('should handle empty string node IDs', () => {
      const keyWithEmpty = matchQueryKeys.detail('');

      expect(keyWithEmpty).toEqual(['experience-matches', 'detail', '']);
    });

    it('should work with various UUID formats', () => {
      const uuidFormats = [
        '123e4567-e89b-12d3-a456-426614174000', // Standard UUID
        '123E4567-E89B-12D3-A456-426614174000', // Uppercase UUID
        '123e4567e89b12d3a456426614174000',     // No hyphens
      ];

      uuidFormats.forEach(uuid => {
        const key = matchQueryKeys.detail(uuid);
        expect(key).toEqual(['experience-matches', 'detail', uuid]);
      });
    });
  });

  describe('TanStack Query Integration', () => {
    it('should provide keys compatible with TanStack Query', () => {
      const key = matchQueryKeys.detail(TEST_NODE_ID);

      // TanStack Query expects array of strings/primitives
      expect(Array.isArray(key)).toBe(true);
      key.forEach(segment => {
        expect(typeof segment).toBe('string');
      });
    });

    it('should support query key filtering patterns', () => {
      const detailKey = matchQueryKeys.detail(TEST_NODE_ID);
      const detailsKey = matchQueryKeys.details();
      const allKey = matchQueryKeys.all;

      // Test filtering logic (simulates TanStack Query's matching)
      const isDetailKeyForNode = (key: string[]) => {
        return key.length >= 3 &&
               key[0] === 'experience-matches' &&
               key[1] === 'detail' &&
               key[2] === TEST_NODE_ID;
      };

      const isAnyDetailKey = (key: string[]) => {
        return key.length >= 2 &&
               key[0] === 'experience-matches' &&
               key[1] === 'detail';
      };

      const isAnyMatchKey = (key: string[]) => {
        return key.length >= 1 && key[0] === 'experience-matches';
      };

      expect(isDetailKeyForNode(detailKey)).toBe(true);
      expect(isAnyDetailKey(detailKey)).toBe(true);
      expect(isAnyDetailKey(detailsKey)).toBe(true);
      expect(isAnyMatchKey(detailKey)).toBe(true);
      expect(isAnyMatchKey(detailsKey)).toBe(true);
      expect(isAnyMatchKey(allKey)).toBe(true);
    });
  });

  describe('Performance Considerations', () => {
    it('should generate keys efficiently', () => {
      const startTime = performance.now();

      // Generate many keys
      for (let i = 0; i < 1000; i++) {
        matchQueryKeys.detail(`test-${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be very fast (less than 10ms for 1000 keys)
      expect(duration).toBeLessThan(10);
    });

    it('should not create new objects unnecessarily', () => {
      const allKey1 = matchQueryKeys.all;
      const allKey2 = matchQueryKeys.all;

      // Static keys should be the same reference
      expect(allKey1).toBe(allKey2);
    });
  });
});