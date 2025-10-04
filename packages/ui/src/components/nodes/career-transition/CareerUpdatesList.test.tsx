/**
 * Tests for CareerUpdatesList Component
 */

import type { UpdateResponse, UpdatesListResponse } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as updatesApi from '../../../services/updates-api';
import { CareerUpdatesList } from './CareerUpdatesList';

// Mock the updates API
vi.mock('../../../services/updates-api');

describe('CareerUpdatesList', () => {
  let queryClient: QueryClient;
  const mockNodeId = 'test-node-id';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (
    props: {
      nodeId?: string;
      canEdit?: boolean;
      onEditUpdate?: (update: UpdateResponse) => void;
    } = {}
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CareerUpdatesList nodeId={props.nodeId || mockNodeId} />
      </QueryClientProvider>
    );
  };

  it('should fetch updates on mount using correct nodeId', async () => {
    const mockResponse: UpdatesListResponse = {
      updates: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        hasNext: false,
        hasPrev: false,
      },
    };

    vi.mocked(updatesApi.getUpdatesByNodeId).mockResolvedValue(mockResponse);

    renderComponent();

    await waitFor(() => {
      expect(updatesApi.getUpdatesByNodeId).toHaveBeenCalledWith(mockNodeId, {
        page: 1,
        limit: 100,
      });
    });
  });

  it('should display loading state while fetching', () => {
    vi.mocked(updatesApi.getUpdatesByNodeId).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderComponent();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display error state when fetch fails', async () => {
    vi.mocked(updatesApi.getUpdatesByNodeId).mockRejectedValue(
      new Error('Failed to fetch')
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/error loading updates/i)).toBeInTheDocument();
    });
  });
});
