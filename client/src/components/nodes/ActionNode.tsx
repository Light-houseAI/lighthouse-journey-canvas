import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, ActionNodeData } from './shared/nodeUtils';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';
import { BaseNode } from './shared/BaseNode';

const ActionNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const actionData = data as ActionNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience } = useJourneyStore();

  // Local state for hover
  const [isHovered, setIsHovered] = useState(false);

  // Simplified focus/blur logic - each node calculates its own state
  const globalFocusedNodeId = actionData.globalFocusedNodeId;
  const isFocused = globalFocusedNodeId === id;
  const isBlurred = Boolean(globalFocusedNodeId && !isFocused && actionData.level === 0);
  const isHighlighted = actionData.isHighlighted || highlight.isHighlighted;

  // Color coding based on completion status
  const isCompleted = actionData.isCompleted || Boolean(actionData.endDate);
  const isOngoing = actionData.isOngoing || !actionData.endDate;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 ActionNode clicked:', {
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
        start={actionData.startDate}
        end={actionData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={false}
        isExpanded={false}
        icon={<Zap size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={actionData.title}
        subtitle={actionData.category || undefined}
        dateText={formatDateRange(actionData.startDate, actionData.endDate)}
        description={actionData.description}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animationDelay={0.3}
      />
    </div>
  );
};

export default memo(ActionNode);