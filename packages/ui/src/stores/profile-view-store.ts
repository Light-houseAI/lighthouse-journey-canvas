import { enableMapSet } from 'immer';
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Enable Immer MapSet support for handling Set operations
enableMapSet();

/**
 * Profile View Store
 *
 * Manages UI state ONLY for profile viewing.
 * Server state (node data) is managed by TanStack Query hooks.
 *
 * UI State includes:
 * - Panel visibility and mode
 * - Selected node ID
 * - Expansion state for hierarchical nodes
 *
 * Pattern:
 * - Use this store for UI interactions (panel, selection, expansion)
 * - Use TanStack Query hooks for node data operations
 */
interface ProfileViewState {
  // Panel state
  isPanelOpen: boolean;
  panelNodeId: string | null;
  panelMode: 'view' | 'edit';
  selectedNodeId: string | null;

  // Expansion state for hierarchical nodes
  expandedNodeIds: Set<string>;

  // Actions
  openPanel: (nodeId: string, mode: 'view' | 'edit') => void;
  closePanel: () => void;
  setSelectedNode: (nodeId: string | null) => void;
  toggleNodeExpansion: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  collapseAll: () => void;
}

export const useProfileViewStore = create<ProfileViewState>()(
  persist(
    subscribeWithSelector(
      immer((set) => ({
        // Initial state
        isPanelOpen: false,
        panelNodeId: null,
        panelMode: 'view' as const,
        selectedNodeId: null,
        expandedNodeIds: new Set<string>(),

        // Actions
        openPanel: (nodeId: string, mode: 'view' | 'edit' = 'view') => {
          set((state) => {
            state.isPanelOpen = true;
            state.panelNodeId = nodeId;
            state.panelMode = mode;
            state.selectedNodeId = nodeId;
          });
        },

        closePanel: () => {
          set((state) => {
            state.isPanelOpen = false;
            state.panelNodeId = null;
            state.panelMode = 'view';
            state.selectedNodeId = null;
          });
        },

        setSelectedNode: (nodeId: string | null) => {
          set((state) => {
            state.selectedNodeId = nodeId;
          });
        },

        toggleNodeExpansion: (nodeId: string) => {
          set((state) => {
            if (state.expandedNodeIds.has(nodeId)) {
              state.expandedNodeIds.delete(nodeId);
            } else {
              state.expandedNodeIds.add(nodeId);
            }
          });
        },

        expandNode: (nodeId: string) => {
          set((state) => {
            state.expandedNodeIds.add(nodeId);
          });
        },

        collapseNode: (nodeId: string) => {
          set((state) => {
            state.expandedNodeIds.delete(nodeId);
          });
        },

        collapseAll: () => {
          set((state) => {
            state.expandedNodeIds.clear();
          });
        },
      }))
    ),
    {
      name: 'profile-view-store',
      partialize: (state) => ({
        // Only persist expansion state, not panel state
        expandedNodeIds: Array.from(state.expandedNodeIds), // Convert Set to Array for persistence
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.expandedNodeIds)) {
          // Convert Array back to Set after rehydration
          state.expandedNodeIds = new Set(state.expandedNodeIds);
        }
      },
    }
  )
);
