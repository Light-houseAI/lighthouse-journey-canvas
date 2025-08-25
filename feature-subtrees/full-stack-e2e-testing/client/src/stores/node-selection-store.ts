import { createWithEqualityFn } from 'zustand/traditional';

/**
 * Node Selection Behavior Store
 * Single responsibility: Managing selected node state
 * Component-centric design for selection behavior
 */
export interface NodeSelectionStore {
  // State
  selectedNodeId: string | null;
  
  // Actions
  setSelectedNode: (id: string | null) => void;
  clearSelection: () => void;
  isSelected: (nodeId: string) => boolean;
  
  // Selection behavior helpers
  selectNext: (nodeIds: string[]) => void;
  selectPrevious: (nodeIds: string[]) => void;
}

/**
 * Selection behavior store following component-centric architecture
 * Manages which node is currently selected
 */
export const useNodeSelectionStore = createWithEqualityFn<NodeSelectionStore>((set, get) => ({
  // State
  selectedNodeId: null,
  
  // Actions
  setSelectedNode: (id: string | null) => {
    set({ selectedNodeId: id });
  },

  clearSelection: () => {
    set({ selectedNodeId: null });
  },

  isSelected: (nodeId: string) => {
    const { selectedNodeId } = get();
    return selectedNodeId === nodeId;
  },

  // Selection behavior helpers
  selectNext: (nodeIds: string[]) => {
    const { selectedNodeId } = get();
    
    if (!selectedNodeId || nodeIds.length === 0) {
      set({ selectedNodeId: nodeIds[0] || null });
      return;
    }
    
    const currentIndex = nodeIds.indexOf(selectedNodeId);
    const nextIndex = (currentIndex + 1) % nodeIds.length;
    set({ selectedNodeId: nodeIds[nextIndex] });
  },

  selectPrevious: (nodeIds: string[]) => {
    const { selectedNodeId } = get();
    
    if (!selectedNodeId || nodeIds.length === 0) {
      set({ selectedNodeId: nodeIds[nodeIds.length - 1] || null });
      return;
    }
    
    const currentIndex = nodeIds.indexOf(selectedNodeId);
    const prevIndex = currentIndex <= 0 ? nodeIds.length - 1 : currentIndex - 1;
    set({ selectedNodeId: nodeIds[prevIndex] });
  },
}));