/**
 * Session Mention Popup Component
 *
 * Appears when user types "@" in the chat input.
 * Shows a searchable list of work sessions that can be selected.
 * Supports viewing session details before adding as a tag.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import type { SessionMappingItem } from '@journey/schema';

import { getUserSessions } from '../../services/session-api';

interface SessionMentionPopupProps {
  /** Whether the popup is visible */
  isOpen: boolean;
  /** Callback when popup should close */
  onClose: () => void;
  /** Callback when a session is selected */
  onSelect: (session: SessionMappingItem) => void;
  /** Search query (text after @) */
  searchQuery?: string;
  /** Position anchor element */
  anchorRef?: React.RefObject<HTMLElement>;
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
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

/**
 * Get session display name
 */
function getSessionName(session: SessionMappingItem): string {
  if (session.generatedTitle) {
    return session.generatedTitle;
  }

  if (session.workflows && session.workflows.length > 0) {
    const firstWorkflow = session.workflows[0];
    if (firstWorkflow.workflow_summary) {
      return firstWorkflow.workflow_summary;
    }
  }

  if (session.chapters && session.chapters.length > 0) {
    const firstChapter = session.chapters[0];
    if (firstChapter.title) {
      return firstChapter.title;
    }
  }

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
 * Session Item in the popup list
 */
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
        isSelected
          ? 'bg-indigo-50'
          : 'hover:bg-gray-50'
      }`}
    >
      {/* Session info - clickable to view details */}
      <button
        onClick={onView}
        className="flex flex-1 items-start gap-3 text-left"
      >
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

      {/* Add button */}
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

/**
 * Expandable Steps Component - Shows steps with expand/collapse
 */
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

/**
 * Session Detail View - Shows workflows and steps
 */
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
      {/* Header */}
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
            {session.startedAt && (
              <span>{formatDate(session.startedAt)}</span>
            )}
            {session.durationSeconds && (
              <span>• {formatDuration(session.durationSeconds)}</span>
            )}
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

      {/* Content */}
      <div className="max-h-[380px] overflow-y-auto p-3">
        {/* Summary */}
        {session.highLevelSummary && (
          <div className="mb-3 rounded-lg bg-indigo-50 p-2">
            <p className="text-xs text-indigo-700">{session.highLevelSummary}</p>
          </div>
        )}

        {/* V2 Workflows */}
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

        {/* V1 Chapters */}
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

        {/* Empty state */}
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

/**
 * Session Mention Popup Component
 */
export function SessionMentionPopup({
  isOpen,
  onClose,
  onSelect,
  searchQuery = '',
}: SessionMentionPopupProps) {
  const [sessions, setSessions] = useState<SessionMappingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingSession, setViewingSession] = useState<SessionMappingItem | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch sessions on mount
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
        setError('Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [isOpen]);

  // Filter sessions based on search query
  const filteredSessions = React.useMemo(() => {
    if (!searchQuery) return sessions;

    const query = searchQuery.toLowerCase();
    return sessions.filter((session) => {
      const name = getSessionName(session).toLowerCase();
      const summary = (session.highLevelSummary || '').toLowerCase();
      return name.includes(query) || summary.includes(query);
    });
  }, [sessions, searchQuery]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSessions.length]);

  // Reset viewing session and show all when popup closes or search changes
  useEffect(() => {
    if (!isOpen) {
      setViewingSession(null);
      setShowAllSessions(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setViewingSession(null);
    setShowAllSessions(false);
  }, [searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      // If viewing a session, handle differently
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

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredSessions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSessions[selectedIndex]) {
            // View details on Enter instead of immediate select
            setViewingSession(filteredSessions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredSessions, selectedIndex, onSelect, onClose, viewingSession]
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

  // Show detail view if viewing a session
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
        {/* Footer hint */}
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-xs text-gray-500">
            <kbd className="rounded bg-gray-200 px-1 font-mono">Enter</kbd> to add,{' '}
            <kbd className="rounded bg-gray-200 px-1 font-mono">Esc</kbd> to go back
          </span>
        </div>
      </div>
    );
  }

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
            Select a work session
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
        <div className="border-b border-gray-100 bg-indigo-50 px-3 py-1.5">
          <span className="text-xs text-indigo-600">
            Filtering by: <strong>{searchQuery}</strong>
          </span>
        </div>
      )}

      {/* Content */}
      <div className="max-h-60 overflow-y-auto">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-500">Loading sessions...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="px-3 py-4 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredSessions.length === 0 && (
          <div className="px-3 py-6 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {searchQuery
                ? `No sessions matching "${searchQuery}"`
                : 'No work sessions found'}
            </p>
          </div>
        )}

        {/* Session List */}
        {!loading && !error && filteredSessions.length > 0 && (
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
                  {showAllSessions
                    ? 'Show less'
                    : `+${filteredSessions.length - 10} more sessions`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs text-gray-500">
          Click session to view details, or{' '}
          <kbd className="rounded bg-gray-200 px-1 font-mono">Add</kbd> to insert
        </span>
      </div>
    </div>
  );
}

export default SessionMentionPopup;
