/**
 * TanStack Query hook for generating progress snapshots
 *
 * Fetches LLM-generated outcome-oriented progress snapshots.
 * Designed for status updates with themes, headlines, and evidence.
 */

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { ProgressSnapshotLLMResponse } from '@journey/schema';

import {
  generateProgressSnapshot,
  type GenerateSnapshotOptions,
} from '../services/progress-snapshot-api';

// Query key factory for progress snapshots
export const progressSnapshotKeys = {
  all: ['progress-snapshots'] as const,
  byNode: (nodeId: string) => ['progress-snapshots', 'node', nodeId] as const,
  byNodeAndRange: (nodeId: string, days: number) =>
    ['progress-snapshots', 'node', nodeId, { days }] as const,
};

/**
 * Result type for useProgressSnapshot hook
 */
export interface UseProgressSnapshotResult {
  snapshot: ProgressSnapshotLLMResponse | null;
  isLoading: boolean;
  isFetching: boolean; // True when fetching in background (e.g., switching periods)
  isError: boolean;
  error: Error | null;
  useFallback: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch a progress snapshot for a node
 * 
 * @param nodeId - The timeline node ID to generate snapshot for
 * @param options - Snapshot generation options (days, rangeLabel, journeyName)
 * @param enabled - Whether to enable the query
 */
export function useProgressSnapshot(
  nodeId: string,
  options: {
    days: number;
    rangeLabel: string;
    journeyName: string;
  },
  enabled = true
): UseProgressSnapshotResult {
  const { days, rangeLabel, journeyName } = options;

  const query = useQuery({
    queryKey: progressSnapshotKeys.byNodeAndRange(nodeId, days),
    queryFn: async () => {
      const response = await generateProgressSnapshot({
        nodeId,
        days,
        rangeLabel,
        journeyName,
      });
      return response;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    enabled: enabled && !!nodeId,
    retry: 1, // Only retry once for LLM failures
    // Keep showing previous data while fetching new period
    // This prevents the "flash of empty state" when switching tabs
    placeholderData: keepPreviousData,
  });

  // Determine if we should fallback to client-side clustering
  const useFallback = !!(
    query.data?.useFallback || 
    (query.isError && !query.data?.success)
  );

  return {
    snapshot: query.data?.success ? query.data.data : null,
    isLoading: query.isLoading,
    isFetching: query.isFetching, // True when fetching new data (even with cache)
    isError: query.isError || (query.data?.success === false && !query.data?.useFallback),
    error: query.error as Error | null,
    useFallback,
    refetch: query.refetch,
  };
}

/**
 * Hook to generate a progress snapshot on demand (mutation)
 * Useful when you want explicit control over when to generate
 */
export function useGenerateProgressSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: GenerateSnapshotOptions) =>
      generateProgressSnapshot(options),
    onSuccess: (data, variables) => {
      // Update the cache for the specific node/range
      queryClient.setQueryData(
        progressSnapshotKeys.byNodeAndRange(variables.nodeId, variables.days),
        data
      );
    },
  });
}

/**
 * Type for the snapshot data
 */
export type { ProgressSnapshotLLMResponse };


