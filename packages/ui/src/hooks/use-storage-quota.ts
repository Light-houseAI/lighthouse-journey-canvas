/**
 * useStorageQuota Hook
 *
 * Fetches user's storage quota information from the backend
 * Uses schema types and API layer for type safety
 */

import type { StorageQuota } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import { getStorageQuota } from '../services/files-api';

/**
 * Query keys for storage quota queries
 */
export const storageQuotaKeys = {
  all: ['storage-quota'] as const,
  quota: () => [...storageQuotaKeys.all, 'quota'] as const,
};

/**
 * Hook to fetch user's storage quota with caching
 */
export function useStorageQuota() {
  return useQuery({
    queryKey: storageQuotaKeys.quota(),
    queryFn: getStorageQuota,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: false, // Server handles errors
  });
}

// Re-export type for convenience
export type { StorageQuota };
