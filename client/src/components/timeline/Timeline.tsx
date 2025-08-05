import React, { useMemo } from 'react';
import { ReactFlow, Background, BackgroundVariant, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/nodes';
import { edgeTypes } from '@/components/edges';
import { sortItemsByDate, DateRange } from '@/utils/date-parser';

export interface TimelineNode extends DateRange {
  id: string;
  type: string;
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
  onNodeClick?: (nodeId: string, data: any) => void;
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
 * Node-agnostic Timeline component that can render any collection of nodes
 * Supports tree hierarchies with vertical parent-child connections
 */
/**
 * Hook that transforms timeline nodes into React Flow nodes and edges
 * Supports tree hierarchies with vertical parent-child connections
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
    console.log('Timeline: Processing nodes', nodes.length);
    
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
        (node) => node.start,
        (node) => node.end
      );
      
      // Calculate positions for this timeline level
      const positions = calculateTimelinePositions(sortedNodes, config, parentPosition, level);
      
      sortedNodes.forEach((timelineNode, index) => {
        const position = positions[index];
        
        // Determine if this node has children or has a parent for handle configuration
        const hasChildren = timelineNode.children && timelineNode.children.length > 0;
        const hasParent = Boolean(timelineNode.parentId);

        // Create React Flow node
        const reactFlowNode: Node = {
          id: timelineNode.id,
          type: timelineNode.type,
          position,
          data: {
            ...timelineNode.data,
            // Add behavior states
            isFocused: focusedNodeId === timelineNode.id,
            isBlurred: focusedNodeId && focusedNodeId !== timelineNode.id,
            isSelected: selectedNodeId === timelineNode.id,
            isHighlighted: highlightedNodeId === timelineNode.id,
            // Add completion status
            isCompleted: Boolean(timelineNode.end),
            isOngoing: !timelineNode.end,
            // Add tree level info
            level,
            parentId: timelineNode.parentId,
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
          addLeafNodePlusButton(timelineNode, position, config, reactFlowNodes, reactFlowEdges);
        }
        
        // Create horizontal connections within this timeline level
        if (index > 0) {
          const prevNode = sortedNodes[index - 1];
          const horizontalEdge: Edge = {
            id: `${prevNode.id}-to-${timelineNode.id}`,
            source: prevNode.id,
            target: timelineNode.id,
            // For child timelines (level > 0), connect through center instead of handles
            sourceHandle: level > 0 ? undefined : 'right',
            targetHandle: level > 0 ? undefined : 'left',
            type: 'straightTimeline',
            data: {
              insertionPoint: 'between',
              parentNode: {
                id: prevNode.id,
                title: prevNode.data.title,
                type: prevNode.type,
              },
              targetNode: {
                id: timelineNode.id,
                title: timelineNode.data.title,
                type: timelineNode.type,
              },
              onPlusButtonClick: config.onPlusButtonClick,
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
                type: timelineNode.type,
              },
              onPlusButtonClick: config.onPlusButtonClick,
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
        addTimelinePlusButtons(sortedNodes, config, reactFlowNodes, reactFlowEdges, level, Boolean(parentId), parentId);
      }
    };
    
    // Start processing from root nodes (nodes without parentId)
    const rootNodes = nodes.filter(node => !node.parentId);
    console.log('Timeline: Root nodes found', rootNodes.length);
    processTimelineLevel(rootNodes);
    
    console.log('Timeline: Generated', reactFlowNodes.length, 'nodes and', reactFlowEdges.length, 'edges');
    
    return { nodes: reactFlowNodes, edges: reactFlowEdges };
  }, [nodes, config, expandedNodes, focusedNodeId, selectedNodeId, highlightedNodeId]);

  console.log('Timeline: Rendering ReactFlow with', timelineData.nodes.length, 'nodes');
  console.log('Timeline: Available edge types:', Object.keys(edgeTypes));
  console.log('Timeline: Edges being passed:', timelineData.edges.map(e => ({ id: e.id, type: e.type, source: e.source, target: e.target })));
  
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
};;

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
    // Increase vertical spacing for child levels to provide more separation
    const verticalOffset = level > 0 ? config.verticalSpacing * 1.8 : config.verticalSpacing;
    const baseY = parentPosition ? parentPosition.y + verticalOffset : config.startY;
    
    let baseX: number;
    if (parentPosition && level > 0) {
      // For child timelines, position the first child directly below the parent
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
  parentId?: string
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
        insertionPoint: 'before',
        targetNode: {
          id: firstNode.id,
          title: firstNode.data.title,
          type: firstNode.type,
        },
        onPlusButtonClick: config.onPlusButtonClick,
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
      insertionPoint: 'after',
      parentNode: {
        id: lastNode.id,
        title: lastNode.data.title,
        type: lastNode.type,
      },
      onPlusButtonClick: config.onPlusButtonClick,
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
  reactFlowEdges: Edge[]
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
        type: node.type,
      },
      onPlusButtonClick: config.onPlusButtonClick,
    },
  };
  
  reactFlowNodes.push(leafPlusButton);
}

export default Timeline;