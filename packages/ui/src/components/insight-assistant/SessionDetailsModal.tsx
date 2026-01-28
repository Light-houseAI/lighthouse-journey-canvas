/**
 * Session Details Modal
 *
 * Displays session details including:
 * - Session name
 * - Brief summary of the session
 * - Associated workflow name
 * - Brief summary of the workflow
 * - List of step descriptions
 *
 * Similar to the "Review Your Work Session" page in desktop app, but without screenshots.
 */

import React from 'react';
import {
  X,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Target,
  Workflow,
  FileText,
} from 'lucide-react';
import type {
  SessionMappingItem,
  SessionChapter,
  WorkflowV2,
  SemanticStep,
  GranularStep,
} from '@journey/schema';

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionMappingItem | null;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format timestamp to readable date/time
 */
function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Workflow Card Component - displays a single workflow with expandable steps
 */
function WorkflowCard({
  workflow,
  isExpanded,
  onToggle,
}: {
  workflow: WorkflowV2;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const durationMinutes = Math.round(workflow.timestamps.duration_ms / 60000);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Workflow Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <Workflow className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-gray-900">
            {workflow.classification.level_1_intent}
          </h4>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {workflow.workflow_summary}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {durationMinutes} min
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Layers className="h-3 w-3" />
              {workflow.semantic_steps.length} steps
            </span>
            {workflow.classification.level_4_tools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {workflow.classification.level_4_tools.slice(0, 3).map((tool, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                  >
                    {tool}
                  </span>
                ))}
                {workflow.classification.level_4_tools.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{workflow.classification.level_4_tools.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <ChevronRight
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Expanded Steps Section */}
      {isExpanded && workflow.semantic_steps.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4" />
              Steps in this workflow
            </h5>
            <div className="space-y-3">
              {workflow.semantic_steps.map((step, idx) => (
                <StepItem key={idx} step={step} index={idx + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step Item Component - displays a single semantic step
 */
function StepItem({ step, index }: { step: SemanticStep; index: number }) {
  const durationMinutes = Math.round(step.duration_seconds / 60);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{step.step_name}</p>
        <p className="mt-0.5 text-sm text-gray-600">{step.description}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">
            {durationMinutes > 0 ? `${durationMinutes} min` : '<1 min'}
          </span>
          {step.tools_involved.length > 0 && (
            <>
              <span className="text-xs text-gray-300">•</span>
              <span className="text-xs text-gray-400">
                {step.tools_involved.join(', ')}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Chapter Card Component - displays a V1 chapter with expandable steps
 */
function ChapterCard({
  chapter,
  isExpanded,
  onToggle,
}: {
  chapter: SessionChapter;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Chapter Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100">
          <Target className="h-5 w-5 text-purple-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-gray-900">
            {chapter.title}
          </h4>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {chapter.summary}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {chapter.primary_app && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {chapter.primary_app}
              </span>
            )}
            {chapter.granular_steps && chapter.granular_steps.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Layers className="h-3 w-3" />
                {chapter.granular_steps.length} steps
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>

      {/* Expanded Granular Steps */}
      {isExpanded && chapter.granular_steps && chapter.granular_steps.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-4">
            <h5 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="h-4 w-4" />
              Steps in this chapter
            </h5>
            <div className="space-y-3">
              {chapter.granular_steps.map((step, idx) => (
                <GranularStepItem key={idx} step={step} index={idx + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Granular Step Item Component - displays a single granular step (V1 format)
 */
function GranularStepItem({ step, index }: { step: GranularStep; index: number }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-600">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-700">{step.description}</p>
        <div className="mt-1 flex items-center gap-2">
          {step.app && (
            <span className="text-xs text-gray-400">{step.app}</span>
          )}
          {step.timestamp && (
            <>
              {step.app && <span className="text-xs text-gray-300">•</span>}
              <span className="text-xs text-gray-400">{step.timestamp}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get a descriptive session name from the session data
 * Priority: generatedTitle > first workflow's summary > first chapter's title > date-based name
 */
function getSessionName(session: SessionMappingItem): string {
  // Prefer the AI-generated title if available
  if (session.generatedTitle) {
    return session.generatedTitle;
  }

  // Use first workflow's summary (V2 schema)
  if (session.workflows && session.workflows.length > 0) {
    const firstWorkflow = session.workflows[0];
    // Use workflow_summary as the session name
    if (firstWorkflow.workflow_summary) {
      return firstWorkflow.workflow_summary;
    }
  }

  // Use first chapter's title (V1 schema)
  if (session.chapters && session.chapters.length > 0) {
    const firstChapter = session.chapters[0];
    if (firstChapter.title) {
      return firstChapter.title;
    }
  }

  // Fall back to date-based name
  if (session.startedAt) {
    const date = new Date(session.startedAt);
    return `Session on ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  return 'Untitled Session';
}

/**
 * Main Session Details Modal Component
 */
export function SessionDetailsModal({
  isOpen,
  onClose,
  session,
}: SessionDetailsModalProps) {
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  // Reset expanded items when session changes
  React.useEffect(() => {
    setExpandedItems(new Set());
  }, [session?.id]);

  if (!isOpen || !session) return null;

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Determine session name
  const sessionName = getSessionName(session);

  // Check schema version (V2 = workflows, V1 = chapters)
  const isV2 = session.schemaVersion === 2 || (session.workflows && session.workflows.length > 0);
  const workflows = session.workflows || [];
  const chapters = session.chapters || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-semibold text-white">{sessionName}</h2>
            <p className="mt-1 text-sm text-indigo-100">
              {session.highLevelSummary || 'Work session details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Session Metadata */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>{formatDateTime(session.startedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{formatDuration(session.durationSeconds)}</span>
            </div>
            {/* Show track/project name */}
            {(session.nodeTitle || session.workflowName) && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Layers className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Track:</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {session.nodeTitle || session.workflowName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="max-h-[calc(85vh-180px)] overflow-y-auto px-6 py-4">
          {/* V2 Workflows */}
          {isV2 && workflows.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Workflows ({workflows.length})
              </h3>
              {workflows.map((workflow, idx) => (
                <WorkflowCard
                  key={workflow.id || idx}
                  workflow={workflow}
                  isExpanded={expandedItems.has(workflow.id || `workflow-${idx}`)}
                  onToggle={() => toggleItem(workflow.id || `workflow-${idx}`)}
                />
              ))}
            </div>
          )}

          {/* V1 Chapters */}
          {!isV2 && chapters.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Chapters ({chapters.length})
              </h3>
              {chapters.map((chapter, idx) => (
                <ChapterCard
                  key={chapter.chapter_id || idx}
                  chapter={chapter}
                  isExpanded={expandedItems.has(`chapter-${chapter.chapter_id || idx}`)}
                  onToggle={() => toggleItem(`chapter-${chapter.chapter_id || idx}`)}
                />
              ))}
            </div>
          )}

          {/* No workflows/chapters */}
          {workflows.length === 0 && chapters.length === 0 && (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mt-3 text-sm text-gray-500">
                No detailed workflow information available for this session.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-gray-200 bg-gray-50 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionDetailsModal;
