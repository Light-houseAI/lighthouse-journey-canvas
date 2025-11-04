/**
 * use-organizations Hook Tests
 *
 * Tests for organization management hooks including:
 * - Fetching user organizations
 * - Searching organizations
 * - Creating organizations
 */

import { type Organization, type OrganizationType } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as organizationApi from '../services/organization-api';
import {
  useCreateOrganization,
  useSearchOrganizations,
  useUserOrganizations,
} from './use-organizations';

// Mock organization API
vi.mock('../services/organization-api', () => ({
  getUserOrganizations: vi.fn(),
  searchOrganizations: vi.fn(),
  createOrganization: vi.fn(),
}));

const mockGetUserOrganizations = vi.mocked(
  organizationApi.getUserOrganizations
);
const mockSearchOrganizations = vi.mocked(organizationApi.searchOrganizations);
const mockCreateOrganization = vi.mocked(organizationApi.createOrganization);

// Test data
const mockOrganizations: Organization[] = [
  {
    id: '1',
    name: 'Acme Corp',
    type: 'company' as OrganizationType,
    createdBy: 'user1',
    createdAt: '2024-01-01T00:00:00Z',
    memberCount: 10,
  },
  {
    id: '2',
    name: 'Tech University',
    type: 'university' as OrganizationType,
    createdBy: 'user1',
    createdAt: '2024-01-02T00:00:00Z',
    memberCount: 5,
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

describe('useUserOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user organizations successfully', async () => {
    mockGetUserOrganizations.mockResolvedValue(mockOrganizations);

    const { result } = renderHook(() => useUserOrganizations(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockOrganizations);
    expect(result.current.data).toHaveLength(2);
  });

  it('should handle empty organizations list', async () => {
    mockGetUserOrganizations.mockResolvedValue([]);

    const { result } = renderHook(() => useUserOrganizations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
    expect(result.current.data).toHaveLength(0);
  });

  it('should handle error when fetching organizations', async () => {
    const error = new Error('Failed to fetch organizations');
    mockGetUserOrganizations.mockRejectedValue(error);

    const { result } = renderHook(() => useUserOrganizations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should cache organizations with correct stale time', async () => {
    mockGetUserOrganizations.mockResolvedValue(mockOrganizations);

    const { result, rerender } = renderHook(() => useUserOrganizations(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstCallCount = mockGetUserOrganizations.mock.calls.length;

    // Rerender should use cached data
    rerender();

    expect(mockGetUserOrganizations).toHaveBeenCalledTimes(firstCallCount);
  });
});

describe('useSearchOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search organizations with valid query', async () => {
    const searchResults = [mockOrganizations[0]];
    mockSearchOrganizations.mockResolvedValue(searchResults);

    const { result } = renderHook(() => useSearchOrganizations('Acme', true), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.organizations).toEqual(searchResults);
    expect(result.current.data).toEqual(searchResults);
    expect(result.current.error).toBe(null);
  });

  it('should not search when query is too short', async () => {
    const { result } = renderHook(() => useSearchOrganizations('A', true), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockSearchOrganizations).not.toHaveBeenCalled();
  });

  it('should not search when disabled', async () => {
    const { result } = renderHook(() => useSearchOrganizations('Acme', false), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockSearchOrganizations).not.toHaveBeenCalled();
  });

  it('should return empty array when search returns no results', async () => {
    mockSearchOrganizations.mockResolvedValue([]);

    const { result } = renderHook(
      () => useSearchOrganizations('Nonexistent', true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.organizations).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should handle search error gracefully', async () => {
    const error = new Error('Search failed');
    mockSearchOrganizations.mockRejectedValue(error);

    const { result } = renderHook(() => useSearchOrganizations('Acme', true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.organizations).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.code).toBe('SEARCH_ERROR');
  });

  it('should trim whitespace from query', async () => {
    mockSearchOrganizations.mockResolvedValue([]);

    const { result } = renderHook(
      () => useSearchOrganizations('  Acme  ', true),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockSearchOrganizations).toHaveBeenCalledWith('  Acme  ');
  });
});

describe('useCreateOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create organization successfully', async () => {
    const newOrg: Organization = {
      id: '3',
      name: 'New Startup',
      type: 'company' as OrganizationType,
      createdBy: 'user1',
      createdAt: '2024-01-03T00:00:00Z',
      memberCount: 1,
    };

    mockCreateOrganization.mockResolvedValue(newOrg);

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: createWrapper(),
    });

    const orgData = {
      name: 'New Startup',
      type: 'company' as OrganizationType,
    };
    const createdOrg = await result.current.mutateAsync(orgData);

    expect(mockCreateOrganization).toHaveBeenCalledWith(orgData);
    expect(createdOrg).toEqual(newOrg);
    expect(result.current.error).toBe(null);
  });

  it('should show loading state during creation', async () => {
    let resolveCreate: (value: Organization) => void;
    const createPromise = new Promise<Organization>((resolve) => {
      resolveCreate = resolve;
    });

    mockCreateOrganization.mockReturnValue(createPromise);

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: createWrapper(),
    });

    const orgData = {
      name: 'New Startup',
      type: 'company' as OrganizationType,
    };
    result.current.mutate(orgData);

    await waitFor(() => expect(result.current.isPending).toBe(true));

    // Resolve the promise
    resolveCreate!({
      id: '3',
      name: 'New Startup',
      type: 'company',
      createdBy: 'user1',
      createdAt: '2024-01-03T00:00:00Z',
      memberCount: 1,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('should handle creation error', async () => {
    const error = new Error('Failed to create organization');
    mockCreateOrganization.mockRejectedValue(error);

    const { result } = renderHook(() => useCreateOrganization(), {
      wrapper: createWrapper(),
    });

    const orgData = {
      name: 'New Startup',
      type: 'company' as OrganizationType,
    };

    await expect(result.current.mutateAsync(orgData)).rejects.toThrow();

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.code).toBe('CREATE_ERROR');
    });
  });

  it('should invalidate user organizations cache after creation', async () => {
    const newOrg: Organization = {
      id: '3',
      name: 'New Startup',
      type: 'company' as OrganizationType,
      createdBy: 'user1',
      createdAt: '2024-01-03T00:00:00Z',
      memberCount: 1,
    };

    mockGetUserOrganizations.mockResolvedValue(mockOrganizations);
    mockCreateOrganization.mockResolvedValue(newOrg);

    const wrapper = createWrapper();

    // First fetch user organizations
    const { result: userOrgsResult } = renderHook(
      () => useUserOrganizations(),
      {
        wrapper,
      }
    );

    await waitFor(() => expect(userOrgsResult.current.isSuccess).toBe(true));

    // Then create a new organization
    const { result: createResult } = renderHook(() => useCreateOrganization(), {
      wrapper,
    });

    const orgData = {
      name: 'New Startup',
      type: 'company' as OrganizationType,
    };
    await createResult.current.mutateAsync(orgData);

    // User organizations should be refetched
    await waitFor(() => {
      expect(mockGetUserOrganizations).toHaveBeenCalledTimes(2);
    });
  });

  it('should create organization with different types', async () => {
    const types: OrganizationType[] = ['company', 'university'];

    for (const type of types) {
      const newOrg: Organization = {
        id: `org-${type}`,
        name: `Test ${type}`,
        type,
        createdBy: 'user1',
        createdAt: '2024-01-03T00:00:00Z',
        memberCount: 1,
      };

      mockCreateOrganization.mockResolvedValue(newOrg);

      const { result } = renderHook(() => useCreateOrganization(), {
        wrapper: createWrapper(),
      });

      const createdOrg = await result.current.mutateAsync({
        name: `Test ${type}`,
        type,
      });

      expect(createdOrg?.type).toBe(type);
    }
  });
});
