/**
 * Layout utilities for React Flow using Dagre
 * 
 * Provides timeline-specific layout configuration for horizontal
 * node positioning with proper parent-child hierarchy support.
 */

import dagre from '@dagrejs/dagre';
import { Node, Edge } from '@xyflow/react';
import { HierarchyNode } from '../services/hierarchy-api';

export interface LayoutDirection {
  direction: 'TB' | 'LR' | 'BT' | 'RL';
}

/**
 * Calculate the hierarchy depth of a node (how many levels deep from root)
 */
function calculateHierarchyDepth(node: Node, allNodes: Node[]): number {
  const nodeData = node.data?.node as HierarchyNode;
  
  // Root nodes are at depth 0
  if (!nodeData?.parentId) {
    return 0;
  }
  
  // Find parent and recursively calculate depth
  const parentNode = allNodes.find(n => n.id === nodeData.parentId);
  if (!parentNode) {
    return 1; // Default to depth 1 if parent not found
  }
  
  return 1 + calculateHierarchyDepth(parentNode, allNodes);
}

/**
 * Calculate layout positions using Dagre with timeline-specific configuration
 */
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'LR'
): { nodes: Node[]; edges: Edge[] } => {
  // Force horizontal layout only
  direction = 'LR';
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Timeline-specific Dagre configuration  
  const isHorizontalTimeline = direction === 'LR' || direction === 'RL';
  
  dagreGraph.setGraph({
    rankdir: direction,
    // Consistent spacing for all hierarchy levels
    nodesep: isHorizontalTimeline ? 180 : 140,    // Consistent horizontal spacing between nodes
    ranksep: isHorizontalTimeline ? 280 : 220,    // Larger vertical spacing between hierarchy levels
    edgesep: 20,                                  // More edge spacing to prevent overlaps
    marginx: 80,                                  // Margins for better layout
    marginy: 80,                                  // Margins for better layout
    align: 'DL',                                  // Down-Left alignment for consistent positioning
    acyclicer: 'greedy',                          // Handle cycles if any
    ranker: 'network-simplex'                     // Use network-simplex ranker for consistent levels
  });

  // Add only root nodes and plus buttons to Dagre (exclude child nodes)
  nodes.forEach((node) => {
    const nodeData = node.data?.node as HierarchyNode;
    const isChildNode = !!nodeData?.parentId;
    
    // Skip child nodes - they will be positioned manually
    if (isChildNode) return;
    
    // Use different dimensions based on node type
    const nodeWidth = getNodeWidth(node);
    const nodeHeight = getNodeHeight(node);
    
    dagreGraph.setNode(node.id, { 
      width: nodeWidth, 
      height: nodeHeight
    });
  });

  // Add only main timeline edges to Dagre (exclude hierarchy edges)
  edges.forEach((edge) => {
    // Skip hierarchy edges - they don't affect main timeline layout
    if (edge.id?.includes('hierarchy-') || edge.id?.includes('child-timeline-')) {
      return;
    }
    
    // Only include timeline edges for main timeline layout
    dagreGraph.setEdge(edge.source, edge.target, { 
      weight: 10,   // Higher weight for main timeline
      minlen: 1     // Normal rank separation
    });
  });

  // Calculate the layout
  dagre.layout(dagreGraph);

  // Map positions: Dagre for root nodes, manual for child nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeData = node.data?.node as HierarchyNode;
    const isChildNode = !!nodeData?.parentId;
    
    if (isChildNode) {
      // Child nodes get temporary position (will be adjusted below)
      return {
        ...node,
        position: { x: 0, y: 0 },
      };
    } else {
      // Root nodes use Dagre positioning
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
      };
    }
  });

  // Post-process: Adjust child nodes to position directly below their parents  
  const adjustedNodes = layoutedNodes.map((node) => {
    const nodeData = node.data?.node as HierarchyNode;
    const isChildNode = !!nodeData?.parentId;
    
    if (isChildNode) {
      // Find parent node
      const parentNode = layoutedNodes.find(n => n.id === nodeData.parentId);
      if (parentNode) {
        // Get all children of this parent
        const childrenOfParent = layoutedNodes.filter(n => {
          const childNodeData = n.data?.node as HierarchyNode;
          return childNodeData?.parentId === nodeData.parentId;
        });
        
        // Sort children by their Dagre X position to maintain relative ordering
        const sortedChildren = childrenOfParent.sort((a, b) => a.position.x - b.position.x);
        const childIndex = sortedChildren.findIndex(n => n.id === node.id);
        
        // Position children in horizontal timeline below parent
        const childSpacing = 300; // Consistent spacing
        const adjustedX = childIndex * childSpacing; // Relative to parent
        
        // Simple consistent 200px spacing between all hierarchy levels
        const consistentSpacing = 200;
        const adjustedY = consistentSpacing;
        
        return {
          ...node,
          position: {
            x: adjustedX,
            y: adjustedY,
          },
        };
      }
    }
    
    // Return original position for root nodes or if parent not found
    return node;
  });

  // Establish a fixed timeline Y-position and center all timeline nodes on it
  const timelineNodes = adjustedNodes.filter(node => {
    const nodeData = node.data as any;
    return ['unified', 'job', 'education', 'project', 'event', 'action', 'careerTransition'].includes(node.type) && nodeData?.node && !nodeData.node.parentId;
  });
  
  if (timelineNodes.length > 0) {
    // Use the standard timeline node height as reference for centering
    const STANDARD_NODE_HEIGHT = 140; // Standard timeline node height
    const TIMELINE_CENTER_Y = 200; // Fixed timeline center position
    
    // Center all timeline nodes on the fixed timeline
    timelineNodes.forEach(node => {
      // Position node so its center aligns with timeline center
      node.position.y = TIMELINE_CENTER_Y - STANDARD_NODE_HEIGHT / 2; // Y = 130 (so center is at 200)
    });
  }

  return { nodes: adjustedNodes, edges };
};

/**
 * Sort hierarchy nodes chronologically for timeline layout
 */
export const sortNodesByDate = (nodes: Node[]): Node[] => {
  return [...nodes].sort((a, b) => {
    // Extract start dates from node data
    const aDate = getNodeStartDate(a);
    const bDate = getNodeStartDate(b);
    
    // If both have dates, sort chronologically
    if (aDate && bDate) {
      return aDate.getTime() - bDate.getTime();
    }
    
    // Nodes without dates go to the end
    if (!aDate && bDate) return 1;
    if (aDate && !bDate) return -1;
    
    // If neither has dates, maintain original order
    return 0;
  });
};

/**
 * Get node width based on type and content
 */
function getNodeWidth(node: Node): number {
  // Plus buttons should be smaller but contribute to timeline spacing
  if (node.type === 'timelinePlus') {
    return 64; // Smaller width for plus buttons
  }
  // All other nodes same width for consistent timeline
  return 250;
}

/**
 * Get node height based on type and content
 */
function getNodeHeight(node: Node): number {
  // Plus buttons should have same height to align properly
  if (node.type === 'timelinePlus') {
    return 64; // Same as width for circular plus buttons
  }
  // All other nodes same height for consistent timeline
  return 140;
}

/**
 * Extract start date from node data
 */
function getNodeStartDate(node: Node): Date | null {
  const nodeData = node.data?.node as HierarchyNode;
  
  if (!nodeData?.meta?.startDate) {
    return null;
  }
  
  try {
    return new Date(nodeData.meta.startDate);
  } catch {
    return null;
  }
}

/**
 * Create timeline-specific layout configuration for different scenarios
 */
export const getTimelineLayoutConfig = (
  direction: 'TB' | 'LR' = 'LR',
  nodeCount: number = 0
) => {
  const isHorizontal = direction === 'LR' || direction === 'RL';
  
  // Adjust spacing based on number of nodes
  const spacingMultiplier = nodeCount > 10 ? 0.8 : 1;
  
  return {
    rankdir: direction,
    nodesep: Math.round((isHorizontal ? 200 : 150) * spacingMultiplier),
    ranksep: Math.round((isHorizontal ? 250 : 200) * spacingMultiplier),
    edgesep: 50,
    marginx: 60,
    marginy: 60,
    align: 'DL',
    acyclicer: 'greedy',
    ranker: 'network-simplex'
  };
};

/**
 * Filter nodes for layout based on expansion state
 */
export const filterNodesForLayout = (
  nodes: Node[],
  expandedNodeIds: Set<string>
): Node[] => {
  const filteredNodes = nodes.filter(node => {
    const nodeData = node.data?.node as HierarchyNode;
    
    // Always include root nodes (no parent)
    if (!nodeData?.parentId) {
      return true;
    }
    
    // Include child nodes only if parent is expanded
    return expandedNodeIds.has(nodeData.parentId);
  });
  
  return filteredNodes;
};

/**
 * Generate edges for hierarchical timelines with proper main timeline preservation
 */
export const generateTimelineEdges = (
  nodes: Node[],
  hierarchyEdges: { source: string; target: string }[]
): Edge[] => {
  const edges: Edge[] = [];
  
  // Separate root nodes and child nodes
  const rootNodes = nodes.filter(node => {
    const nodeData = node.data?.node as HierarchyNode;
    return !nodeData?.parentId && ['unified', 'job', 'education', 'project', 'event', 'action', 'careerTransition'].includes(node.type);
  });
  
  const childNodes = nodes.filter(node => {
    const nodeData = node.data?.node as HierarchyNode;
    return nodeData?.parentId && ['unified', 'job', 'education', 'project', 'event', 'action', 'careerTransition'].includes(node.type);
  });
  
  // Sort root nodes by date for main timeline - this is ALWAYS preserved
  const sortedRootNodes = sortNodesByDate(rootNodes);
  
  // 1. CREATE MAIN TIMELINE (connect consecutive nodes only)
  if (sortedRootNodes.length > 1) {
    // Connect ALL consecutive root nodes in main timeline
    for (let i = 0; i < sortedRootNodes.length - 1; i++) {
      const currentNode = sortedRootNodes[i];
      const nextNode = sortedRootNodes[i + 1];
      
      edges.push({
        id: `main-timeline-${currentNode.id}-${nextNode.id}`,
        source: currentNode.id,
        sourceHandle: 'right',
        target: nextNode.id,
        targetHandle: 'left',
        type: 'straight',
        style: {
          stroke: '#3b82f6',
          strokeWidth: 3,
        },
      });
    }
  }
  
  // 2. ADD HIERARCHY EDGES (parent to child connections)
  const parentIds = new Set(childNodes.map(node => {
    const nodeData = node.data?.node as HierarchyNode;
    return nodeData?.parentId;
  }).filter(Boolean));
  
  parentIds.forEach(parentId => {
    const childrenOfParent = childNodes.filter(node => {
      const nodeData = node.data?.node as HierarchyNode;
      return nodeData?.parentId === parentId;
    });
    
    const sortedChildren = sortNodesByDate(childrenOfParent);
    
    if (sortedChildren.length > 0) {
      // Connect parent to first child (creates hierarchy rank)
      const firstChild = sortedChildren[0];
      edges.push({
        id: `hierarchy-${parentId}-${firstChild.id}`,
        source: parentId!,
        sourceHandle: 'bottom',
        target: firstChild.id,
        targetHandle: 'top',
        type: 'straight',
        style: {
          stroke: '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: '8 4',
        },
      });
      
      // Connect consecutive children in their sub-timeline (same style as main timeline)
      for (let i = 0; i < sortedChildren.length - 1; i++) {
        const currentChild = sortedChildren[i];
        const nextChild = sortedChildren[i + 1];
        
        edges.push({
          id: `child-timeline-${currentChild.id}-${nextChild.id}`,
          source: currentChild.id,
          sourceHandle: 'right',
          target: nextChild.id,
          targetHandle: 'left',
          type: 'straight',
          style: {
            stroke: '#3b82f6', // Same blue color as main timeline
            strokeWidth: 3,    // Same thickness as main timeline
          },
        });
      }
    }
  });
  
  return edges;
};

export default {
  getLayoutedElements,
  sortNodesByDate,
  getTimelineLayoutConfig,
  filterNodesForLayout,
  generateTimelineEdges,
};