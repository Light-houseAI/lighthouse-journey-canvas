import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface ExpandChevronProps {
  isExpanded: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
  onClick?: () => void; // Deprecated - use onExpand/onCollapse
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  variant?: 'default' | 'glass' | 'solid';
}

const sizeClasses = {
  sm: {
    container: 'w-6 h-6',
    icon: 'w-3 h-3'
  },
  md: {
    container: 'w-8 h-8', 
    icon: 'w-4 h-4'
  },
  lg: {
    container: 'w-10 h-10',
    icon: 'w-5 h-5'
  }
};

const variantClasses = {
  default: 'bg-white/90 border border-gray-200 hover:bg-white shadow-lg',
  glass: 'bg-white/10 backdrop-blur-sm border border-white/30 hover:bg-white/20 shadow-md',
  solid: 'bg-gray-800 border border-gray-600 hover:bg-gray-700'
};

/**
 * Reusable chevron button for expanding/collapsing nodes
 * Matches the Career Journey app design with smooth rotation animations
 */
export const ExpandChevron: React.FC<ExpandChevronProps> = ({
  isExpanded,
  onExpand,
  onCollapse,
  onClick, // Deprecated fallback
  size = 'md',
  className = '',
  disabled = false,
  variant = 'default'
}) => {
  const sizeClass = sizeClasses[size];
  const variantClass = variantClasses[variant];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    if (onExpand && onCollapse) {
      // Use new separate handlers
      if (isExpanded) {
        onCollapse();
      } else {
        onExpand();
      }
    } else if (onClick) {
      // Fallback to deprecated onClick
      onClick();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      className={`
        ${sizeClass.container}
        ${variantClass}
        rounded-full flex items-center justify-center
        transition-all duration-200 ease-out
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.1 }}
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      initial={false}
    >
      <motion.div
        animate={{ rotate: isExpanded ? 180 : 0 }}
        transition={{ 
          duration: 0.3, 
          ease: "easeInOut",
          type: "tween"
        }}
        className="flex items-center justify-center"
      >
        <ChevronDown 
          className={`${sizeClass.icon} ${variant === 'default' ? 'text-gray-600' : 'text-white/80'}`}
        />
      </motion.div>
    </motion.button>
  );
};

/**
 * Simplified chevron for inline use (just the icon with rotation)
 */
export const ChevronIcon: React.FC<{
  isExpanded: boolean;
  size?: number;
  className?: string;
}> = ({ 
  isExpanded, 
  size = 16, 
  className = '' 
}) => {
  return (
    <motion.div
      animate={{ rotate: isExpanded ? 180 : 0 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeInOut" 
      }}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <ChevronDown 
        size={size}
        className="text-current"
      />
    </motion.div>
  );
};