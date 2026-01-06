/**
 * useNaturalLanguageQuery Hook
 *
 * React Query hook for executing natural language queries over work history
 * using RAG (Retrieval-Augmented Generation) with Graph RAG + Vector Search
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

import {
  naturalLanguageQuery,
  type NaturalLanguageQueryRequest,
  type NaturalLanguageQueryResult,
} from '../services/workflow-api';

/**
 * Hook options
 */
interface UseNaturalLanguageQueryOptions {
  nodeId?: string;
  lookbackDays?: number;
  maxResults?: number;
  includeGraph?: boolean;
  includeVectors?: boolean;
  onSuccess?: (result: NaturalLanguageQueryResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to execute natural language queries over work history
 */
export function useNaturalLanguageQuery(options: UseNaturalLanguageQueryOptions = {}) {
  const queryClient = useQueryClient();
  const [queryHistory, setQueryHistory] = useState<NaturalLanguageQueryResult[]>([]);
  const [lastResult, setLastResult] = useState<NaturalLanguageQueryResult | null>(null);

  // Mutation for executing queries
  const queryMutation = useMutation({
    mutationFn: async (query: string) => {
      const request: NaturalLanguageQueryRequest = {
        query,
        nodeId: options.nodeId,
        lookbackDays: options.lookbackDays ?? 30,
        maxResults: options.maxResults ?? 10,
        includeGraph: options.includeGraph ?? true,
        includeVectors: options.includeVectors ?? true,
      };
      return naturalLanguageQuery(request);
    },
    onSuccess: (data) => {
      if (data) {
        setLastResult(data);
        setQueryHistory((prev) => [data, ...prev].slice(0, 10)); // Keep last 10 queries
        options.onSuccess?.(data);
      }
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });

  // Execute a query
  const executeQuery = useCallback(
    async (query: string) => {
      return queryMutation.mutateAsync(query);
    },
    [queryMutation]
  );

  // Clear query history
  const clearHistory = useCallback(() => {
    setQueryHistory([]);
    setLastResult(null);
  }, []);

  // Execute a follow-up query from suggestions
  const executeFollowUp = useCallback(
    async (followUpQuery: string) => {
      return executeQuery(followUpQuery);
    },
    [executeQuery]
  );

  return {
    // Query execution
    executeQuery,
    executeFollowUp,

    // Current state
    result: lastResult,
    isLoading: queryMutation.isPending,
    error: queryMutation.error,

    // Query history
    queryHistory,
    clearHistory,

    // Metadata
    isSuccess: queryMutation.isSuccess,
    isError: queryMutation.isError,
  };
}
