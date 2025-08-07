import React from 'react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target } from 'lucide-react';
import type { Education, Job, Project, Event, Action, CareerTransition } from '@shared/schema';
import { JobData } from '@/stores/journey-store';

// Node type definitions
export enum NodeType {
  Education = 'education',
  Job = 'job',
  Transition = 'transition',
  Skill = 'skill',
  Event = 'event',
  Project = 'project',
  Update = 'update',
}

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

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Job node data for React Flow with UI features - extends shared schema
export interface JobNodeData extends Job {
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
  isSuggested?: boolean;
  suggestedReason?: string;

  // Computed display fields
  duration?: string;

  // Expandable functionality
  isExpanded?: boolean;
  children?: any[];
  hasExpandableContent?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onToggleExpansion?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;
  branch?: number;
  handles?: any;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Project node data for React Flow with UI features - extends shared schema
export interface ProjectNodeData extends Project {
  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;
  isSuggested?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;
  branch?: number;
  handles?: any;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Event node data for React Flow with UI features - extends shared schema
export interface EventNodeData extends Event {
  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;

  // Additional event-specific fields not in base schema (keeping for backward compatibility)
  eventType?: string;
  organizer?: string;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Action node data for React Flow with UI features - extends shared schema
export interface ActionNodeData extends Action {
  // Additional action-specific fields not in base schema
  actionType?: string;
  category?: string;
  status?: string;
  impact?: string;
  verification?: string;

  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Career transition node data for React Flow with UI features - extends shared schema
export interface CareerTransitionNodeData extends CareerTransition {
  // Additional career transition-specific fields not in base schema
  transitionType?: string;
  fromRole?: string;
  toRole?: string;
  reason?: string;
  outcome?: string;

  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;

  // Expandable functionality
  isExpanded?: boolean;
  children?: any[];
  hasExpandableContent?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onToggleExpansion?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;

  // Allow additional dynamic properties
  [key: string]: unknown;
}

// Project-specific data - extends shared schema
export interface ProjectData extends Project {
  // Timeline positioning and hierarchy
  isSubMilestone?: boolean;
  parentId?: string;

  // Visual states for node interactions
  isFocused?: boolean;
  isBlurred?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isCompleted?: boolean;
  isOngoing?: boolean;
  isSuggested?: boolean;

  // React Flow callbacks
  onNodeClick?: (data: any, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;

  // Global focus state for reference
  globalFocusedNodeId?: string | null;
  level?: number;
  branch?: number;
  handles?: any;

  // Additional project-specific fields not in base schema
  objectives?: string;
  impact?: string;
  challenges?: string;
  teamSize?: number;
  budget?: string;
  outcomes?: string[];
  lessonsLearned?: string;
  projectUpdates?: ProjectUpdate[];

  // Allow additional dynamic properties
  [key: string]: unknown;
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
  data: JobData | EducationNodeData | ProjectData | EventNodeData | ActionNodeData | CareerTransitionNodeData;
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
    case NodeType.Education:
      return React.createElement(GraduationCap, iconProps);
    case NodeType.Job:
      return React.createElement(Briefcase, iconProps);
    case NodeType.Event:
      return React.createElement(Calendar, iconProps);
    case NodeType.Project:
      return React.createElement(Wrench, iconProps);
    case NodeType.Update:
      return React.createElement(Zap, iconProps);
    case NodeType.Transition:
      return React.createElement(ArrowRight, iconProps);
    case NodeType.Skill:
      return React.createElement(Zap, iconProps);
    default:
      return React.createElement(Target, iconProps);
  }
};

// Gradient mapping function
export const getTypeGradient = (type: NodeType): string => {
  switch (type) {
    case NodeType.Education: return 'from-blue-400 to-blue-600';
    case NodeType.Job: return 'from-emerald-400 to-emerald-600';
    case NodeType.Event: return 'from-purple-400 to-purple-600';
    case NodeType.Project: return 'from-amber-400 to-amber-600';
    case NodeType.Update: return 'from-green-400 to-green-600';
    case NodeType.Transition: return 'from-pink-400 to-pink-600';
    case NodeType.Skill: return 'from-cyan-400 to-cyan-600';
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
