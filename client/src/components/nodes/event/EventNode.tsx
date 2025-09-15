/**
 * EventNode - Dedicated Event Node Component
 *
 * Specialized node component for event experiences with optimized layout
 * and event-specific information display.
 */

import { TimelineNode } from '@shared/schema';
import React, { useEffect, useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, NodeProps,Position } from 'reactflow';

import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { NodeIcon } from '../../icons/NodeIcons';
import { ExpandChevron } from '../../ui/expand-chevron';

// Props passed to EventNode by React Flow
export interface EventNodeData {
  node: TimelineNode;
  isSelected: boolean;
  isFocused: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onAddChild: () => void;
}

// React Flow node component
export const EventNode: React.FC<NodeProps<EventNodeData>> = ({
  data,
}) => {
  const {
    node,
    isSelected,
    isFocused,
    isExpanded,
    hasChildren,
    canEdit,
    onSelect,
    onFocus,
    onExpand,
    onCollapse,
    onAddChild,
  } = data;

  // Get global focus state from hierarchy store
  const { focusedNodeId } = useHierarchyStore();

  // Local state for expansion to fix collapse issue
  const [localIsExpanded, setLocalIsExpanded] = useState(isExpanded);
  
  // Hover tooltip state
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const nodeRef = useRef<HTMLDivElement>(null);

  // Sync local state with store state when it changes
  useEffect(() => {
    setLocalIsExpanded(isExpanded);
  }, [isExpanded]);

  // Use local state for expansion control
  const currentExpanded = localIsExpanded;

  // Local handlers for expansion state
  const handleExpand = () => {
    setLocalIsExpanded(true);
    onExpand();
  };

  const handleCollapse = () => {
    setLocalIsExpanded(false);
    onCollapse();
  };

  // Calculate visual state - handle focus mode
  const isInFocusMode = focusedNodeId !== null;
  const isThisFocusedNode = focusedNodeId === node.id;
  
  // Get focused node and check relationships
  const { getNodeById } = useHierarchyStore();
  const focusedNode = focusedNodeId ? getNodeById(focusedNodeId) : null;
  
  // Determine if this node should remain visible (not blurred)
  const shouldRemainVisible = !isInFocusMode || 
    isThisFocusedNode || // The focused node itself
    (focusedNode && node.parentId === focusedNode.id) || // Child of focused node
    (focusedNode && focusedNode.parentId === node.id) || // Parent of focused node
    (focusedNode && node.parentId === focusedNode.parentId && focusedNode.parentId !== null); // Sibling of focused node
  
  // Apply blur and opacity effects - only blur unrelated root nodes
  const opacity = shouldRemainVisible ? 1.0 : 0.4;
  const shouldBlur = !shouldRemainVisible;

  // Event-specific node styling with vibrant theme
  const getEventNodeStyle = (): React.CSSProperties => {
    const baseColor = '#f97316'; // Bright orange for events and milestones
    const accentColor = '#ea580c'; // Deeper orange
    const isHighlighted = isSelected || isFocused;

    return {
      // Vibrant gradient with event-specific colors
      background: isHighlighted
        ? `linear-gradient(135deg, ${baseColor}, ${accentColor}, ${baseColor})`
        : `linear-gradient(135deg, ${baseColor}f0, ${accentColor}f8, ${baseColor}f5)`,
      border: `2px solid ${isHighlighted ? '#ffffff' : 'rgba(255,255,255,0.3)'}`,
      borderRadius: '20px',
      padding: '0px',
      width: '240px', // Slightly wider for event info
      height: '180px', // Taller for event title + description info
      boxShadow: isHighlighted
        ? `0 20px 60px ${baseColor}40, 0 12px 35px ${accentColor}30, inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 1px rgba(255,255,255,0.1)`
        : `0 12px 35px ${baseColor}25, 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 0 1px rgba(255,255,255,0.05)`,
      opacity,
      filter: shouldBlur ? 'blur(2px)' : 'none',
      transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      fontWeight: '600',
      textShadow: '0 2px 8px rgba(0,0,0,0.6)',
      backdropFilter: shouldBlur ? 'blur(4px)' : 'blur(1px)',
      overflow: 'hidden',
    };
  };

  // Handle node click - ONLY opens side panel
  const handleNodeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Select node for side panel
    onSelect();

    // Focus node for hierarchy visualization
    onFocus();
  };

  // Handle mouse enter for tooltip (disabled when in focus mode)
  const handleMouseEnter = (e: React.MouseEvent) => {
    // Disable hover tooltip when any node is in focus mode
    if (!isInFocusMode) {
      setIsHovered(true);
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10, // Position above the node
      });
    }
  };

  // Handle mouse leave for tooltip
  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Extract event-specific data
  const title = node.meta?.title || node.title || 'Event';
  const description = node.meta?.description || '';

  return (
    <div
      ref={nodeRef}
      style={getEventNodeStyle()}
      onClick={handleNodeClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="event-node group relative transform hover:scale-[1.02] transition-transform duration-300"
    >
      {/* Vibrant background effects */}
      <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/5 via-transparent to-white/5"></div>
      
      {/* Animated border beam effect */}
      <div className="absolute inset-0 rounded-[20px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
      </div>
      
      {/* Connection handles for React Flow */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: '#f97316', border: 'none', width: 8, height: 8 }}
      />

      {/* Bottom handle for parent-child connections (only if has children) */}
      {hasChildren && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: '#f97316', border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Top handle for child nodes receiving parent connection */}
      {node.parentId && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: '#f97316', border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Event-specific layout: Icon+Label | Title | Description Preview | Actions */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between px-3">
        
        {/* Row 1: Icon and Type Label */}
        <div className="flex items-center justify-between pt-3">
          {/* Event Icon */}
          <div style={{ 
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 20px rgba(255,255,255,0.2))',
          }}>
            <NodeIcon 
              type="event" 
              size={24} 
              className="text-white opacity-95"
            />
          </div>
          
          {/* Event Type Label */}
          <div style={{
            padding: '2px 6px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))',
            borderRadius: '8px',
            fontSize: '9px',
            fontWeight: '600',
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.4)',
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.2px',
            textTransform: 'uppercase',
          }}>
            EVENT
          </div>
        </div>

        {/* Row 2: Event Information */}
        <div className="flex-1 flex flex-col justify-center text-center px-1">
          {/* Event Title */}
          <div style={{
            fontSize: '16px',
            fontWeight: '800',
            color: 'white',
            marginBottom: '6px',
            textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 16px rgba(255,255,255,0.1)',
            lineHeight: '1.2',
            letterSpacing: '0.3px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}>
            {title}
          </div>

          {/* Description Preview (if available) */}
          {description && (
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: 'rgba(255,255,255,0.9)',
              marginBottom: '4px',
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
              lineHeight: '1.3',
              letterSpacing: '0.1px',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}>
              {description}
            </div>
          )}

          {/* Date Range */}
          {(node.meta?.startDate || node.meta?.endDate) && (
            <div style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.75)',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              fontWeight: '500',
              letterSpacing: '0.1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {formatDateRange(node.meta.startDate, node.meta.endDate)}
            </div>
          )}
        </div>

        {/* Row 3: Actions (bottom area for chevron and add button) */}
        <div className="relative h-8">
          {/* This space is reserved for the chevron and add button which are positioned absolutely */}
        </div>
      </div>

      {/* Expansion Chevron - BOTTOM CENTER (only if has children) */}
      {hasChildren && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        >
          <ExpandChevron
            isExpanded={currentExpanded}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            size="sm"
            variant="glass"
            className="shadow-lg opacity-90 hover:opacity-100 transition-all duration-200 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full p-1"
          />
        </div>
      )}

      {/* Enhanced Add Child Plus Button - BOTTOM RIGHT - Only show for node owners */}
      {canEdit && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddChild();
          }}
          className="group absolute bottom-3 right-3 w-7 h-7 rounded-full bg-gradient-to-br from-white/25 to-white/15 hover:from-white/35 hover:to-white/25 backdrop-blur-sm border border-white/50 hover:border-white/70 transition-all duration-300 flex items-center justify-center text-white hover:scale-125 shadow-lg hover:shadow-xl overflow-hidden"
          title="Add Child Node"
          style={{ zIndex: 10 }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
          <span className="relative z-10 text-sm font-bold">+</span>
        </button>
      )}

      {/* Right handle for sibling connections (always present) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: '#f97316', border: 'none', width: 8, height: 8 }}
      />

      {/* Event-specific Hover Tooltip */}
      {isHovered && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltipPosition.x - 180, // Center tooltip (360px width / 2)
            top: tooltipPosition.y - 260, // Position above node (240px height + 20px gap)
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {/* Enhanced Event Tooltip */}
          <div
            style={{
              ...getEventNodeStyle(),
              width: '360px',
              height: '240px',
              transform: 'scale(1.15)',
              filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.4))',
              animation: 'tooltip-fade-in 200ms ease-out forwards',
            }}
            className="tooltip-popup"
          >
            {/* Enhanced background effects */}
            <div className="absolute inset-0 rounded-[20px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-100"></div>
            <div className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-white/10 via-transparent to-white/10"></div>
            
            <div className="relative z-10 h-full w-full flex flex-col justify-between px-4">
              
              {/* Row 1: Icon and Type Label */}
              <div className="flex items-center justify-between pt-4">
                {/* Event Icon */}
                <div style={{ 
                  filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.4)) drop-shadow(0 0 24px rgba(255,255,255,0.3))',
                }}>
                  <NodeIcon 
                    type="event" 
                    size={32} 
                    className="text-white opacity-95"
                  />
                </div>
                
                {/* Event Type Label */}
                <div style={{
                  padding: '4px 10px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.2))',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  backdropFilter: 'blur(12px)',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}>
                  EVENT
                </div>
              </div>

              {/* Row 2: Enhanced Event Information */}
              <div className="flex-1 flex flex-col justify-center text-center pb-4">
                {/* Event Title */}
                <div style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: 'white',
                  marginBottom: '8px',
                  textShadow: '0 3px 12px rgba(0,0,0,0.9), 0 0 20px rgba(255,255,255,0.2)',
                  lineHeight: '1.2',
                  letterSpacing: '0.4px',
                }}>
                  {title}
                </div>

                {/* Description */}
                {description && (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'rgba(255,255,255,0.95)',
                    marginBottom: '6px',
                    textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                    lineHeight: '1.4',
                    letterSpacing: '0.2px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}>
                    {description}
                  </div>
                )}

                {/* Date Range */}
                {(node.meta?.startDate || node.meta?.endDate) && (
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.8)',
                    textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                    fontWeight: '600',
                    letterSpacing: '0.3px',
                  }}>
                    {formatDateRange(node.meta.startDate, node.meta.endDate)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Format date range for display
function formatDateRange(startDate?: string, endDate?: string): string {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
    } catch {
      return dateString;
    }
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  if (start && end && start !== end) {
    return `${start} - ${end}`;
  } else if (start) {
    return `${start} - Present`;
  } else if (end) {
    return `Until ${end}`;
  }
  return '';
}

// Export the component
export default EventNode;