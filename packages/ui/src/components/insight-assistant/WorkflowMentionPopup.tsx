/**
 * Workflow Mention Popup Component
 *
 * Appears when user types "/" in the chat input.
 * Shows a searchable list of workflows extracted from user sessions.
 * Supports viewing workflow details and adding individual steps.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Clock,
  Loader2,
  Search,
  X,
  Plus,
  ChevronRight,
  ArrowLeft,
  Activity,
  Zap,
  Wrench,
  type LucideIcon,
  Bug,
  BookOpen,
  Eye,
  Rocket,
  FileText,
  MessageSquare,
  Palette,
  FlaskConical,
  RefreshCw,
  Hammer,
  Calendar,
} from 'lucide-react';

import { getUserSessions } from '../../services/session-api';
import type { SessionMappingItem } from '@journey/schema';

// ============================================================================
// TYPES: Workflows & steps extracted from user sessions
// ============================================================================

/** A workflow extracted from a user session */
export interface SessionWorkflow {
  /** Workflow ID (from session's workflow.id) */
  id: string;
  /** Workflow summary description */
  workflowSummary: string;
  /** Intent category (classification.level_1_intent) */
  intentCategory: string;
  /** Problem being solved (classification.level_2_problem) */
  problem: string;
  /** Approach used (classification.level_3_approach) */
  approach: string;
  /** Tools used (classification.level_4_tools) */
  tools: string[];
  /** Outcome achieved (classification.level_5_outcome) */
  outcome: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Semantic steps within the workflow */
  steps: SessionWorkflowStep[];
  /** Parent session ID */
  sessionId: string;
  /** Parent session title */
  sessionTitle: string;
  /** Session date */
  sessionDate: string | null;
}

/** A semantic step within a session workflow */
export interface SessionWorkflowStep {
  /** Step name */
  stepName: string;
  /** Step description */
  description: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** Tools used in this step */
  toolsInvolved: string[];
  /** Parent workflow ID */
  parentWorkflowId: string;
  /** Parent workflow summary */
  parentWorkflowSummary: string;
}

// ============================================================================
// PROPS
// ============================================================================

interface WorkflowMentionPopupProps {
  /** Whether the popup is visible */
  isOpen: boolean;
  /** Callback when popup should close */
  onClose: () => void;
  /** Callback when a workflow is selected */
  onSelectWorkflow: (workflow: SessionWorkflow) => void;
  /** Callback when an individual step is selected */
  onSelectBlock: (step: SessionWorkflowStep, parentWorkflow: SessionWorkflow) => void;
  /** Search query (text after /) */
  searchQuery?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatStepDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getIntentIcon(intent: string): LucideIcon {
  const lower = intent.toLowerCase();
  if (lower.includes('build') || lower.includes('develop') || lower.includes('implement')) return Hammer;
  if (lower.includes('debug') || lower.includes('fix') || lower.includes('troubleshoot')) return Bug;
  if (lower.includes('research') || lower.includes('learn') || lower.includes('explore')) return BookOpen;
  if (lower.includes('review') || lower.includes('audit')) return Eye;
  if (lower.includes('deploy') || lower.includes('release') || lower.includes('ship')) return Rocket;
  if (lower.includes('document') || lower.includes('write')) return FileText;
  if (lower.includes('communicat') || lower.includes('discuss') || lower.includes('meet')) return MessageSquare;
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux')) return Palette;
  if (lower.includes('test') || lower.includes('qa') || lower.includes('experiment')) return FlaskConical;
  if (lower.includes('refactor') || lower.includes('clean') || lower.includes('optimize')) return RefreshCw;
  return Activity;
}

function getIntentColor(intent: string): { bg: string; text: string; badge: string } {
  const lower = intent.toLowerCase();
  if (lower.includes('build') || lower.includes('develop') || lower.includes('implement'))
    return { bg: 'bg-amber-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
  if (lower.includes('debug') || lower.includes('fix') || lower.includes('troubleshoot'))
    return { bg: 'bg-red-50', text: 'text-red-600', badge: 'bg-red-100 text-red-700' };
  if (lower.includes('research') || lower.includes('learn') || lower.includes('explore'))
    return { bg: 'bg-blue-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' };
  if (lower.includes('review') || lower.includes('audit'))
    return { bg: 'bg-purple-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' };
  if (lower.includes('deploy') || lower.includes('release') || lower.includes('ship'))
    return { bg: 'bg-green-50', text: 'text-green-600', badge: 'bg-green-100 text-green-700' };
  if (lower.includes('test') || lower.includes('qa') || lower.includes('experiment'))
    return { bg: 'bg-teal-50', text: 'text-teal-600', badge: 'bg-teal-100 text-teal-700' };
  if (lower.includes('refactor') || lower.includes('clean') || lower.includes('optimize'))
    return { bg: 'bg-orange-50', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' };
}

/**
 * Extract all workflows from sessions into a flat list
 */
function extractWorkflowsFromSessions(sessions: SessionMappingItem[]): SessionWorkflow[] {
  const workflows: SessionWorkflow[] = [];

  for (const session of sessions) {
    if (!session.workflows || session.workflows.length === 0) continue;

    const sessionTitle =
      session.generatedTitle ||
      session.workflows[0]?.workflow_summary ||
      session.chapters?.[0]?.title ||
      'Untitled Session';

    for (const wf of session.workflows) {
      workflows.push({
        id: wf.id,
        workflowSummary: wf.workflow_summary,
        intentCategory: wf.classification?.level_1_intent || 'General',
        problem: wf.classification?.level_2_problem || '',
        approach: wf.classification?.level_3_approach || '',
        tools: wf.classification?.level_4_tools || [],
        outcome: wf.classification?.level_5_outcome || '',
        durationMs: wf.timestamps?.duration_ms || 0,
        steps: (wf.semantic_steps || []).map((step) => ({
          stepName: step.step_name,
          description: step.description,
          durationSeconds: step.duration_seconds,
          toolsInvolved: step.tools_involved || [],
          parentWorkflowId: wf.id,
          parentWorkflowSummary: wf.workflow_summary,
        })),
        sessionId: session.id,
        sessionTitle,
        sessionDate: session.startedAt,
      });
    }
  }

  return workflows;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function WorkflowItem({
  workflow,
  isSelected,
  onView,
  onAdd,
}: {
  workflow: SessionWorkflow;
  isSelected: boolean;
  onView: () => void;
  onAdd: () => void;
}) {
  const IntentIcon = getIntentIcon(workflow.intentCategory);
  const colors = getIntentColor(workflow.intentCategory);

  return (
    <div
      className={`flex w-full items-center gap-2 px-3 py-2 transition-colors ${
        isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
      }`}
    >
      <button onClick={onView} className="flex flex-1 items-start gap-3 text-left">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          isSelected ? 'bg-emerald-100' : colors.bg
        }`}>
          <IntentIcon className={`h-4 w-4 ${isSelected ? 'text-emerald-600' : colors.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`line-clamp-2 text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
            {workflow.workflowSummary}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className={`inline-flex items-center rounded px-1 py-0.5 ${colors.badge}`}>
              {workflow.intentCategory}
            </span>
            {workflow.durationMs > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(workflow.durationMs)}
              </span>
            )}
            {workflow.steps.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {workflow.steps.length} steps
              </span>
            )}
            {workflow.sessionDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(workflow.sessionDate)}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
        title="Add workflow to query"
      >
        <Plus className="h-3 w-3" />
        Add
      </button>
    </div>
  );
}

function WorkflowDetailView({
  workflow,
  onBack,
  onAddWorkflow,
  onAddStep,
}: {
  workflow: SessionWorkflow;
  onBack: () => void;
  onAddWorkflow: () => void;
  onAddStep: (step: SessionWorkflowStep) => void;
}) {
  const IntentIcon = getIntentIcon(workflow.intentCategory);
  const colors = getIntentColor(workflow.intentCategory);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-gray-900">{workflow.workflowSummary}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`inline-flex items-center gap-1 rounded px-1 py-0.5 ${colors.badge}`}>
              <IntentIcon className="h-3 w-3" />
              {workflow.intentCategory}
            </span>
            {workflow.durationMs > 0 && <span>{formatDuration(workflow.durationMs)}</span>}
            <span className="text-gray-400">from {workflow.sessionTitle}</span>
          </div>
        </div>
        <button
          onClick={onAddWorkflow}
          className="flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add workflow
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[380px] overflow-y-auto p-3">
        {/* Outcome */}
        {workflow.outcome && (
          <div className="mb-3 rounded-lg bg-emerald-50 p-2">
            <p className="text-xs font-medium text-emerald-800">Outcome</p>
            <p className="text-xs text-emerald-700">{workflow.outcome}</p>
          </div>
        )}

        {/* Steps */}
        {workflow.steps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Steps ({workflow.steps.length})
            </p>
            {workflow.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium text-gray-900">
                      {step.stepName}
                    </p>
                  </div>
                  <p className="ml-7 mt-0.5 text-xs text-gray-600">{step.description}</p>
                  <div className="ml-7 mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {step.durationSeconds > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatStepDuration(step.durationSeconds)}
                      </span>
                    )}
                    {step.toolsInvolved.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {step.toolsInvolved.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onAddStep(step)}
                  className="flex h-6 flex-shrink-0 items-center gap-1 rounded bg-teal-600 px-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700"
                  title="Add this step to query"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tools */}
        {workflow.tools.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Tools used
            </p>
            <div className="flex flex-wrap gap-1.5">
              {workflow.tools.map((tool) => (
                <span
                  key={tool}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  <Wrench className="h-3 w-3" />
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {workflow.steps.length === 0 && (
          <div className="py-4 text-center">
            <Activity className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-xs text-gray-500">No step details available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WorkflowMentionPopup({
  isOpen,
  onClose,
  onSelectWorkflow,
  onSelectBlock,
  searchQuery = '',
}: WorkflowMentionPopupProps) {
  const [workflows, setWorkflows] = useState<SessionWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingWorkflow, setViewingWorkflow] = useState<SessionWorkflow | null>(null);
  const [showAllWorkflows, setShowAllWorkflows] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch sessions and extract workflows
  useEffect(() => {
    if (!isOpen) return;

    const fetchWorkflows = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getUserSessions({ limit: 50 });
        const extracted = extractWorkflowsFromSessions(response.sessions);
        setWorkflows(extracted);
      } catch (err) {
        console.error('Failed to fetch workflows:', err);
        setError('Failed to load workflows');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [isOpen]);

  // Filter workflows based on search query
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery) return workflows;

    const query = searchQuery.toLowerCase();
    return workflows.filter((wf) => {
      const summary = wf.workflowSummary.toLowerCase();
      const intent = wf.intentCategory.toLowerCase();
      const tools = wf.tools.join(' ').toLowerCase();
      const stepMatch = wf.steps.some(
        (s) =>
          s.stepName.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query)
      );
      return (
        summary.includes(query) ||
        intent.includes(query) ||
        tools.includes(query) ||
        stepMatch
      );
    });
  }, [workflows, searchQuery]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredWorkflows.length]);

  // Reset viewing workflow when popup closes or search changes
  useEffect(() => {
    if (!isOpen) {
      setViewingWorkflow(null);
      setShowAllWorkflows(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setViewingWorkflow(null);
    setShowAllWorkflows(false);
  }, [searchQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (viewingWorkflow) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setViewingWorkflow(null);
            break;
          case 'Enter':
            e.preventDefault();
            onSelectWorkflow(viewingWorkflow);
            break;
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredWorkflows.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredWorkflows[selectedIndex]) {
            setViewingWorkflow(filteredWorkflows[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredWorkflows, selectedIndex, onSelectWorkflow, onClose, viewingWorkflow]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Detail view
  if (viewingWorkflow) {
    return (
      <div
        ref={popupRef}
        className="absolute bottom-full left-0 right-0 mb-2 max-h-[500px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      >
        <WorkflowDetailView
          workflow={viewingWorkflow}
          onBack={() => setViewingWorkflow(null)}
          onAddWorkflow={() => onSelectWorkflow(viewingWorkflow)}
          onAddStep={(step) => onSelectBlock(step, viewingWorkflow)}
        />
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">
            <kbd className="rounded bg-gray-200 px-1 font-mono">Enter</kbd> to add workflow,{' '}
            <kbd className="rounded bg-gray-200 px-1 font-mono">Esc</kbd> to go back
          </span>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      ref={popupRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            Select a workflow or step
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search hint */}
      {searchQuery && (
        <div className="border-b border-gray-100 bg-emerald-50 px-3 py-1.5">
          <span className="text-xs text-emerald-600">
            Filtering by: <strong>{searchQuery}</strong>
          </span>
        </div>
      )}

      {/* Content */}
      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-gray-500">Loading workflows...</span>
          </div>
        )}

        {error && !loading && (
          <div className="px-3 py-4 text-center text-sm text-red-600">{error}</div>
        )}

        {!loading && !error && filteredWorkflows.length === 0 && (
          <div className="px-3 py-6 text-center">
            <Activity className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {searchQuery
                ? `No workflows matching "${searchQuery}"`
                : 'No workflows found'}
            </p>
          </div>
        )}

        {!loading && !error && filteredWorkflows.length > 0 && (
          <div className="py-1">
            {(showAllWorkflows ? filteredWorkflows : filteredWorkflows.slice(0, 10)).map(
              (workflow, index) => (
                <WorkflowItem
                  key={`${workflow.sessionId}-${workflow.id}`}
                  workflow={workflow}
                  isSelected={index === selectedIndex}
                  onView={() => setViewingWorkflow(workflow)}
                  onAdd={() => onSelectWorkflow(workflow)}
                />
              )
            )}
            {filteredWorkflows.length > 10 && (
              <div className="px-3 py-2 text-center">
                <button
                  onClick={() => setShowAllWorkflows(!showAllWorkflows)}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {showAllWorkflows
                    ? 'Show less'
                    : `+${filteredWorkflows.length - 10} more workflows`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs text-gray-500">
          Click workflow to view steps, or{' '}
          <kbd className="rounded bg-gray-200 px-1 font-mono">Add</kbd> to insert
        </span>
      </div>
    </div>
  );
}

export default WorkflowMentionPopup;
