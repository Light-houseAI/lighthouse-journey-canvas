import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Calendar } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses, EventNodeData } from './shared/nodeUtils';
import { useUICoordinatorStore } from '@/stores/ui-coordinator-store';
import { useJourneyStore } from '@/stores/journey-store';
import { BaseNode } from './shared/BaseNode';

const EventNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Type assertion for data
  const eventData = data as EventNodeData;

  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);
  const { zoomToFocusedNode } = useUICoordinatorStore();
  const { setFocusedExperience } = useJourneyStore();

  // Local state for hover
  const [isHovered, setIsHovered] = useState(false);

  // Simplified focus/blur logic - each node calculates its own state
  const globalFocusedNodeId = eventData.globalFocusedNodeId;
  const isFocused = globalFocusedNodeId === id;
  const isBlurred = Boolean(globalFocusedNodeId && !isFocused && eventData.level === 0);
  const isHighlighted = eventData.isHighlighted || highlight.isHighlighted;

  // Color coding based on completion status
  const isCompleted = eventData.isCompleted || Boolean(eventData.endDate);
  const isOngoing = eventData.isOngoing || !eventData.endDate;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    console.log('🎯 EventNode clicked:', {
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
        start={eventData.startDate}
        end={eventData.endDate}
        isCompleted={isCompleted}
        isOngoing={isOngoing}
        isHighlighted={isHighlighted}
        isHovered={isHovered}
        hasExpandableContent={false}
        isExpanded={false}
        icon={<Calendar size={24} className="text-white filter drop-shadow-sm" />}
        nodeSize="medium"
        title={eventData.title}
        subtitle={eventData.eventType || undefined}
        dateText={formatDateRange(eventData.startDate, eventData.endDate)}
        description={eventData.description}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animationDelay={0.4}
      />
    </div>
  );
};

export default memo(EventNode);
