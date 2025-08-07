import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { ArrowLeftRight } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, CareerTransitionNodeData } from './shared/nodeUtils';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';

import { BaseNode } from './shared/BaseNode';

const CareerTransitionNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const transitionData = data as CareerTransitionNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience, expandedNodeId, setExpandedNode } = useJourneyStore();

  // Expansion logic - single expanded node like focus
  const isExpanded = expandedNodeId === id;
  const hasExpandableContent = Boolean(transitionData.children && transitionData.children.length > 0);

  const handleToggleExpansion = () => {
    if (isExpanded) {
      // If already expanded, collapse it
      setExpandedNode(null);
    } else {
      // Expand this node (closes any other expanded node)
      setExpandedNode(id);
    }
  };

  // Local state for hover
  const [isHovered, setIsHovered] = useState(false);

  // Simplified focus/blur logic - each node calculates its own state
  const globalFocusedNodeId = transitionData.globalFocusedNodeId;
  const isFocused = globalFocusedNodeId === id;
  const isBlurred = Boolean(globalFocusedNodeId && !isFocused && transitionData.level === 0);
  const isHighlighted = transitionData.isHighlighted || highlight.isHighlighted;

  // Color coding based on completion status
  const isCompleted = transitionData.isCompleted || Boolean(transitionData.endDate);
  const isOngoing = transitionData.isOngoing || !transitionData.endDate;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 CareerTransitionNode clicked:', {
      nodeId: id,
      currentFocused: globalFocusedNodeId,
      isFocused
    });

    // Node handles its own focus directly
    if (isFocused) {
      // If already focused, clear focus
      setFocusedExperience(null);
    } else {
      // Focus this node
      setFocusedExperience(id);
      // Zoom to focused node
      setTimeout(() => {
        zoomToFocusedNode(id);
      }, 50);
    }
  };

  return (
    <div className={`${getBlurClasses(isBlurred, isFocused)}`}>
      <BaseNode
        id={id}
        start={transitionData.startDate}
        end={transitionData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={hasExpandableContent}
        isExpanded={isExpanded}
        icon={<ArrowLeftRight size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={transitionData.title}
        subtitle={transitionData.transitionType?.replace('_', ' ') || undefined}
        dateText={formatDateRange(transitionData.startDate, transitionData.endDate)}
        description={transitionData.description}
        onClick={handleClick}
        onExpandToggle={handleToggleExpansion}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animationDelay={0.5}
      />
    </div>
  );
};

export default memo(CareerTransitionNode);