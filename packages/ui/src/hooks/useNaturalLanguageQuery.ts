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
 *
 * Storage scoping:
 * - nodeId: Scopes queries to a specific user's work track (Vector DB + Graph DB)
 * - sessionId: Optional further scoping to a specific session within the track
 */
interface UseNaturalLanguageQueryOptions {
  /** Timeline node ID - scopes to user's specific work track */
  nodeId?: string;
  /** Session ID - optional further scoping to specific session */
  sessionId?: string;
  /** Number of days to look back for context (default: 30) */
  lookbackDays?: number;
  /** Maximum results to retrieve from Vector/Graph DBs (default: 10) */
  maxResults?: number;
  /** Include Graph DB (ArangoDB) context for relational search */
  includeGraph?: boolean;
  /** Include Vector DB (pgvector) context for semantic search */
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
