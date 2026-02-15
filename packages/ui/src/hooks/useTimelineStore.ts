/**
 * Timeline Store Hook
 *
 * A unified hook that automatically determines which timeline store to use
 * based on the current route context.
 *
 * Pattern:
 * - Returns UI state from Zustand stores (selection, expansion, focus)
 * - Provides server state access via TanStack Query hooks
 * - Automatically switches between current user and other user contexts
 *
 * Usage:
 * ```ts
 * const timeline = useTimelineStore();
 *
 * // UI state (from Zustand)
 * timeline.selectedNodeId
 * timeline.selectNode(id)
 * timeline.expandNode(id)
 *
 * // Server state (from TanStack Query)
 * timeline.nodes.data
 * timeline.nodes.isLoading
 * timeline.createNode.mutate(...)
 * timeline.insights.useNodeInsights(nodeId)
 * ```
 */

import { useMemo } from 'react';
import { useLocation } from 'wouter';

import { useCurrentUserTimelineStore } from '../stores/current-user-timeline-store';
import { useOtherUserTimelineStore } from '../stores/other-user-timeline-store';
import {
  useBulkDeleteNodes,
  useBulkMoveNodes,
  useCreateInsight,
  useCreateNode,
  useDeleteInsight,
  useDeleteNode,
  useDuplicateNode,
  useMoveNode,
  useNodeInsights,
  useTimelineNodes,
  useUpdateInsight,
  useUpdateNode,
  useUserTimelineNodes,
} from './useTimeline';

/**
 * Unified timeline store hook
 * Combines UI state (Zustand) with server state (TanStack Query)
 */
export const useTimelineStore = () => {
  const [location] = useLocation();

  // Determine if viewing another user's timeline
  const isViewingOtherUser =
    location !== '/home' && location !== '/timeline' && !location.startsWith('/home?');

  // Extract username from location if viewing other user
  const viewingUsername = isViewingOtherUser
    ? extractUsernameFromLocation(location)
    : null;

  // Get appropriate UI store
  const currentUserUI = useCurrentUserTimelineStore();
  const otherUserUI = useOtherUserTimelineStore();

  // Select appropriate nodes query
  const currentUserNodes = useTimelineNodes();
  const otherUserNodes = useUserTimelineNodes(viewingUsername || '');

  // Data mutations (only available for current user)
  const createNode = useCreateNode();
  const updateNode = useUpdateNode();
  const deleteNode = useDeleteNode();
  const moveNode = useMoveNode();
  const duplicateNode = useDuplicateNode();
  const bulkDeleteNodes = useBulkDeleteNodes();
  const bulkMoveNodes = useBulkMoveNodes();

  // Insights mutations (only available for current user)
  const createInsight = useCreateInsight();
  const updateInsight = useUpdateInsight();
  const deleteInsight = useDeleteInsight();

  // Build unified interface
  return useMemo(() => {
    if (isViewingOtherUser) {
      // Other user context (read-only)
      return {
        // Context flags
        isViewingOtherUser: true,
        isReadOnly: true,
        viewingUsername,

        // UI state (from Zustand)
        ...otherUserUI,

        // Server state (from TanStack Query)
        nodes: {
          data: otherUserNodes.data,
          isLoading: otherUserNodes.isLoading,
          error: otherUserNodes.error,
          refetch: otherUserNodes.refetch,
        },

        // Helper to get insights for a node
        insights: {
          useNodeInsights: (nodeId: string, enabled?: boolean) =>
            useNodeInsights(nodeId, enabled),
        },

        // No mutations available (read-only)
        createNode: undefined,
        updateNode: undefined,
        deleteNode: undefined,
        moveNode: undefined,
        duplicateNode: undefined,
        bulkDeleteNodes: undefined,
        bulkMoveNodes: undefined,
        createInsight: undefined,
        updateInsight: undefined,
        deleteInsight: undefined,
      };
    } else {
      // Current user context (full access)
      return {
        // Context flags
        isViewingOtherUser: false,
        isReadOnly: false,
        viewingUsername: null,

        // UI state (from Zustand)
        ...currentUserUI,

        // Server state (from TanStack Query)
        nodes: {
          data: currentUserNodes.data,
          isLoading: currentUserNodes.isLoading,
          error: currentUserNodes.error,
          refetch: currentUserNodes.refetch,
        },

        // Helper to get insights for a node
        insights: {
          useNodeInsights: (nodeId: string, enabled?: boolean) =>
            useNodeInsights(nodeId, enabled),
        },

        // Mutations available
        createNode,
        updateNode,
        deleteNode,
        moveNode,
        duplicateNode,
        bulkDeleteNodes,
        bulkMoveNodes,
        createInsight,
        updateInsight,
        deleteInsight,
      };
    }
  }, [
    isViewingOtherUser,
    viewingUsername,
    currentUserUI,
    otherUserUI,
    currentUserNodes,
    otherUserNodes,
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    duplicateNode,
    bulkDeleteNodes,
    bulkMoveNodes,
    createInsight,
    updateInsight,
    deleteInsight,
  ]);
};

/**
 * Extract username from location path
 * Handles routes like /profile/username or /username
 */
function extractUsernameFromLocation(location: string): string | null {
  // Remove leading slash and query params
  const path = location.split('?')[0].replace(/^\//, '');

  // Handle /profile/:username format
  if (path.startsWith('profile/')) {
    return path.replace('profile/', '');
  }

  // Handle /:username format
  return path || null;
}
