'use client';

import { VisibilityLevel } from '@journey/schema';
import { Loader2, Plus } from 'lucide-react';
import React, { useState } from 'react';

import { AnimatedList } from '@journey/components';
import { BlurFade } from '@journey/components';
import { ShimmerButton } from '@journey/components';
import type { TimelineNode } from '@journey/schema';
import { useNodeInsights } from '../../../hooks/useNodeInsights';
import { cn } from '../../../lib/utils';
import { InsightCard } from './InsightCard';
import { InsightForm } from './InsightForm';

interface InsightsSectionProps {
  node: TimelineNode;
  className?: string;
}

export const InsightsSection: React.FC<InsightsSectionProps> = ({
  node,
  className,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);

  // Check user's access level for insights from node permissions
  const hasFullAccess = node.permissions?.accessLevel === VisibilityLevel.Full;
  const isOwner = node.permissions?.canEdit === true;

  // Show insights if user is owner OR has full access
  const canViewInsights = isOwner || hasFullAccess;

  // Use TanStack Query to fetch insights
  const {
    data: nodeInsights = [],
    isLoading,
    error,
  } = useNodeInsights(node.id, canViewInsights);

  // If user can't view insights, don't render insights section at all
  if (!canViewInsights) {
    return null;
  }

  return (
    <div className={cn('mt-8 border-t border-gray-200 pt-6', className)}>
      <BlurFade delay={0.1} inView>
        <div className="mb-6 flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900">
            Insights
            {nodeInsights.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({nodeInsights.length})
              </span>
            )}
          </h4>

          {isOwner && (
            <ShimmerButton
              onClick={() => setShowAddForm(true)}
              className="bg-purple-600 text-white hover:bg-purple-700"
              shimmerColor="#ffffff"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Insight
            </ShimmerButton>
          )}
        </div>
      </BlurFade>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading insights...</span>
        </div>
      ) : error ? (
        <BlurFade delay={0.2} inView>
          <div className="rounded-lg border-2 border-red-200 bg-red-50 py-12 text-center">
            <p className="text-red-600">
              Failed to load insights. Please try again.
            </p>
          </div>
        </BlurFade>
      ) : nodeInsights.length === 0 ? (
        <BlurFade delay={0.2} inView>
          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12 text-center">
            <div className="mb-2 text-gray-400">💡</div>
            <p className="mb-4 text-gray-500">
              {isOwner
                ? 'No insights yet. Share your learnings!'
                : 'No insights available.'}
            </p>
            {isOwner && (
              <ShimmerButton
                onClick={() => setShowAddForm(true)}
                className="border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
              >
                Add Your First Insight
              </ShimmerButton>
            )}
          </div>
        </BlurFade>
      ) : (
        <AnimatedList className="space-y-4" delay={300}>
          {nodeInsights.map((insight, index) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              nodeId={node.id}
              delay={index * 100}
              canEdit={isOwner}
            />
          ))}
        </AnimatedList>
      )}

      {showAddForm && (
        <InsightForm
          nodeId={node.id}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};
