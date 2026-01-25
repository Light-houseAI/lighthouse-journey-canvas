/**
 * Workflow Analysis View
 * Displays workflow preview cards using real session chapter data
 * Also shows Graph RAG cross-session insights
 */

import { SessionMappingItem } from '@journey/schema';
import { Layers } from 'lucide-react';

import { useCrossSessionContext } from '../../hooks/useCrossSessionContext';
import { getSessionDisplayTitle } from '../../utils/node-title';
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
  // Generate workflows from real session data (supports both V1 chapters and V2 workflows)
  const workflows = sessions
    .filter((session) => {
      // V2: workflows array or V1: chapters array
      const hasWorkflows = session.workflows && session.workflows.length > 0;
      const hasChapters = session.chapters && session.chapters.length > 0;
      return hasWorkflows || hasChapters;
    })
    .map((session) => {
      // Detect schema version
      const isV2 = session.workflows && session.workflows.length > 0;

      // Convert to workflow steps for preview
      let steps;
      if (isV2) {
        // V2: Use workflow classification intents
        steps = (session.workflows || []).slice(0, 4).map((workflow) => ({
          id: workflow.id || `workflow-${workflow.classification?.level_1_intent}`,
          label: workflow.classification?.level_1_intent || 'Workflow',
          // Include classification for richer preview
          classification: workflow.classification,
        }));
      } else {
        // V1: Use chapter titles
        steps = (session.chapters || []).slice(0, 4).map((chapter) => ({
          id: `chapter-${chapter.chapter_id}`,
          label: chapter.title,
        }));
      }

      return {
        id: session.id,
        title: getSessionDisplayTitle(session as any),
        steps,
        hasInsights: false,
        confidence: session.categoryConfidence ? Math.round(session.categoryConfidence * 100) : undefined,
        // Pass the full session data to the preview card
        sessionData: session,
        // Include schema version for components that need it
        schemaVersion: isV2 ? 2 : 1,
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
