import { ChevronDown, ChevronUp, Expand, Minimize2 } from 'lucide-react';
import React from 'react';

import { cn } from '../../lib/utils';
import type { ExperienceSectionProps } from '../../types/profile';
import { Button } from '../ui/button';
import { TreeList } from './TreeList';

// ============================================================================
// EXPERIENCE SECTION COMPONENT
// ============================================================================
// Groups timeline nodes into sections (Current/Past) with expand/collapse controls

export function ExperienceSection({
  title,
  nodes,
  expandedIds,
  selectedId,
  onNodeClick,
  onToggleExpand,
}: ExperienceSectionProps) {
  const [isSectionCollapsed, setIsSectionCollapsed] = React.useState(false);
  const nodeCount = nodes.length;
  const expandedCount = nodes.filter(node => expandedIds.has(node.node.id)).length;

  const handleExpandAll = () => {
    nodes.forEach(node => {
      if (node.hasChildren && !expandedIds.has(node.node.id)) {
        onToggleExpand(node.node.id);
      }
    });
  };

  const handleCollapseAll = () => {
    nodes.forEach(node => {
      if (expandedIds.has(node.node.id)) {
        onToggleExpand(node.node.id);
      }
    });
  };

  const toggleSectionCollapse = () => {
    setIsSectionCollapsed(!isSectionCollapsed);
  };

  if (nodeCount === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              📋
            </div>
          </div>
          <p className="text-sm text-gray-500">No {title.toLowerCase()} found</p>
          <p className="text-xs text-gray-400 mt-1">
            {title.toLowerCase()} will appear here when available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Section Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSectionCollapse}
              className="p-1 h-8 w-8"
            >
              {isSectionCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {nodeCount} {nodeCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Section Controls */}
          {!isSectionCollapsed && nodeCount > 0 && (
            <div className="flex items-center space-x-1">
              {expandedCount < nodeCount && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandAll}
                  className="text-xs"
                  title="Expand all nodes"
                >
                  <Expand className="h-3 w-3 mr-1" />
                  Expand All
                </Button>
              )}
              
              {expandedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  className="text-xs"
                  title="Collapse all nodes"
                >
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Collapse All
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section Content */}
      <div className={cn(
        'transition-all duration-300 overflow-hidden',
        isSectionCollapsed ? 'max-h-0' : 'max-h-none'
      )}>
        {!isSectionCollapsed && (
          <div className="p-4">
            <TreeList
              nodes={nodes}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
            />
          </div>
        )}
      </div>

      {/* Collapsed Summary */}
      {isSectionCollapsed && (
        <div className="px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{nodeCount} items hidden</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSectionCollapse}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Show all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPERIENCE SECTION SKELETON
// ============================================================================

interface ExperienceSectionSkeletonProps {
  title: string;
  itemCount?: number;
}

export function ExperienceSectionSkeleton({ 
  title, 
  itemCount = 3 
}: ExperienceSectionSkeletonProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse">
      {/* Header Skeleton */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded" />
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <div className="w-12 h-6 bg-gray-200 rounded-full" />
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-20 h-8 bg-gray-200 rounded" />
            <div className="w-24 h-8 bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="p-4 space-y-4">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between">
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
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXPERIENCE SECTION ERROR
// ============================================================================

interface ExperienceSectionErrorProps {
  title: string;
  error: string;
  onRetry?: () => void;
}

export function ExperienceSectionError({ 
  title, 
  error, 
  onRetry 
}: ExperienceSectionErrorProps) {
  return (
    <div className="bg-white rounded-lg border border-red-200 shadow-sm">
      <div className="px-6 py-4 border-b border-red-100">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      
      <div className="p-6 text-center">
        <div className="text-red-400 mb-4">
          <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            ⚠️
          </div>
        </div>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}