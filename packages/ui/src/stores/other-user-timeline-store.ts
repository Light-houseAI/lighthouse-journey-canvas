/**
 * Other User Timeline Store
 *
 * Manages UI state ONLY for viewing other users' timelines.
 * Server state (nodes, insights) is managed by TanStack Query hooks in useTimeline.ts
 *
 * This is a read-only timeline view - no editing capabilities.
 *
 * UI State includes:
 * - Selection: selectedNodeId, showPanel (always view mode)
 * - Focus: focusedNodeId (for highlighting/centering)
 * - Expansion: expandedNodeIds (for collapse/expand)
 * - Viewing context: viewingUsername (which user's timeline is displayed)
 *
 * Pattern:
 * - Use this store for UI interactions (select, expand, focus)
 * - Use useUserTimelineNodes(username) hook for data operations (read-only)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

export interface OtherUserTimelineUIState {
  // Viewing context
  viewingUsername: string | null;

  // Selection state (read-only, always view mode)
  selectedNodeId: string | null;
  showPanel: boolean;

  // Focus state (for highlighting/centering)
  focusedNodeId: string | null;

  // Expansion state (for collapse/expand)
  expandedNodeIds: Set<string>;

  // Viewing context actions
  setViewingUsername: (username: string | null) => void;

  // Selection actions (read-only)
  selectNode: (nodeId: string | null) => void;
  closePanel: () => void;

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
  viewingUsername: null,
  selectedNodeId: null,
  showPanel: false,
  focusedNodeId: null,
  expandedNodeIds: new Set<string>(),
};

// ============================================================================
// Store
// ============================================================================

export const useOtherUserTimelineStore = create<OtherUserTimelineUIState>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      ...initialState,

      // ========================================================================
      // Viewing Context Actions
      // ========================================================================

      setViewingUsername: (username: string | null) => {
        set({
          viewingUsername: username,
          // Reset UI state when changing users
          selectedNodeId: null,
          showPanel: false,
          focusedNodeId: null,
          expandedNodeIds: new Set(),
        });
        console.log('👤 Viewing username set:', username);
      },

      // ========================================================================
      // Selection Actions (Read-only)
      // ========================================================================

      selectNode: (nodeId: string | null) => {
        set({
          selectedNodeId: nodeId,
          showPanel: nodeId !== null,
        });

        if (nodeId) {
          console.log('📌 Node selected:', nodeId);
        }
      },

      closePanel: () => {
        set({
          selectedNodeId: null,
          showPanel: false,
        });
        console.log('🚪 Panel closed');
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
      name: 'other-user-timeline-ui-store',
    }
  )
);
