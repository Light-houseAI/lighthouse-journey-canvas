import React, { useMemo } from 'react';
import { ReactFlow, Background, BackgroundVariant, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { sortItemsByDate, DateRange } from '@/utils/date-parser';

export interface TimelineNode {
  id: string;
  data: any;
  children?: TimelineNode[];
  parentId?: string;
}

export interface TimelineConfig {
  // Timeline positioning
  startX: number;
  startY: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  
  // Visual options
  orientation: 'horizontal' | 'vertical';
  alignment: 'start' | 'center' | 'end';
  
  // Interaction options
  onPlusButtonClick?: (edgeData: any) => void;
}

export interface TimelineProps {
  nodes: TimelineNode[];
  config: TimelineConfig;
  expandedNodes?: Set<string>;
  focusedNodeId?: string;
  selectedNodeId?: string;
  highlightedNodeId?: string;
  // React Flow props
  className?: string;
  style?: React.CSSProperties;
  onPaneClick?: () => void;
  onInit?: (instance: any) => void;
  fitView?: boolean;
  fitViewOptions?: {
    padding?: number;
    includeHiddenNodes?: boolean;
    minZoom?: number;
    maxZoom?: number;
  };
  minZoom?: number;
  maxZoom?: number;
  panOnScroll?: boolean;
  zoomOnScroll?: boolean;
}

/**
 * Timeline component that renders nodes with proper focus/blur behavior
 * When a node is focused, all other primary timeline nodes are blurred
 */
export const Timeline: React.FC<TimelineProps> = ({
  nodes,
  config,
  expandedNodes = new Set(),
  focusedNodeId,
  selectedNodeId,
  highlightedNodeId,
  className = "timeline-flow",
  style = { background: 'transparent' },
  onPaneClick,
  onInit,
  fitView = true,
  fitViewOptions = {
    padding: 0.3,
    includeHiddenNodes: false,
    minZoom: 0.4,
    maxZoom: 1.2,
  },
  minZoom = 0.2,
  maxZoom = 1.8,
  panOnScroll = true,
  zoomOnScroll = false,
}: TimelineProps) => {
  
  const timelineData = useMemo(() => {
    console.log('Timeline: Processing', nodes.length, 'nodes');
    console.log('Timeline: Input nodes:', nodes);
    
    const reactFlowNodes: Node[] = [];
    const reactFlowEdges: Edge[] = [];
    
    // Process nodes recursively to support unlimited nesting
    const processTimelineLevel = (
      timelineNodes: TimelineNode[],
      parentPosition?: { x: number; y: number },
      parentId?: string,
      level: number = 0
    ) => {
      // Sort nodes by date for this timeline level
      const sortedNodes = sortItemsByDate(
        timelineNodes,
        (node) => node.data?.startDate || node.data?.start,
        (node) => node.data?.endDate || node.data?.end
      );
      
      // Calculate positions for this timeline level
      const positions = calculateTimelinePositions(sortedNodes, config, parentPosition, level);
      
      sortedNodes.forEach((timelineNode, index) => {
        const position = positions[index];
        
        // Determine if this node has children or has a parent for handle configuration
        const hasChildren = timelineNode.children && timelineNode.children.length > 0;
        const hasParent = Boolean(timelineNode.parentId);

        // Determine node type from the data
        const nodeType = timelineNode.data?.type || 
                        (timelineNode.data?.degree ? 'education' : 
                         timelineNode.data?.company ? 'job' : 
                         timelineNode.data?.technologies ? 'project' :
                         timelineNode.data?.eventType ? 'event' :
                         timelineNode.data?.category ? 'action' :
                         timelineNode.data?.transitionType ? 'careerTransition' : 'job');

        // Let individual nodes calculate their own focus/blur state
        // Just pass the global focused node ID for reference

        // Create React Flow node
        const reactFlowNode: Node = {
          id: timelineNode.id,
          type: nodeType,
          position,
          data: {
            ...timelineNode.data,
            // Pass global focus state for reference - let nodes calculate their own blur state
            globalFocusedNodeId: focusedNodeId,
            isSelected: selectedNodeId === timelineNode.id,
            isHighlighted: highlightedNodeId === timelineNode.id,
            // Add completion status
            isCompleted: Boolean(timelineNode.data?.endDate || timelineNode.data?.end),
            isOngoing: !(timelineNode.data?.endDate || timelineNode.data?.end),
            // Add tree level info
            level,
            parentId: timelineNode.parentId,
            // Removed onNodeClick - nodes handle their own focus directly
            // Add handle configuration for parent-child connections
            handles: {
              left: true,    // Standard horizontal connections
              right: true,   // Standard horizontal connections
              bottom: hasChildren,  // Bottom handle if this node has children
              top: hasParent,       // Top handle if this node has a parent
            },
          },
        };
        
        reactFlowNodes.push(reactFlowNode);
        
        // Add plus button below leaf nodes (nodes without children)
        if (!hasChildren && !expandedNodes.has(timelineNode.id)) {
          addLeafNodePlusButton(timelineNode, position, config, reactFlowNodes, reactFlowEdges, focusedNodeId);
        }
        
        // Create horizontal connections within this timeline level
        if (index > 0) {
          const prevNode = sortedNodes[index - 1];
          const prevNodeType = prevNode.data?.type || 
                               (prevNode.data?.degree ? 'education' : 
                                prevNode.data?.company ? 'job' : 
                                prevNode.data?.technologies ? 'project' :
                                prevNode.data?.eventType ? 'event' :
                                prevNode.data?.category ? 'action' :
                                prevNode.data?.transitionType ? 'careerTransition' : 'job');
          
          const horizontalEdge: Edge = {
            id: `${prevNode.id}-to-${timelineNode.id}`,
            source: prevNode.id,
            target: timelineNode.id,
            // For child timelines (level > 0), connect through center instead of handles
            sourceHandle: level > 0 ? undefined : 'right',
            targetHandle: level > 0 ? undefined : 'left',
            type: 'straightTimeline',
            data: {
              insertionPoint: 'timeline-between',
              parentNode: {
                id: prevNode.id,
                title: prevNode.data.title,
                type: prevNodeType,
              },
              targetNode: {
                id: timelineNode.id,
                title: timelineNode.data.title,
                type: nodeType,
              },
              onPlusButtonClick: config.onPlusButtonClick,
              globalFocusedNodeId: focusedNodeId, // Pass focus state for blur logic
            },
          };
          reactFlowEdges.push(horizontalEdge);
        }
        
        // Create vertical connection to parent (if this is a child timeline)
        if (parentId && index === 0) {
          const verticalEdge: Edge = {
            id: `${parentId}-to-child-timeline-${timelineNode.id}`,
            source: parentId,
            target: timelineNode.id,
            type: 'secondaryTimeline', // Dashed line for parent-child connection
            sourceHandle: 'bottom', // Connect from bottom of parent
            targetHandle: 'top',    // Connect to top of child
            data: {
              insertionPoint: 'branch',
              parentNode: {
                id: parentId,
                type: 'parent',
              },
              targetNode: {
                id: timelineNode.id,
                title: timelineNode.data.title,
                type: nodeType,
              },
              onPlusButtonClick: config.onPlusButtonClick,
              globalFocusedNodeId: focusedNodeId, // Pass focus state for blur logic
            },
          };
          reactFlowEdges.push(verticalEdge);
        }
        
        // Process children recursively if node is expanded
        if (timelineNode.children && timelineNode.children.length > 0 && expandedNodes.has(timelineNode.id)) {
          processTimelineLevel(
            timelineNode.children,
            position,
            timelineNode.id,
            level + 1
          );
        }
      });
      
      // Add plus buttons at timeline ends for this level
      if (sortedNodes.length > 0) {
        addTimelinePlusButtons(sortedNodes, config, reactFlowNodes, reactFlowEdges, level, Boolean(parentId), parentId, focusedNodeId);
      }
    };
    
    // Start processing from root nodes (nodes without parentId)
    const rootNodes = nodes.filter(node => !node.parentId);
    console.log('Timeline: Root nodes found', rootNodes.length);
    console.log('Timeline: Root nodes:', rootNodes);
    
    if (rootNodes.length === 0) {
      // No nodes exist - add a start plus button as the only component
      const emptyTimelineStartButton: Node = {
        id: 'empty-timeline-start-plus',
        type: 'plusNode',
        position: {
          x: config.startX,
          y: config.startY,
        },
        data: {
          type: 'timelineStart',
          insertionPoint: 'timeline-start',
          parentNode: null,
          targetNode: null,
          onPlusButtonClick: config.onPlusButtonClick,
          globalFocusedNodeId: focusedNodeId,
        },
      };
      reactFlowNodes.push(emptyTimelineStartButton);
    } else {
      processTimelineLevel(rootNodes);
    }
    
    console.log('Timeline: Generated', reactFlowNodes.length, 'nodes and', reactFlowEdges.length, 'edges');
    
    return { nodes: reactFlowNodes, edges: reactFlowEdges };
  }, [nodes, config, expandedNodes, focusedNodeId, selectedNodeId, highlightedNodeId]);

  console.log('Timeline: Rendering ReactFlow with', timelineData.nodes.length, 'nodes');
  
  return (
    <ReactFlow
      onInit={onInit}
      nodes={timelineData.nodes}
      edges={timelineData.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      onPaneClick={onPaneClick}
      fitView={fitView}
      fitViewOptions={fitViewOptions}
      minZoom={minZoom}
      maxZoom={maxZoom}
      className={className}
      style={style}
      panOnScroll={panOnScroll}
      zoomOnScroll={zoomOnScroll}
      attributionPosition="bottom-center"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgba(168, 85, 247, 0.2)"
      />
    </ReactFlow>
  );
};

/**
 * Calculate positions for nodes in a timeline level
 */
function calculateTimelinePositions(
  nodes: TimelineNode[],
  config: TimelineConfig,
  parentPosition?: { x: number; y: number },
  level: number = 0
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  if (config.orientation === 'horizontal') {
    // Horizontal timeline layout
    // For child levels, position them directly below parent with consistent spacing
    const verticalOffset = config.verticalSpacing;
    // For child nodes, center them on the connecting line by offsetting by half node height (40px for medium nodes)
    const nodeHeight = 80; // Default medium node size (w-20 h-20 = 80px)
    const childYOffset = parentPosition && level > 0 ? nodeHeight / 2 : 0;
    const baseY = parentPosition ? parentPosition.y + verticalOffset - childYOffset : config.startY;
    
    let baseX: number;
    if (parentPosition && level > 0) {
      // For child timelines, start directly below the parent node
      baseX = parentPosition.x;
    } else {
      baseX = config.startX;
    }
    
    nodes.forEach((node, index) => {
      positions.push({
        x: baseX + (index * config.horizontalSpacing),
        y: baseY,
      });
    });
  } else {
    // Vertical timeline layout
    const baseX = parentPosition ? parentPosition.x + config.horizontalSpacing : config.startX;
    const baseY = parentPosition ? parentPosition.y : config.startY;
    
    nodes.forEach((node, index) => {
      positions.push({
        x: baseX,
        y: baseY + (index * config.verticalSpacing),
      });
    });
  }
  
  return positions;
}

/**
 * Add plus buttons at the start and end of a timeline
 */
function addTimelinePlusButtons(
  nodes: TimelineNode[],
  config: TimelineConfig,
  reactFlowNodes: Node[],
  reactFlowEdges: Edge[],
  level: number,
  hasParent: boolean = false,
  parentId?: string,
  focusedNodeId?: string
) {
  if (nodes.length === 0) return;
  
  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  
  // For child timelines, we need to calculate positions relative to the parent
  const firstNodePosition = reactFlowNodes.find(n => n.id === firstNode.id)?.position;
  const lastNodePosition = reactFlowNodes.find(n => n.id === lastNode.id)?.position;
  
  if (!firstNodePosition || !lastNodePosition) return;
  
  // Only add start plus button for root timelines (no parent)
  if (!hasParent) {
    const startPlusButton: Node = {
      id: parentId ? `timeline-start-plus-level-${level}-parent-${parentId}` : `timeline-start-plus-level-${level}`,
      type: 'plusNode',
      position: {
        x: firstNodePosition.x - config.horizontalSpacing * 0.4 + 17, // Centered with node
        y: firstNodePosition.y + 17, // Centered with node
      },
      data: {
        type: 'timelineStart',
        insertionPoint: 'timeline-start',
        parentNode: null, // No parent for timeline start
        targetNode: {
          id: firstNode.id,
          title: firstNode.data.title,
          type: firstNode.data?.type || 'node',
        },
        onPlusButtonClick: config.onPlusButtonClick,
        globalFocusedNodeId: focusedNodeId, // Pass focus state for blur logic
      },
    };
    
    reactFlowNodes.push(startPlusButton);
  }
  
  // Always add end plus button for all timelines
  const endPlusButton: Node = {
    id: parentId ? `timeline-end-plus-level-${level}-parent-${parentId}` : `timeline-end-plus-level-${level}`,
    type: 'plusNode',
    position: {
      x: lastNodePosition.x + config.horizontalSpacing * 0.4 + 17, // Centered with node
      y: lastNodePosition.y + 17, // Centered with node
    },
    data: {
      type: 'timelineEnd',
      insertionPoint: hasParent ? 'child' : 'timeline-end', // For child timelines, this is adding to parent
      parentNode: hasParent && parentId ? (() => {
        // Find the actual parent node to get its real type
        const parentNode = reactFlowNodes.find(n => n.id === parentId);
        const parentNodeType = parentNode?.data?.type || parentNode?.type || 'job'; // Default to 'job' if not found
        return {
          id: parentId, // Use the actual parent node ID for child timelines
          title: parentNode?.data?.title || 'Parent Node', // Use actual title if available
          type: parentNodeType, // Use the actual parent node type
        };
      })() : {
        id: lastNode.id,
        title: lastNode.data.title,
        type: lastNode.data?.type || 'node',
      },
      targetNode: null, // No target for timeline end
      onPlusButtonClick: config.onPlusButtonClick,
      globalFocusedNodeId: focusedNodeId, // Pass focus state for blur logic
    },
  };
  
  reactFlowNodes.push(endPlusButton);
}

/**
 * Add plus button below leaf nodes (nodes without children)
 */
function addLeafNodePlusButton(
  node: TimelineNode,
  nodePosition: { x: number; y: number },
  config: TimelineConfig,
  reactFlowNodes: Node[],
  reactFlowEdges: Edge[],
  focusedNodeId?: string
) {
  // Create plus button node below the leaf node
  const leafPlusButton: Node = {
    id: `leaf-plus-${node.id}`,
    type: 'plusNode',
    position: {
      x: nodePosition.x + 17, // Center-aligned with parent node center
      y: nodePosition.y + config.verticalSpacing * 0.6, // Position below node
    },
    data: {
      type: 'leafNode',
      insertionPoint: 'child',
      parentNode: {
        id: node.id,
        title: node.data.title,
        type: node.data?.type || 'node',
      },
      targetNode: null, // No target for leaf node child creation
      onPlusButtonClick: config.onPlusButtonClick,
      globalFocusedNodeId: focusedNodeId, // Pass focus state for blur logic
    },
  };
  
  reactFlowNodes.push(leafPlusButton);
}

export default Timeline;