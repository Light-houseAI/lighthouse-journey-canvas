/**
 * Past Conversations Panel Component
 *
 * Collapsible left sidebar showing past chat sessions.
 */

import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import React from 'react';

import type { ChatSession } from '../../services/chat-session-storage';
import { CompanyDocsUploadButton } from './CompanyDocsUploadButton';

interface PastConversationsPanelProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PastConversationsPanel({
  sessions,
  currentSessionId,
  isExpanded,
  onToggle,
  onSelectSession,
  onNewConversation,
  onDeleteSession,
}: PastConversationsPanelProps) {
  return (
    <div
      className="flex h-full flex-shrink-0 flex-col border-r transition-all duration-300"
      style={{
        width: isExpanded ? '280px' : '48px',
        borderColor: '#E2E8F0',
        background: '#FAFAFA',
      }}
    >
      {/* Header with Toggle */}
      <div
        className="flex items-center gap-2 px-3 py-4"
        style={{ borderBottom: '1px solid #E2E8F0' }}
      >
        <button
          onClick={onToggle}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-gray-200"
          title={isExpanded ? 'Hide conversations' : 'Show conversations'}
        >
          {isExpanded ? (
            <ChevronLeft className="h-5 w-5" style={{ color: '#64748B' }} />
          ) : (
            <ChevronRight className="h-5 w-5" style={{ color: '#64748B' }} />
          )}
        </button>

        {isExpanded && (
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" style={{ color: '#4F46E5' }} />
              <span
                className="text-sm font-semibold"
                style={{ color: '#1E293B' }}
              >
                Conversations
              </span>
            </div>
            <button
              onClick={onNewConversation}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-indigo-100"
              title="New conversation"
            >
              <Plus className="h-4 w-4" style={{ color: '#4F46E5' }} />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed State - Just icon */}
      {!isExpanded && (
        <div className="flex flex-1 flex-col items-center pt-4">
          <button
            onClick={onNewConversation}
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-indigo-100"
            title="New conversation"
          >
            <Plus className="h-5 w-5" style={{ color: '#4F46E5' }} />
          </button>
          <MessageSquare className="h-5 w-5" style={{ color: '#4F46E5' }} />
          {sessions.length > 0 && (
            <span
              className="mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium"
              style={{ background: '#4F46E5', color: '#FFFFFF' }}
            >
              {sessions.length}
            </span>
          )}
          {/* Company Docs Upload - Collapsed */}
          <div className="mt-auto pb-4">
            <CompanyDocsUploadButton />
          </div>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <>
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare
                  className="mb-3 h-10 w-10"
                  style={{ color: '#CBD5E1' }}
                />
                <p
                  className="mb-1 text-sm font-medium"
                  style={{ color: '#64748B' }}
                >
                  No conversations yet
                </p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Start a new conversation to get AI insights
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {sessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  return (
                    <div
                      key={session.id}
                      className={`group flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                        isActive
                          ? 'bg-indigo-100'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => onSelectSession(session.id)}
                    >
                      <MessageSquare
                        className="mt-0.5 h-4 w-4 flex-shrink-0"
                        style={{ color: isActive ? '#4F46E5' : '#94A3B8' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium"
                          style={{ color: isActive ? '#4F46E5' : '#1E293B' }}
                          title={session.title}
                        >
                          {session.title}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: '#94A3B8' }}
                        >
                          {formatRelativeTime(session.updatedAt)}
                        </p>
                      </div>
                      {onDeleteSession && !isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSession(session.id);
                          }}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100"
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: '#EF4444' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Company Docs Upload - Expanded */}
          <div
            className="flex items-center gap-3 px-3 py-3"
            style={{ borderTop: '1px solid #E2E8F0' }}
          >
            <CompanyDocsUploadButton />
            <span className="text-sm" style={{ color: '#64748B' }}>
              Upload Documents
            </span>
          </div>
        </>
      )}
    </div>
  );
}
