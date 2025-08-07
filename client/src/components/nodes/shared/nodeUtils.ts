import React from 'react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target } from 'lucide-react';
import type { Education } from '@shared/schema';

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

// Education node data for React Flow - combines Zod schema with all UI features
export interface EducationNodeData extends Education {
  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  hasProjects?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;  
  isCompleted?: boolean;
  isOngoing?: boolean;

  // Computed display fields
  duration?: string;       // Calculated from startDate/endDate

  // Expandable functionality
  isExpanded?: boolean;
  children?: any[];
  hasExpandableContent?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onToggleExpansion?: (nodeId: string) => void;

  // Allow additional dynamic properties
  [key: string]: unknown;
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
  data: BaseMilestoneData | ExperienceData | EducationNodeData | ProjectData;
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

  return "flex flex-col items-center justify-center"
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
