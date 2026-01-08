/**
 * WorkTrackDetail Page
 * Displays aggregated session data for a work track with appropriate visualization template
 */

import { Badge, Button, LoadingScreen, VStack } from '@journey/components';
import {
  TRACK_TEMPLATE_TYPE_LABELS,
  WORK_TRACK_ARCHETYPE_LABELS,
  WORK_TRACK_CATEGORY_LABELS,
  type SessionMappingItem,
  type TrackTemplateType,
  type WorkTrackArchetype,
} from '@journey/schema';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Activity,
  FileText,
  Layers,
  TrendingUp,
  CheckCircle,
  Target,
  ListChecks,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';

import { useNodeSessions } from '../hooks/useNodeSessions';
import { useTimelineNodes } from '../hooks/useTimeline';
import {
  formatSessionDuration,
  formatSessionDate,
  formatSessionTimeRange,
} from '../services/session-api';
import { getSessionDisplayTitle } from '../utils/node-title';
import { WorkflowAnalysisView } from '../components/timeline/WorkflowAnalysisView';
import { ProgressUpdateView } from '../components/timeline/ProgressUpdateView';
import { StorySummaryView } from '../components/timeline/StorySummaryView';
import { ProgressSnapshotView } from '../components/timeline/ProgressSnapshotView';
import { WorkTrackLeftNav } from '../components/timeline/WorkTrackLeftNav';
import { WorkflowContentArea } from '../components/timeline/WorkflowContentArea';

/**
 * Template-specific session renderer
 */
function WorkflowApproachView({ sessions }: { sessions: SessionMappingItem[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-blue-900">
          <Layers size={20} />
          Workflow Steps
        </h3>
        <p className="mt-1 text-sm text-blue-700">
          Your development journey broken down by session
        </p>
      </div>

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
              <h4 className="font-medium text-gray-900">
                {getSessionDisplayTitle(session as any)}
              </h4>
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
  );
}

function CaseStudyNarrativeView({ sessions }: { sessions: SessionMappingItem[] }) {
  // Group sessions into phases
  const phases = [
    { name: 'Research & Discovery', icon: Target, sessions: sessions.slice(0, Math.ceil(sessions.length / 3)) },
    { name: 'Analysis & Strategy', icon: TrendingUp, sessions: sessions.slice(Math.ceil(sessions.length / 3), Math.ceil(sessions.length * 2 / 3)) },
    { name: 'Execution & Outcomes', icon: CheckCircle, sessions: sessions.slice(Math.ceil(sessions.length * 2 / 3)) },
  ].filter(phase => phase.sessions.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-purple-900">
          <FileText size={20} />
          Case Study Narrative
        </h3>
        <p className="mt-1 text-sm text-purple-700">
          Your research journey from problem to solution
        </p>
      </div>

      {phases.map((phase, phaseIndex) => (
        <div key={phase.name} className="rounded-lg border border-gray-200 p-4">
          <h4 className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
            <phase.icon size={18} className="text-purple-500" />
            {phase.name}
          </h4>
          <div className="space-y-3">
            {phase.sessions.map((session) => (
              <div key={session.id} className="rounded bg-gray-50 p-3">
                <h5 className="font-medium text-gray-800">{getSessionDisplayTitle(session as any)}</h5>
                {session.highLevelSummary && (
                  <p className="mt-1 text-sm text-gray-600">{session.highLevelSummary}</p>
                )}
                <div className="mt-2 text-xs text-gray-500">
                  {formatSessionDate(session.startedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineChronicleView({ sessions }: { sessions: SessionMappingItem[] }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-gradient-to-r from-gray-50 to-slate-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <ListChecks size={20} />
          Activity Timeline
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Chronological view of all work sessions
        </p>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-gray-900">
                  {getSessionDisplayTitle(session as any)}
                </h4>
                {session.highLevelSummary && (
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                    {session.highLevelSummary}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatSessionDate(session.startedAt)}
                  </span>
                  {session.startedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatSessionTimeRange(session.startedAt, session.endedAt)}
                    </span>
                  )}
                  {session.durationSeconds && (
                    <span className="flex items-center gap-1">
                      <Activity size={12} />
                      {formatSessionDuration(session.durationSeconds)}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="flex-shrink-0 text-xs bg-gray-100 text-gray-700">
                {WORK_TRACK_CATEGORY_LABELS[session.category] || session.category}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render sessions based on template type
 */
function SessionsView({
  sessions,
  templateType,
}: {
  sessions: SessionMappingItem[];
  templateType?: TrackTemplateType;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Sessions pushed from your desktop app will appear here
        </p>
      </div>
    );
  }

  // Choose view based on template type
  switch (templateType) {
    case 'WORKFLOW_APPROACH':
      return <WorkflowApproachView sessions={sessions} />;
    case 'CASE_STUDY_NARRATIVE':
      return <CaseStudyNarrativeView sessions={sessions} />;
    case 'TIMELINE_CHRONICLE':
    default:
      return <TimelineChronicleView sessions={sessions} />;
  }
}

/**
 * Summary stats component
 */
function WorkTrackStats({
  sessionCount,
  totalDuration,
}: {
  sessionCount: number;
  totalDuration: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div className="rounded-lg bg-blue-50 p-4">
        <div className="text-2xl font-bold text-blue-700">{sessionCount}</div>
        <div className="text-sm text-blue-600">Total Sessions</div>
      </div>
      <div className="rounded-lg bg-green-50 p-4">
        <div className="text-2xl font-bold text-green-700">
          {formatSessionDuration(totalDuration)}
        </div>
        <div className="text-sm text-green-600">Total Time</div>
      </div>
      <div className="rounded-lg bg-purple-50 p-4">
        <div className="text-2xl font-bold text-purple-700">
          {sessionCount > 0 ? formatSessionDuration(Math.round(totalDuration / sessionCount)) : '0m'}
        </div>
        <div className="text-sm text-purple-600">Avg Session</div>
      </div>
    </div>
  );
}

/**
 * Template selector dropdown component
 */
interface TemplateOption {
  value: string;
  label: string;
}

const templateOptions: TemplateOption[] = [
  { value: 'workflow-analysis', label: 'Workflow analysis' },
  { value: 'progress-snapshot', label: 'Progress Snapshot' },
  { value: 'progress-update', label: 'Progress update' },
  { value: 'story-summary', label: 'Story summary' },
];

function TemplateSelector({
  selectedTemplate,
  onTemplateChange,
}: {
  selectedTemplate: string;
  onTemplateChange: (template: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900 font-medium px-4 py-2 h-auto"
      >
        Current template:{' '}
        {templateOptions.find((t) => t.value === selectedTemplate)?.label || selectedTemplate}
        <ChevronDown className="ml-2 w-4 h-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            {templateOptions.map((template) => (
              <button
                key={template.value}
                onClick={() => {
                  onTemplateChange(template.value);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
              >
                <span
                  className={
                    selectedTemplate === template.value ? 'font-medium text-gray-900' : 'text-gray-700'
                  }
                >
                  {template.label}
                </span>
                {selectedTemplate === template.value && <Check className="w-4 h-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Main WorkTrackDetail component
 */
export default function WorkTrackDetail() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [location, setLocation] = useLocation();
  const { data: nodes, isLoading: nodesLoading } = useTimelineNodes();

  // Get initial template from URL query parameter
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const initialTemplate = searchParams.get('template') || 'workflow-analysis';
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);
  const [activeCategoryId, setActiveCategoryId] = useState('discovery');

  // Find the work track node
  const workTrack = nodes?.find((n) => n.id === nodeId);
  
  // Fetch sessions for this work track (max 50 per schema validation)
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
  } = useNodeSessions(nodeId || '', { limit: 50 }, !!nodeId);

  const isLoading = nodesLoading || sessionsLoading;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!workTrack) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-2xl font-bold text-gray-900">Work Track Not Found</h1>
        <p className="mt-2 text-gray-600">The work track you're looking for doesn't exist.</p>
        <Button onClick={() => setLocation('/')} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const title = workTrack.meta?.title || 'Work Track';
  const description = workTrack.meta?.description;
  const templateType = workTrack.meta?.templateType as TrackTemplateType | undefined;
  const archetype = workTrack.meta?.workTrackArchetype as WorkTrackArchetype | undefined;
  const sessions = sessionsData?.sessions || [];
  const totalDuration = sessionsData?.totalDurationSeconds || 0;
  const sessionCount = sessionsData?.sessionCount || 0;

  // Extract start date for header
  const startedDate = workTrack.meta?.startDate
    ? new Date(String(workTrack.meta.startDate)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header matching journey-workflows */}
      <header className="w-full bg-white border-b border-gray-200 pb-6">
        <div className="max-w-full mx-auto px-6">
          {/* Top row: Back nav + Template dropdown */}
          <div className="flex items-start justify-between pt-6">
            {/* Left side */}
            <div className="flex flex-col gap-2">
              {/* Back navigation */}
              <button
                onClick={() => setLocation('/')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to my journeys</span>
              </button>

              {/* Journey title */}
              <h1 className="text-2xl font-semibold text-gray-900 mt-1">
                {title}
              </h1>

              {/* Metadata row */}
              <div className="flex items-center gap-6 mt-2 text-sm text-gray-500">
                <span>
                  Started journey: <span className="text-gray-900">{startedDate}</span>
                </span>
                <span>
                  Last update: <span className="text-gray-900">Yesterday</span>
                </span>
                <span>
                  Work sessions:{' '}
                  <span className="text-gray-900 underline underline-offset-2">
                    {sessionCount} total
                  </span>
                </span>
              </div>
            </div>

            {/* Right side: Template dropdown */}
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
            />
          </div>
        </div>
      </header>

      {/* Main content area with left nav - matching journey-workflows layout */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {selectedTemplate === 'workflow-analysis' ? (
          <>
            <WorkTrackLeftNav sessions={sessions} activeCategoryId={activeCategoryId} />
            <WorkflowContentArea
              sessions={sessions}
              nodeId={nodeId}
              onCategoryInView={setActiveCategoryId}
            />
          </>
        ) : (
          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="max-w-4xl mx-auto p-6 lg:p-10">
              {/* Stats */}
              <WorkTrackStats sessionCount={sessionCount} totalDuration={totalDuration} />

              {/* View based on selected template */}
              <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
                {selectedTemplate === 'progress-snapshot' && (
                  <ProgressSnapshotView sessions={sessions} totalDuration={totalDuration} nodeTitle={title} nodeId={nodeId} />
                )}
                {selectedTemplate === 'progress-update' && (
                  <ProgressUpdateView sessions={sessions} totalDuration={totalDuration} />
                )}
                {selectedTemplate === 'story-summary' && (
                  <StorySummaryView sessions={sessions} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

