/**
 * Timeline Component - Hierarchical Timeline Implementation
 *
 * COMPLETELY REPLACED with new hierarchical system.
 * This component now uses the simplified meta-driven architecture with React Flow + Dagre.
 *
 * Legacy interface maintained for backward compatibility, but all functionality
 * is now handled by the HierarchicalTimeline component.
 */

import React, { useEffect } from 'react';

import { useTimelineStore } from '../../hooks/useTimelineStore';
import { HierarchicalTimeline } from './HierarchicalTimeline';

// Legacy interfaces (maintained for backward compatibility)
export interface TimelineNode {
  id: string;
  data: any;
  children?: TimelineNode[];
  parentId?: string;
}

export interface TimelineConfig {
  startX: number;
  startY: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  orientation: 'horizontal' | 'vertical';
  alignment: 'start' | 'center' | 'end';
  onPlusButtonClick?: (edgeData: any) => void;
}

export interface TimelineProps {
  nodes?: TimelineNode[]; // Legacy prop - no longer used
  config?: TimelineConfig; // Legacy prop - no longer used
  expandedNodes?: Set<string>;
  focusedNodeId?: string;
  selectedNodeId?: string;
  highlightedNodeId?: string;
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
}

/**
 * Timeline Component - New Hierarchical Implementation
 *
 * This component has been completely rewritten to use the hierarchical timeline system.
 * It automatically loads and displays user timeline data using the new v2 API.
 */
export const Timeline: React.FC<TimelineProps> = ({
  // Legacy props are ignored - maintained for compatibility
  nodes: legacyNodes,
  config: legacyConfig,
  expandedNodes: legacyExpandedNodes,

  // Still-relevant props
  focusedNodeId,
  selectedNodeId,
  className,
  style,
}) => {
  const timelineStore = useTimelineStore();

  // Load hierarchy data on mount
  useEffect(() => {
    // Check if we have the loadNodes method (current user store)
    if ('loadNodes' in timelineStore) {
      timelineStore.loadNodes();
    }
    // If we're in other user mode, loading is handled by the route
  }, [timelineStore]);

  // Sync legacy focused node with new store
  useEffect(() => {
    if (focusedNodeId) {
      timelineStore.focusNode(focusedNodeId);
    }
  }, [focusedNodeId, timelineStore]);

  // Sync legacy selected node with new store
  useEffect(() => {
    if (selectedNodeId) {
      timelineStore.selectNode(selectedNodeId);
    }
  }, [selectedNodeId, timelineStore]);

  // Log deprecation warning for legacy props (development only)
  useEffect(() => {
    if (import.meta.env.DEV) {
      if (legacyNodes && legacyNodes.length > 0) {
        console.warn(
          '⚠️ Timeline: Legacy "nodes" prop is deprecated. Data is now loaded automatically from the v2 API.'
        );
      }
      if (legacyConfig) {
        console.warn(
          '⚠️ Timeline: Legacy "config" prop is deprecated. Layout is now handled automatically by Dagre.'
        );
      }
      if (legacyExpandedNodes) {
        console.warn(
          '⚠️ Timeline: Legacy "expandedNodes" prop is deprecated. Expansion state is now managed internally.'
        );
      }
    }
  }, [legacyNodes, legacyConfig, legacyExpandedNodes]);

  return <HierarchicalTimeline className={className} style={style} />;
};

// Export the main Timeline component as default
export default Timeline;

// Re-export HierarchicalTimeline for direct usage
export { HierarchicalTimeline } from './HierarchicalTimeline';

/**
 * MIGRATION NOTES:
 *
 * This Timeline component has been completely rewritten using the new hierarchical system.
 *
 * WHAT'S NEW:
 * - ✅ Automatic data loading from v2 API
 * - ✅ Meta-driven node rendering (single UnifiedNode component)
 * - ✅ Modern side panel with shadcn components
 * - ✅ Focus mode and expansion system
 * - ✅ Automatic Dagre layout
 * - ✅ Real-time CRUD operations
 *
 * BREAKING CHANGES:
 * - `nodes` prop is no longer used (data loaded from API)
 * - `config` prop is deprecated (layout handled automatically)
 * - Type-specific node components are replaced with UnifiedNode
 * - Timeline positioning is now handled by Dagre algorithm
 *
 * BACKWARD COMPATIBILITY:
 * - Component interface maintained for existing usage
 * - Props are accepted but logged as deprecated in development
 * - focusedNodeId and selectedNodeId props still work
 *
 * For new implementations, use HierarchicalTimeline directly.
 */
