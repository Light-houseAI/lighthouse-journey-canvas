import { createWithEqualityFn } from 'zustand/traditional';

/**
 * Node Highlight Behavior Store
 * Single responsibility: Managing highlighted node state with auto-clear
 * Component-centric design for highlight behavior
 */
export interface NodeHighlightStore {
  // State
  highlightedNodeId: string | null;
  highlightTimeout: NodeJS.Timeout | null;
  
  // Actions
  setHighlightedNode: (id: string | null, duration?: number) => void;
  clearHighlight: () => void;
  isHighlighted: (nodeId: string) => boolean;
  
  // Highlight behavior helpers
  highlightTemporary: (nodeId: string, duration?: number) => void;
  flashHighlight: (nodeId: string, count?: number) => void;
}

/**
 * Highlight behavior store following component-centric architecture
 * Manages which node is currently highlighted with auto-clear functionality
 */
export const useNodeHighlightStore = createWithEqualityFn<NodeHighlightStore>((set, get) => ({
  // State
  highlightedNodeId: null,
  highlightTimeout: null,
  
  // Actions
  setHighlightedNode: (id: string | null, duration: number = 3000) => {
    const { highlightTimeout } = get();
    
    // Clear existing timeout
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    set({ highlightedNodeId: id, highlightTimeout: null });
    
    // Auto-clear highlight after duration
    if (id && duration > 0) {
      const timeout = setTimeout(() => {
        if (get().highlightedNodeId === id) {
          set({ highlightedNodeId: null, highlightTimeout: null });
        }
      }, duration);
      
      set({ highlightTimeout: timeout });
    }
  },

  clearHighlight: () => {
    const { highlightTimeout } = get();
    
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    
    set({ highlightedNodeId: null, highlightTimeout: null });
  },

  isHighlighted: (nodeId: string) => {
    const { highlightedNodeId } = get();
    return highlightedNodeId === nodeId;
  },

  // Highlight behavior helpers
  highlightTemporary: (nodeId: string, duration: number = 2000) => {
    const { setHighlightedNode } = get();
    setHighlightedNode(nodeId, duration);
  },

  flashHighlight: (nodeId: string, count: number = 3) => {
    const { setHighlightedNode, clearHighlight } = get();
    let currentCount = 0;
    
    const flash = () => {
      if (currentCount >= count * 2) return;
      
      if (currentCount % 2 === 0) {
        setHighlightedNode(nodeId, 0); // No auto-clear
      } else {
        clearHighlight();
      }
      
      currentCount++;
      setTimeout(flash, 300);
    };
    
    flash();
  },
}));