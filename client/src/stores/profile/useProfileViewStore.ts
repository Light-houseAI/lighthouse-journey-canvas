import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { ProfileViewStore, TimelineNodeView } from '../../types/profile';
import { getAncestorIds, getDescendantIds } from './useTimelineTransform';

// ============================================================================
// PROFILE VIEW STORE - UI STATE MANAGEMENT
// ============================================================================
// Manages client-side UI state for the profile view feature
// Uses Zustand with persistence for expanded states

interface ProfileViewState extends ProfileViewStore {
  // Internal state
  _nodes: TimelineNodeView[]; // Cache nodes for ancestor/descendant operations
  
  // Internal actions
  _setNodes: (nodes: TimelineNodeView[]) => void;
}

export const useProfileViewStore = create<ProfileViewState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ============================================================================
        // INITIAL STATE
        // ============================================================================
        selectedNodeId: null,
        focusedNodeId: null,
        expandedNodeIds: new Set<string>(),
        isPanelOpen: false,
        panelMode: 'view' as const,
        panelNodeId: null,
        
        // Internal state
        _nodes: [],
        
        // ============================================================================
        // SELECTION ACTIONS
        // ============================================================================
        selectNode: (nodeId: string | null) => {
          set((state) => {
            state.selectedNodeId = nodeId;
            state.focusedNodeId = nodeId;
            state.isPanelOpen = nodeId !== null;
            state.panelNodeId = nodeId;
            state.panelMode = 'view';
          });
        },

        focusNode: (nodeId: string | null) => {
          set((state) => {
            state.focusedNodeId = nodeId;
          });
        },

        // ============================================================================
        // EXPANSION ACTIONS
        // ============================================================================
        toggleNodeExpansion: (nodeId: string) => {
          set((state) => {
            if (state.expandedNodeIds.has(nodeId)) {
              state.expandedNodeIds.delete(nodeId);
            } else {
              state.expandedNodeIds.add(nodeId);
            }
          });
        },

        expandAllNodes: () => {
          set((state) => {
            const { _nodes } = get();
            const allNodeIds = _nodes
              .filter(node => {
                // Only expand nodes that have children
                return _nodes.some(n => n.parentId === node.id);
              })
              .map(node => node.id);
            
            allNodeIds.forEach(id => state.expandedNodeIds.add(id));
          });
        },

        collapseAllNodes: () => {
          set((state) => {
            state.expandedNodeIds.clear();
          });
        },

        // ============================================================================
        // PANEL ACTIONS
        // ============================================================================
        openPanel: (nodeId: string, mode: 'view' | 'edit' = 'view') => {
          set((state) => {
            state.selectedNodeId = nodeId;
            state.panelNodeId = nodeId;
            state.isPanelOpen = true;
            state.panelMode = mode;
          });
        },

        closePanel: () => {
          set((state) => {
            state.isPanelOpen = false;
            state.selectedNodeId = null;
            state.panelNodeId = null;
            state.panelMode = 'view';
          });
        },

        setPanelMode: (mode: 'view' | 'edit') => {
          set((state) => {
            state.panelMode = mode;
          });
        },

        // ============================================================================
        // ADVANCED ACTIONS
        // ============================================================================
        
        // Expand all ancestors of a node (useful when deep-linking to a node)
        expandToNode: (nodeId: string) => {
          set((state) => {
            const { _nodes } = get();
            const ancestorIds = getAncestorIds(nodeId, _nodes);
            ancestorIds.forEach(id => state.expandedNodeIds.add(id));
          });
        },

        // Collapse a node and all its descendants
        collapseSubtree: (nodeId: string) => {
          set((state) => {
            const { _nodes } = get();
            const descendantIds = getDescendantIds(nodeId, _nodes);
            
            // Remove the node and all descendants from expanded set
            state.expandedNodeIds.delete(nodeId);
            descendantIds.forEach(id => state.expandedNodeIds.delete(id));
          });
        },

        // Smart expand - expand only direct children, not grandchildren
        expandDirect: (nodeId: string) => {
          set((state) => {
            const { _nodes } = get();
            const directChildren = _nodes.filter(n => n.parentId === nodeId);
            
            state.expandedNodeIds.add(nodeId);
            // Don't automatically expand grandchildren
            directChildren.forEach(child => {
              if (!state.expandedNodeIds.has(child.id)) {
                // Only expand if not already expanded (preserve user choices)
              }
            });
          });
        },

        // ============================================================================
        // UTILITY ACTIONS
        // ============================================================================
        resetUIState: () => {
          set((state) => {
            state.selectedNodeId = null;
            state.focusedNodeId = null;
            state.expandedNodeIds.clear();
            state.isPanelOpen = false;
            state.panelMode = 'view';
            state.panelNodeId = null;
          });
        },

        // Clear only selection state, keep expansion state
        clearSelection: () => {
          set((state) => {
            state.selectedNodeId = null;
            state.focusedNodeId = null;
            state.isPanelOpen = false;
            state.panelNodeId = null;
            state.panelMode = 'view';
          });
        },

        // ============================================================================
        // INTERNAL ACTIONS
        // ============================================================================
        _setNodes: (nodes: TimelineNodeView[]) => {
          set((state) => {
            state._nodes = nodes;
          });
        },

      })),
      {
        name: 'profile-view-store',
        partialize: (state) => ({
          // Persist expansion state and panel preferences
          expandedNodeIds: Array.from(state.expandedNodeIds), // Convert Set to Array for serialization
          panelMode: state.panelMode,
          // Don't persist selection state - start fresh each session
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Convert Array back to Set after deserialization
            state.expandedNodeIds = new Set(state.expandedNodeIds || []);
          }
        },
      }
    ),
    {
      name: 'profile-view-store',
      // Serialize Set to Array for devtools display
      serialize: {
        options: {
          map: true,
        },
      },
    }
  )
);

// ============================================================================
// COMPUTED SELECTORS
// ============================================================================
// Efficient selectors that compute derived state

export const useIsNodeExpanded = (nodeId: string) =>
  useProfileViewStore((state) => state.expandedNodeIds.has(nodeId));

export const useIsNodeSelected = (nodeId: string) =>
  useProfileViewStore((state) => state.selectedNodeId === nodeId);

export const useIsNodeFocused = (nodeId: string) =>
  useProfileViewStore((state) => state.focusedNodeId === nodeId);

export const useExpandedCount = () =>
  useProfileViewStore((state) => state.expandedNodeIds.size);

export const useHasSelection = () =>
  useProfileViewStore((state) => state.selectedNodeId !== null);

export const useIsPanelOpen = () =>
  useProfileViewStore((state) => state.isPanelOpen);

export const usePanelMode = () =>
  useProfileViewStore((state) => state.panelMode);

// ============================================================================
// ACTION SELECTORS
// ============================================================================
// Optimized action selectors to prevent unnecessary re-renders

export const useProfileViewActions = () =>
  useProfileViewStore((state) => ({
    selectNode: state.selectNode,
    focusNode: state.focusNode,
    toggleNodeExpansion: state.toggleNodeExpansion,
    expandAllNodes: state.expandAllNodes,
    collapseAllNodes: state.collapseAllNodes,
    openPanel: state.openPanel,
    closePanel: state.closePanel,
    setPanelMode: state.setPanelMode,
    resetUIState: state.resetUIState,
    clearSelection: state.clearSelection,
  }));

export const useExpandToNode = () =>
  useProfileViewStore((state) => state.expandToNode);

export const useCollapseSubtree = () =>
  useProfileViewStore((state) => state.collapseSubtree);

// ============================================================================
// STORE INITIALIZATION HOOK
// ============================================================================
// Hook to initialize the store with node data
// Note: This hook should be used in components where React is already imported

export const useInitializeProfileView = (nodes: TimelineNodeView[]) => {
  const _setNodes = useProfileViewStore((state) => state._setNodes);
  
  // This will be called from components where React.useEffect is available
  // Components using this hook should import React and call React.useEffect
  return { _setNodes, nodes };
};