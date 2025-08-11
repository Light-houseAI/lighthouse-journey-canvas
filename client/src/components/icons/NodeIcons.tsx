/**
 * Centralized Node Icon System
 * Single source of truth for all node type icons across the application
 */

import React from 'react';
import {
  GraduationCap,
  Building2,
  TrendingUp,
  Rocket,
  Calendar,
  Zap,
  LucideIcon
} from 'lucide-react';

// Centralized icon mapping - single source of truth
export const NODE_ICONS: Record<string, LucideIcon> = {
  education: GraduationCap,
  job: Building2,
  careerTransition: TrendingUp,
  project: Rocket,
  event: Calendar,
  action: Zap,
} as const;

// Icon selector component
export interface NodeIconProps {
  type: 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition';
  size?: number;
  className?: string;
}

// Utility function to get icon component by type
export const getNodeIcon = (type: string): LucideIcon | null => {
  return NODE_ICONS[type] || null;
};

// Main NodeIcon component
export const NodeIcon: React.FC<NodeIconProps> = ({ type, size = 24, className = "" }) => {
  const IconComponent = NODE_ICONS[type];

  if (!IconComponent) {
    return <div style={{ width: size, height: size }} className={className}>?</div>;
  }

  return <IconComponent size={size} className={className} />;
};

export default NodeIcon;
