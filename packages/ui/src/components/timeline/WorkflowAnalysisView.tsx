/**
 * Workflow Analysis View
 * Displays workflow preview cards using real session chapter data
 * Also shows Graph RAG cross-session insights
 */

import { SessionMappingItem } from '@journey/schema';
import { Layers } from 'lucide-react';

import { useCrossSessionContext } from '../../hooks/useCrossSessionContext';
import { CrossSessionInsights } from './CrossSessionInsights';
import { WorkflowPreviewCard } from './WorkflowPreviewCard';

interface WorkflowAnalysisViewProps {
  sessions: SessionMappingItem[];
  nodeId?: string;
}

export function WorkflowAnalysisView({ sessions, nodeId }: WorkflowAnalysisViewProps) {
  // Fetch cross-session Graph RAG insights
  const {
    data: graphRagData,
    isLoading: isLoadingGraphRag,
    isEmpty: isGraphRagEmpty,
  } = useCrossSessionContext(nodeId, {
    lookbackDays: 30,
    maxResults: 20,
    enabled: !!nodeId,
  });
  // Generate workflows from real session data
  const workflows = sessions
    .filter((session) => session.chapters && session.chapters.length > 0)
    .map((session) => {
      // Convert chapter data to workflow steps for preview
      const steps = (session.chapters || []).slice(0, 4).map((chapter) => ({
        id: `chapter-${chapter.chapter_id}`,
        label: chapter.title,
      }));

      return {
        id: session.id,
        title: session.workflowName || 'Work Session',
        steps,
        hasInsights: false,
        confidence: session.categoryConfidence ? Math.round(session.categoryConfidence * 100) : undefined,
        // Pass the full session data to the preview card
        sessionData: session,
      };
    });

  // If no sessions with chapters, show placeholder
  if (workflows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
          <h3 className="flex items-center gap-2 font-semibold text-blue-900">
            <Layers size={20} />
            Workflow Analysis
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            Interactive visualization of your work journey and key milestones
          </p>
        </div>
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">
            No workflow data available yet. Push a session from the Desktop Companion to see your workflows.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-blue-900">
          <Layers size={20} />
          Workflow Analysis
        </h3>
        <p className="mt-1 text-sm text-blue-700">
          Interactive visualization of your work journey and key milestones
        </p>
      </div>

      {/* Cross-Session Insights from Graph RAG */}
      {!isGraphRagEmpty && graphRagData && (
        <CrossSessionInsights data={graphRagData} isLoading={isLoadingGraphRag} />
      )}

      {/* Workflow Preview Cards */}
      <div className="space-y-4">
        {workflows.map((workflow) => (
          <WorkflowPreviewCard
            key={workflow.id}
            workflowId={workflow.id}
            title={workflow.title}
            steps={workflow.steps}
            hasInsights={workflow.hasInsights}
            confidence={workflow.confidence}
          />
        ))}
      </div>
    </div>
  );
}
