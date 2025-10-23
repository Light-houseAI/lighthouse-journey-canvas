/**
 * Share Store
 *
 * Manages UI state ONLY for sharing modal.
 * Server state (permissions, share operations) is managed by TanStack Query hooks in useSharing.ts
 *
 * UI State includes:
 * - Modal: isModalOpen, isLoading, error
 * - Search: searchQuery, activeTab
 * - Configuration: config (selectedNodes, targets, shareAllNodes)
 *
 * Pattern:
 * - Use this store for UI interactions (modal open/close, search, selection)
 * - Use useSharing hooks for data operations (share, fetch, update, remove)
 */

import { VisibilityLevel } from '@journey/schema';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// Types
// ============================================================================

// Share configuration types
export interface ShareTarget {
  type: 'user' | 'organization' | 'public';
  id?: number; // For user/organization targets
  name: string;
  email?: string; // For user targets
  accessLevel: VisibilityLevel; // Per-target access level
}

export interface ShareConfiguration {
  selectedNodes: string[]; // Node IDs to share
  shareAllNodes: boolean; // Whether to share all user's nodes
  targets: ShareTarget[]; // Who to share with
}

export interface ShareState {
  // Modal state
  isModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Share configuration (UI state)
  config: ShareConfiguration;

  // UI state
  searchQuery: string;
  activeTab: 'users' | 'organizations' | 'public';

  // Actions
  openModal: (selectedNodeIds?: string[]) => void;
  closeModal: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Configuration actions
  toggleShareAllNodes: () => void;
  addNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  setTargetAccessLevel: (target: ShareTarget, level: VisibilityLevel) => void;
  addTarget: (target: ShareTarget) => void;
  removeTarget: (target: ShareTarget) => void;
  clearTargets: () => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: 'users' | 'organizations' | 'public') => void;

  // Reset
  resetConfiguration: () => void;

  // Helper methods
  getUserSubjectKey: (userId: number) => string;
  getOrgSubjectKey: (orgId: number) => string;
  getPublicSubjectKey: () => string;
}

// ============================================================================
// Initial State
// ============================================================================

const defaultConfig: ShareConfiguration = {
  selectedNodes: [],
  shareAllNodes: false,
  targets: [],
};

// ============================================================================
// Store
// ============================================================================

export const useShareStore = create<ShareState>()(
  devtools(
    immer((set) => ({
      // Initial state
      isModalOpen: false,
      isLoading: false,
      error: null,
      config: { ...defaultConfig },
      searchQuery: '',
      activeTab: 'users',

      // ========================================================================
      // Modal Actions
      // ========================================================================

      openModal: (selectedNodeIds?: string[]) => {
        console.log(
          '🔥 openModal called with selectedNodeIds:',
          selectedNodeIds?.length || 0
        );
        set((state) => {
          state.isModalOpen = true;
          state.error = null;
          if (selectedNodeIds && selectedNodeIds.length > 0) {
            // Specific nodes selected
            state.config.selectedNodes = selectedNodeIds;
            state.config.shareAllNodes = false;
          } else {
            // No nodes selected - default to share all
            state.config.selectedNodes = [];
            state.config.shareAllNodes = true;
          }
          console.log(
            '✅ Modal state updated, isModalOpen:',
            state.isModalOpen
          );
        });
      },

      closeModal: () =>
        set((state) => {
          state.isModalOpen = false;
          state.error = null;
          // Reset configuration when closing
          state.config = { ...defaultConfig };
          state.searchQuery = '';
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
          state.isLoading = false;
        }),

      clearError: () =>
        set((state) => {
          state.error = null;
        }),

      // ========================================================================
      // Configuration Actions
      // ========================================================================

      toggleShareAllNodes: () =>
        set((state) => {
          state.config.shareAllNodes = !state.config.shareAllNodes;
          if (state.config.shareAllNodes) {
            // When sharing all nodes, clear selected nodes
            state.config.selectedNodes = [];
          }
        }),

      addNode: (nodeId) =>
        set((state) => {
          if (!state.config.selectedNodes.includes(nodeId)) {
            state.config.selectedNodes.push(nodeId);
          }
          // If adding specific nodes, disable share all
          if (state.config.selectedNodes.length > 0) {
            state.config.shareAllNodes = false;
          }
        }),

      removeNode: (nodeId) =>
        set((state) => {
          const index = state.config.selectedNodes.indexOf(nodeId);
          if (index > -1) {
            state.config.selectedNodes.splice(index, 1);
          }
        }),

      setTargetAccessLevel: (target, level) =>
        set((state) => {
          const existingTargetIndex = state.config.targets.findIndex(
            (t) =>
              t.type === target.type &&
              (target.id ? t.id === target.id : t.type === 'public')
          );

          if (existingTargetIndex !== -1) {
            state.config.targets[existingTargetIndex].accessLevel = level;
          }
        }),

      addTarget: (target) =>
        set((state) => {
          // Check if target already exists
          const exists = state.config.targets.some(
            (t) =>
              t.type === target.type &&
              (target.id ? t.id === target.id : t.type === 'public')
          );

          if (!exists) {
            // Ensure target has an access level (default to Overview if not provided)
            const targetWithAccessLevel = {
              ...target,
              accessLevel: target.accessLevel || VisibilityLevel.Overview,
            };
            state.config.targets.push(targetWithAccessLevel);
          }
        }),

      removeTarget: (target) =>
        set((state) => {
          const index = state.config.targets.findIndex(
            (t) =>
              t.type === target.type &&
              (target.id ? t.id === target.id : t.type === 'public')
          );
          if (index > -1) {
            state.config.targets.splice(index, 1);
          }
        }),

      clearTargets: () =>
        set((state) => {
          state.config.targets = [];
        }),

      // ========================================================================
      // Search Actions
      // ========================================================================

      setSearchQuery: (query) =>
        set((state) => {
          state.searchQuery = query;
        }),

      setActiveTab: (tab) =>
        set((state) => {
          state.activeTab = tab;
        }),

      // ========================================================================
      // Reset
      // ========================================================================

      resetConfiguration: () =>
        set((state) => {
          state.config = { ...defaultConfig };
          state.error = null;
        }),

      // ========================================================================
      // Helper Methods
      // ========================================================================

      getUserSubjectKey: (userId: number) => `user-${userId}`,
      getOrgSubjectKey: (orgId: number) => `org-${orgId}`,
      getPublicSubjectKey: () => 'public',
    })),
    { name: 'share-store' }
  )
);
