/**
 * WorkflowCanvas Component
 * Interactive workflow diagram with pan, zoom, and node interaction
 * Ported from journey-workflows project
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@journey/components';
import type { WorkflowNode, WorkflowConnection, FullWorkflow } from '../../types/workflow-canvas';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const PANEL_WIDTH = 400;

interface WorkflowCanvasProps {
  workflow: FullWorkflow;
  onNodeSelect?: (node: WorkflowNode | null) => void;
}

export function WorkflowCanvas({ workflow, onNodeSelect }: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  // Center canvas on mount
  useEffect(() => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setOffset({
        x: rect.width / 2 - 700,
        y: rect.height / 2 - 250,
      });
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: WorkflowNode) => {
      setSelectedNode(node);
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

  // Pan handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.3), 2));
  }, []);

  // Get anchor points for a node
  const getNodeAnchors = (nodeId: string) => {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node)
      return {
        top: { x: 0, y: 0 },
        bottom: { x: 0, y: 0 },
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
      };

    const centerX = node.position.x + NODE_WIDTH / 2;
    const centerY = node.position.y + NODE_HEIGHT / 2;

    return {
      top: { x: centerX, y: node.position.y },
      bottom: { x: centerX, y: node.position.y + NODE_HEIGHT },
      left: { x: node.position.x, y: centerY },
      right: { x: node.position.x + NODE_WIDTH, y: centerY },
    };
  };

  // Generate smooth cubic Bézier path between two nodes
  const generatePath = (conn: WorkflowConnection) => {
    const fromNode = workflow.nodes.find((n) => n.id === conn.from);
    const toNode = workflow.nodes.find((n) => n.id === conn.to);
    if (!fromNode || !toNode) return '';

    const fromAnchors = getNodeAnchors(conn.from);
    const toAnchors = getNodeAnchors(conn.to);

    const yDiff = toNode.position.y - fromNode.position.y;
    const isTargetBelow = yDiff > NODE_HEIGHT / 2;
    const isTargetAbove = yDiff < -NODE_HEIGHT / 2;
    const isSameRow = !isTargetBelow && !isTargetAbove;

    const clampOffset = (distance: number) => Math.min(Math.max(Math.abs(distance) * 0.4, 40), 160);

    // Horizontal flow (same row)
    if (isSameRow) {
      const from = fromAnchors.right;
      const to = toAnchors.left;
      const dx = to.x - from.x;
      const offset = clampOffset(dx);

      const cp1x = from.x + offset;
      const cp1y = from.y;
      const cp2x = to.x - offset;
      const cp2y = to.y;

      return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    }

    // Branching DOWN
    if (isTargetBelow) {
      const from = fromAnchors.bottom;
      const to = toAnchors.top;
      const dy = to.y - from.y;
      const offset = clampOffset(dy);

      const cp1x = from.x;
      const cp1y = from.y + offset;
      const cp2x = to.x;
      const cp2y = to.y - offset;

      return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    }

    // Returning UP
    if (isTargetAbove) {
      const from = fromAnchors.right;
      const to = toAnchors.bottom;

      const dx = to.x - from.x;
      const dy = from.y - to.y;
      const hOffset = clampOffset(dx);
      const vOffset = clampOffset(dy);

      const cp1x = from.x + hOffset;
      const cp1y = from.y;

      const cp2x = to.x;
      const cp2y = to.y + vOffset;

      return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
    }

    // Default: horizontal
    const from = fromAnchors.right;
    const to = toAnchors.left;
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  };

  // Check if connection is highlighted
  const isConnectionHighlighted = (conn: WorkflowConnection) => {
    return hoveredNode === conn.from || hoveredNode === conn.to;
  };

  return (
    <div className="h-[600px] flex flex-col bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 p-3 z-10 shadow-sm">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-blue-500" />
              <span className="text-gray-600">Consistent step</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-blue-200 border border-dashed border-blue-400" />
              <span className="text-gray-600">Situational step</span>
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 p-2 z-10 flex gap-2 shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.min(s * 1.2, 2))}>
            +
          </Button>
          <span className="text-sm text-gray-600 self-center px-2">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setScale((s) => Math.max(s * 0.8, 0.3))}>
            −
          </Button>
        </div>

        {/* Transformed Canvas Content */}
        <div
          className="absolute inset-0 transition-transform duration-75"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG for Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
              <marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#93c5fd" />
              </marker>
              <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
              </marker>
            </defs>
            {workflow.connections.map((conn, idx) => {
              const isHighlighted = isConnectionHighlighted(conn);
              const path = generatePath(conn);

              return (
                <path
                  key={idx}
                  d={path}
                  fill="none"
                  stroke={
                    isHighlighted ? '#2563eb' : conn.type === 'dashed' ? '#93c5fd' : '#3b82f6'
                  }
                  strokeWidth={isHighlighted ? 3 : 2}
                  strokeDasharray={conn.type === 'dashed' ? '8 4' : 'none'}
                  markerEnd={`url(#${isHighlighted ? 'arrowhead-highlight' : conn.type === 'dashed' ? 'arrowhead-dashed' : 'arrowhead'})`}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {/* Workflow Nodes */}
          {workflow.nodes.map((node) => (
            <WorkflowNodeCard
              key={node.id}
              node={node}
              isHovered={hoveredNode === node.id}
              isSelected={selectedNode?.id === node.id}
              onHover={setHoveredNode}
              onClick={handleNodeClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface WorkflowNodeCardProps {
  node: WorkflowNode;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (node: WorkflowNode) => void;
}

const WorkflowNodeCard = ({ node, isHovered, isSelected, onHover, onClick }: WorkflowNodeCardProps) => {
  const isConsistent = node.type === 'consistent';
  const isTooltipVisible = node.hasInsight;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(node);
  };

  return (
    <div
      className="absolute"
      style={{
        left: node.position.x,
        top: node.position.y,
        width: 160,
      }}
    >
      {/* Condition label for situational nodes */}
      {node.condition && (
        <div className="absolute -top-6 left-0 right-0 text-center">
          <span className="text-xs text-gray-500 italic">{node.condition}</span>
        </div>
      )}

      {/* Insight Tooltip */}
      {node.hasInsight && (
        <div
          className={`
            absolute -top-24 left-1/2 -translate-x-1/2 z-20
            transition-all duration-300 ease-out
            ${isTooltipVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
          `}
        >
          <div
            className="relative bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-blue-200"
            style={{
              boxShadow: '0 4px 24px -4px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)',
            }}
          >
            <div className="relative flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium whitespace-nowrap">Insight available</span>
              </div>
              <button
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all duration-150 shadow-sm"
                onClick={handleClick}
              >
                View
              </button>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white/95 border-r border-b border-blue-200" />
          </div>
        </div>
      )}

      <div
        className={`
          relative rounded-xl p-4 text-center cursor-pointer
          transition-all duration-200 border-2
          ${
            isConsistent
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-blue-100 text-gray-900 border-blue-300 border-dashed'
          }
          ${isHovered ? 'shadow-lg scale-105' : 'shadow-md'}
          ${isSelected ? 'ring-4 ring-blue-400 ring-offset-2 ring-offset-white shadow-2xl scale-110' : ''}
          ${isTooltipVisible && !isSelected ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-white shadow-xl scale-105' : ''}
          ${node.hasInsight && !isTooltipVisible && !isSelected ? 'ring-1 ring-blue-300' : ''}
        `}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={handleClick}
      >
        {node.hasInsight && isTooltipVisible && (
          <div className="absolute inset-0 rounded-xl bg-blue-500/10 pointer-events-none" />
        )}

        <span className={`relative z-10 text-sm font-medium leading-tight ${isConsistent ? '' : 'text-gray-900'}`}>
          {node.title}
        </span>
      </div>
    </div>
  );
};
