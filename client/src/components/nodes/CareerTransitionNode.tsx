import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { ArrowLeftRight } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const CareerTransitionNode: React.FC<NodeProps> = ({ data, selected, id }) => {
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

  // Transition type colors
  const getTransitionColor = (transitionType: string) => {
    switch (transitionType) {
      case 'promotion': return 'from-green-500 to-teal-600 border-green-400';
      case 'role_change': return 'from-blue-500 to-indigo-600 border-blue-400';
      case 'company_change': return 'from-orange-500 to-red-600 border-orange-400';
      case 'career_pivot': return 'from-purple-500 to-pink-600 border-purple-400';
      case 'break': return 'from-gray-500 to-slate-600 border-gray-400';
      default: return 'from-cyan-500 to-blue-600 border-cyan-400';
    }
  };

  const transitionColors = getTransitionColor(data.transitionType || 'default');

  return (
    <BaseNode
      id={id}
      type="careerTransition"
      className={`
        group bg-gradient-to-br ${transitionColors} text-white shadow-lg
        border-2 rounded-xl p-4 w-80
        transform transition-all duration-300 ease-in-out
        ${selected ? 'ring-4 ring-orange-300/50 scale-105' : ''}
        ${isHighlighted ? 'ring-2 ring-yellow-400/60 shadow-yellow-400/30' : ''}
        ${isFocused ? 'ring-4 ring-orange-400/80 shadow-2xl shadow-orange-400/40 scale-110' : ''}
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
          <ArrowLeftRight className="w-5 h-5 text-orange-200" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white leading-tight truncate">
            {data.title}
          </h3>

          {/* Transition Type and Date */}
          <div className="flex items-center space-x-2 mt-1">
            {data.transitionType && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white/90 capitalize">
                {data.transitionType.replace('_', ' ')}
              </span>
            )}
            <span className="text-xs text-white/80">{dateRange}</span>
          </div>

          {/* From/To Information */}
          {(data.fromRole || data.toRole) && (
            <div className="text-xs text-white/90 mt-2 space-y-1">
              {data.fromRole && (
                <p><span className="opacity-75">From:</span> {data.fromRole}</p>
              )}
              {data.toRole && (
                <p><span className="opacity-75">To:</span> {data.toRole}</p>
              )}
            </div>
          )}

          {/* Description */}
          {data.description && (
            <p className="text-xs text-white/90 mt-2 line-clamp-2 opacity-90">
              {data.description}
            </p>
          )}

          {/* Reason */}
          {data.reason && (
            <p className="text-xs text-white/80 mt-1">
              <span className="opacity-75">Reason:</span> {data.reason}
            </p>
          )}

          {/* Outcome */}
          {data.outcome && (
            <p className="text-xs text-white/80 mt-1">
              <span className="opacity-75">Outcome:</span> {data.outcome}
            </p>
          )}
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(CareerTransitionNode);