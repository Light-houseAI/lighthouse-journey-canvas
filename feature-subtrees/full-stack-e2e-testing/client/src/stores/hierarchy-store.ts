/**
 * Hierarchy Store - Unified state management for hierarchical timeline
 *
 * Manages all hierarchy data, UI state, focus mode, and expansion state.
 * Integrates with existing focus store for consistent behavior.
 */

import { create } from 'zustand';
import {
  hierarchyApi,
  type CreateNodePayload,
  type UpdateNodePayload,
} from '../services/hierarchy-api';
import {
  NodeInsight,
  InsightCreateDTO,
  InsightUpdateDTO,
} from '@shared/schema';
import {
  buildHierarchyTree,
  findRoots,
  findChildren,
  type HierarchyNode,
  type HierarchyTree,
} from './shared-timeline-types';
import { useAuthStore } from './auth-store';
import { useProfileReviewStore } from './profile-review-store';

export interface HierarchyState {
  // Data state
  nodes: HierarchyNode[];
  tree: HierarchyTree;
  loading: boolean;
  error: string | null;
  hasData: boolean; // Track if we have loaded data

  // Insights state
  insights: Record<string, NodeInsight[]>; // nodeId -> insights
  insightLoading: Record<string, boolean>; // nodeId -> loading state

  // Selection and focus state
  selectedNodeId: string | null;
  focusedNodeId: string | null; // Integrates with existing focus system

  // Layout state - Fixed to horizontal only
  layoutDirection: 'LR'; // Always Left-to-Right for timeline

  // Expansion state (independent from focus)
  expandedNodeIds: Set<string>;

  // UI state
  panelMode: 'view' | 'edit' | 'create' | 'move';
  showPanel: boolean;

  // Data actions
  loadNodes: () => Promise<void>;
  loadUserTimeline: (username: string) => Promise<void>;
  refreshTree: () => void;
  clearUserData: () => void;

  // Node CRUD operations
  createNode: (payload: CreateNodePayload) => Promise<HierarchyNode>;
  updateNode: (nodeId: string, patch: UpdateNodePayload) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;

  // Selection and focus actions
  selectNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  clearFocus: () => void;

  // Layout actions - Removed (forced to LR only)

  // Expansion actions
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  expandAllNodes: () => void;
  collapseAllNodes: () => void;
  isNodeExpanded: (nodeId: string) => boolean;

  // Panel actions
  setPanelMode: (mode: 'view' | 'edit' | 'create' | 'move') => void;
  showSidePanel: () => void;
  hideSidePanel: () => void;

  // Insights actions
  getNodeInsights: (nodeId: string) => Promise<void>;
  createInsight: (nodeId: string, data: InsightCreateDTO) => Promise<void>;
  updateInsight: (
    insightId: string,
    nodeId: string,
    data: InsightUpdateDTO
  ) => Promise<void>;
  deleteInsight: (insightId: string, nodeId: string) => Promise<void>;
  clearInsights: (nodeId: string) => void;

  // Utility getters
  getRootNodes: () => HierarchyNode[];
  getNodeById: (nodeId: string) => HierarchyNode | undefined;
  getChildren: (nodeId: string) => HierarchyNode[];
  hasChildren: (nodeId: string) => boolean;
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  // Initial state
  nodes: [],
  tree: { nodes: [], edges: [] },
  loading: false,
  error: null,
  hasData: false,

  // Insights state
  insights: {},
  insightLoading: {},

  selectedNodeId: null,
  focusedNodeId: null,

  layoutDirection: 'LR',
  expandedNodeIds: new Set<string>(),

  panelMode: 'view',
  showPanel: false,

  // Data actions
  loadNodes: async () => {
    const state = get();
    if (state.loading) return; // Prevent multiple simultaneous loads

    set({ 
      loading: true, 
      error: null,
      // Reset selection state when loading timeline
      selectedNodeId: null,
      showPanel: false,
      focusedNodeId: null,
      panelMode: 'view'
    });

    try {
      const apiNodes = await hierarchyApi.listNodesWithPermissions(); // Session determines user, include permissions
      const tree = buildHierarchyTree(apiNodes);

      set({
        nodes: tree.nodes, // Use hierarchy nodes with UI extensions
        tree,
        hasData: true,
        loading: false,
      });

      console.log('✅ Hierarchy data loaded:', {
        nodeCount: tree.nodes.length,
        edgeCount: tree.edges.length,
        rootCount: findRoots(apiNodes).length,
      });
    } catch (error) {
      console.error('❌ Failed to load hierarchy data:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      });
    }
  },

  loadUserTimeline: async (username: string) => {
    const state = get();
    if (state.loading) return; // Prevent multiple simultaneous loads

    set({ 
      loading: true, 
      error: null,
      // Reset selection state when loading different user's timeline
      selectedNodeId: null,
      showPanel: false,
      focusedNodeId: null,
      panelMode: 'view'
    });

    try {
      const apiNodes = await hierarchyApi.listUserNodes(username);
      const tree = buildHierarchyTree(apiNodes);

      set({
        nodes: tree.nodes, // Use hierarchy nodes with UI extensions
        tree,
        hasData: true,
        loading: false,
      });

      console.log(`✅ User timeline data loaded for ${username}:`, {
        nodeCount: tree.nodes.length,
        edgeCount: tree.edges.length,
        rootCount: findRoots(apiNodes).length,
      });
    } catch (error) {
      console.error(`❌ Failed to load user timeline for ${username}:`, error);
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load user timeline',
      });
    }
  },

  refreshTree: () => {
    const { nodes } = get();
    const tree = buildHierarchyTree(nodes);
    set({ tree });
  },

  clearUserData: () => {
    set({
      nodes: [],
      tree: { nodes: [], edges: [] },
      hasData: false,
      error: null,
      insights: {},
      insightLoading: {},
      selectedNodeId: null,
      focusedNodeId: null,
      expandedNodeIds: new Set<string>(),
      showPanel: false,
      panelMode: 'view',
    });
    console.log('🧹 User data cleared');
  },

  // Node CRUD operations
  createNode: async (payload: CreateNodePayload) => {
    set({ loading: true, error: null });

    try {
      const newApiNode = await hierarchyApi.createNode(payload);

      // Reload all data to ensure consistency
      await get().loadNodes();

      set({
        loading: false,
        selectedNodeId: newApiNode.id, // Select the newly created node
      });

      console.log('✅ Node created:', newApiNode.id);
      return newApiNode;
    } catch (error) {
      console.error('❌ Failed to create node:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create node',
      });
      throw error;
    }
  },

  updateNode: async (nodeId: string, patch: UpdateNodePayload) => {
    set({ loading: true, error: null });

    try {
      const updatedNode = await hierarchyApi.updateNode(nodeId, patch);

      // Update local state
      const { nodes } = get();
      const updatedNodes = nodes.map((node) =>
        node.id === nodeId ? updatedNode : node
      );
      const tree = buildHierarchyTree(updatedNodes);

      set({
        nodes: updatedNodes,
        tree,
        loading: false,
      });

      console.log('✅ Node updated:', nodeId);
    } catch (error) {
      console.error('❌ Failed to update node:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to update node',
      });
      throw error;
    }
  },

  deleteNode: async (nodeId: string) => {
    set({ loading: true, error: null });

    try {
      await hierarchyApi.deleteNode(nodeId);

      // Update local state
      const { nodes, selectedNodeId, focusedNodeId, expandedNodeIds } = get();
      const updatedNodes = nodes.filter((node) => node.id !== nodeId);
      const tree = buildHierarchyTree(updatedNodes);

      // Clear selection/focus if deleted node was selected/focused
      const newSelectedId = selectedNodeId === nodeId ? null : selectedNodeId;
      const newFocusedId = focusedNodeId === nodeId ? null : focusedNodeId;

      // Remove from expansion set
      const newExpandedIds = new Set(expandedNodeIds);
      newExpandedIds.delete(nodeId);

      set({
        nodes: updatedNodes,
        tree,
        selectedNodeId: newSelectedId,
        focusedNodeId: newFocusedId,
        expandedNodeIds: newExpandedIds,
        loading: false,
        showPanel: newSelectedId !== null, // Hide panel if no selection
      });

      console.log('✅ Node deleted:', nodeId);
    } catch (error) {
      console.error('❌ Failed to delete node:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to delete node',
      });
      throw error;
    }
  },

  // Selection and focus actions
  selectNode: (nodeId: string | null) => {
    set({
      selectedNodeId: nodeId,
      showPanel: nodeId !== null,
      panelMode: 'view', // Reset to view mode when selecting
    });

    if (nodeId) {
      console.log('📌 Node selected:', nodeId);
    }
  },

  focusNode: (nodeId: string | null) => {
    set({ focusedNodeId: nodeId });

    if (nodeId) {
      console.log('🎯 Node focused:', nodeId);

      // Auto-expand focused node if it has children
      const { hasChildren } = get();
      if (hasChildren(nodeId)) {
        get().expandNode(nodeId);
      }
    }
  },

  clearFocus: () => {
    set({ focusedNodeId: null });
    console.log('🔄 Focus cleared');
  },

  // Layout actions - Removed (forced to LR only)

  // Expansion actions
  expandNode: (nodeId: string) => {
    const { expandedNodeIds } = get();
    const newExpandedIds = new Set(expandedNodeIds);
    newExpandedIds.add(nodeId);
    set({ expandedNodeIds: newExpandedIds });
    console.log('📂 Node expanded:', nodeId);
  },

  collapseNode: (nodeId: string) => {
    const { expandedNodeIds, nodes } = get();
    const newExpandedIds = new Set(expandedNodeIds);

    // Function to recursively find all descendant node IDs
    const findAllDescendants = (parentId: string): string[] => {
      const directChildren = nodes
        .filter((node) => node.parentId === parentId)
        .map((node) => node.id);
      let allDescendants = [...directChildren];

      // Recursively find descendants of each child
      directChildren.forEach((childId) => {
        allDescendants = allDescendants.concat(findAllDescendants(childId));
      });

      return allDescendants;
    };

    // Remove the node itself
    newExpandedIds.delete(nodeId);

    // Remove all descendant nodes to prevent orphaned expanded children
    const descendants = findAllDescendants(nodeId);
    descendants.forEach((descendantId) => {
      newExpandedIds.delete(descendantId);
    });

    set({ expandedNodeIds: newExpandedIds });
    console.log('📁 Node and descendants collapsed:', {
      nodeId,
      descendantsCollapsed: descendants.length,
      remainingExpanded: Array.from(newExpandedIds),
    });
  },

  toggleNodeExpansion: (nodeId: string) => {
    const { isNodeExpanded } = get();
    if (isNodeExpanded(nodeId)) {
      get().collapseNode(nodeId);
    } else {
      // expandNode now handles closing other nodes automatically
      get().expandNode(nodeId);
    }
  },

  expandAllNodes: () => {
    const { nodes } = get();
    const allNodeIds = new Set(nodes.map((node) => node.id));
    set({ expandedNodeIds: allNodeIds });
    console.log('📂 All nodes expanded');
  },

  collapseAllNodes: () => {
    set({ expandedNodeIds: new Set() });
    console.log('📁 All nodes collapsed');
  },

  isNodeExpanded: (nodeId: string) => {
    return get().expandedNodeIds.has(nodeId);
  },

  // Panel actions
  setPanelMode: (mode: 'view' | 'edit' | 'create' | 'move') => {
    set({ panelMode: mode });
  },

  showSidePanel: () => {
    set({ showPanel: true });
  },

  hideSidePanel: () => {
    set({ showPanel: false, selectedNodeId: null });
  },

  // Insights methods
  getNodeInsights: async (nodeId: string) => {
    set((state) => ({
      insightLoading: { ...state.insightLoading, [nodeId]: true },
    }));

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
        set((state) => ({
          insights: { ...state.insights, [nodeId]: result.data },
          insightLoading: { ...state.insightLoading, [nodeId]: false },
        }));
      } else {
        throw new Error(result.error?.message || 'Failed to fetch insights');
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      set((state) => ({
        insightLoading: { ...state.insightLoading, [nodeId]: false },
        error:
          error instanceof Error ? error.message : 'Failed to load insights',
      }));
    }
  },

  createInsight: async (nodeId: string, data: InsightCreateDTO) => {
    try {
      const response = await fetch(
        `/api/v2/timeline/nodes/${nodeId}/insights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        set((state) => ({
          insights: {
            ...state.insights,
            [nodeId]: [...(state.insights[nodeId] || []), result.data],
          },
        }));
        console.log('✅ Insight created successfully');
      } else {
        throw new Error(result.error?.message || 'Failed to create insight');
      }
    } catch (error) {
      console.error('Failed to create insight:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to add insight',
      });
      throw error;
    }
  },

  updateInsight: async (
    insightId: string,
    nodeId: string,
    data: InsightUpdateDTO
  ) => {
    try {
      const response = await fetch(`/api/v2/timeline/insights/${insightId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        set((state) => ({
          insights: {
            ...state.insights,
            [nodeId]:
              state.insights[nodeId]?.map((insight) =>
                insight.id === insightId ? result.data : insight
              ) || [],
          },
        }));
        console.log('✅ Insight updated successfully');
      } else {
        throw new Error(result.error?.message || 'Failed to update insight');
      }
    } catch (error) {
      console.error('Failed to update insight:', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to update insight',
      });
      throw error;
    }
  },

  deleteInsight: async (insightId: string, nodeId: string) => {
    try {
      const response = await fetch(`/api/v2/timeline/insights/${insightId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        set((state) => ({
          insights: {
            ...state.insights,
            [nodeId]:
              state.insights[nodeId]?.filter(
                (insight) => insight.id !== insightId
              ) || [],
          },
        }));
        console.log('✅ Insight deleted successfully');
      } else {
        throw new Error(result.error?.message || 'Failed to delete insight');
      }
    } catch (error) {
      console.error('Failed to delete insight:', error);
      set({
        error:
          error instanceof Error ? error.message : 'Failed to delete insight',
      });
      throw error;
    }
  },

  clearInsights: (nodeId: string) => {
    set((state) => ({
      insights: { ...state.insights, [nodeId]: [] },
    }));
  },

  // Utility getters
  getRootNodes: () => {
    const { nodes } = get();
    return findRoots(nodes);
  },

  getNodeById: (nodeId: string) => {
    const { nodes } = get();
    return nodes.find((node) => node.id === nodeId);
  },

  getChildren: (nodeId: string) => {
    const { nodes } = get();
    return findChildren(nodeId, nodes);
  },

  hasChildren: (nodeId: string) => {
    return get().getChildren(nodeId).length > 0;
  },
}));

// Subscribe to auth changes - automatically sync hierarchy with auth state
useAuthStore.subscribe((authState, prevAuthState) => {
  const hierarchyStore = useHierarchyStore.getState();

  // When user logs out, clear hierarchy data
  if (prevAuthState.isAuthenticated && !authState.isAuthenticated) {
    console.log('🔄 User logged out, clearing hierarchy data');
    hierarchyStore.clearUserData();
  }

  // When user logs in, load their data
  if (
    !prevAuthState.isAuthenticated &&
    authState.isAuthenticated &&
    authState.user
  ) {
    console.log('🔄 User logged in, loading hierarchy data');
    hierarchyStore.loadNodes();
  }
});

// Subscribe to profile review store to load nodes when profile is saved
useProfileReviewStore.subscribe((profileState, prevProfileState) => {
  const hierarchyStore = useHierarchyStore.getState();
  const authState = useAuthStore.getState();

  // When profile save completes successfully (showSuccess becomes true), load nodes
  if (
    !prevProfileState.showSuccess &&
    profileState.showSuccess &&
    authState.isAuthenticated &&
    authState.user
  ) {
    console.log('🔄 Profile saved successfully, loading hierarchy nodes');
    hierarchyStore.loadNodes();
  }
});

// Export store for use in components
export default useHierarchyStore;
