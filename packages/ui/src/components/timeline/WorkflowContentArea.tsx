/**
 * WorkflowContentArea Component
 * Displays workflow preview cards dynamically organized by detected workflow categories
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { SessionMappingItem, CrossSessionContextResponse } from '@journey/schema';

import { useCrossSessionContext } from '../../hooks/useCrossSessionContext';
import { groupSessionsByCategory } from '../../utils/workflow-grouping';
import { getSessionDisplayTitle } from '../../utils/node-title';

import { CrossSessionInsights } from './CrossSessionInsights';
import { WorkflowPreviewCard } from './WorkflowPreviewCard';

interface WorkflowContentAreaProps {
  sessions: SessionMappingItem[];
  nodeId?: string;
  onCategoryInView?: (categoryId: string) => void;
}

export function WorkflowContentArea({
  sessions,
  nodeId,
  onCategoryInView,
}: WorkflowContentAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Group sessions by detected workflow category
  const workflowGroups = useMemo(() => groupSessionsByCategory(sessions), [sessions]);

  // Fetch cross-session Graph RAG insights for this work track
  const {
    data: graphRagData,
    isLoading: isLoadingGraphRag,
    error: graphRagError,
  } = useCrossSessionContext(nodeId, {
    lookbackDays: 30,
    maxResults: 20,
    enabled: !!nodeId,
  });

  // Fallback used to render loading/empty states while the query resolves
  const emptyGraphRagData: CrossSessionContextResponse = {
    entities: [],
    concepts: [],
    relatedSessions: [],
    workflowPatterns: [],
    temporalSequence: [],
    retrievalMetadata: {
      graphQueryTimeMs: 0,
      vectorQueryTimeMs: 0,
      totalTimeMs: 0,
      graphResultCount: 0,
      vectorResultCount: 0,
      fusedResultCount: 0,
    },
  };

  // Scroll spy logic
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onCategoryInView) return;

    const container = containerRef.current;
    const containerTop = container.getBoundingClientRect().top;

    let closestCategory = workflowGroups[0]?.id;
    let closestDistance = Infinity;

    workflowGroups.forEach((group) => {
      const element = document.getElementById(`category-${group.id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 50);

        if (rect.top <= containerTop + 100 && distance < closestDistance) {
          closestDistance = distance;
          closestCategory = group.id;
        }
      }
    });

    onCategoryInView(closestCategory);
  }, [onCategoryInView, workflowGroups]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Handle empty state
  if (workflowGroups.length === 0) {
    return (
      <main className="flex-1 p-6 lg:p-10 overflow-auto bg-gray-50">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              No workflow data available yet.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Push a session from Desktop Companion to see your workflows.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main ref={containerRef} className="flex-1 p-6 lg:p-10 overflow-auto bg-gray-50">
      {/* Cross-session Graph RAG insights */}
      {nodeId && !graphRagError && (
        <div className="mb-10">
          <CrossSessionInsights
            data={graphRagData ?? emptyGraphRagData}
            isLoading={isLoadingGraphRag}
          />
        </div>
      )}

      {workflowGroups.map((group) => (
        <section key={group.id} id={`category-${group.id}`} className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{group.label}</h2>
          <div className="space-y-6">
            {group.sessions.map((session) => {
              // Convert chapter data to workflow steps for preview
              const steps = (session.chapters || []).slice(0, 4).map((chapter) => ({
                id: `chapter-${chapter.chapter_id}`,
                label: chapter.title,
              }));

              return (
                <WorkflowPreviewCard
                  key={session.id}
                  workflowId={session.id}
                  title={getSessionDisplayTitle(session as any)}
                  steps={steps}
                  hasInsights={false}
                  confidence={session.categoryConfidence ? Math.round(session.categoryConfidence * 100) : undefined}
                />
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
