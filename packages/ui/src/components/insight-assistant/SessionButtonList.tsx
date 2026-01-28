/**
 * Session Button List Component
 *
 * Displays all user sessions as clickable buttons.
 * When clicked, opens the SessionDetailsModal with session details.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Layers,
  Loader2,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import type { SessionMappingItem } from '@journey/schema';

import { getUserSessions } from '../../services/session-api';
import { SessionDetailsModal } from './SessionDetailsModal';

interface SessionButtonListProps {
  /** Maximum number of sessions to show initially */
  initialLimit?: number;
  /** Whether to show in collapsed mode initially */
  collapsed?: boolean;
  /** Callback when a session is selected */
  onSessionSelect?: (session: SessionMappingItem) => void;
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
 * Format date to short readable format
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
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
 * Session Button - Individual clickable session item
 */
function SessionButton({
  session,
  onClick,
}: {
  session: SessionMappingItem;
  onClick: () => void;
}) {
  const sessionName = getSessionName(session);
  const hasWorkflows = (session.workflows && session.workflows.length > 0) ||
    (session.chapters && session.chapters.length > 0);

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 transition-colors group-hover:bg-indigo-100">
        <FolderOpen className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-700">
          {sessionName}
        </h4>
        {session.highLevelSummary && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">
            {session.highLevelSummary}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {session.startedAt && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Calendar className="h-3 w-3" />
              {formatDate(session.startedAt)}
            </span>
          )}
          {session.durationSeconds && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatDuration(session.durationSeconds)}
            </span>
          )}
          {hasWorkflows && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Layers className="h-3 w-3" />
              {session.workflows?.length || session.chapters?.length || 0} workflows
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Session Button List Component
 */
export function SessionButtonList({
  initialLimit = 5,
  collapsed = false,
  onSessionSelect,
}: SessionButtonListProps) {
  const [sessions, setSessions] = useState<SessionMappingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [showAll, setShowAll] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionMappingItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getUserSessions({ limit: 50 });
      setSessions(response.sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to load sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSessionClick = useCallback((session: SessionMappingItem) => {
    setSelectedSession(session);
    setIsModalOpen(true);
    onSessionSelect?.(session);
  }, [onSessionSelect]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSession(null);
  }, []);

  const displayedSessions = showAll ? sessions : sessions.slice(0, initialLimit);
  const hasMoreSessions = sessions.length > initialLimit;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-900">
              Your Work Sessions
            </span>
            {sessions.length > 0 && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {sessions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {/* Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-4">
            {/* Loading State */}
            {loading && sessions.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                <span className="ml-2 text-sm text-gray-500">Loading sessions...</span>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={fetchSessions}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && sessions.length === 0 && (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <FolderOpen className="h-6 w-6 text-gray-400" />
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  No work sessions found. Push sessions from the desktop app to see them here.
                </p>
              </div>
            )}

            {/* Sessions Grid */}
            {!loading && !error && sessions.length > 0 && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {displayedSessions.map((session) => (
                    <SessionButton
                      key={session.id}
                      session={session}
                      onClick={() => handleSessionClick(session)}
                    />
                  ))}
                </div>

                {/* Show More/Less */}
                {hasMoreSessions && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      {showAll ? (
                        <>
                          Show less
                          <ChevronUp className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Show all {sessions.length} sessions
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      <SessionDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        session={selectedSession}
      />
    </>
  );
}

export default SessionButtonList;
