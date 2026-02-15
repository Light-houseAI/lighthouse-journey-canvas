/**
 * Session & Workflow Mention Popup Component
 *
 * Appears when user types "@" in the chat input.
 * Tabbed interface: "Sessions" tab shows work sessions,
 * "Workflows" tab shows individual workflows extracted from sessions.
 * Supports viewing details and adding sessions, workflows, or steps.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FolderOpen,
  Clock,
  Calendar,
  Loader2,
  Search,
  X,
  Plus,
  ChevronRight,
  Layers,
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
  Group,
} from 'lucide-react';
import type { SessionMappingItem } from '@journey/schema';

import { getUserSessions } from '../../services/session-api';
import { getUserGroups, type Group as GroupType } from '../../services/groups-api';

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

interface SessionMentionPopupProps {
  /** Whether the popup is visible */
  isOpen: boolean;
  /** Callback when popup should close */
  onClose: () => void;
  /** Callback when a session is selected */
  onSelect: (session: SessionMappingItem) => void;
  /** Callback when a workflow is selected */
  onSelectWorkflow: (workflow: SessionWorkflow) => void;
  /** Callback when an individual step is selected */
  onSelectBlock: (step: SessionWorkflowStep, parentWorkflow: SessionWorkflow) => void;
  /** Callback when a group is selected */
  onGroupSelect?: (group: GroupType) => void;
  /** Search query (text after @) */
  searchQuery?: string;
  /** Position anchor element */
  anchorRef?: React.RefObject<HTMLElement>;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDurationMs(ms: number): string {
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

function getSessionName(session: SessionMappingItem): string {
  if (session.generatedTitle) return session.generatedTitle;
  if (session.workflows && session.workflows.length > 0) {
    if (session.workflows[0].workflow_summary) return session.workflows[0].workflow_summary;
  }
  if (session.chapters && session.chapters.length > 0) {
    if (session.chapters[0].title) return session.chapters[0].title;
  }
  if (session.startedAt) {
    const date = new Date(session.startedAt);
    return `Session on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  return 'Untitled Session';
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
// SESSION SUB-COMPONENTS
// ============================================================================

function SessionItem({
  session,
  isSelected,
  onView,
  onAdd,
}: {
  session: SessionMappingItem;
  isSelected: boolean;
  onView: () => void;
  onAdd: () => void;
}) {
  const sessionName = getSessionName(session);
  const workflowCount = session.workflows?.length || session.chapters?.length || 0;

  return (
    <div
      className={`flex w-full items-center gap-2 px-3 py-2 transition-colors ${
        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
      }`}
    >
      <button onClick={onView} className="flex flex-1 items-start gap-3 text-left">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
          isSelected ? 'bg-indigo-100' : 'bg-gray-100'
        }`}>
          <FolderOpen className={`h-4 w-4 ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
            {sessionName}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            {session.startedAt && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(session.startedAt)}
              </span>
            )}
            {session.durationSeconds && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(session.durationSeconds)}
              </span>
            )}
            {workflowCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {workflowCount} workflows
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
        className="flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
        title="Add to query"
      >
        <Plus className="h-3 w-3" />
        Add
      </button>
    </div>
  );
}

function ExpandableSteps({
  steps,
  type,
}: {
  steps: Array<{ step_name?: string; description?: string }>;
  type: 'semantic' | 'granular';
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displaySteps = isExpanded ? steps : steps.slice(0, 3);
  const hasMore = steps.length > 3;

  return (
    <div className="mt-2 space-y-1">
      {displaySteps.map((step, stepIdx) => (
        <div key={stepIdx} className="flex items-start gap-2 text-xs text-gray-500">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium">
            {stepIdx + 1}
          </span>
          <span>{type === 'semantic' ? (step.step_name || step.description) : step.description}</span>
        </div>
      ))}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-6 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {isExpanded ? 'Show less' : `+${steps.length - 3} more steps`}
        </button>
      )}
    </div>
  );
}

function SessionDetailView({
  session,
  onBack,
  onAdd,
}: {
  session: SessionMappingItem;
  onBack: () => void;
  onAdd: () => void;
}) {
  const sessionName = getSessionName(session);
  const workflows = session.workflows || [];
  const chapters = session.chapters || [];
  const isV2 = workflows.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{sessionName}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {session.startedAt && <span>{formatDate(session.startedAt)}</span>}
            {session.durationSeconds && <span>• {formatDuration(session.durationSeconds)}</span>}
          </div>
        </div>
        <button
          onClick={onAdd}
          className="flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add to query
        </button>
      </div>
      <div className="max-h-[380px] overflow-y-auto p-3">
        {session.highLevelSummary && (
          <div className="mb-3 rounded-lg bg-indigo-50 p-2">
            <p className="text-xs text-indigo-700">{session.highLevelSummary}</p>
          </div>
        )}
        {isV2 && workflows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Workflows ({workflows.length})
            </p>
            {workflows.map((workflow, idx) => (
              <div key={workflow.id || idx} className="rounded-lg border border-gray-200 bg-white p-2">
                <p className="text-sm font-medium text-gray-900">
                  {workflow.classification?.level_1_intent || workflow.workflow_summary || 'Workflow'}
                </p>
                {workflow.workflow_summary && workflow.classification?.level_1_intent && (
                  <p className="mt-0.5 text-xs text-gray-600">{workflow.workflow_summary}</p>
                )}
                {workflow.semantic_steps && workflow.semantic_steps.length > 0 && (
                  <ExpandableSteps steps={workflow.semantic_steps} type="semantic" />
                )}
              </div>
            ))}
          </div>
        )}
        {!isV2 && chapters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Chapters ({chapters.length})
            </p>
            {chapters.map((chapter, idx) => (
              <div key={chapter.chapter_id || idx} className="rounded-lg border border-gray-200 bg-white p-2">
                <p className="text-sm font-medium text-gray-900">{chapter.title}</p>
                {chapter.summary && (
                  <p className="mt-0.5 text-xs text-gray-600">{chapter.summary}</p>
                )}
                {chapter.granular_steps && chapter.granular_steps.length > 0 && (
                  <ExpandableSteps steps={chapter.granular_steps} type="granular" />
                )}
              </div>
            ))}
          </div>
        )}
        {workflows.length === 0 && chapters.length === 0 && (
          <div className="py-4 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-xs text-gray-500">No workflow details available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// WORKFLOW SUB-COMPONENTS
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
          <p className={`line-clamp-1 text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
            {workflow.intentCategory}
          </p>
          <p className={`mt-0.5 line-clamp-2 text-xs ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`}>
            {workflow.workflowSummary}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            {workflow.durationMs > 0 && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDurationMs(workflow.durationMs)}
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
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-medium text-gray-900">{workflow.intentCategory}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{workflow.workflowSummary}</p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
            {workflow.durationMs > 0 && <span>{formatDurationMs(workflow.durationMs)}</span>}
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
      <div className="max-h-[380px] overflow-y-auto p-3">
        {workflow.outcome && (
          <div className="mb-3 rounded-lg bg-emerald-50 p-2">
            <p className="text-xs font-medium text-emerald-800">Outcome</p>
            <p className="text-xs text-emerald-700">{workflow.outcome}</p>
          </div>
        )}
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
                    <p className="text-sm font-medium text-gray-900">{step.stepName}</p>
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
        {workflow.tools.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Tools used</p>
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

export function SessionMentionPopup({
  isOpen,
  onClose,
  onSelect,
  onSelectWorkflow,
  onSelectBlock,
  onGroupSelect,
  searchQuery = '',
}: SessionMentionPopupProps) {
  const [sessions, setSessions] = useState<SessionMappingItem[]>([]);
  const [groupsList, setGroupsList] = useState<GroupType[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'sessions' | 'workflows' | 'groups'>('sessions');

  // Session-specific state
  const [viewingSession, setViewingSession] = useState<SessionMappingItem | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Workflow-specific state
  const [viewingWorkflow, setViewingWorkflow] = useState<SessionWorkflow | null>(null);
  const [showAllWorkflows, setShowAllWorkflows] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch sessions on open (shared by both tabs)
  useEffect(() => {
    if (!isOpen) return;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getUserSessions({ limit: 50 });
        setSessions(response.sessions);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [isOpen]);

  // Fetch groups on open (for the Groups tab)
  useEffect(() => {
    if (!isOpen) return;

    const fetchGroups = async () => {
      setGroupsLoading(true);
      try {
        const groups = await getUserGroups();
        setGroupsList(groups);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, [isOpen]);

  // Extract workflows from sessions (for the Workflows tab)
  const workflows = useMemo(() => extractWorkflowsFromSessions(sessions), [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((session) => {
      const name = getSessionName(session).toLowerCase();
      const summary = (session.highLevelSummary || '').toLowerCase();
      return name.includes(query) || summary.includes(query);
    });
  }, [sessions, searchQuery]);

  // Filter workflows
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
      return summary.includes(query) || intent.includes(query) || tools.includes(query) || stepMatch;
    });
  }, [workflows, searchQuery]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupsList;
    const query = searchQuery.toLowerCase();
    return groupsList.filter((g) => {
      const name = g.name.toLowerCase();
      const desc = (g.description || '').toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }, [groupsList, searchQuery]);

  // Reset selected index when filtered results or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab, filteredSessions.length, filteredWorkflows.length]);

  // Reset state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setViewingSession(null);
      setViewingWorkflow(null);
      setShowAllSessions(false);
      setShowAllWorkflows(false);
      setActiveTab('sessions');
    }
  }, [isOpen]);

  // Reset detail views when search changes
  useEffect(() => {
    setViewingSession(null);
    setViewingWorkflow(null);
    setShowAllSessions(false);
    setShowAllWorkflows(false);
  }, [searchQuery]);

  // Handle tab switch
  const handleTabSwitch = useCallback((tab: 'sessions' | 'workflows' | 'groups') => {
    setActiveTab(tab);
    setSelectedIndex(0);
    setViewingSession(null);
    setViewingWorkflow(null);
    setShowAllSessions(false);
    setShowAllWorkflows(false);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Session detail view
      if (viewingSession) {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setViewingSession(null);
            break;
          case 'Enter':
            e.preventDefault();
            onSelect(viewingSession);
            break;
        }
        return;
      }

      // Workflow detail view
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

      // List view navigation
      const currentList = activeTab === 'sessions' ? filteredSessions : filteredWorkflows;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < currentList.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeTab === 'sessions' && filteredSessions[selectedIndex]) {
            setViewingSession(filteredSessions[selectedIndex]);
          } else if (activeTab === 'workflows' && filteredWorkflows[selectedIndex]) {
            setViewingWorkflow(filteredWorkflows[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, activeTab, filteredSessions, filteredWorkflows, selectedIndex, viewingSession, viewingWorkflow, onSelect, onSelectWorkflow, onClose]
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

  // Session detail view
  if (viewingSession) {
    return (
      <div
        ref={popupRef}
        className="absolute bottom-full left-0 right-0 mb-2 max-h-[500px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
      >
        <SessionDetailView
          session={viewingSession}
          onBack={() => setViewingSession(null)}
          onAdd={() => onSelect(viewingSession)}
        />
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">
            <kbd className="rounded bg-gray-200 px-1 font-mono">Enter</kbd> to add,{' '}
            <kbd className="rounded bg-gray-200 px-1 font-mono">Esc</kbd> to go back
          </span>
        </div>
      </div>
    );
  }

  // Workflow detail view
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

  // List view with tabs
  return (
    <div
      ref={popupRef}
      className="absolute bottom-full left-0 right-0 mb-2 max-h-96 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Add context</span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => handleTabSwitch('sessions')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sessions'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Sessions
          {!loading && filteredSessions.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
              activeTab === 'sessions' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {filteredSessions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabSwitch('workflows')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'border-b-2 border-emerald-600 text-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          Workflows
          {!loading && filteredWorkflows.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
              activeTab === 'workflows' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {filteredWorkflows.length}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabSwitch('groups')}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'groups'
              ? 'border-b-2 border-violet-600 text-violet-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Group className="h-3.5 w-3.5" />
          Groups
          {!groupsLoading && filteredGroups.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${
              activeTab === 'groups' ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {filteredGroups.length}
            </span>
          )}
        </button>
      </div>

      {/* Search hint */}
      {searchQuery && (
        <div className={`border-b border-gray-100 px-3 py-1.5 ${
          activeTab === 'sessions' ? 'bg-indigo-50' : activeTab === 'workflows' ? 'bg-emerald-50' : 'bg-violet-50'
        }`}>
          <span className={`text-xs ${
            activeTab === 'sessions' ? 'text-indigo-600' : activeTab === 'workflows' ? 'text-emerald-600' : 'text-violet-600'
          }`}>
            Filtering by: <strong>{searchQuery}</strong>
          </span>
        </div>
      )}

      {/* Content */}
      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        )}

        {error && !loading && (
          <div className="px-3 py-4 text-center text-sm text-red-600">{error}</div>
        )}

        {/* Sessions Tab */}
        {!loading && !error && activeTab === 'sessions' && (
          <>
            {filteredSessions.length === 0 && (
              <div className="px-3 py-6 text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? `No sessions matching "${searchQuery}"` : 'No work sessions found'}
                </p>
              </div>
            )}
            {filteredSessions.length > 0 && (
              <div className="py-1">
                {(showAllSessions ? filteredSessions : filteredSessions.slice(0, 10)).map((session, index) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isSelected={index === selectedIndex}
                    onView={() => setViewingSession(session)}
                    onAdd={() => onSelect(session)}
                  />
                ))}
                {filteredSessions.length > 10 && (
                  <div className="px-3 py-2 text-center">
                    <button
                      onClick={() => setShowAllSessions(!showAllSessions)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {showAllSessions ? 'Show less' : `+${filteredSessions.length - 10} more sessions`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Workflows Tab */}
        {!loading && !error && activeTab === 'workflows' && (
          <>
            {filteredWorkflows.length === 0 && (
              <div className="px-3 py-6 text-center">
                <Activity className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? `No workflows matching "${searchQuery}"` : 'No workflows found'}
                </p>
              </div>
            )}
            {filteredWorkflows.length > 0 && (
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
                      {showAllWorkflows ? 'Show less' : `+${filteredWorkflows.length - 10} more workflows`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <>
            {groupsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                <span className="ml-2 text-sm text-gray-500">Loading groups...</span>
              </div>
            )}
            {!groupsLoading && filteredGroups.length === 0 && (
              <div className="px-3 py-6 text-center">
                <Group className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? `No groups matching "${searchQuery}"` : 'No groups created yet'}
                </p>
              </div>
            )}
            {!groupsLoading && filteredGroups.length > 0 && (
              <div className="py-1">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-violet-50 cursor-pointer"
                    onClick={() => onGroupSelect?.(group)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Group className="h-4 w-4 text-violet-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{group.name}</p>
                        {group.description && (
                          <p className="text-xs text-gray-500 truncate">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs text-violet-600">
                        {group.itemCount} item{group.itemCount !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGroupSelect?.(group);
                        }}
                        className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-600 hover:bg-violet-200"
                      >
                        <Plus className="inline h-3 w-3 mr-0.5" />
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs text-gray-500">
          {activeTab === 'sessions'
            ? 'Click session to view details, or Add to insert'
            : activeTab === 'workflows'
              ? 'Click workflow to view steps, or Add to insert'
              : 'Click a group to add its sessions as context'}
        </span>
      </div>
    </div>
  );
}

export default SessionMentionPopup;
