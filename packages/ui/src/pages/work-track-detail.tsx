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
} from 'lucide-react';
import { useParams, useLocation } from 'wouter';

import { useNodeSessions } from '../hooks/useNodeSessions';
import { useTimelineNodes } from '../hooks/useTimeline';
import {
  formatSessionDuration,
  formatSessionDate,
  formatSessionTimeRange,
} from '../services/session-api';

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
                {session.workflowName || 'Work Session'}
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
                <h5 className="font-medium text-gray-800">{session.workflowName}</h5>
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
                  {session.workflowName || 'Work Session'}
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
 * Main WorkTrackDetail component
 */
export default function WorkTrackDetail() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [, setLocation] = useLocation();
  const { data: nodes, isLoading: nodesLoading } = useTimelineNodes();
  
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4 -ml-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Journey
          </Button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {description && (
                <p className="mt-1 text-gray-600">{description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {archetype && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {WORK_TRACK_ARCHETYPE_LABELS[archetype] || archetype}
                  </Badge>
                )}
                {templateType && (
                  <Badge variant="outline">
                    {TRACK_TEMPLATE_TYPE_LABELS[templateType] || templateType}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <VStack spacing={6}>
          {/* Stats */}
          <WorkTrackStats sessionCount={sessionCount} totalDuration={totalDuration} />

          {/* Sessions by template */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <SessionsView sessions={sessions} templateType={templateType} />
          </div>
        </VStack>
      </div>
    </div>
  );
}

