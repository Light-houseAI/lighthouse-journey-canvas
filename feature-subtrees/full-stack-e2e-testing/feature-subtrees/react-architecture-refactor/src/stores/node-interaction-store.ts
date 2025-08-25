import { createWithEqualityFn } from 'zustand/traditional';

/**
 * Node Interaction Behavior Store
 * Single responsibility: Managing node interaction states (hover, drag, etc.)
 * Component-centric design for interaction behavior
 */
export interface NodeInteractionStore {
  // State
  hoveredNodeId: string | null;
  draggedNodeId: string | null;
  contextMenuNodeId: string | null;
  
  // Interaction flags
  isInteracting: boolean;
  
  // Actions
  setHoveredNode: (id: string | null) => void;
  setDraggedNode: (id: string | null) => void;
  setContextMenuNode: (id: string | null) => void;
  setIsInteracting: (interacting: boolean) => void;
  
  // Interaction state helpers
  isHovered: (nodeId: string) => boolean;
  isDragged: (nodeId: string) => boolean;
  hasContextMenu: (nodeId: string) => boolean;
  clearAllInteractions: () => void;
}

/**
 * Interaction behavior store following component-centric architecture
 * Manages various node interaction states
 */
export const useNodeInteractionStore = createWithEqualityFn<NodeInteractionStore>((set, get) => ({
  // State
  hoveredNodeId: null,
  draggedNodeId: null,
  contextMenuNodeId: null,
  isInteracting: false,
  
  // Actions
  setHoveredNode: (id: string | null) => {
    set({ hoveredNodeId: id });
  },

  setDraggedNode: (id: string | null) => {
    set({ 
      draggedNodeId: id,
      isInteracting: id !== null 
    });
  },

  setContextMenuNode: (id: string | null) => {
    set({ contextMenuNodeId: id });
  },

  setIsInteracting: (interacting: boolean) => {
    set({ isInteracting: interacting });
  },

  // Interaction state helpers
  isHovered: (nodeId: string) => {
    const { hoveredNodeId } = get();
    return hoveredNodeId === nodeId;
  },

  isDragged: (nodeId: string) => {
    const { draggedNodeId } = get();
    return draggedNodeId === nodeId;
  },

  hasContextMenu: (nodeId: string) => {
    const { contextMenuNodeId } = get();
    return contextMenuNodeId === nodeId;
  },

  clearAllInteractions: () => {
    set({ 
      hoveredNodeId: null,
      draggedNodeId: null,
      contextMenuNodeId: null,
      isInteracting: false
    });
  },
}));