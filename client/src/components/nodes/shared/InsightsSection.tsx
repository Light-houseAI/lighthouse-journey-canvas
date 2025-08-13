'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { InsightCard } from './InsightCard';
import { InsightForm } from './InsightForm';
import { ShimmerButton } from '../../../../../components/magicui/shimmer-button';
import { AnimatedList } from '../../../../../components/magicui/animated-list';
import { BlurFade } from '../../../../../components/magicui/blur-fade';
import { cn } from '../../../lib/utils';

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
    getNodeInsights 
  } = useHierarchyStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  
  const nodeInsights = insights[nodeId] || [];
  const isLoading = insightLoading[nodeId] || false;

  useEffect(() => {
    getNodeInsights(nodeId);
  }, [nodeId, getNodeInsights]);

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
          
          <ShimmerButton
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            shimmerColor="#ffffff"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Insight
          </ShimmerButton>
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
            <p className="text-gray-500 mb-4">No insights yet. Share your learnings!</p>
            <ShimmerButton
              onClick={() => setShowAddForm(true)}
              size="sm"
              variant="outline"
            >
              Add Your First Insight
            </ShimmerButton>
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