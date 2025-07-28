import React from 'react';
import { GraduationCap, Briefcase, Calendar, Wrench, ArrowRight, Zap, Target } from 'lucide-react';
import { format, parse } from 'date-fns';

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

// Date formatting utilities - all dates in MMM yyyy format
export const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  try {
    // Try parsing as MMM yyyy first
    const parsed = parse(dateString, 'MMM yyyy', new Date());
    return format(parsed, 'MMM yyyy');
  } catch {
    try {
      // Try parsing as ISO date
      const parsed = new Date(dateString);
      return format(parsed, 'MMM yyyy');
    } catch {
      // Return original if parsing fails
      return dateString;
    }
  }
};

export const formatDateRange = (startDate?: Date | string, endDate?: Date | string): string => {
  const start = startDate ? formatDate(typeof startDate === 'string' ? startDate : format(startDate, 'MMM yyyy')) : '';
  const end = endDate ? formatDate(typeof endDate === 'string' ? endDate : format(endDate, 'MMM yyyy')) : 'Present';
  
  if (!start) return end === 'Present' ? '' : end;
  
  return `${start} - ${end}`;
};

// Duration calculation utility
export const calculateDuration = (startDate?: Date | string, endDate?: Date | string): string => {
  if (!startDate) return '';
  
  try {
    const start = typeof startDate === 'string' ? parse(startDate, 'MMM yyyy', new Date()) : startDate;
    const end = endDate 
      ? (typeof endDate === 'string' ? parse(endDate, 'MMM yyyy', new Date()) : endDate)
      : new Date();
    
    const diffInMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    if (diffInMonths < 1) return '< 1 month';
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'}`;
    
    const years = Math.floor(diffInMonths / 12);
    const months = diffInMonths % 12;
    
    let duration = `${years} year${years === 1 ? '' : 's'}`;
    if (months > 0) {
      duration += ` ${months} month${months === 1 ? '' : 's'}`;
    }
    
    return duration;
  } catch {
    return '';
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