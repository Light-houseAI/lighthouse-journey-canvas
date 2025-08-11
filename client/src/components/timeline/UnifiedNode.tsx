/**
 * UnifiedNode - Meta-Driven Node Component
 *
 * Single component that handles all 6 node types through meta-field rendering.
 * Eliminates the need for type-specific components while providing rich
 * visualization and interaction capabilities.
 */

import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HierarchyNode } from '../../services/hierarchy-api';
import { ExpandChevron } from '../ui/expand-chevron';

// Props passed to UnifiedNode by React Flow
export interface UnifiedNodeData {
  node: HierarchyNode;
  isSelected: boolean;
  isFocused: boolean;
  isExpanded: boolean;
  hasChildren: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onAddChild: () => void; // New handler for adding child nodes
}

// React Flow node component
export const UnifiedNode: React.FC<NodeProps<UnifiedNodeData>> = ({
  data,
}) => {
  const {
    node,
    isSelected,
    isFocused,
    isExpanded,
    hasChildren,
    onSelect,
    onFocus,
    onExpand,
    onCollapse,
    onAddChild,
  } = data;

  // Local state for expansion to fix collapse issue
  const [localIsExpanded, setLocalIsExpanded] = useState(isExpanded);

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

  // Calculate visual state - keep all nodes visible and clear
  const opacity = 1.0; // Always full opacity
  // Remove blur effect to keep all details visible
  const shouldBlur = false;

  // Node styling - bright by default, blur only unfocused nodes
  const getNodeStyle = (): React.CSSProperties => {
    const baseColor = getNodeColor(node.type);
    const accentColor = getNodeAccentColor(node.type);
    const isHighlighted = isSelected || isFocused;

    return {
      // Always use bright, vibrant backgrounds
      background: isHighlighted
        ? `linear-gradient(135deg, ${baseColor}, ${accentColor})`
        : `linear-gradient(135deg, ${baseColor}f0, ${accentColor}f8)`,
      border: `3px solid ${isHighlighted ? '#ffffff' : accentColor}`,
      borderRadius: '16px',
      padding: '18px',
      width: '200px',
      height: '150px',
      boxShadow: isHighlighted
        ? `0 15px 50px ${baseColor}70, 0 8px 25px ${accentColor}50, inset 0 2px 4px rgba(255,255,255,0.4)`
        : `0 8px 25px ${baseColor}50, 0 4px 12px rgba(0, 0, 0, 0.25), inset 0 2px 4px rgba(255,255,255,0.3)`,
      opacity,
      // Add blur filter only for unfocused nodes
      filter: shouldBlur ? 'blur(2px)' : 'none',
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff', // White text
      fontWeight: '700', // Bold for maximum visibility
      textShadow: '0 2px 4px rgba(0,0,0,0.9)', // Strong dark shadow for contrast
      backdropFilter: shouldBlur ? 'blur(4px)' : 'none',
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


  return (
    <div
      style={getNodeStyle()}
      onClick={handleNodeClick}
      className="unified-node"
    >
      {/* Connection handles for React Flow */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ background: getNodeColor(node.type), border: 'none', width: 8, height: 8 }}
      />

      {/* Bottom handle for parent-child connections (only if has children) */}
      {hasChildren && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{ background: getNodeColor(node.type), border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Top handle for child nodes receiving parent connection */}
      {node.parentId && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ background: getNodeColor(node.type), border: 'none', width: 8, height: 8 }}
        />
      )}

      {/* Content Container - Prevent Overflow */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        textAlign: 'center',
        overflow: 'hidden',
        paddingRight: hasChildren ? '32px' : '8px', // Make room for chevron
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingLeft: '8px',
      }}>
        {/* Single Icon */}
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>
          {getNodeIcon(node.type)}
        </div>

        {/* Main Label - Truncate if too long */}
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'white',
          marginBottom: '4px',
          textShadow: '0 2px 4px rgba(0,0,0,0.9)',
          lineHeight: '1.2',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {node.label}
        </div>

        {/* Date Range - Only show if space available */}
        {(node.meta?.startDate || node.meta?.endDate) && (
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.85)',
            marginBottom: '4px',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {formatDateRange(node.meta.startDate, node.meta.endDate)}
          </div>
        )}

        {/* Type Badge - Smaller to fit */}
        <div style={{
          display: 'inline-block',
          padding: '2px 8px',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: '500',
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,255,255,0.3)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}>
          {formatNodeType(node.type)}
        </div>
      </div>

      {/* Expansion Chevron - TOP RIGHT (only if has children) */}
      {hasChildren && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
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


      {/* Add Child Plus Button - BOTTOM RIGHT */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAddChild();
        }}
        className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/40 hover:border-white/60 transition-all duration-200 flex items-center justify-center text-white hover:scale-110 shadow-lg"
        title="Add Child Node"
        style={{ zIndex: 10 }}
      >
        <span className="text-sm font-bold">+</span>
      </button>

      {/* Right handle for sibling connections (always present) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: getNodeColor(node.type), border: 'none', width: 8, height: 8 }}
      />
    </div>
  );
};

// Colors optimized for purple background with high contrast and readability
function getNodeColor(type: HierarchyNode['type']): string {
  const colors: Record<HierarchyNode['type'], string> = {
    job: '#06b6d4',           // Bright cyan - stands out against purple
    education: '#10b981',     // Bright emerald - complements purple
    project: '#f59e0b',       // Bright amber - warm contrast to purple
    event: '#f97316',         // Bright orange - vibrant against purple
    action: '#ef4444',        // Bright red - high contrast
    careerTransition: '#8b5cf6', // Lighter purple - tonal harmony
  };
  return colors[type] || '#64748b';
}

// Get accent color for better visual hierarchy
function getNodeAccentColor(type: HierarchyNode['type']): string {
  const accentColors: Record<HierarchyNode['type'], string> = {
    job: '#0891b2',           // Deeper cyan
    education: '#059669',     // Deeper emerald
    project: '#d97706',       // Deeper amber
    event: '#ea580c',         // Deeper orange
    action: '#dc2626',        // Deeper red
    careerTransition: '#7c3aed', // Deeper purple
  };
  return accentColors[type] || '#475569';
}

// Get icon for node type (same as NodeTypeRenderer)
function getNodeIcon(type: HierarchyNode['type']): string {
  const icons: Record<HierarchyNode['type'], string> = {
    job: '💼',
    education: '🎓',
    project: '🚀',
    event: '📅',
    action: '⚡',
    careerTransition: '🔄',
  };
  return icons[type] || '📋';
}

// Format date range for display
function formatDateRange(startDate?: string, endDate?: string): string {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
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
    return start;
  } else if (end) {
    return end;
  }
  return '';
}

// Format node type for display
function formatNodeType(type: HierarchyNode['type']): string {
  const typeLabels: Record<HierarchyNode['type'], string> = {
    job: 'Job',
    education: 'Education',
    project: 'Project',
    event: 'Event',
    action: 'Action',
    careerTransition: 'Job Transition',
  };
  return typeLabels[type] || type;
}


// Export the component
export default UnifiedNode;
