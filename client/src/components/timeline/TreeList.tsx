import { ChevronDown,ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import { cn } from '../../lib/utils';
import { flattenTree } from '../../stores/profile/useTimelineTransform';
import type { TreeListProps, TreeNode } from '../../types/profile';

// ============================================================================
// TREE LIST COMPONENT
// ============================================================================
// Renders a hierarchical tree structure with expand/collapse functionality

export function TreeList({
  nodes,
  expandedIds,
  selectedId,
  onNodeClick,
  onToggleExpand,
  className,
}: TreeListProps) {
  // Flatten the tree structure respecting expanded state
  const flattenedNodes = useMemo(() => {
    return flattenTree(nodes, expandedIds);
  }, [nodes, expandedIds]);

  const handleNodeClick = (nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    onNodeClick(nodeId);
  };

  const handleExpandClick = (nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleExpand(nodeId);
  };

  if (flattenedNodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <div className="text-center">
          <p className="text-sm">No timeline entries found</p>
          <p className="text-xs text-gray-400 mt-1">
            Timeline entries will appear here when available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {flattenedNodes.map((treeNode, index) => (
        <TreeListItem
          key={treeNode.node.id}
          treeNode={treeNode}
          isSelected={selectedId === treeNode.node.id}
          isExpanded={expandedIds.has(treeNode.node.id)}
          onNodeClick={handleNodeClick}
          onExpandClick={handleExpandClick}
          showConnectingLines={index > 0}
        />
      ))}
    </div>
  );
}

// ============================================================================
// TREE LIST ITEM COMPONENT
// ============================================================================
// Individual item in the tree list with proper indentation and tree lines

interface TreeListItemProps {
  treeNode: TreeNode;
  isSelected: boolean;
  isExpanded: boolean;
  onNodeClick: (nodeId: string, event: React.MouseEvent) => void;
  onExpandClick: (nodeId: string, event: React.MouseEvent) => void;
  showConnectingLines?: boolean;
}

function TreeListItem({
  treeNode,
  isSelected,
  isExpanded,
  onNodeClick,
  onExpandClick,
  showConnectingLines = false,
}: TreeListItemProps) {
  const { node, level, hasChildren, isLastChild } = treeNode;
  const indentSize = 24; // pixels per level
  const paddingLeft = level * indentSize + 16; // Base padding + level indentation

  const getNodeTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'job':
        return 'bg-blue-100 text-blue-800';
      case 'education':
        return 'bg-green-100 text-green-800';
      case 'project':
        return 'bg-purple-100 text-purple-800';
      case 'event':
        return 'bg-orange-100 text-orange-800';
      case 'action':
        return 'bg-red-100 text-red-800';
      case 'careertransition':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateRange = (startDate?: string, endDate?: string | null) => {
    if (!startDate) return '';
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
    };

    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : 'Present';
    
    return `${start} - ${end}`;
  };

  return (
    <div 
      className={cn(
        'relative flex items-center p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-50',
        isSelected && 'bg-blue-50 border-l-4 border-l-blue-500',
        !isSelected && 'border-l-4 border-l-transparent'
      )}
      style={{ paddingLeft }}
      onClick={(e) => onNodeClick(node.id, e)}
    >
      {/* Tree connecting lines */}
      {level > 0 && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center pointer-events-none">
          {/* Vertical lines for ancestor levels */}
          {Array.from({ length: level }).map((_, i) => (
            <div
              key={i}
              className="w-6 flex justify-center"
              style={{ marginLeft: i * indentSize + 8 }}
            >
              {i < level - 1 && (
                <div className="w-px h-full bg-gray-200" />
              )}
            </div>
          ))}
          
          {/* Horizontal line to current node */}
          <div 
            className="flex items-center h-full"
            style={{ marginLeft: (level - 1) * indentSize + 8 }}
          >
            <div className="w-px bg-gray-200" style={{ height: isLastChild ? '50%' : '100%' }} />
            <div className="w-3 h-px bg-gray-200" />
          </div>
        </div>
      )}

      {/* Expand/Collapse Button */}
      {hasChildren && (
        <button
          onClick={(e) => onExpandClick(node.id, e)}
          className="mr-2 p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
      )}
      
      {/* Spacer for non-expandable items */}
      {!hasChildren && <div className="w-6 mr-2" />}

      {/* Node Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Node Type Badge */}
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getNodeTypeColor(node.type)
            )}>
              {node.type}
            </span>

            {/* Node Title */}
            <div className="min-w-0 flex-1">
              <h4 className={cn(
                'text-sm font-medium truncate',
                isSelected ? 'text-blue-900' : 'text-gray-900'
              )}>
                {node.meta?.title || 'Untitled'}
              </h4>
              
              {/* Node Subtitle (company, school, etc.) */}
              {node.meta?.company && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {node.meta.company}
                </p>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-gray-500">
              {formatDateRange(node.meta?.startDate, node.meta?.endDate)}
            </p>
            
            {/* Current indicator */}
            {node.isCurrent && (
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full ml-2" 
                    title="Current" />
            )}
          </div>
        </div>
        
        {/* Node Description (if available and selected) */}
        {isSelected && node.meta?.description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {node.meta.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TREE LIST SKELETON
// ============================================================================
// Loading state for tree list

export function TreeListSkeleton({ itemCount = 5 }: { itemCount?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: itemCount }).map((_, index) => (
        <div 
          key={index}
          className="flex items-center p-3 rounded-lg"
          style={{ paddingLeft: 16 + (index % 3) * 24 }} // Vary indentation
        >
          <div className="w-6 h-4 bg-gray-200 rounded animate-pulse mr-2" />
          <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse mr-3" />
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
          <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TREE LIST ERROR
// ============================================================================
// Error state for tree list

interface TreeListErrorProps {
  error: string;
  onRetry?: () => void;
}

export function TreeListError({ error, onRetry }: TreeListErrorProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <p className="text-sm text-red-600 mb-2">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}