/**
 * UI-specific hierarchy utilities
 * 
 * Contains client-side tree building and hierarchy operations for UI components.
 * Separates UI concerns from API data structures.
 */

import { TimelineNode } from '@journey/schema';

// UI-extended node type with computed fields for visualization
export interface HierarchyNode extends TimelineNode {
  // UI-computed fields
  children?: HierarchyNode[];
  level?: number;
}

// Tree structure for visualization
export interface HierarchyTree {
  nodes: HierarchyNode[];
  edges: { source: string; target: string }[];
}

/**
 * Build hierarchy tree from flat TimelineNode list
 * Client-side tree building for UI visualization
 */
export function buildHierarchyTree(nodes: TimelineNode[]): HierarchyTree {
  // Create lookup map for efficient parent-child relationships
  const nodeMap = new Map<string, HierarchyNode>();
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  const roots: HierarchyNode[] = [];
  const edges: { source: string; target: string }[] = [];

  // Build parent-child relationships and edge list
  nodes.forEach(node => {
    const nodeWithChildren = nodeMap.get(node.id)!;
    
    if (node.parentId && nodeMap.has(node.parentId)) {
      // Add to parent's children
      const parent = nodeMap.get(node.parentId)!;
      parent.children!.push(nodeWithChildren);
      
      // Add edge for React Flow
      edges.push({
        source: node.parentId,
        target: node.id,
      });
    } else {
      // Root node
      roots.push(nodeWithChildren);
    }
  });

  // Calculate levels for each node
  const calculateLevels = (nodes: HierarchyNode[], level: number = 0) => {
    nodes.forEach(node => {
      node.level = level;
      if (node.children && node.children.length > 0) {
        calculateLevels(node.children, level + 1);
      }
    });
  };

  calculateLevels(roots);

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

/**
 * Find root nodes (nodes without parents)
 */
export function findRoots(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.filter(node => !node.parentId);
}

/**
 * Find children of a specific node
 */
export function findChildren(nodeId: string, nodes: TimelineNode[]): TimelineNode[] {
  return nodes.filter(node => node.parentId === nodeId);
}

/**
 * Find ancestors of a specific node
 */
export function findAncestors(nodeId: string, nodes: TimelineNode[]): TimelineNode[] {
  const ancestors: TimelineNode[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  let currentNode = nodeMap.get(nodeId);
  while (currentNode?.parentId) {
    const parent = nodeMap.get(currentNode.parentId);
    if (parent) {
      ancestors.unshift(parent);
      currentNode = parent;
    } else {
      break;
    }
  }
  
  return ancestors;
}

/**
 * Get the complete subtree starting from a specific node
 */
export function getSubtree(nodeId: string, nodes: TimelineNode[]): TimelineNode[] {
  const result: TimelineNode[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  const traverse = (currentId: string) => {
    const node = nodeMap.get(currentId);
    if (node) {
      result.push(node);
      // Find children and traverse them
      nodes
        .filter(n => n.parentId === currentId)
        .forEach(child => traverse(child.id));
    }
  };
  
  traverse(nodeId);
  return result;
}

/**
 * Validate that a move operation won't create cycles
 */
export function validateMove(nodeId: string, newParentId: string | null, nodes: TimelineNode[]): boolean {
  if (!newParentId) return true; // Moving to root is always safe
  
  // Check if the new parent is a descendant of the node being moved
  const subtree = getSubtree(nodeId, nodes);
  return !subtree.some(node => node.id === newParentId);
}

/**
 * Convert TimelineNode to HierarchyNode with UI extensions
 */
export function toHierarchyNode(node: TimelineNode): HierarchyNode {
  return {
    ...node,
    children: [],
    level: 0,
  };
}

/**
 * Convert HierarchyNode back to pure TimelineNode (removes UI fields)
 */
export function toTimelineNode(node: HierarchyNode): TimelineNode {
  const { children, level, ...timelineNode } = node;
  return timelineNode;
}