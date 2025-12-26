/**
 * Workflow Analysis View
 * Displays session data with an interactive workflow canvas diagram
 */

import { SessionMappingItem } from '@journey/schema';
import { WorkflowCanvas } from './WorkflowCanvas';
import { generateWorkflowFromSessions } from '../../data/workflow-canvas-data';
import { Layers, Calendar, Clock } from 'lucide-react';
import { formatSessionDuration, formatSessionDate } from '../../services/session-api';

interface WorkflowAnalysisViewProps {
  sessions: SessionMappingItem[];
}

export function WorkflowAnalysisView({ sessions }: WorkflowAnalysisViewProps) {
  const workflow = generateWorkflowFromSessions();

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

      {/* Workflow Canvas Diagram */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Your Workflow Journey</h4>
        <WorkflowCanvas workflow={workflow} />
      </div>

      {/* Session Details Below */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Session Timeline</h4>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Sessions as workflow steps */}
          {sessions.map((session, index) => (
            <div key={session.id} className="relative pl-10 pb-6">
              {/* Step indicator */}
              <div className="absolute left-2 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">
                {index + 1}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h5 className="font-medium text-gray-900">
                  {session.workflowName || 'Work Session'}
                </h5>
                {session.highLevelSummary && (
                  <p className="mt-2 text-sm text-gray-600">{session.highLevelSummary}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatSessionDate(session.startedAt)}
                  </span>
                  {session.durationSeconds && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatSessionDuration(session.durationSeconds)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
