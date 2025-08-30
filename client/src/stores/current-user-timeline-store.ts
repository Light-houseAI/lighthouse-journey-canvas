/**
 * Current User Timeline Store
 * 
 * Manages the current user's own timeline with full CRUD capabilities.
 * Used for the main timeline route ('/') where users can edit their own data.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { 
  TimelineNode, 
  NodeInsight, 
  InsightCreateDTO, 
  InsightUpdateDTO 
} from '@shared/schema';
import { httpClient } from '../services/http-client';
import type { TimelineNodeType } from '@shared/enums';
import { hierarchyApi } from '../services/hierarchy-api';
import { 
  BaseTimelineState,
  HierarchyNode,
  HierarchyTree,
  buildHierarchyTree,
  findRoots,
  createBaseTimelineActions,
  createBaseTimelineGetters 
} from './shared-timeline-types';

// Extended interface for current user with full editing capabilities
export interface CurrentUserTimelineState extends BaseTimelineState {
  // Data loading
  loadNodes: () => Promise<void>;
  refreshNodes: () => Promise<void>;

  // Node management (full CRUD)
  createNode: (type: TimelineNodeType, parentId?: string) => Promise<TimelineNode>;
  updateNode: (nodeId: string, updates: Partial<TimelineNode>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;

  // Node operations
  moveNode: (nodeId: string, newParentId: string | null) => Promise<void>;
  duplicateNode: (nodeId: string) => Promise<TimelineNode>;

  // Panel management
  setPanelMode: (mode: 'view' | 'edit') => void;
  closePanel: () => void;

  // Bulk operations
  deleteNodes: (nodeIds: string[]) => Promise<void>;
  bulkMove: (nodeIds: string[], newParentId: string | null) => Promise<void>;

  // Insights state and actions
  insights: Record<string, NodeInsight[]>; // nodeId -> insights
  insightLoading: Record<string, boolean>; // nodeId -> loading state
  getNodeInsights: (nodeId: string) => Promise<void>;
  createInsight: (nodeId: string, data: InsightCreateDTO) => Promise<void>;
  updateInsight: (insightId: string, nodeId: string, data: InsightUpdateDTO) => Promise<void>;
  deleteInsight: (insightId: string, nodeId: string) => Promise<void>;
  clearInsights: (nodeId: string) => void;

  // Reset
  clearData: () => void;

  // Legacy aliases for compatibility
  toggleNodeExpansion: (nodeId: string) => void;
}

export const useCurrentUserTimelineStore = create<CurrentUserTimelineState>()(
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
      panelMode: 'view',

      // UI state
      expandedNodeIds: new Set<string>(),

      // Data loading
      loadNodes: async () => {
        const state = get();
        if (state.loading) return;

        set({ 
          loading: true, 
          error: null,
          // Reset selection state when loading
          selectedNodeId: null,
          showPanel: false,
          focusedNodeId: null,
          panelMode: 'view'
        });

        try {
          const apiNodes = await hierarchyApi.listNodesWithPermissions(); // Get nodes with permissions
          const tree = buildHierarchyTree(apiNodes);

          set({
            nodes: tree.nodes,
            tree,
            hasData: true,
            loading: false,
          });

          console.log('✅ Current user timeline loaded:', {
            nodeCount: tree.nodes.length,
            edgeCount: tree.edges.length,
            rootCount: findRoots(apiNodes).length,
          });
        } catch (error) {
          console.error('❌ Failed to load current user timeline:', error);
          set({
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load timeline',
          });
        }
      },

      refreshNodes: async () => {
        // Force refresh without changing loading UI
        try {
          const apiNodes = await hierarchyApi.listNodesWithPermissions();
          const tree = buildHierarchyTree(apiNodes);

          set({
            nodes: tree.nodes,
            tree,
            hasData: true,
            error: null,
          });

          console.log('🔄 Current user timeline refreshed');
        } catch (error) {
          console.error('❌ Failed to refresh timeline:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to refresh timeline',
          });
        }
      },

      // Node management
      createNode: async (type: TimelineNodeType, parentId?: string) => {
        try {
          const newNode = await hierarchyApi.createNode({ type, parentId });
          
          // Refresh data to get updated tree
          await get().refreshNodes();
          
          // Select the new node
          get().selectNode(newNode.id);
          
          console.log('✅ Node created:', newNode.id);
          return newNode;
        } catch (error) {
          console.error('❌ Failed to create node:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to create node',
          });
          throw error;
        }
      },

      updateNode: async (nodeId: string, updates: Partial<TimelineNode>) => {
        try {
          await hierarchyApi.updateNode(nodeId, updates);
          
          // Update local state optimistically
          set(state => {
            const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
            if (nodeIndex !== -1) {
              state.nodes[nodeIndex] = { ...state.nodes[nodeIndex], ...updates };
            }
          });

          console.log('✅ Node updated:', nodeId);
        } catch (error) {
          console.error('❌ Failed to update node:', error);
          // Refresh to revert optimistic update
          await get().refreshNodes();
          set({
            error: error instanceof Error ? error.message : 'Failed to update node',
          });
          throw error;
        }
      },

      deleteNode: async (nodeId: string) => {
        try {
          await hierarchyApi.deleteNode(nodeId);
          
          // Clear selection if deleted node was selected
          const { selectedNodeId } = get();
          if (selectedNodeId === nodeId) {
            get().closePanel();
          }
          
          // Refresh data
          await get().refreshNodes();
          
          console.log('✅ Node deleted:', nodeId);
        } catch (error) {
          console.error('❌ Failed to delete node:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete node',
          });
          throw error;
        }
      },

      moveNode: async (nodeId: string, newParentId: string | null) => {
        try {
          await hierarchyApi.updateNode(nodeId, { parentId: newParentId });
          await get().refreshNodes();
          console.log('✅ Node moved:', nodeId);
        } catch (error) {
          console.error('❌ Failed to move node:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to move node',
          });
          throw error;
        }
      },

      duplicateNode: async (nodeId: string) => {
        try {
          const originalNode = get().getNodeById(nodeId);
          if (!originalNode) throw new Error('Node not found');

          const duplicateData = {
            ...originalNode,
            id: undefined, // Let server generate new ID
            title: `${originalNode.title || ''} (Copy)`,
          };

          const newNode = await hierarchyApi.createNode(duplicateData);
          await get().refreshNodes();
          get().selectNode(newNode.id);
          
          console.log('✅ Node duplicated:', newNode.id);
          return newNode;
        } catch (error) {
          console.error('❌ Failed to duplicate node:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to duplicate node',
          });
          throw error;
        }
      },

      // Panel management
      setPanelMode: (mode: 'view' | 'edit') => {
        set({ panelMode: mode });
        console.log('🎛️ Panel mode:', mode);
      },

      closePanel: () => {
        set({
          selectedNodeId: null,
          showPanel: false,
          panelMode: 'view',
        });
      },

      // Bulk operations
      deleteNodes: async (nodeIds: string[]) => {
        try {
          // Delete all nodes in parallel
          await Promise.all(nodeIds.map(id => hierarchyApi.deleteNode(id)));
          
          // Clear selection if any deleted node was selected
          const { selectedNodeId } = get();
          if (selectedNodeId && nodeIds.includes(selectedNodeId)) {
            get().closePanel();
          }
          
          await get().refreshNodes();
          console.log('✅ Bulk delete completed:', nodeIds.length);
        } catch (error) {
          console.error('❌ Failed to delete nodes:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete nodes',
          });
          throw error;
        }
      },

      bulkMove: async (nodeIds: string[], newParentId: string | null) => {
        try {
          // Move all nodes in parallel
          await Promise.all(
            nodeIds.map(id => hierarchyApi.updateNode(id, { parentId: newParentId }))
          );
          
          await get().refreshNodes();
          console.log('✅ Bulk move completed:', nodeIds.length);
        } catch (error) {
          console.error('❌ Failed to move nodes:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to move nodes',
          });
          throw error;
        }
      },

      // Insights methods
      getNodeInsights: async (nodeId: string) => {
        set(state => {
          state.insightLoading[nodeId] = true;
        });

        try {
          const data = await httpClient.get(`/api/v2/timeline/nodes/${nodeId}/insights`);

          set(state => {
            state.insights[nodeId] = data;
            state.insightLoading[nodeId] = false;
          });
        } catch (error) {
          console.error('Failed to fetch insights:', error);
          set(state => {
            state.insightLoading[nodeId] = false;
            state.error = error instanceof Error ? error.message : 'Failed to load insights';
          });
        }
      },

      createInsight: async (nodeId: string, data: InsightCreateDTO) => {
        try {
          const newInsight = await httpClient.post(`/api/v2/timeline/nodes/${nodeId}/insights`, data);

          set(state => {
            if (!state.insights[nodeId]) {
              state.insights[nodeId] = [];
            }
            state.insights[nodeId].push(newInsight);
          });
          console.log('✅ Insight created successfully');
        } catch (error) {
          console.error('Failed to create insight:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to add insight',
          });
          throw error;
        }
      },

      updateInsight: async (insightId: string, nodeId: string, data: InsightUpdateDTO) => {
        try {
          const updatedInsight = await httpClient.put(`/api/v2/timeline/insights/${insightId}`, data);

          set(state => {
            if (state.insights[nodeId]) {
              const index = state.insights[nodeId].findIndex(insight => insight.id === insightId);
              if (index !== -1) {
                state.insights[nodeId][index] = updatedInsight;
              }
            }
          });
          console.log('✅ Insight updated successfully');
        } catch (error) {
          console.error('Failed to update insight:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to update insight',
          });
          throw error;
        }
      },

      deleteInsight: async (insightId: string, nodeId: string) => {
        try {
          await httpClient.delete(`/api/v2/timeline/insights/${insightId}`);

          set(state => {
            if (state.insights[nodeId]) {
              state.insights[nodeId] = state.insights[nodeId].filter(
                insight => insight.id !== insightId
              );
            }
          });
          console.log('✅ Insight deleted successfully');
        } catch (error) {
          console.error('Failed to delete insight:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to delete insight',
          });
          throw error;
        }
      },

      clearInsights: (nodeId: string) => {
        set(state => {
          state.insights[nodeId] = [];
        });
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
      name: 'current-user-timeline-store',
    }
  )
);