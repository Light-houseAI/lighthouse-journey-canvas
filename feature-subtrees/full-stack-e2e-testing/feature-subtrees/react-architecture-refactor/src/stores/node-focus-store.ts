import { createWithEqualityFn } from 'zustand/traditional';

/**
 * Node Focus Behavior Store
 * Single responsibility: Managing focused experience state
 * Component-centric design for focus behavior
 */
export interface NodeFocusStore {
  // State
  focusedExperienceId: string | null;
  
  // Actions
  setFocusedExperience: (id: string | null) => void;
  clearFocus: () => void;
  isFocused: (nodeId: string) => boolean;
  isBlurred: (nodeId: string) => boolean;
}

/**
 * Focus behavior store following component-centric architecture
 * Manages which experience node is currently focused
 */
export const useNodeFocusStore = createWithEqualityFn<NodeFocusStore>((set, get) => ({
  // State
  focusedExperienceId: null,
  
  // Actions
  setFocusedExperience: (id: string | null) => {
    set({ focusedExperienceId: id });
  },

  clearFocus: () => {
    set({ focusedExperienceId: null });
  },

  isFocused: (nodeId: string) => {
    const { focusedExperienceId } = get();
    return focusedExperienceId === nodeId;
  },

  isBlurred: (nodeId: string) => {
    const { focusedExperienceId } = get();
    return focusedExperienceId !== null && focusedExperienceId !== nodeId;
  },
}));