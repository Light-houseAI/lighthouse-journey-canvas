/**
 * Shared types and utilities for timeline stores
 */

import type { TimelineNode, TimelineNodeWithPermissions } from '@shared/schema';

// Extended node type with UI state and permissions
export interface HierarchyNode extends TimelineNodeWithPermissions {
  level: number;
  isRoot: boolean;
  hasParent: boolean;
  childCount: number;
}

// Tree structure for React Flow
export interface HierarchyTree {
  nodes: HierarchyNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
  }>;
}

// Base timeline state interface
export interface BaseTimelineState {
  // Data
  nodes: HierarchyNode[];
  tree: HierarchyTree;
  hasData: boolean;
  
  // Loading states
  loading: boolean;
  error: string | null;

  // Selection state
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  showPanel: boolean;
  panelMode: 'view' | 'edit';

  // UI state
  expandedNodeIds: Set<string>;

  // Getters
  getNodeById: (nodeId: string) => HierarchyNode | undefined;
  getChildren: (nodeId: string) => HierarchyNode[];
  hasChildren: (nodeId: string) => boolean;
  isNodeExpanded: (nodeId: string) => boolean;

  // Selection actions
  selectNode: (nodeId: string | null) => void;
  focusNode: (nodeId: string | null) => void;
  clearFocus: () => void;
  
  // UI actions
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNode: (nodeId: string) => void;
}

// Utility functions that can be shared between stores
export const findChildren = (parentId: string, allNodes: HierarchyNode[]): HierarchyNode[] => {
  return allNodes.filter(node => node.parentId === parentId);
};

export const findRoots = (nodes: TimelineNode[]): TimelineNode[] => {
  return nodes.filter(node => !node.parentId);
};

export const buildHierarchyTree = (apiNodes: TimelineNodeWithPermissions[]): HierarchyTree => {
  // Convert API nodes to hierarchy nodes with UI extensions
  const hierarchyNodes: HierarchyNode[] = apiNodes.map((node) => ({
    ...node,
    level: calculateNodeLevel(node, apiNodes),
    isRoot: !node.parentId,
    hasParent: !!node.parentId,
    childCount: apiNodes.filter(n => n.parentId === node.id).length,
  }));

  // Build edges for React Flow
  const edges = hierarchyNodes
    .filter(node => node.parentId)
    .map(node => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id,
      type: 'hierarchyEdge',
    }));

  return {
    nodes: hierarchyNodes,
    edges,
  };
};

const calculateNodeLevel = (node: TimelineNodeWithPermissions, allNodes: TimelineNodeWithPermissions[]): number => {
  if (!node.parentId) return 0;
  
  const parent = allNodes.find(n => n.id === node.parentId);
  if (!parent) return 0;
  
  return 1 + calculateNodeLevel(parent, allNodes);
};

// Common store actions factory
export const createBaseTimelineActions = () => ({
  selectNode: (nodeId: string | null, set: any) => {
    set({
      selectedNodeId: nodeId,
      showPanel: nodeId !== null,
      panelMode: 'view', // Always reset to view mode when selecting
    });

    if (nodeId) {
      console.log('📌 Node selected:', nodeId);
    }
  },

  focusNode: (nodeId: string | null, set: any, get: any) => {
    set({ focusedNodeId: nodeId });

    if (nodeId) {
      console.log('🎯 Node focused:', nodeId);

      // Auto-expand focused node if it has children
      const { hasChildren, expandNode } = get();
      if (hasChildren(nodeId)) {
        expandNode(nodeId);
      }
    }
  },

  clearFocus: (set: any) => {
    set({ focusedNodeId: null });
    console.log('🔄 Focus cleared');
  },

  expandNode: (nodeId: string, set: any, get: any) => {
    const { expandedNodeIds } = get();
    const newExpanded = new Set(expandedNodeIds);
    newExpanded.add(nodeId);
    set({ expandedNodeIds: newExpanded });
    console.log('📂 Node expanded:', nodeId);
  },

  collapseNode: (nodeId: string, set: any, get: any) => {
    const { expandedNodeIds } = get();
    const newExpanded = new Set(expandedNodeIds);
    newExpanded.delete(nodeId);
    set({ expandedNodeIds: newExpanded });
    console.log('📁 Node collapsed:', nodeId);
  },

  toggleNode: (nodeId: string, set: any, get: any) => {
    const { isNodeExpanded, expandNode, collapseNode } = get();
    
    if (isNodeExpanded(nodeId)) {
      collapseNode(nodeId);
    } else {
      expandNode(nodeId);
    }
  },
});

// Common getters factory
export const createBaseTimelineGetters = () => ({
  getNodeById: (nodeId: string, get: any) => {
    const { nodes } = get();
    return nodes.find((node: HierarchyNode) => node.id === nodeId);
  },

  getChildren: (nodeId: string, get: any) => {
    const { nodes } = get();
    return findChildren(nodeId, nodes);
  },

  hasChildren: (nodeId: string, get: any) => {
    const { getChildren } = get();
    return getChildren(nodeId).length > 0;
  },

  isNodeExpanded: (nodeId: string, get: any) => {
    const { expandedNodeIds } = get();
    return expandedNodeIds.has(nodeId);
  },
});