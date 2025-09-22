/**
 * @vitest-environment jsdom
 * useSearchResults Hook Tests
 *
 * Tests non-debounced search hook following existing search hook patterns
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchResults } from './useSearchResults';

// Mock the graphrag-api service
vi.mock('@/services/graphrag-api', () => ({
  searchProfiles: vi.fn(),
}));

import { searchProfiles } from '@/services/graphrag-api';

const mockSearchProfiles = vi.mocked(searchProfiles);

// Test wrapper with QueryClient following SearchPeopleComponent pattern
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

describe('useSearchResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search immediately without debouncing', async () => {
    const mockResults = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        whyMatched: ['Software Engineer'],
        matchedNodes: [],
      },
    ];

    mockSearchProfiles.mockResolvedValue(mockResults);

    const { result } = renderHook(
      () => useSearchResults('engineer'),
      { wrapper: createWrapper() }
    );

    // Should immediately trigger search without debouncing
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockSearchProfiles).toHaveBeenCalledWith('engineer', { limit: 50 });
    expect(result.current.results).toEqual(mockResults);
  });

  it('should cache results with same config as useProfileSearch', async () => {
    const mockResults = [
      {
        id: '1',
        name: 'Jane Smith',
        email: 'jane@example.com',
        whyMatched: ['Product Manager'],
        matchedNodes: [],
      },
    ];

    mockSearchProfiles.mockResolvedValue(mockResults);

    // Use same wrapper instance to share QueryClient cache
    const wrapper = createWrapper();

    const { result: result1 } = renderHook(
      () => useSearchResults('product manager'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    // Second call with same query should use cache
    const { result: result2 } = renderHook(
      () => useSearchResults('product manager'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Should only call API once due to caching
    expect(mockSearchProfiles).toHaveBeenCalledTimes(1);
    expect(result2.current.results).toEqual(mockResults);
  });

  it('should handle loading states', () => {
    mockSearchProfiles.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { result } = renderHook(
      () => useSearchResults('loading test'),
      { wrapper: createWrapper() }
    );

    // Should be loading initially
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results).toEqual([]);
  });

  it('should handle error states', async () => {
    const mockError = new Error('Search failed');
    mockSearchProfiles.mockRejectedValue(mockError);

    const { result } = renderHook(
      () => useSearchResults('error test'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(mockError);
    expect(result.current.results).toEqual([]);
  });

  it('should not search with empty query', () => {
    const { result } = renderHook(
      () => useSearchResults(''),
      { wrapper: createWrapper() }
    );

    expect(mockSearchProfiles).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('should handle query length validation', () => {
    const longQuery = 'a'.repeat(501); // Over 500 characters

    const { result } = renderHook(
      () => useSearchResults(longQuery),
      { wrapper: createWrapper() }
    );

    // Should not search with overly long query
    expect(mockSearchProfiles).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });
});