import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Calendar } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const EventNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  // Component-centric behavior composition
  const { focus, selection, highlight, interaction } = useNodeBehaviors(id);

  // Local state for hover
  const [isHovered, setIsHovered] = useState(false);

  // Calculate derived states using behavior composition
  const isHighlighted = highlight.isHighlighted || data.isHighlighted;
  const isFocused = focus.isFocused || data.isFocused;
  const isBlurred = focus.isBlurred && !isFocused;

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    selection.handleClick();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    highlight.handleMouseEnter();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    highlight.handleMouseLeave();
  };

  // Date formatting
  const dateRange = formatDateRange(data.startDate || data.start, data.endDate || data.end, {
    includePresent: false,
    format: 'short'
  });

  return (
    <BaseNode
      id={id}
      type="event"
      className={`
        group bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg
        border-2 border-indigo-400 rounded-xl p-4 w-80
        transform transition-all duration-300 ease-in-out
        ${selected ? 'ring-4 ring-indigo-300/50 scale-105' : ''}
        ${isHighlighted ? 'ring-2 ring-yellow-400/60 shadow-yellow-400/30' : ''}
        ${isFocused ? 'ring-4 ring-amber-400/80 shadow-2xl shadow-amber-400/40 scale-110' : ''}
        ${isHovered ? 'shadow-xl scale-102' : ''}
        ${isBlurred ? getBlurClasses(isBlurred, isFocused) : ''}
        hover:shadow-xl hover:scale-102
        cursor-pointer
      `}
      data={data}
      selected={selected}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      handles={data.handles}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          <Calendar className="w-5 h-5 text-indigo-200" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white leading-tight truncate">
            {data.title}
          </h3>

          {/* Event Type and Date */}
          <div className="flex items-center space-x-2 mt-1">
            {data.eventType && (
              <span className="text-xs bg-indigo-400/30 px-2 py-0.5 rounded-full text-indigo-100 capitalize">
                {data.eventType}
              </span>
            )}
            <span className="text-xs text-indigo-200">{dateRange}</span>
          </div>

          {/* Location */}
          {data.location && (
            <p className="text-xs text-indigo-200 mt-1">📍 {data.location}</p>
          )}

          {/* Description */}
          {data.description && (
            <p className="text-xs text-indigo-100 mt-2 line-clamp-2 opacity-90">
              {data.description}
            </p>
          )}

          {/* Organizer */}
          {data.organizer && (
            <p className="text-xs text-indigo-200 mt-1">
              <span className="opacity-75">by</span> {data.organizer}
            </p>
          )}
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(EventNode);