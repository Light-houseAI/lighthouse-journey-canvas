import { useNodeFocusStore } from '@/stores/node-focus-store';
import { useNodeHighlightStore } from '@/stores/node-highlight-store';
import { useNodeInteractionStore } from '@/stores/node-interaction-store';
import { useNodeSelectionStore } from '@/stores/node-selection-store';

/**
 * Component-level behavior hook for node focus behavior
 * Provides focused/blurred state and focus actions for a specific node
 */
export const useNodeFocus = (nodeId: string) => {
  const focusedExperienceId = useNodeFocusStore(state => state.focusedExperienceId);
  const setFocusedExperience = useNodeFocusStore(state => state.setFocusedExperience);
  const clearFocus = useNodeFocusStore(state => state.clearFocus);
  const isFocused = useNodeFocusStore(state => state.isFocused);
  const isBlurred = useNodeFocusStore(state => state.isBlurred);

  return {
    // State for this node
    isFocused: isFocused(nodeId),
    isBlurred: isBlurred(nodeId),
    focusedExperienceId,
    
    // Actions
    focus: () => setFocusedExperience(nodeId),
    clearFocus,
    setFocusedExperience,
  };
};

/**
 * Component-level behavior hook for node selection behavior
 * Provides selected state and selection actions for a specific node
 */
export const useNodeSelection = (nodeId: string) => {
  const selectedNodeId = useNodeSelectionStore(state => state.selectedNodeId);
  const setSelectedNode = useNodeSelectionStore(state => state.setSelectedNode);
  const clearSelection = useNodeSelectionStore(state => state.clearSelection);
  const isSelected = useNodeSelectionStore(state => state.isSelected);
  const selectNext = useNodeSelectionStore(state => state.selectNext);
  const selectPrevious = useNodeSelectionStore(state => state.selectPrevious);

  return {
    // State for this node
    isSelected: isSelected(nodeId),
    selectedNodeId,
    
    // Actions
    select: () => setSelectedNode(nodeId),
    clearSelection,
    setSelectedNode,
    selectNext,
    selectPrevious,
  };
};

/**
 * Component-level behavior hook for node highlight behavior
 * Provides highlighted state and highlight actions for a specific node
 */
export const useNodeHighlight = (nodeId: string) => {
  const highlightedNodeId = useNodeHighlightStore(state => state.highlightedNodeId);
  const setHighlightedNode = useNodeHighlightStore(state => state.setHighlightedNode);
  const clearHighlight = useNodeHighlightStore(state => state.clearHighlight);
  const isHighlighted = useNodeHighlightStore(state => state.isHighlighted);
  const highlightTemporary = useNodeHighlightStore(state => state.highlightTemporary);
  const flashHighlight = useNodeHighlightStore(state => state.flashHighlight);

  return {
    // State for this node
    isHighlighted: isHighlighted(nodeId),
    highlightedNodeId,
    
    // Actions
    highlight: (duration?: number) => setHighlightedNode(nodeId, duration),
    clearHighlight,
    highlightTemporary: (duration?: number) => highlightTemporary(nodeId, duration),
    flashHighlight: (count?: number) => flashHighlight(nodeId, count),
    setHighlightedNode,
  };
};

/**
 * Component-level behavior hook for node interaction behavior
 * Provides interaction states and actions for a specific node
 */
export const useNodeInteraction = (nodeId: string) => {
  const hoveredNodeId = useNodeInteractionStore(state => state.hoveredNodeId);
  const draggedNodeId = useNodeInteractionStore(state => state.draggedNodeId);
  const contextMenuNodeId = useNodeInteractionStore(state => state.contextMenuNodeId);
  const isInteracting = useNodeInteractionStore(state => state.isInteracting);
  const setHoveredNode = useNodeInteractionStore(state => state.setHoveredNode);
  const setDraggedNode = useNodeInteractionStore(state => state.setDraggedNode);
  const setContextMenuNode = useNodeInteractionStore(state => state.setContextMenuNode);
  const isHovered = useNodeInteractionStore(state => state.isHovered);
  const isDragged = useNodeInteractionStore(state => state.isDragged);
  const hasContextMenu = useNodeInteractionStore(state => state.hasContextMenu);
  const clearAllInteractions = useNodeInteractionStore(state => state.clearAllInteractions);

  return {
    // State for this node
    isHovered: isHovered(nodeId),
    isDragged: isDragged(nodeId),
    hasContextMenu: hasContextMenu(nodeId),
    isInteracting,
    
    // Global state
    hoveredNodeId,
    draggedNodeId,
    contextMenuNodeId,
    
    // Actions
    setHovered: () => setHoveredNode(nodeId),
    clearHovered: () => setHoveredNode(null),
    setDragged: () => setDraggedNode(nodeId),
    clearDragged: () => setDraggedNode(null),
    setContextMenu: () => setContextMenuNode(nodeId),
    clearContextMenu: () => setContextMenuNode(null),
    clearAllInteractions,
  };
};

/**
 * Composed behavior hook that combines all node behaviors
 * Use this for components that need multiple behaviors
 */
export const useNodeBehaviors = (nodeId: string) => {
  const focus = useNodeFocus(nodeId);
  const selection = useNodeSelection(nodeId);
  const highlight = useNodeHighlight(nodeId);
  const interaction = useNodeInteraction(nodeId);

  return {
    focus,
    selection,
    highlight,
    interaction,
    
    // Convenience composed state
    isActive: focus.isFocused || selection.isSelected || highlight.isHighlighted,
    isInteractive: interaction.isHovered || interaction.isDragged,
  };
};