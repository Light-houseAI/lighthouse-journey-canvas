/**
 * Other User Timeline Store
 *
 * Manages viewing other users' timelines with read-only access.
 * Used for user timeline routes ('/profile/:username') where users can only view, not edit.
 *
 * NOTE: This store may be deprecated as ProfileListView uses TanStack Query directly.
 * Consider removing if no longer referenced.
 */

import type {
  InsightCreateDTO,
  InsightUpdateDTO,
  NodeInsight,
} from '@shared/schema';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { hierarchyApi } from '../services/hierarchy-api';
import { getErrorMessage } from '../utils/error-toast';
import {
  BaseTimelineState,
  buildHierarchyTree,
  createBaseTimelineActions,
  createBaseTimelineGetters,
  findRoots,
} from './shared-timeline-types';

// Read-only interface for viewing other users' timelines
export interface OtherUserTimelineState extends BaseTimelineState {
  // Current viewing context
  viewingUsername: string | null;
  viewingUserId: number | null;

  // Data loading (read-only)
  loadUserTimeline: (username: string) => Promise<void>;
  refreshUserTimeline: () => Promise<void>;

  // Panel management (view-only)
  closePanel: () => void;

  // Insights state and actions (read-only)
  insights: Record<string, NodeInsight[]>; // nodeId -> insights
  insightLoading: Record<string, boolean>; // nodeId -> loading state
  getNodeInsights: (nodeId: string) => Promise<void>;

  // Stub methods for insights (read-only store - these don't exist)
  createInsight?: (nodeId: string, data: InsightCreateDTO) => Promise<void>;
  updateInsight?: (
    insightId: string,
    nodeId: string,
    data: InsightUpdateDTO
  ) => Promise<void>;
  deleteInsight?: (insightId: string, nodeId: string) => Promise<void>;
  clearInsights?: (nodeId: string) => void;

  // Reset
  clearData: () => void;

  // Legacy aliases for compatibility
  toggleNodeExpansion: (nodeId: string) => void;

  // Stub methods for compatibility (read-only store)
  loading: boolean;
  deleteNode?: (nodeId: string) => Promise<void>;
  updateNode?: (nodeId: string, updates: any) => Promise<void>;
  createNode?: (type: any, parentId?: string) => Promise<any>;
}

export const useOtherUserTimelineStore = create<OtherUserTimelineState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      nodes: [],
      tree: { nodes: [], edges: [] },
      hasData: false,
      loading: false,
      error: null,

      // Insights state
      insights: {},
      insightLoading: {},

      // Selection state
      selectedNodeId: null,
      focusedNodeId: null,
      showPanel: false,
      panelMode: 'view', // Always view mode for other users

      // UI state
      expandedNodeIds: new Set<string>(),

      // Viewing context
      viewingUsername: null,
      viewingUserId: null,

      // Data loading
      loadUserTimeline: async (username: string) => {
        const state = get();
        if (state.loading) return;

        set({
          loading: true,
          error: null,
          viewingUsername: username,
          // Reset selection state when loading different user
          selectedNodeId: null,
          showPanel: false,
          focusedNodeId: null,
          panelMode: 'view',
        });

        try {
          const apiNodes =
            await hierarchyApi.listUserNodesWithPermissions(username);
          const tree = buildHierarchyTree(apiNodes);

          // Extract user ID from first node (if available)
          const viewingUserId = apiNodes.length > 0 ? apiNodes[0].userId : null;

          set({
            nodes: tree.nodes,
            tree,
            hasData: true,
            loading: false,
            viewingUserId,
          });

          console.log(`✅ User timeline loaded for ${username}:`, {
            nodeCount: tree.nodes.length,
            edgeCount: tree.edges.length,
            rootCount: findRoots(apiNodes).length,
            viewingUserId,
          });
        } catch (error) {
          console.error(
            `❌ Failed to load user timeline for ${username}:`,
            error
          );
          set({
            loading: false,
            error: getErrorMessage(error),
          });
        }
      },

      refreshUserTimeline: async () => {
        const { viewingUsername } = get();
        if (!viewingUsername) {
          console.warn('No username to refresh');
          return;
        }

        try {
          const apiNodes = await hierarchyApi.listUserNodes(viewingUsername);
          const tree = buildHierarchyTree(apiNodes);

          set({
            nodes: tree.nodes,
            tree,
            hasData: true,
            error: null,
          });

          console.log(`🔄 User timeline refreshed for ${viewingUsername}`);
        } catch (error) {
          console.error(
            `❌ Failed to refresh timeline for ${viewingUsername}:`,
            error
          );
          set({
            error: getErrorMessage(error),
          });
        }
      },

      // Panel management (view-only)
      closePanel: () => {
        set({
          selectedNodeId: null,
          showPanel: false,
          panelMode: 'view',
        });
      },

      // Insights methods (read-only)
      getNodeInsights: async (nodeId: string) => {
        set((state) => {
          state.insightLoading[nodeId] = true;
        });

        try {
          const response = await fetch(
            `/api/v2/timeline/nodes/${nodeId}/insights`,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();

          if (result.success) {
            set((state) => {
              state.insights[nodeId] = result.data;
              state.insightLoading[nodeId] = false;
            });
          } else {
            throw new Error(
              result.error?.message || 'Failed to fetch insights'
            );
          }
        } catch (error) {
          console.error('Failed to fetch insights:', error);
          set((state) => {
            state.insightLoading[nodeId] = false;
            state.error = getErrorMessage(error);
          });
        }
      },

      // Reset
      clearData: () => {
        set({
          nodes: [],
          tree: { nodes: [], edges: [] },
          hasData: false,
          insights: {},
          insightLoading: {},
          selectedNodeId: null,
          showPanel: false,
          focusedNodeId: null,
          panelMode: 'view',
          expandedNodeIds: new Set(),
          error: null,
          viewingUsername: null,
          viewingUserId: null,
        });
      },

      // Inject base actions and getters
      ...createBaseTimelineActions(),
      ...createBaseTimelineGetters(),

      // Override base actions to use this store's set/get
      selectNode: (nodeId: string | null) => {
        createBaseTimelineActions().selectNode(nodeId, set);
      },

      focusNode: (nodeId: string | null) => {
        createBaseTimelineActions().focusNode(nodeId, set, get);
      },

      clearFocus: () => {
        createBaseTimelineActions().clearFocus(set);
      },

      expandNode: (nodeId: string) => {
        createBaseTimelineActions().expandNode(nodeId, set, get);
      },

      collapseNode: (nodeId: string) => {
        createBaseTimelineActions().collapseNode(nodeId, set, get);
      },

      toggleNode: (nodeId: string) => {
        createBaseTimelineActions().toggleNode(nodeId, set, get);
      },

      getNodeById: (nodeId: string) => {
        return createBaseTimelineGetters().getNodeById(nodeId, get);
      },

      getChildren: (nodeId: string) => {
        return createBaseTimelineGetters().getChildren(nodeId, get);
      },

      hasChildren: (nodeId: string) => {
        return createBaseTimelineGetters().hasChildren(nodeId, get);
      },

      isNodeExpanded: (nodeId: string) => {
        return createBaseTimelineGetters().isNodeExpanded(nodeId, get);
      },

      // Legacy aliases for compatibility
      toggleNodeExpansion: (nodeId: string) => {
        get().toggleNode(nodeId);
      },
    })),
    {
      name: 'other-user-timeline-store',
    }
  )
);
