/**
 * NodeSessions Component
 * Displays desktop sessions mapped to a timeline node
 * (LIG-247: Desktop Session to Work Track Mapping)
 */

import { Badge, Skeleton, VStack, Button } from '@journey/components';
import type { SessionMappingItem } from '@journey/schema';
import { WORK_TRACK_CATEGORY_LABELS } from '@journey/schema';
import { Clock, Calendar, FileText, Activity, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { useNodeSessions } from '../../hooks/useNodeSessions';
import {
  formatSessionDuration,
  formatSessionDate,
  formatSessionTimeRange,
} from '../../services/session-api';
import { WorkflowAnalysisPanel } from '../workflow/WorkflowAnalysisPanel';
import { TopWorkflowPanel } from '../workflow/TopWorkflowPanel';
import { HierarchicalWorkflowPanel } from '../workflow/HierarchicalWorkflowPanel';

interface NodeSessionsProps {
  nodeId: string;
  enabled?: boolean;
}

/**
 * Get category badge color based on category group
 */
function getCategoryColor(category: string): string {
  // Career Development - blue
  if (['job_search', 'interview_prep', 'networking', 'career_planning', 'resume_portfolio', 'personal_branding'].includes(category)) {
    return 'bg-blue-100 text-blue-700';
  }
  // Learning & Education - green
  if (['online_course', 'certification_study', 'self_study', 'skill_practice', 'research'].includes(category)) {
    return 'bg-green-100 text-green-700';
  }
  // Current Role Work - purple
  if (['core_work', 'meetings', 'communication', 'code_review', 'planning_strategy', 'mentoring'].includes(category)) {
    return 'bg-purple-100 text-purple-700';
  }
  // Projects - orange
  if (['work_project', 'side_project', 'open_source', 'freelance_work'].includes(category)) {
    return 'bg-orange-100 text-orange-700';
  }
  // Administrative - gray
  return 'bg-gray-100 text-gray-700';
}

/**
 * Single session item display
 */
function SessionItem({ session }: { session: SessionMappingItem }) {
  const categoryLabel = WORK_TRACK_CATEGORY_LABELS[session.category] || session.category;
  const categoryColor = getCategoryColor(session.category);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Workflow name / Title */}
          <h5 className="font-medium text-gray-900 line-clamp-1">
            {session.workflowName || (session as any).generatedTitle || 'Work Session'}
          </h5>

          {/* High-level summary */}
          {session.highLevelSummary && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
              {session.highLevelSummary}
            </p>
          )}

          {/* Metadata row */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>{formatSessionDate(session.startedAt)}</span>
            </div>

            {/* Time range */}
            {session.startedAt && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{formatSessionTimeRange(session.startedAt, session.endedAt)}</span>
              </div>
            )}

            {/* Duration */}
            {session.durationSeconds && (
              <div className="flex items-center gap-1">
                <Activity size={12} />
                <span>{formatSessionDuration(session.durationSeconds)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Category badge */}
        <Badge variant="secondary" className={`flex-shrink-0 text-xs ${categoryColor}`}>
          {categoryLabel}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for sessions
 */
function SessionsSkeleton() {
  return (
    <VStack spacing={3} className="flex flex-col">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </VStack>
  );
}

/**
 * Empty state when no sessions exist
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-6 px-4">
      <FileText className="h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-500 text-center">
        No work sessions yet
      </p>
      <p className="text-xs text-gray-400 text-center mt-1">
        Sessions pushed from desktop will appear here
      </p>
    </div>
  );
}

/**
 * NodeSessions - Main component
 * Displays sessions for a timeline node with loading and empty states
 */
export function NodeSessions({ nodeId, enabled = true }: NodeSessionsProps) {
  const { data, isLoading, error } = useNodeSessions(nodeId, { limit: 5 }, enabled);
  const [showWorkflowAnalysis, setShowWorkflowAnalysis] = useState(false);
  const [showTopWorkflows, setShowTopWorkflows] = useState(false);

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Work Sessions</h4>
        <SessionsSkeleton />
      </div>
    );
  }

  if (error) {
    console.error('NodeSessions error:', { nodeId, error });
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Work Sessions</h4>
        <p className="text-sm text-red-500">
          Failed to load sessions: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const totalDuration = data?.totalDurationSeconds || 0;
  const sessionCount = data?.sessionCount || 0;

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('NodeSessions data:', { nodeId, sessionCount, sessions: sessions.length, data });
  }

  return (
    <div className="mt-4">
      {/* Section header with stats */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">
          Work Sessions
          {sessionCount > 0 && (
            <span className="ml-2 text-xs text-gray-500 font-normal">
              ({sessionCount} session{sessionCount !== 1 ? 's' : ''} · {formatSessionDuration(totalDuration)} total)
            </span>
          )}
        </h4>

        {/* Workflow buttons - only show if there are sessions */}
        {sessionCount > 0 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowTopWorkflows(!showTopWorkflows);
                if (!showTopWorkflows) setShowWorkflowAnalysis(false);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <TrendingUp size={14} />
              Top Workflow
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowWorkflowAnalysis(!showWorkflowAnalysis);
                if (!showWorkflowAnalysis) setShowTopWorkflows(false);
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <Sparkles size={14} />
              Workflow Analysis
            </Button>
          </div>
        )}
      </div>

      {/* Hierarchical Workflow Panel - shown when button is clicked */}
      {/* Uses the new 3-level hierarchy: Patterns → Blocks → Steps */}
      {showTopWorkflows && sessionCount > 0 && (
        <HierarchicalWorkflowPanel
          nodeId={nodeId}
          onClose={() => setShowTopWorkflows(false)}
        />
      )}

      {/* Workflow Analysis Panel - shown when button is clicked */}
      {showWorkflowAnalysis && sessionCount > 0 && (
        <WorkflowAnalysisPanel
          nodeId={nodeId}
          onClose={() => setShowWorkflowAnalysis(false)}
        />
      )}

      {/* Sessions list or empty state */}
      {sessions.length > 0 ? (
        <VStack spacing={3} className="flex flex-col">
          {sessions.map((session) => (
            <SessionItem key={session.id} session={session} />
          ))}

          {/* "Show more" indicator if there are more sessions */}
          {data?.pagination && data.pagination.hasNext && (
            <p className="text-xs text-gray-400 text-center py-2">
              +{data.pagination.total - sessions.length} more sessions
            </p>
          )}
        </VStack>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

export default NodeSessions;

