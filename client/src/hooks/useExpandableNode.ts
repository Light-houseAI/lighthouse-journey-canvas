import { useCallback, useMemo } from 'react';

import { useHierarchyStore } from '@/stores/hierarchy-store';

// Define BaseExpandableNodeData locally for expandable node functionality
export interface BaseExpandableNodeData {
  isExpanded?: boolean;
  children?: any[];
  hasExpandableContent?: boolean;
  projects?: any[];
  courses?: any[];
}

/**
 * Universal expandable node hook
 * Provides expansion logic and state management for any node type
 */
export interface UseExpandableNodeProps {
  nodeId: string;
  nodeData: BaseExpandableNodeData;
  onToggleExpansion?: (nodeId: string) => void;
}

export interface UseExpandableNodeReturn {
  // State
  isExpanded: boolean;
  hasExpandableContent: boolean;
  canExpand: boolean;
  
  // Actions
  toggleExpansion: () => void;
  expand: () => void;
  collapse: () => void;
  
  // UI Properties
  chevronRotation: number;
  expansionButtonVisible: boolean;
}

export const useExpandableNode = ({
  nodeId,
  nodeData,
  onToggleExpansion
}: UseExpandableNodeProps): UseExpandableNodeReturn => {
  const {
    isNodeExpanded,
    toggleNodeExpansion,
    expandNode,
    collapseNode
  } = useHierarchyStore();

  // Calculate expansion state
  const isExpanded = useMemo(() => {
    return nodeData.isExpanded ?? isNodeExpanded(nodeId);
  }, [nodeData.isExpanded, isNodeExpanded, nodeId]);

  // Determine if node has expandable content
  const hasExpandableContent = useMemo(() => {
    if (nodeData.hasExpandableContent !== undefined) {
      return nodeData.hasExpandableContent;
    }
    
    // Auto-detect based on children or projects
    if (nodeData.children && nodeData.children.length > 0) {
      return true;
    }
    
    // Check for projects in work experience nodes
    if ('projects' in nodeData && Array.isArray(nodeData.projects) && nodeData.projects.length > 0) {
      return true;
    }
    
    // Check for courses/achievements in education nodes
    if ('courses' in nodeData && Array.isArray(nodeData.courses) && nodeData.courses.length > 0) {
      return true;
    }
    
    return false;
  }, [nodeData]);

  // Determine if node can expand (has content and is not already expanded)
  const canExpand = useMemo(() => {
    return hasExpandableContent && !isExpanded;
  }, [hasExpandableContent, isExpanded]);

  // Toggle expansion handler
  const toggleExpansion = useCallback(() => {
    // Call custom handler if provided
    if (onToggleExpansion) {
      onToggleExpansion(nodeId);
    } else {
      // Use store's toggle method
      toggleNodeExpansion(nodeId);
    }
  }, [nodeId, onToggleExpansion, toggleNodeExpansion]);

  // Expand handler
  const expand = useCallback(() => {
    if (!isExpanded) {
      expandNode(nodeId);
    }
  }, [nodeId, isExpanded, expandNode]);

  // Collapse handler
  const collapse = useCallback(() => {
    if (isExpanded) {
      collapseNode(nodeId);
    }
  }, [nodeId, isExpanded, collapseNode]);

  // Calculate chevron rotation for animation
  const chevronRotation = useMemo(() => {
    return isExpanded ? 180 : 0;
  }, [isExpanded]);

  // Determine if expansion button should be visible
  const expansionButtonVisible = useMemo(() => {
    return hasExpandableContent;
  }, [hasExpandableContent]);

  return {
    // State
    isExpanded,
    hasExpandableContent,
    canExpand,
    
    // Actions
    toggleExpansion,
    expand,
    collapse,
    
    // UI Properties
    chevronRotation,
    expansionButtonVisible
  };
};

/**
 * Hook for getting expansion state of any node (read-only)
 */
export const useNodeExpansionState = (nodeId: string) => {
  const { isNodeExpanded } = useHierarchyStore();
  return isNodeExpanded(nodeId);
};

/**
 * Hook for managing multiple node expansions (bulk operations)
 */
export const useMultiNodeExpansion = () => {
  const {
    expandAllNodes,
    collapseAllNodes,
    expandedNodeIds
  } = useHierarchyStore();

  const expandedCount = useMemo(() => {
    return expandedNodeIds.size;
  }, [expandedNodeIds]);

  const hasExpandedNodes = useMemo(() => {
    return expandedCount > 0;
  }, [expandedCount]);

  return {
    expandAll: expandAllNodes,
    collapseAll: collapseAllNodes,
    expandedCount,
    hasExpandedNodes,
    expandedNodeIds
  };
};