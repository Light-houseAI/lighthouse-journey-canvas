import { Calendar, ChevronDown, ChevronRight, ExternalLink,MapPin } from 'lucide-react';
import React from 'react';

import { cn } from '../../lib/utils';
import type { NodeListItemProps } from '../../types/profile';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

// ============================================================================
// NODE LIST ITEM COMPONENT
// ============================================================================
// Individual timeline node displayed in list format with expand/collapse

export function NodeListItem({
  treeNode,
  isSelected,
  onClick,
  onToggleExpand,
  className,
}: NodeListItemProps) {
  const { node, level, hasChildren, isLastChild } = treeNode;
  const indentSize = 20; // pixels per level
  const paddingLeft = level * indentSize + 16;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    onClick(node.id);
  };

  const handleExpandClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleExpand(node.id);
  };

  // Node type styling
  const getNodeTypeConfig = (type: string) => {
    const configs = {
      job: {
        color: 'bg-blue-500',
        badge: 'bg-blue-100 text-blue-800',
        icon: '💼',
        label: 'Job',
      },
      education: {
        color: 'bg-green-500',
        badge: 'bg-green-100 text-green-800',
        icon: '🎓',
        label: 'Education',
      },
      project: {
        color: 'bg-purple-500',
        badge: 'bg-purple-100 text-purple-800',
        icon: '🚀',
        label: 'Project',
      },
      event: {
        color: 'bg-orange-500',
        badge: 'bg-orange-100 text-orange-800',
        icon: '🎯',
        label: 'Event',
      },
      action: {
        color: 'bg-red-500',
        badge: 'bg-red-100 text-red-800',
        icon: '⚡',
        label: 'Action',
      },
      careertransition: {
        color: 'bg-indigo-500',
        badge: 'bg-indigo-100 text-indigo-800',
        icon: '🔄',
        label: 'Transition',
      },
    };
    
    return configs[type.toLowerCase()] || {
      color: 'bg-gray-500',
      badge: 'bg-gray-100 text-gray-800',
      icon: '📝',
      label: 'Other',
    };
  };

  const typeConfig = getNodeTypeConfig(node.type);

  // Date formatting
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  const formatDateRange = () => {
    const start = formatDate(node.meta?.startDate);
    const end = node.meta?.endDate ? formatDate(node.meta.endDate) : 'Present';
    return start ? `${start} - ${end}` : '';
  };

  const calculateDuration = () => {
    const startDate = node.meta?.startDate ? new Date(node.meta.startDate) : null;
    const endDate = node.meta?.endDate ? new Date(node.meta.endDate) : new Date();
    
    if (!startDate) return '';
    
    const months = Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    
    if (months < 1) return '< 1 month';
    if (months < 12) return `${Math.round(months)} month${Math.round(months) === 1 ? '' : 's'}`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = Math.round(months % 12);
    
    if (remainingMonths === 0) {
      return `${years} year${years === 1 ? '' : 's'}`;
    }
    
    return `${years}y ${remainingMonths}m`;
  };

  return (
    <div
      className={cn(
        'group relative border border-transparent rounded-lg transition-all duration-200 hover:shadow-md hover:border-gray-200',
        isSelected && 'bg-blue-50 border-blue-200 shadow-sm',
        'cursor-pointer',
        className
      )}
      style={{ marginLeft: level * indentSize }}
      onClick={handleClick}
    >
      {/* Tree connecting lines */}
      {level > 0 && (
        <div className="absolute -left-4 top-0 bottom-0 flex items-center pointer-events-none">
          <div className="w-px h-full bg-gray-200" />
          <div className="w-4 h-px bg-gray-200" />
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-3 min-w-0 flex-1">
            {/* Node type indicator */}
            <div className="flex-shrink-0 flex items-center space-x-2">
              <div className={cn('w-3 h-3 rounded-full', typeConfig.color)} />
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandClick}
                  className="p-0 h-5 w-5 hover:bg-gray-100"
                >
                  {treeNode.isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>

            {/* Node content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <Badge variant="secondary" className={cn('text-xs', typeConfig.badge)}>
                  {typeConfig.icon} {typeConfig.label}
                </Badge>
                
                {node.isCurrent && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                    Current
                  </Badge>
                )}
              </div>

              <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">
                {node.meta?.title || 'Untitled'}
              </h3>

              {/* Subtitle (company, institution, etc.) */}
              {node.meta?.company && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                  {node.meta.company}
                </p>
              )}

              {/* Location */}
              {node.meta?.location && (
                <div className="flex items-center text-xs text-gray-500 mb-2">
                  <MapPin className="h-3 w-3 mr-1" />
                  {node.meta.location}
                </div>
              )}
            </div>
          </div>

          {/* Date and duration info */}
          <div className="flex-shrink-0 text-right ml-4">
            <div className="flex items-center text-xs text-gray-500 mb-1">
              <Calendar className="h-3 w-3 mr-1" />
              {formatDateRange()}
            </div>
            
            {/* Duration */}
            <p className="text-xs text-gray-400">
              {calculateDuration()}
            </p>
          </div>
        </div>

        {/* Description (visible when expanded or selected) */}
        {(isSelected || treeNode.isExpanded) && node.meta?.description && (
          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              {node.meta.description}
            </p>
          </div>
        )}

        {/* Action buttons (visible on hover or selection) */}
        {(isSelected || false) && ( // Will add hover state logic later
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  View Details
                </Button>
                
                {node.permissions.canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Edit
                  </Button>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Children count indicator */}
        {hasChildren && !treeNode.isExpanded && (
          <div className="border-t border-gray-100 pt-2 mt-3">
            <button
              onClick={handleExpandClick}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              Show {node.children?.length || 0} nested item{node.children?.length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// NODE LIST ITEM SKELETON
// ============================================================================

export function NodeListItemSkeleton({ level = 0 }: { level?: number }) {
  const paddingLeft = level * 20 + 16;

  return (
    <div
      className="border border-transparent rounded-lg p-4 animate-pulse"
      style={{ marginLeft: level * 20 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-16 h-5 bg-gray-200 rounded-full" />
              <div className="w-12 h-5 bg-gray-200 rounded-full" />
            </div>
            <div className="w-3/4 h-5 bg-gray-200 rounded" />
            <div className="w-1/2 h-4 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="flex-shrink-0 space-y-1">
          <div className="w-20 h-3 bg-gray-200 rounded" />
          <div className="w-16 h-3 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}