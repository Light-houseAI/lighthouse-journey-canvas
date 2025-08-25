/**
 * NodePanelHeader - Shared header component for all node panels
 * 
 * Provides consistent styling and functionality across all node types
 */

import React from 'react';
import { X } from 'lucide-react';
import { NodeIcon } from '../../icons/NodeIcons';
import { TimelineNode } from '@shared/schema';
import { TimelineNodeType } from '@shared/enums';
import { ShareButton } from '../../share';
import { useAuthStore } from '../../../stores/auth-store';

interface NodePanelHeaderProps {
  node: TimelineNode;
  nodeType: TimelineNodeType;
  title: string;
  iconColor?: string;
  onClose: () => void;
}

const getNodeTypeLabel = (type: TimelineNodeType): string => {
  switch (type) {
    case TimelineNodeType.Job:
      return 'Job Experience';
    case TimelineNodeType.Education:
      return 'Education';
    case TimelineNodeType.Project:
      return 'Project';
    case TimelineNodeType.Event:
      return 'Event';
    case TimelineNodeType.Action:
      return 'Action';
    case TimelineNodeType.CareerTransition:
      return 'Career Transition';
    default:
      return 'Timeline Node';
  }
};

const getNodeTypeColor = (type: TimelineNodeType): string => {
  switch (type) {
    case TimelineNodeType.Job:
      return 'from-cyan-500 to-cyan-600';
    case TimelineNodeType.Education:
      return 'from-blue-500 to-blue-600';
    case TimelineNodeType.Project:
      return 'from-green-500 to-green-600';
    case TimelineNodeType.Event:
      return 'from-purple-500 to-purple-600';
    case TimelineNodeType.Action:
      return 'from-orange-500 to-orange-600';
    case TimelineNodeType.CareerTransition:
      return 'from-red-500 to-red-600';
    default:
      return 'from-slate-500 to-slate-600';
  }
};

export const NodePanelHeader: React.FC<NodePanelHeaderProps> = ({
  node,
  nodeType,
  title,
  iconColor,
  onClose,
}) => {
  const { user } = useAuthStore();
  const colorClasses = iconColor || getNodeTypeColor(nodeType);
  const typeLabel = getNodeTypeLabel(nodeType);
  
  // Check if current user owns this node
  const isOwner = user && user.id === node.userId;

  return (
    <div className="px-6 py-4 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colorClasses} flex items-center justify-center shadow-lg`}>
          <NodeIcon type={nodeType} size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent uppercase tracking-wider">
            {typeLabel}
          </h2>
          <div className={`w-8 h-0.5 bg-gradient-to-r ${colorClasses} rounded-full`}></div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Share Button - Only show for node owners */}
        {isOwner && (
          <ShareButton
            nodes={[node]}
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          />
        )}
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="group relative p-2 rounded-full transition-all duration-300 hover:bg-slate-100 hover:shadow-lg"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-slate-400/0 via-slate-400/10 to-slate-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <X className="h-5 w-5 text-slate-400 group-hover:text-slate-600 relative z-10 transition-colors duration-300" />
        </button>
      </div>
    </div>
  );
};