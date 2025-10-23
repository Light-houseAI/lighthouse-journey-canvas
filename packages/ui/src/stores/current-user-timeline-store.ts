/**
 * Current User Timeline Store
 *
 * Manages UI state ONLY for the current user's timeline.
 * Server state (nodes, insights) is managed by TanStack Query hooks in useTimeline.ts
 *
 * UI State includes:
 * - Selection: selectedNodeId, showPanel, panelMode
 * - Focus: focusedNodeId (for highlighting/centering)
 * - Expansion: expandedNodeIds (for collapse/expand)
 *
 * Pattern:
 * - Use this store for UI interactions (select, expand, focus)
 * - Use useTimeline hooks for data operations (CRUD)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export interface CurrentUserTimelineUIState {
  // Selection state
  selectedNodeId: string | null;
  showPanel: boolean;
  panelMode: 'view' | 'edit';

  // Focus state (for highlighting/centering)
  focusedNodeId: string | null;

  // Expansion state (for collapse/expand)
  expandedNodeIds: Set<string>;

  // Selection actions
  selectNode: (nodeId: string | null) => void;
  closePanel: () => void;
  setPanelMode: (mode: 'view' | 'edit') => void;

  // Focus actions
  focusNode: (nodeId: string | null) => void;
  clearFocus: () => void;

  // Expansion actions
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNode: (nodeId: string) => void;
  isNodeExpanded: (nodeId: string) => boolean;

  // Bulk expansion
  expandNodes: (nodeIds: string[]) => void;
  collapseNodes: (nodeIds: string[]) => void;
  collapseAll: () => void;

  // Reset
  reset: () => void;

  // Legacy aliases for compatibility
  toggleNodeExpansion: (nodeId: string) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  selectedNodeId: null,
  showPanel: false,
  panelMode: 'view' as const,
  focusedNodeId: null,
  expandedNodeIds: new Set<string>(),
};

// ============================================================================
// Store
// ============================================================================

export const useCurrentUserTimelineStore = create<CurrentUserTimelineUIState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Selection Actions
      // ========================================================================

      selectNode: (nodeId: string | null) => {
        set({
          selectedNodeId: nodeId,
          showPanel: nodeId !== null,
          panelMode: 'view', // Always reset to view mode when selecting
        });

        if (nodeId) {
          console.log('📌 Node selected:', nodeId);
        }
      },

      closePanel: () => {
        set({
          selectedNodeId: null,
          showPanel: false,
          panelMode: 'view',
        });
        console.log('🚪 Panel closed');
      },

      setPanelMode: (mode: 'view' | 'edit') => {
        set({ panelMode: mode });
        console.log('🎛️ Panel mode:', mode);
      },

      // ========================================================================
      // Focus Actions
      // ========================================================================

      focusNode: (nodeId: string | null) => {
        set({ focusedNodeId: nodeId });

        if (nodeId) {
          console.log('🎯 Node focused:', nodeId);
        }
      },

      clearFocus: () => {
        set({ focusedNodeId: null });
        console.log('🔄 Focus cleared');
      },

      // ========================================================================
      // Expansion Actions
      // ========================================================================

      expandNode: (nodeId: string) => {
        set((state) => {
          state.expandedNodeIds.add(nodeId);
        });
        console.log('📂 Node expanded:', nodeId);
      },

      collapseNode: (nodeId: string) => {
        set((state) => {
          state.expandedNodeIds.delete(nodeId);
        });
        console.log('📁 Node collapsed:', nodeId);
      },

      toggleNode: (nodeId: string) => {
        const { isNodeExpanded, expandNode, collapseNode } = get();

        if (isNodeExpanded(nodeId)) {
          collapseNode(nodeId);
        } else {
          expandNode(nodeId);
        }
      },

      isNodeExpanded: (nodeId: string) => {
        return get().expandedNodeIds.has(nodeId);
      },

      // Bulk expansion
      expandNodes: (nodeIds: string[]) => {
        set((state) => {
          nodeIds.forEach((id) => state.expandedNodeIds.add(id));
        });
        console.log('📂 Nodes expanded:', nodeIds.length);
      },

      collapseNodes: (nodeIds: string[]) => {
        set((state) => {
          nodeIds.forEach((id) => state.expandedNodeIds.delete(id));
        });
        console.log('📁 Nodes collapsed:', nodeIds.length);
      },

      collapseAll: () => {
        set({ expandedNodeIds: new Set() });
        console.log('📁 All nodes collapsed');
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset: () => {
        set(initialState);
        console.log('🔄 Timeline UI state reset');
      },

      // ========================================================================
      // Legacy Aliases
      // ========================================================================

      toggleNodeExpansion: (nodeId: string) => {
        get().toggleNode(nodeId);
      },
    })),
    {
      name: 'current-user-timeline-ui-store',
    }
  )
);
