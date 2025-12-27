/**
 * Workflow Analysis View
 * Displays workflow preview cards that users can click to see full flow diagrams
 */

import { SessionMappingItem } from '@journey/schema';
import { WorkflowPreviewCard } from './WorkflowPreviewCard';
import { Layers } from 'lucide-react';

interface WorkflowAnalysisViewProps {
  sessions: SessionMappingItem[];
  nodeId?: string;
}

export function WorkflowAnalysisView({ sessions, nodeId }: WorkflowAnalysisViewProps) {
  // Group sessions into workflows (for now, we'll create one workflow)
  // In production, this would analyze sessions and create multiple workflows
  const workflows = [
    {
      id: nodeId || 'default-workflow',
      title: sessions[0]?.workflowName || 'Work Journey',
      steps: [
        { id: 'research', label: 'Research & Planning' },
        { id: 'preparation', label: 'Preparation' },
        { id: 'execution', label: 'Execution' },
        { id: 'review', label: 'Review & Iterate' },
      ],
      hasInsights: true,
      confidence: 85,
    },
  ];

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
