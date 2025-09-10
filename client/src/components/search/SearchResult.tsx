/**
 * SearchResult Component
 * 
 * Individual search result display with profile info, matched nodes, and insights
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Briefcase, 
  GraduationCap, 
  Folder, 
  Calendar, 
  Zap, 
  ArrowRight,
  Lightbulb 
} from 'lucide-react';
import type { 
  SearchResultProps, 
  TimelineNodeType,
  MatchedNode 
} from './types/search.types';
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from './types/search.types';

// Node type icon mapping
const NODE_TYPE_ICONS: Record<TimelineNodeType, React.ComponentType<any>> = {
  job: Briefcase,
  education: GraduationCap,
  project: Folder,
  event: Calendar,
  action: Zap,
  careerTransition: ArrowRight
};

// Component for node type badges
const NodeTypeBadge: React.FC<{ type: TimelineNodeType; size?: 'sm' | 'md' }> = ({ 
  type, 
  size = 'sm' 
}) => {
  const Icon = NODE_TYPE_ICONS[type];
  const label = NODE_TYPE_LABELS[type];
  const colorClass = NODE_TYPE_COLORS[type];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        colorClass,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        'flex items-center gap-1 border'
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </Badge>
  );
};

// Component for matched node display
const MatchedNodeItem: React.FC<{ node: MatchedNode }> = ({ node }) => {
  const getNodeTitle = (node: MatchedNode): string => {
    const { meta, type } = node;
    
    switch (type) {
      case 'job':
        return `${meta.role || 'Position'} at ${meta.company || 'Company'}`;
      case 'education':
        return `${meta.degree || 'Degree'} at ${meta.institution || 'Institution'}`;
      case 'project':
        return meta.title || meta.name || 'Project';
      case 'event':
        return meta.title || meta.name || 'Event';
      case 'action':
        return meta.title || meta.description || 'Action';
      case 'careerTransition':
        return meta.title || 'Career Transition';
      default:
        return 'Experience';
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <NodeTypeBadge type={node.type} size="sm" />
      <span className="text-[#454C52] truncate">
        {getNodeTitle(node)}
      </span>
    </div>
  );
};

export const SearchResult: React.FC<SearchResultProps> = ({
  result,
  isHighlighted,
  showInsights = true,
  onSelect,
  onClick,
  className
}) => {
  const initials = result.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleClick = () => {
    onClick(result.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(result.id);
    }
  };

  return (
    <motion.div
      role="option"
      tabIndex={-1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ 
        backgroundColor: "rgba(245, 245, 245, 0.5)",
        transition: { duration: 0.15 }
      }}
      className={cn(
        "w-full p-4 cursor-pointer transition-all duration-200 ease-out",
        "border-b border-gray-100 last:border-b-0",
        "focus:outline-none",
        isHighlighted && "bg-gray-50/70",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Profile Avatar */}
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className="text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Profile Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Name and Role */}
          <div>
            <h3 className="text-sm font-medium text-[#2E2E2E] truncate">
              {result.name}
            </h3>
            {(result.currentRole || result.company) && (
              <p className="text-xs text-[#4A4F4E] truncate">
                {[result.currentRole, result.company].filter(Boolean).join(' at ')}
              </p>
            )}
          </div>

          {/* Why This Profile Matches */}
          {result.whyMatched && result.whyMatched.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#2E2E2E]">
                Why this profile matches your search:
              </h4>
              <div className="space-y-1">
                {result.whyMatched.slice(0, 3).map((reason, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <span className="text-xs text-[#454C52] leading-relaxed">
                      {reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {showInsights && result.insightsSummary && result.insightsSummary.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <h4 className="text-xs font-medium text-[#2E2E2E]">
                  AI Insights:
                </h4>
              </div>
              <div className="space-y-1">
                {result.insightsSummary.slice(0, 2).map((insight, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <span className="text-xs text-[#454C52] leading-relaxed">
                      {insight}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Nodes */}
          {result.matchedNodes && result.matchedNodes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-[#2E2E2E]">
                Relevant Experience:
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.matchedNodes.slice(0, 3).map((node, index) => (
                  <MatchedNodeItem key={node.id || index} node={node} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};