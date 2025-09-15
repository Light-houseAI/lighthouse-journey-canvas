import type { TimelineNodeView, TreeNode } from '../../types/profile';

// ============================================================================
// TIMELINE TRANSFORM UTILITIES
// ============================================================================
// Pure functions for transforming timeline data into tree structures
// Used by multiple stores and components

/**
 * Separates timeline nodes into current and past experiences
 * based on endDate presence and value
 */
export function separateExperiences(nodes: TimelineNodeView[]): {
  current: TimelineNodeView[];
  past: TimelineNodeView[];
} {
  return nodes.reduce(
    (acc, node) => {
      const endDate = node.meta?.endDate;
      if (!endDate || new Date(endDate) > new Date()) {
        acc.current.push(node);
      } else {
        acc.past.push(node);
      }
      return acc;
    },
    { current: [] as TimelineNodeView[], past: [] as TimelineNodeView[] }
  );
}

/**
 * Builds a hierarchical tree structure from flat timeline nodes
 * Returns tree nodes with parent-child relationships
 */
export function buildHierarchyTree(
  nodes: TimelineNodeView[],
  parentId: string | null = null,
  level: number = 0
): TreeNode[] {
  const childNodes = nodes.filter(node => node.parentId === parentId);
  
  return childNodes.map((node, index) => {
    const hasChildren = nodes.some(n => n.parentId === node.id);
    const isLastChild = index === childNodes.length - 1;
    
    const treeNode: TreeNode = {
      node: {
        ...node,
        depth: level,
        path: getNodePath(node.id, nodes),
      },
      isExpanded: false,
      isSelected: false,
      level,
      hasChildren,
      isLastChild,
      parentPath: getNodePath(node.id, nodes).slice(0, -1), // Exclude self from path
    };

    return treeNode;
  });
}

/**
 * Flattens a tree structure for display, respecting expanded/collapsed state
 * Only shows children of expanded nodes
 */
export function flattenTree(
  tree: TreeNode[],
  expandedIds: Set<string>,
  allNodes: TimelineNodeView[] = []
): TreeNode[] {
  const result: TreeNode[] = [];

  function traverse(nodes: TreeNode[]) {
    for (const treeNode of nodes) {
      result.push(treeNode);
      
      // If node is expanded and has children, include them
      if (treeNode.hasChildren && expandedIds.has(treeNode.node.id)) {
        const childNodes = buildHierarchyTree(
          allNodes.length > 0 ? allNodes : [treeNode.node], // Use allNodes if provided
          treeNode.node.id,
          treeNode.level + 1
        );
        traverse(childNodes);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Gets the breadcrumb path from root to a specific node
 * Returns array of node IDs representing the path
 */
export function getNodePath(nodeId: string, nodes: TimelineNodeView[]): string[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const path: string[] = [];
  
  function buildPath(id: string) {
    const node = nodeMap.get(id);
    if (!node) return;
    
    path.unshift(id);
    if (node.parentId) {
      buildPath(node.parentId);
    }
  }
  
  buildPath(nodeId);
  return path;
}

/**
 * Calculates the depth level of a node in the hierarchy
 * Root nodes have depth 0
 */
export function getNodeDepth(nodeId: string, nodes: TimelineNodeView[]): number {
  const path = getNodePath(nodeId, nodes);
  return path.length - 1; // Depth is path length minus 1 (root is 0)
}

/**
 * Filters nodes based on user permissions
 * Only returns nodes the user can perform the specified action on
 */
export function filterNodesByPermission(
  nodes: TimelineNodeView[],
  permission: 'view' | 'edit'
): TimelineNodeView[] {
  return nodes.filter(node => {
    switch (permission) {
      case 'view':
        return node.permissions.canView;
      case 'edit':
        return node.permissions.canEdit;
      default:
        return false;
    }
  });
}

/**
 * Sorts nodes by date (most recent first)
 * Handles both current (null endDate) and completed items
 */
export function sortNodesByDate(nodes: TimelineNodeView[]): TimelineNodeView[] {
  return [...nodes].sort((a, b) => {
    const aEndDate = a.meta?.endDate;
    const bEndDate = b.meta?.endDate;
    const aStartDate = a.meta?.startDate || '';
    const bStartDate = b.meta?.startDate || '';
    
    // Current items (null endDate) come first
    if (!aEndDate && bEndDate) return -1;
    if (aEndDate && !bEndDate) return 1;
    
    // Both current or both completed - sort by start date (most recent first)
    if (!aEndDate && !bEndDate) {
      return new Date(bStartDate).getTime() - new Date(aStartDate).getTime();
    }
    
    // Both completed - sort by end date (most recent first)
    return new Date(bEndDate!).getTime() - new Date(aEndDate!).getTime();
  });
}

/**
 * Computes all ancestor node IDs for a given node
 * Useful for expanding all parent nodes when selecting a deep child
 */
export function getAncestorIds(nodeId: string, nodes: TimelineNodeView[]): string[] {
  const path = getNodePath(nodeId, nodes);
  return path.slice(0, -1); // Exclude the node itself
}

/**
 * Computes all descendant node IDs for a given node
 * Useful for operations that affect entire subtrees
 */
export function getDescendantIds(nodeId: string, nodes: TimelineNodeView[]): string[] {
  const descendants: string[] = [];
  
  function findChildren(parentId: string) {
    const children = nodes.filter(n => n.parentId === parentId);
    for (const child of children) {
      descendants.push(child.id);
      findChildren(child.id); // Recursively find grandchildren
    }
  }
  
  findChildren(nodeId);
  return descendants;
}

/**
 * Validates that a tree structure is valid (no circular references, valid parent-child relationships)
 * Returns true if valid, false if issues found
 */
export function validateTreeStructure(nodes: TimelineNodeView[]): boolean {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // Check for circular references by traversing paths
  for (const node of nodes) {
    const visited = new Set<string>();
    let currentId = node.parentId;
    
    while (currentId !== null) {
      if (visited.has(currentId)) {
        return false; // Circular reference detected
      }
      visited.add(currentId);
      
      const parentNode = nodes.find(n => n.id === currentId);
      if (!parentNode) {
        return false; // Parent node doesn't exist
      }
      currentId = parentNode.parentId;
    }
  }
  
  return true;
}

// ============================================================================
// COMPOSITE TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Complete transformation pipeline for profile view
 * Takes raw timeline nodes and returns organized tree structures
 */
export function transformTimelineForProfile(nodes: TimelineNodeView[]): {
  currentTree: TreeNode[];
  pastTree: TreeNode[];
  allNodes: TimelineNodeView[];
  isValid: boolean;
} {
  // Validate structure first
  const isValid = validateTreeStructure(nodes);
  if (!isValid) {
    // Invalid tree structure detected in timeline nodes
  }
  
  // Separate current vs past experiences
  const { current, past } = separateExperiences(nodes);
  
  // Sort each group by date
  const sortedCurrent = sortNodesByDate(current);
  const sortedPast = sortNodesByDate(past);
  
  // Build tree structures
  const currentTree = buildHierarchyTree(sortedCurrent);
  const pastTree = buildHierarchyTree(sortedPast);
  
  return {
    currentTree,
    pastTree,
    allNodes: [...sortedCurrent, ...sortedPast],
    isValid,
  };
}