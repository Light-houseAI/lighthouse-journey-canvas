/**
 * use-user-search Hook Tests
 *
 * Tests for user search functionality including:
 * - Debounced search
 * - Search with different queries
 * - Error handling
 */

import { type UserSearchResult } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as userApi from '../services/user-api';
import { useUserSearch } from './use-user-search';

// Mock user API
vi.mock('../services/user-api', () => ({
  searchUsers: vi.fn(),
}));

// Mock debounce hook to return immediately for testing
vi.mock('./use-debounce', () => ({
  useDebounce: (value: string) => value,
}));

const mockSearchUsers = vi.mocked(userApi.searchUsers);

// Test data
const mockUsers: UserSearchResult[] = [
  {
    id: '1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    headline: 'Software Engineer',
    avatarUrl: null,
  },
  {
    id: '2',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    headline: 'Product Manager',
    avatarUrl: null,
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

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search users with valid query', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toEqual(mockUsers);
    expect(result.current.data).toEqual(mockUsers);
    expect(result.current.error).toBe(null);
    expect(mockSearchUsers).toHaveBeenCalledWith('john');
  });

  it('should not search with empty query', async () => {
    const { result } = renderHook(() => useUserSearch(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
  });

  it('should not search with whitespace-only query', async () => {
    const { result } = renderHook(() => useUserSearch('   '), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
  });

  it('should not search when disabled', async () => {
    const { result } = renderHook(
      () => useUserSearch('john', { enabled: false }),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('should return empty array when search returns no results', async () => {
    mockSearchUsers.mockResolvedValue([]);

    const { result } = renderHook(() => useUserSearch('nonexistent'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should handle search error gracefully', async () => {
    const error = new Error('Search service unavailable');
    mockSearchUsers.mockRejectedValue(error);

    const { result } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.code).toBe('SEARCH_ERROR');
    expect(result.current.error?.message).toBe('Search service unavailable');
  });

  it('should handle non-Error exceptions', async () => {
    mockSearchUsers.mockRejectedValue('Unknown error');

    const { result } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.message).toBe('User search failed');
  });

  it('should update results when query changes', async () => {
    mockSearchUsers.mockResolvedValue([mockUsers[0]]);

    const { result, rerender } = renderHook(
      ({ query }) => useUserSearch(query),
      {
        wrapper: createWrapper(),
        initialProps: { query: 'john' },
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.users).toEqual([mockUsers[0]]);

    // Change query
    mockSearchUsers.mockResolvedValue([mockUsers[1]]);

    act(() => {
      rerender({ query: 'jane' });
    });

    await waitFor(() => expect(result.current.users).toEqual([mockUsers[1]]));
  });

  it('should cache search results with stale time', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result, rerender } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const firstCallCount = mockSearchUsers.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockSearchUsers).toHaveBeenCalledTimes(firstCallCount);
  });

  it('should support refetch', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCountBefore = mockSearchUsers.mock.calls.length;

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(mockSearchUsers.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  it('should search with custom debounce delay option', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(
      () => useUserSearch('john', { debounceDelay: 500 }),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toEqual(mockUsers);
  });

  it('should search when enabled changes from false to true', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result, rerender } = renderHook(
      ({ enabled }) => useUserSearch('john', { enabled }),
      {
        wrapper: createWrapper(),
        initialProps: { enabled: false },
      }
    );

    expect(mockSearchUsers).not.toHaveBeenCalled();

    act(() => {
      rerender({ enabled: true });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSearchUsers).toHaveBeenCalledWith('john');
  });

  it('should return users sorted by relevance', async () => {
    mockSearchUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toHaveLength(2);
    expect(result.current.users[0].id).toBe('1');
    expect(result.current.users[1].id).toBe('2');
  });
});
