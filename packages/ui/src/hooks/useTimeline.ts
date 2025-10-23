/**
 * TanStack Query hooks for timeline management
 * Separates server state from UI state
 *
 * Pattern:
 * - useTimeline hooks handle server data (nodes, insights) via TanStack Query
 * - Timeline store handles UI state (selections, expansions, panel) via Zustand
 */

import type {
  InsightCreateDTO,
  InsightUpdateDTO,
  NodeInsight,
  TimelineNode,
  TimelineNodeWithPermissions,
} from '@journey/schema';
import type { ApiErrorResponse } from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  CreateNodePayload,
  hierarchyApi,
  UpdateNodePayload,
} from '../services/hierarchy-api';
import * as insightsApi from '../services/insights-api';

/**
 * Query keys for timeline-related queries
 */
export const timelineKeys = {
  all: ['timeline'] as const,
  nodes: () => [...timelineKeys.all, 'nodes'] as const,
  userNodes: (username: string) =>
    [...timelineKeys.all, 'nodes', 'user', username] as const,
  node: (id: string) => [...timelineKeys.all, 'nodes', id] as const,
  insights: () => [...timelineKeys.all, 'insights'] as const,
  nodeInsights: (nodeId: string) =>
    [...timelineKeys.insights(), 'node', nodeId] as const,
};

// ============================================================================
// Timeline Nodes Queries
// ============================================================================

/**
 * Hook to fetch current user's timeline nodes with permissions
 */
export function useTimelineNodes() {
  return useQuery({
    queryKey: timelineKeys.nodes(),
    queryFn: () => hierarchyApi.listNodesWithPermissions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false,
  });
}

/**
 * Hook to fetch another user's timeline nodes with permissions
 */
export function useUserTimelineNodes(username: string) {
  return useQuery({
    queryKey: timelineKeys.userNodes(username),
    queryFn: () => hierarchyApi.listUserNodesWithPermissions(username),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}

/**
 * Hook to fetch a single node by ID
 */
export function useTimelineNode(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: timelineKeys.node(id),
    queryFn: () => hierarchyApi.getNode(id),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    enabled,
  });
}

// ============================================================================
// Timeline Node Mutations
// ============================================================================

interface UseCreateNodeReturn {
  mutate: (data: CreateNodePayload) => void;
  mutateAsync: (data: CreateNodePayload) => Promise<TimelineNode>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to create a new timeline node
 */
export function useCreateNode(): UseCreateNodeReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CreateNodePayload) => hierarchyApi.createNode(data),
    onSuccess: (newNode) => {
      // Invalidate nodes list to trigger refetch
      queryClient.invalidateQueries({ queryKey: timelineKeys.nodes() });

      // Optimistically add to cache
      queryClient.setQueryData<TimelineNodeWithPermissions[]>(
        timelineKeys.nodes(),
        (old) =>
          old
            ? [...old, newNode as TimelineNodeWithPermissions]
            : [newNode as TimelineNodeWithPermissions]
      );

      console.log('✅ Node created:', newNode.id);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

interface UseUpdateNodeReturn {
  mutate: (params: { id: string; updates: UpdateNodePayload }) => void;
  mutateAsync: (params: {
    id: string;
    updates: UpdateNodePayload;
  }) => Promise<TimelineNode>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to update a timeline node
 */
export function useUpdateNode(): UseUpdateNodeReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateNodePayload }) =>
      hierarchyApi.updateNode(id, updates),
    onSuccess: (updatedNode, variables) => {
      // Update specific node in cache
      queryClient.setQueryData<TimelineNode>(
        timelineKeys.node(variables.id),
        updatedNode
      );

      // Update node in nodes list cache
      queryClient.setQueryData<TimelineNodeWithPermissions[]>(
        timelineKeys.nodes(),
        (old) => {
          if (!old) return old;
          return old.map((node) =>
            node.id === variables.id ? { ...node, ...updatedNode } : node
          );
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: timelineKeys.nodes() });

      console.log('✅ Node updated:', variables.id);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

interface UseDeleteNodeReturn {
  mutate: (nodeId: string) => void;
  mutateAsync: (nodeId: string) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to delete a timeline node
 */
export function useDeleteNode(): UseDeleteNodeReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (nodeId: string) => hierarchyApi.deleteNode(nodeId),
    onSuccess: (_, nodeId) => {
      // Remove from cache
      queryClient.setQueryData<TimelineNodeWithPermissions[]>(
        timelineKeys.nodes(),
        (old) => old?.filter((node) => node.id !== nodeId)
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: timelineKeys.nodes() });

      // Clear any insights for this node
      queryClient.removeQueries({
        queryKey: timelineKeys.nodeInsights(nodeId),
      });

      console.log('✅ Node deleted:', nodeId);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to move a node to a new parent
 */
export function useMoveNode(): UseUpdateNodeReturn {
  // Reuse useUpdateNode since moving is just updating parentId
  return useUpdateNode();
}

/**
 * Hook to duplicate a node
 */
export function useDuplicateNode(): UseCreateNodeReturn {
  // Reuse useCreateNode since duplicating is creating with copied data
  return useCreateNode();
}

// ============================================================================
// Bulk Operations
// ============================================================================

interface UseBulkDeleteNodesReturn {
  mutate: (nodeIds: string[]) => void;
  mutateAsync: (nodeIds: string[]) => Promise<void[]>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to delete multiple nodes
 */
export function useBulkDeleteNodes(): UseBulkDeleteNodesReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (nodeIds: string[]) =>
      Promise.all(nodeIds.map((id) => hierarchyApi.deleteNode(id))),
    onSuccess: (_, nodeIds) => {
      // Remove from cache
      queryClient.setQueryData<TimelineNodeWithPermissions[]>(
        timelineKeys.nodes(),
        (old) => old?.filter((node) => !nodeIds.includes(node.id))
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: timelineKeys.nodes() });

      console.log('✅ Bulk delete completed:', nodeIds.length);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

interface UseBulkMoveNodesReturn {
  mutate: (params: { nodeIds: string[]; newParentId: string | null }) => void;
  mutateAsync: (params: {
    nodeIds: string[];
    newParentId: string | null;
  }) => Promise<TimelineNode[]>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to move multiple nodes to a new parent
 */
export function useBulkMoveNodes(): UseBulkMoveNodesReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      nodeIds,
      newParentId,
    }: {
      nodeIds: string[];
      newParentId: string | null;
    }) =>
      Promise.all(
        nodeIds.map((id) =>
          hierarchyApi.updateNode(id, { parentId: newParentId })
        )
      ),
    onSuccess: (_, variables) => {
      // Invalidate nodes to trigger refetch
      queryClient.invalidateQueries({ queryKey: timelineKeys.nodes() });

      console.log('✅ Bulk move completed:', variables.nodeIds.length);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// Insights Queries
// ============================================================================

export interface UseNodeInsightsResult {
  data: NodeInsight[] | undefined;
  isLoading: boolean;
  error: ApiErrorResponse['error'] | null;
  hasInsights: boolean;
  insightCount: number;
  refetch: () => void;
}

/**
 * Hook to fetch insights for a specific node
 */
export function useNodeInsights(
  nodeId: string,
  enabled: boolean = true
): UseNodeInsightsResult {
  const queryResult = useQuery({
    queryKey: timelineKeys.nodeInsights(nodeId),
    queryFn: () => insightsApi.getNodeInsights(nodeId),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Extract data (already unwrapped by http-client)
  const insights = queryResult.data;
  const error = queryResult.error
    ? {
        code: 'FETCH_ERROR',
        message:
          queryResult.error instanceof Error
            ? queryResult.error.message
            : 'Failed to fetch insights',
      }
    : null;

  return {
    data: insights,
    isLoading: queryResult.isLoading,
    error,
    hasInsights: (insights?.length ?? 0) > 0,
    insightCount: insights?.length ?? 0,
    refetch: queryResult.refetch,
  };
}

// ============================================================================
// Insights Mutations
// ============================================================================

interface UseCreateInsightReturn {
  mutate: (params: { nodeId: string; data: InsightCreateDTO }) => void;
  mutateAsync: (params: {
    nodeId: string;
    data: InsightCreateDTO;
  }) => Promise<NodeInsight | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to create a new insight for a node
 */
export function useCreateInsight(): UseCreateInsightReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      nodeId,
      data,
    }: {
      nodeId: string;
      data: InsightCreateDTO;
    }) => insightsApi.createInsight(nodeId, data),
    onSuccess: (newInsight, variables) => {
      // Update insights cache (data is already unwrapped)
      queryClient.setQueryData<NodeInsight[]>(
        timelineKeys.nodeInsights(variables.nodeId),
        (old) => {
          if (!old) return [newInsight];
          return [...old, newInsight];
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: timelineKeys.nodeInsights(variables.nodeId),
      });

      console.log('✅ Insight created');
    },
    retry: false,
  });

  const error = mutation.error
    ? {
        code: 'CREATE_ERROR',
        message:
          mutation.error instanceof Error
            ? mutation.error.message
            : 'Failed to create insight',
      }
    : null;

  return {
    mutate: mutation.mutate,
    mutateAsync: async (params) => {
      return await mutation.mutateAsync(params);
    },
    isPending: mutation.isPending,
    error,
  };
}

interface UseUpdateInsightReturn {
  mutate: (params: {
    insightId: string;
    nodeId: string;
    data: InsightUpdateDTO;
  }) => void;
  mutateAsync: (params: {
    insightId: string;
    nodeId: string;
    data: InsightUpdateDTO;
  }) => Promise<NodeInsight | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to update an existing insight
 */
export function useUpdateInsight(): UseUpdateInsightReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      insightId,
      data,
    }: {
      insightId: string;
      nodeId: string;
      data: InsightUpdateDTO;
    }) => insightsApi.updateInsight(insightId, data),
    onSuccess: (updatedInsight, variables) => {
      // Update specific insight in cache (data is already unwrapped)
      queryClient.setQueryData<NodeInsight[]>(
        timelineKeys.nodeInsights(variables.nodeId),
        (old) => {
          if (!old) return [updatedInsight];
          return old.map((insight) =>
            insight.id === variables.insightId ? updatedInsight : insight
          );
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: timelineKeys.nodeInsights(variables.nodeId),
      });

      console.log('✅ Insight updated');
    },
    retry: false,
  });

  const error = mutation.error
    ? {
        code: 'UPDATE_ERROR',
        message:
          mutation.error instanceof Error
            ? mutation.error.message
            : 'Failed to update insight',
      }
    : null;

  return {
    mutate: mutation.mutate,
    mutateAsync: async (params) => {
      return await mutation.mutateAsync(params);
    },
    isPending: mutation.isPending,
    error,
  };
}

interface UseDeleteInsightReturn {
  mutate: (params: { insightId: string; nodeId: string }) => void;
  mutateAsync: (params: { insightId: string; nodeId: string }) => Promise<void>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to delete an insight
 */
export function useDeleteInsight(): UseDeleteInsightReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ insightId }: { insightId: string; nodeId: string }) =>
      insightsApi.deleteInsight(insightId),
    onSuccess: (_data, variables) => {
      // Remove from cache
      queryClient.setQueryData<NodeInsight[]>(
        timelineKeys.nodeInsights(variables.nodeId),
        (old) => {
          if (!old) return [];
          return old.filter((insight) => insight.id !== variables.insightId);
        }
      );

      // Invalidate to ensure consistency
      queryClient.invalidateQueries({
        queryKey: timelineKeys.nodeInsights(variables.nodeId),
      });

      console.log('✅ Insight deleted');
    },
    retry: false,
  });

  const error = mutation.error
    ? {
        code: 'DELETE_ERROR',
        message:
          mutation.error instanceof Error
            ? mutation.error.message
            : 'Failed to delete insight',
      }
    : null;

  return {
    mutate: mutation.mutate,
    mutateAsync: async (params) => {
      await mutation.mutateAsync(params);
    },
    isPending: mutation.isPending,
    error,
  };
}
