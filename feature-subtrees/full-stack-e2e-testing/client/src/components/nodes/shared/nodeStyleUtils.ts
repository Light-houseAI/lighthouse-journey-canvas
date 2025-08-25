/**
 * Shared node styling utilities for consistent appearance across all node types
 * Based on temporal status (completed/ongoing/suggested)
 */

export interface NodeStyling {
  gradient: string;
  opacity: string;
  glowOpacity: number;
  textOpacity: string;
  borderOpacity: string;
}

export interface NodeStyleParams {
  start?: string;
  end?: string;
  isOngoing?: boolean;
  isCompleted?: boolean;
  isSuggested?: boolean;
  isHovered?: boolean;
}

/**
 * Calculate node styling based on temporal status
 */
export const getNodeStyling = (params: NodeStyleParams): NodeStyling => {
  const { start, end, isOngoing, isCompleted, isSuggested, isHovered = false } = params;
  
  // Determine completion status if not explicitly provided
  const completed = isCompleted ?? Boolean(end);
  const ongoing = isOngoing ?? !end;
  const suggested = isSuggested ?? false;

  if (suggested) {
    return {
      gradient: 'from-gray-400 to-gray-500',
      opacity: isHovered ? '0.8' : '0.4',
      glowOpacity: isHovered ? 0.4 : 0.2,
      textOpacity: isHovered ? 'text-white/90' : 'text-white/60',
      borderOpacity: isHovered ? 'border-white/40' : 'border-white/20'
    };
  }

  if (completed) {
    return {
      gradient: 'from-green-500 to-green-600',
      opacity: '1',
      glowOpacity: isHovered ? 0.6 : 0.4,
      textOpacity: 'text-white',
      borderOpacity: 'border-white/30'
    };
  }

  if (ongoing) {
    return {
      gradient: 'from-blue-500 to-blue-600',
      opacity: '1',
      glowOpacity: isHovered ? 0.6 : 0.4,
      textOpacity: 'text-white',
      borderOpacity: 'border-white/30'
    };
  }

  // Default styling for nodes without clear temporal status
  return {
    gradient: 'from-emerald-500 to-green-600',
    opacity: '1',
    glowOpacity: isHovered ? 0.6 : 0.4,
    textOpacity: 'text-white',
    borderOpacity: 'border-white/30'
  };
};

/**
 * Get consistent node classes for circular node styling
 */
export const getNodeClasses = (styling: NodeStyling, isHighlighted?: boolean, hasProjects?: boolean, isExpanded?: boolean) => {
  return `
    relative w-20 h-20 rounded-full bg-gradient-to-br ${styling.gradient}
    border-2 ${styling.borderOpacity} flex items-center justify-center
    text-white shadow-2xl overflow-hidden
    ${isHighlighted ? `ring-2 ring-amber-400 animate-pulse` : ''}
    ${hasProjects ? 'ring-2 ring-amber-400/60' : ''}
    ${isExpanded ? 'ring-2 ring-blue-400/80 shadow-blue-400/20' : ''}
  `.trim();
};

/**
 * Get consistent glow ring classes
 */
export const getGlowRingClasses = (styling: NodeStyling) => {
  return `absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-br ${styling.gradient} blur-xl`;
};

/**
 * Get consistent label styling
 */
export const getLabelStyling = (styling: NodeStyling, isSuggested?: boolean) => {
  return {
    titleClass: `${styling.textOpacity} font-medium text-sm transition-all duration-300`,
    subtitleClass: `${isSuggested ? 'text-gray-400' : 'text-gray-300'} mt-1 text-xs transition-all duration-300`,
    dateClass: `${isSuggested ? 'text-gray-400' : 'text-gray-300'} mt-1 text-xs transition-all duration-300`
  };
};