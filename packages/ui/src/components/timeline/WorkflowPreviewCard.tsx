/**
 * WorkflowPreviewCard Component
 * Shows a mini preview of workflow steps with "View full workflow" on hover
 */

import { useLocation } from 'wouter';
import { Button } from '@journey/components';
import type { WorkflowNode } from '../../types/workflow-canvas';

interface WorkflowStep {
  id: string;
  label: string;
}

interface WorkflowPreviewCardProps {
  workflowId: string;
  title: string;
  steps: WorkflowStep[];
  hasInsights?: boolean;
  confidence?: number;
}

function WorkflowStepCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center px-4 py-3 min-w-[120px] max-w-[160px] h-16 rounded-lg border border-cyan-200 bg-cyan-50 text-sm font-medium text-gray-700 text-center shadow-sm">
      {label}
    </div>
  );
}

function WorkflowConnector() {
  return (
    <div className="flex items-center justify-center w-8 shrink-0">
      <svg width="32" height="12" viewBox="0 0 32 12" fill="none" className="text-cyan-400">
        <line x1="0" y1="6" x2="24" y2="6" stroke="currentColor" strokeWidth="2" />
        <polygon points="24,0 32,6 24,12" fill="currentColor" />
      </svg>
    </div>
  );
}

export function WorkflowPreviewCard({
  workflowId,
  title,
  steps,
  hasInsights,
  confidence,
}: WorkflowPreviewCardProps) {
  const [, setLocation] = useLocation();
  const displayedSteps = steps.slice(0, 4);

  const handleViewFullWorkflow = () => {
    setLocation(`/workflow-canvas/${workflowId}`);
  };

  return (
    <div className="mb-8">
      {/* Header row - outside card */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          {hasInsights && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
              Insights available
            </span>
          )}
        </div>
        {confidence && (
          <span className="text-sm text-gray-500">{confidence}% confidence</span>
        )}
      </div>

      {/* Preview card container */}
      <div className="group relative">
        <div className="relative rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 group-hover:shadow-lg">
          {/* Workflow steps preview */}
          <div className="flex items-center overflow-x-auto pb-2">
            {displayedSteps.map((step, index) => (
              <div key={step.id} className="flex items-center shrink-0">
                <WorkflowStepCard label={step.label} />
                {index < displayedSteps.length - 1 && <WorkflowConnector />}
              </div>
            ))}
          </div>

          {/* Hover overlay with button */}
          <div className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none group-hover:pointer-events-auto">
            <button
              onClick={handleViewFullWorkflow}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium shadow-md hover:bg-blue-700 transition-colors"
            >
              View full workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
