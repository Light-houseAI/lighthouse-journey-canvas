import React, { ReactNode, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { ExpandChevron } from '@/components/ui/expand-chevron';
import { getNodeStyling, getNodeClasses, getGlowRingClasses, getLabelStyling } from './nodeStyleUtils';

export interface BaseNodeProps {
  // Core node data
  id: string;
  start?: string;
  end?: string;
  isCompleted?: boolean;
  isOngoing?: boolean;
  isSuggested?: boolean;
  suggestedReason?: string;

  // Visual states
  isHighlighted?: boolean;
  isHovered?: boolean;
  hasExpandableContent?: boolean; // Still kept for backward compatibility but not used for chevron visibility
  isExpanded?: boolean; // Optional external control, otherwise uses internal state

  // Customization
  icon: ReactNode;
  nodeSize?: 'small' | 'medium' | 'large';

  // Label content
  title: string;
  subtitle?: string;
  dateText?: string;
  description?: string;
  customContent?: ReactNode;

  // Interaction handlers
  onClick?: (e: React.MouseEvent) => void;
  onExpandToggle?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;

  // Handle configuration
  handles?: {
    left?: boolean;
    right?: boolean;
    top?: boolean;
    bottom?: boolean;
    leftSource?: boolean;
  };

  // Animation customization
  animationDelay?: number;
  showGlow?: boolean;

  // Additional content
  statusIndicator?: ReactNode;
  additionalContent?: ReactNode;
}

const getSizeClasses = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return { node: 'w-16 h-16', glow: 'w-18 h-18' };
    case 'large':
      return { node: 'w-24 h-24', glow: 'w-28 h-28' };
    default: // medium
      return { node: 'w-20 h-20', glow: 'w-24 h-24' };
  }
};

export const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  start,
  end,
  isCompleted,
  isOngoing,
  isSuggested = false,
  suggestedReason,
  isHighlighted = false,
  isHovered = false,
  hasExpandableContent = false,
  isExpanded: externalIsExpanded,
  icon,
  nodeSize = 'medium',
  title,
  subtitle,
  dateText,
  description,
  customContent,
  onClick,
  onExpandToggle,
  onMouseEnter,
  onMouseLeave,
  handles = { left: true, right: true },
  animationDelay = 0,
  showGlow = true,
  statusIndicator,
  additionalContent
}) => {
  // Internal expansion state - use external prop if provided, otherwise manage internally
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;

  // Handle chevron click
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (externalIsExpanded === undefined) {
      // Use internal state
      setInternalIsExpanded(!internalIsExpanded);
    }

    // Still call the external handler if provided
    onExpandToggle?.(e);
  };
  // Get shared styling
  const styling = getNodeStyling({
    start,
    end,
    isOngoing,
    isCompleted,
    isSuggested,
    isHovered
  });

  const labelStyling = getLabelStyling(styling, isSuggested);
  const sizeClasses = getSizeClasses(nodeSize);

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer relative"
    >
      {/* Enhanced Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animationDelay + 0.3 }}
        className="absolute -top-24 -left-10 transform -translate-x-1/2 text-center min-w-max z-10"
      >
        <div className="px-4 py-3 transition-all duration-300">
          {/* Title */}
          <div className={labelStyling.titleClass}>
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div className={labelStyling.subtitleClass}>
              {subtitle}
            </div>
          )}

          {/* Date text */}
          {dateText && (
            <div className={labelStyling.dateClass}>
              {dateText}
            </div>
          )}

          {/* Suggested reason */}
          {isSuggested && suggestedReason && (
            <div className="text-gray-400 mt-1 text-xs max-w-40 leading-tight">
              {suggestedReason}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="text-gray-300 mt-1 text-xs max-w-[180px] line-clamp-2">
              {description}
            </div>
          )}

          {/* Custom content */}
          {customContent}
        </div>
      </motion.div>

      {/* Main Circular Node Container */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow ring */}
        {showGlow && (
          <motion.div
            className={`${getGlowRingClasses(styling)} ${sizeClasses.glow}`}
            style={{ opacity: styling.glowOpacity }}
            animate={{
              scale: isExpanded ? 1.4 : (isHovered ? 1.3 : 1),
              opacity: isExpanded ? styling.glowOpacity * 1.2 : styling.glowOpacity
            }}
            transition={{
              duration: isExpanded ? 0.6 : 0.3,
              type: isExpanded ? "spring" : "tween",
              stiffness: isExpanded ? 80 : 100
            }}
          />
        )}

        {/* Main circular node */}
        <motion.div
          className={`${getNodeClasses(styling, isHighlighted, hasExpandableContent, isExpanded)} ${sizeClasses.node}`}
          style={{ opacity: styling.opacity }}
          animate={{
            opacity: styling.opacity,
            scale: isExpanded ? 1.05 : 1
          }}
          transition={{
            duration: 0.3,
            type: "spring",
            stiffness: 120
          }}
        >
          {/* Background pattern */}
          <div className="absolute inset-0 bg-white/5 rounded-full" />

          {/* Icon */}
          <div className={`relative z-10 ${isSuggested && !isHovered ? 'opacity-60' : ''} transition-opacity duration-300`}>
            {icon}
          </div>

          {/* Expansion Chevron - Always visible */}
          <div className="absolute -bottom-1 right-10 z-30">
            <ExpandChevron
              isExpanded={isExpanded}
              onClick={handleChevronClick}
              size="sm"
              variant="glass"
              className="shadow-lg opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Progress ring for suggested items */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="36"
              fill="none"
              stroke={isSuggested ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)"}
              strokeWidth="2"
            />
            <motion.circle
              cx="50%"
              cy="50%"
              r="36"
              fill="none"
              stroke={isSuggested ? (isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.8)"}
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 36}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 36 }}
              animate={{ strokeDashoffset: isSuggested ? (2 * Math.PI * 36) * 0.3 : 0 }}
              transition={{ delay: animationDelay + 0.5, duration: 1.5, ease: "easeInOut" }}
              strokeLinecap="round"
            />
          </svg>

          {/* Pulse effect for hover */}
          {isHovered && (
            <motion.div
              className={`absolute inset-0 rounded-full border-2 ${isSuggested ? 'border-white/40' : 'border-white/60'}`}
              initial={{ scale: 1, opacity: isSuggested ? 0.4 : 0.8 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}

          {/* Suggested milestone indicator */}
          {isSuggested && (
            <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-gray-500/80 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
              <svg className="w-3 h-3 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}

          {/* Status indicator */}
          {statusIndicator}
        </motion.div>

        {/* Connection handles */}
        {handles.left && (
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        )}
        {handles.leftSource && (
          <Handle
            type="source"
            position={Position.Left}
            id="left-source"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        )}
        {handles.right && (
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        )}
        {handles.top && (
          <Handle
            type="target"
            position={Position.Top}
            id="top"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        )}
        {handles.bottom && (
          <Handle
            type="source"
            position={Position.Bottom}
            id="bottom"
            className="w-3 h-3 bg-white/80 border-2 border-gray-300 opacity-0 hover:opacity-100 transition-opacity"
          />
        )}
      </div>

      {/* Additional content outside the main structure */}
      {additionalContent}
    </div>
  );
};
