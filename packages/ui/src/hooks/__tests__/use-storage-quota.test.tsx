/**
 * Tests for useStorageQuota hook
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as filesApi from '../../services/files-api';
import { useStorageQuota } from '../use-storage-quota';

// Mock files-api
vi.mock('../../services/files-api', () => ({
  getStorageQuota: vi.fn(),
}));

describe('useStorageQuota', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch storage quota successfully', async () => {
    const mockQuota = {
      bytesUsed: 5000000, // 5MB
      quotaBytes: 100000000, // 100MB
      bytesAvailable: 95000000,
      percentUsed: 5,
    };

    vi.mocked(filesApi.getStorageQuota).mockResolvedValueOnce(mockQuota);

    const { result } = renderHook(() => useStorageQuota(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockQuota);
    expect(filesApi.getStorageQuota).toHaveBeenCalled();
  });

  it('should handle loading state', () => {
    vi.mocked(filesApi.getStorageQuota).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHook(() => useStorageQuota(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should handle error state', async () => {
    vi.mocked(filesApi.getStorageQuota).mockRejectedValueOnce(
      new Error('Failed to fetch quota')
    );

    const { result } = renderHook(() => useStorageQuota(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should calculate usage percentage correctly', async () => {
    const mockQuota = {
      bytesUsed: 80000000, // 80MB
      quotaBytes: 100000000, // 100MB
      bytesAvailable: 20000000,
      percentUsed: 80,
    };

    vi.mocked(filesApi.getStorageQuota).mockResolvedValueOnce(mockQuota);

    const { result } = renderHook(() => useStorageQuota(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.percentUsed).toBe(80);
  });
});
