'use client';

import { VisibilityLevel } from '@shared/enums';
import { Loader2,Plus } from 'lucide-react';
import React, { useEffect,useState } from 'react';

import { AnimatedList } from '@/components/magicui/animated-list';
import { BlurFade } from '@/components/magicui/blur-fade';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { useTimelineStore } from '../../../hooks/useTimelineStore';
import { cn } from '../../../lib/utils';
import { InsightCard } from './InsightCard';
import { InsightForm } from './InsightForm';

interface InsightsSectionProps {
  nodeId: string;
  className?: string;
}

export const InsightsSection: React.FC<InsightsSectionProps> = ({ 
  nodeId, 
  className 
}) => {
  const { 
    insights, 
    insightLoading, 
    getNodeInsights,
    getNodeById
  } = useTimelineStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  
  const nodeInsights = insights[nodeId] || [];
  const isLoading = insightLoading[nodeId] || false;
  const node = getNodeById(nodeId);
  
  // Check user's access level for insights
  // Only Full access level users can see insights section, plus owners always can see
  const hasFullAccess = node?.permissions?.accessLevel === VisibilityLevel.Full;
  const isOwner = node?.permissions?.canEdit === true;
  // Owners can always view insights, or users with Full access
  const canViewInsights = hasFullAccess || isOwner;


  useEffect(() => {
    // Fetch insights if user can view insights
    if (canViewInsights) {
      getNodeInsights(nodeId);
    }
  }, [nodeId, getNodeInsights, canViewInsights]);
  
  // If user can't view insights, don't render insights section at all
  if (!canViewInsights) {
    return null;
  }

  return (
    <div className={cn("mt-8 border-t border-gray-200 pt-6", className)}>
      <BlurFade delay={0.1} inView>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900">
            Insights
            {nodeInsights.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                ({nodeInsights.length})
              </span>
            )}
          </h4>
          
          {isOwner && (
            <ShimmerButton
              onClick={() => setShowAddForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              shimmerColor="#ffffff"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Insight
            </ShimmerButton>
          )}
        </div>
      </BlurFade>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading insights...</span>
        </div>
      ) : nodeInsights.length === 0 ? (
        <BlurFade delay={0.2} inView>
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <div className="text-gray-400 mb-2">💡</div>
            <p className="text-gray-500 mb-4">
              {isOwner ? "No insights yet. Share your learnings!" : "No insights available."}
            </p>
            {isOwner && (
              <ShimmerButton
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
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
              nodeId={nodeId}
              delay={index * 100}
            />
          ))}
        </AnimatedList>
      )}

      {showAddForm && (
        <InsightForm
          nodeId={nodeId}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};