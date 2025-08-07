import React, { memo, useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useNodeBehaviors } from '@/hooks/useNodeBehaviors';
import { formatDateRange } from '@/utils/date-parser';
import { getBlurClasses } from './shared/nodeUtils';
import { BaseNode } from './shared/BaseNode';

const ActionNode: React.FC<NodeProps> = ({ data, selected, id }) => {
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

  // Category colors
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'achievement': return 'from-amber-500 to-orange-600 border-amber-400';
      case 'milestone': return 'from-green-500 to-emerald-600 border-green-400';
      case 'recognition': return 'from-purple-500 to-pink-600 border-purple-400';
      case 'certification': return 'from-blue-500 to-cyan-600 border-blue-400';
      default: return 'from-gray-500 to-slate-600 border-gray-400';
    }
  };

  const categoryColors = getCategoryColor(data.category);

  return (
    <BaseNode
      id={id}
      type="action"
      className={`
        group bg-gradient-to-br ${categoryColors} text-white shadow-lg
        border-2 rounded-xl p-4 w-80
        transform transition-all duration-300 ease-in-out
        ${selected ? 'ring-4 ring-amber-300/50 scale-105' : ''}
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
          <Zap className="w-5 h-5 text-amber-200" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white leading-tight truncate">
            {data.title}
          </h3>

          {/* Category and Date */}
          <div className="flex items-center space-x-2 mt-1">
            {data.category && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white/90 capitalize">
                {data.category}
              </span>
            )}
            <span className="text-xs text-white/80">{dateRange}</span>
          </div>

          {/* Description */}
          {data.description && (
            <p className="text-xs text-white/90 mt-2 line-clamp-2 opacity-90">
              {data.description}
            </p>
          )}

          {/* Impact */}
          {data.impact && (
            <p className="text-xs text-white/80 mt-1">
              <span className="opacity-75">Impact:</span> {data.impact}
            </p>
          )}

          {/* Verification */}
          {data.verification && (
            <p className="text-xs text-white/80 mt-1">
              <span className="opacity-75">Verified:</span> {data.verification}
            </p>
          )}
        </div>
      </div>
    </BaseNode>
  );
};

export default memo(ActionNode);