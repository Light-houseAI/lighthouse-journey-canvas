import React from 'react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target } from 'lucide-react';

// Node type definitions
export type NodeType = 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project' | 'update';

// Base milestone data interface
export interface BaseMilestoneData {
  title: string;
  type: NodeType;
  date: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
  description: string;
  skills: string[];
  organization?: string;
  isSubMilestone?: boolean;
  parentId?: string;
}

// Experience-specific data
export interface ExperienceData extends BaseMilestoneData {
  type: 'job';
  originalData?: any;
  hasProjects?: boolean;
  isFocused?: boolean;
  isBlurred?: boolean;
  starDetails?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
}

// Education-specific data
export interface EducationData extends BaseMilestoneData {
  type: 'education';
  school?: string;
  degree?: string;
  field?: string;
}

// Project-specific data
export interface ProjectData extends BaseMilestoneData {
  type: 'project';
  objectives?: string;
  technologies?: string[];
  impact?: string;
  challenges?: string;
  teamSize?: number;
  budget?: string;
  outcomes?: string[];
  lessonsLearned?: string;
  projectUpdates?: ProjectUpdate[];
}

// Project update interface with WDRL framework
export interface ProjectUpdate {
  title: string;
  description: string; // Work - What piece of work has taken most attention (required)
  date?: string;
  skills?: string[];
  achievements?: string;
  challenges?: string;
  impact?: string;
  // WDRL Framework fields
  decisions?: string; // Decision - Key decisions/actions to move work forward
  results?: string; // Result - Measurable result/evidence of impact
  learnings?: string; // Learning - Feedback/personal takeaways from experience
}

// Common node props
export interface BaseNodeProps {
  data: BaseMilestoneData | ExperienceData | EducationData | ProjectData;
  selected: boolean;
  id: string;
  // Common callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onAddSubMilestone?: () => void;
  // Visual states
  isUpdated?: boolean;
  hasSubMilestones?: boolean;
}

// Icon mapping function
export const getTypeIcon = (type: NodeType, size: number = 28) => {
  const iconProps = { size, className: "text-white filter drop-shadow-sm" };
  
  switch (type) {
    case 'education': 
      return React.createElement(GraduationCap, iconProps);
    case 'job': 
      return React.createElement(Briefcase, iconProps);
    case 'event': 
      return React.createElement(Calendar, iconProps);
    case 'project': 
      return React.createElement(Wrench, iconProps);
    case 'update': 
      return React.createElement(Zap, iconProps);
    case 'transition': 
      return React.createElement(ArrowRight, iconProps);
    case 'skill': 
      return React.createElement(Zap, iconProps);
    default: 
      return React.createElement(Target, iconProps);
  }
};

// Gradient mapping function
export const getTypeGradient = (type: NodeType): string => {
  switch (type) {
    case 'education': return 'from-blue-400 to-blue-600';
    case 'job': return 'from-emerald-400 to-emerald-600';
    case 'event': return 'from-purple-400 to-purple-600';
    case 'project': return 'from-amber-400 to-amber-600';
    case 'update': return 'from-green-400 to-green-600';
    case 'transition': return 'from-pink-400 to-pink-600';
    case 'skill': return 'from-cyan-400 to-cyan-600';
    default: return 'from-gray-400 to-gray-600';
  }
};


// Common styling utilities
export const getNodeSize = (isSubMilestone?: boolean) => ({
  width: isSubMilestone ? 'w-16' : 'w-20',
  height: isSubMilestone ? 'h-16' : 'h-20',
});

export const getBlurClasses = (isBlurred?: boolean, isFocused?: boolean) => {
  let classes = 'transition-all duration-500';
  
  if (isBlurred) {
    classes += ' blur-sm opacity-30';
  }
  
  if (isFocused) {
    classes += ' ring-4 ring-amber-400/50 rounded-full';
  }
  
  return classes;
};

export const getProjectIndicatorClasses = (hasProjects?: boolean) => {
  return hasProjects ? 'ring-2 ring-amber-400/60' : '';
};

/**
 * Calculates flexbox-based positioning classes for nodes
 * @param branch - The branch number of the current node
 * @param nodeType - Type of the node
 * @param nodeId - ID of the node for unique positioning
 * @returns CSS classes for flexbox positioning  
 */
export const getFlexPositionClasses = (branch?: number, nodeType?: string, nodeId?: string) => {
  const baseBranch = branch || 0;
  
  if (nodeType === 'project') {
    // Projects use standard flex-col with margin
    return 'flex flex-col items-center justify-center';
  } else if (baseBranch === 0) {
    // Primary timeline - labels above, properly centered
    return 'flex flex-col-reverse items-center justify-center';
  } else {
    // Branch nodes - labels below for better spacing, properly centered
    return 'flex flex-col items-center justify-center';
  }
};

/**
 * Legacy function kept for compatibility
 * @deprecated Use getFlexPositionClasses instead
 */
export const getLabelPositionClasses = (branch?: number, nodeType?: string, nodeId?: string) => {
  const baseBranch = branch || 0;
  
  // More aggressive spacing to prevent overlap
  if (nodeType === 'project') {
    // Projects always go below to avoid overlap with parent
    return 'top-24';
  } else if (baseBranch === 0) {
    return '-top-44'; // Primary timeline - labels above with more space
  } else if (baseBranch % 2 === 1) {
    return '-top-60'; // Odd branches - much higher above
  } else {
    return 'top-28'; // Even branches - below with more space
  }
};

/**
 * Gets the appropriate z-index for labels to handle layering
 * @param isHighlighted - Whether the node is highlighted
 * @param isFocused - Whether the node is focused
 * @returns z-index class
 */
export const getLabelZIndexClass = (isHighlighted?: boolean, isFocused?: boolean) => {
  if (isFocused) return 'z-50'; // Focused nodes on top
  if (isHighlighted) return 'z-40'; // Highlighted nodes next
  return 'z-10'; // Default label z-index
};