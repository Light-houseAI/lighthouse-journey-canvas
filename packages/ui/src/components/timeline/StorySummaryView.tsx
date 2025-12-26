/**
 * Story Summary View
 * Displays session data as a narrative journey with key highlights
 */

import { SessionMappingItem } from '@journey/schema';
import { BookOpen, Sparkles, Calendar } from 'lucide-react';
import { formatSessionDate } from '../../services/session-api';

interface StorySummaryViewProps {
  sessions: SessionMappingItem[];
}

export function StorySummaryView({ sessions }: StorySummaryViewProps) {
  // Group sessions into story chapters
  const chapters = [
    {
      title: 'Beginning: Discovery & Exploration',
      description: 'The journey started with understanding the landscape and possibilities',
      sessions: sessions.slice(0, Math.ceil(sessions.length / 3)),
      color: 'blue',
    },
    {
      title: 'Development: Building & Learning',
      description: 'Progress was made through focused effort and skill development',
      sessions: sessions.slice(
        Math.ceil(sessions.length / 3),
        Math.ceil((sessions.length * 2) / 3)
      ),
      color: 'purple',
    },
    {
      title: 'Culmination: Achievement & Reflection',
      description: 'The work reached completion with valuable outcomes and insights',
      sessions: sessions.slice(Math.ceil((sessions.length * 2) / 3)),
      color: 'green',
    },
  ].filter((chapter) => chapter.sessions.length > 0);

  const colorStyles = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      accent: 'text-blue-600',
      dot: 'bg-blue-400',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      accent: 'text-purple-600',
      dot: 'bg-purple-400',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      accent: 'text-green-600',
      dot: 'bg-green-400',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-amber-900">
          <BookOpen size={20} />
          Story Summary
        </h3>
        <p className="mt-1 text-sm text-amber-700">
          Your work journey told as a narrative arc from start to finish
        </p>
      </div>

      {/* Opening Summary */}
      {sessions.length > 0 && (
        <div className="rounded-lg bg-white border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Journey Overview</h4>
              <p className="text-gray-700 leading-relaxed">
                This work track represents a journey spanning {sessions.length} distinct{' '}
                {sessions.length === 1 ? 'session' : 'sessions'}, from{' '}
                {formatSessionDate(sessions[0].startedAt)} to{' '}
                {formatSessionDate(sessions[sessions.length - 1].startedAt)}. Each session
                contributed to building skills, gaining insights, and making progress toward
                meaningful goals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Story Chapters */}
      <div className="space-y-6">
        {chapters.map((chapter, chapterIndex) => {
          const styles = colorStyles[chapter.color as keyof typeof colorStyles];

          return (
            <div key={chapterIndex} className="space-y-3">
              {/* Chapter Header */}
              <div className={`rounded-lg border ${styles.border} ${styles.bg} p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <h4 className={`font-semibold ${styles.text}`}>{chapter.title}</h4>
                </div>
                <p className={`text-sm ${styles.accent} ml-4`}>{chapter.description}</p>
              </div>

              {/* Chapter Sessions */}
              <div className="space-y-3 ml-4 border-l-2 border-gray-200 pl-4">
                {chapter.sessions.map((session, sessionIndex) => (
                  <div key={session.id} className="rounded-lg bg-white border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${styles.dot} mt-2 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 mb-1">
                          {session.workflowName || 'Work Session'}
                        </h5>
                        {session.highLevelSummary && (
                          <p className="text-sm text-gray-600 leading-relaxed mb-2">
                            {session.highLevelSummary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} />
                          {formatSessionDate(session.startedAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closing Reflection */}
      {sessions.length > 0 && (
        <div className="rounded-lg bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="text-gray-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Reflection</h4>
              <p className="text-gray-700 leading-relaxed">
                This journey showcases dedication, growth, and the iterative process of
                meaningful work. Each session built upon the last, creating a cohesive narrative
                of progress and achievement.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
