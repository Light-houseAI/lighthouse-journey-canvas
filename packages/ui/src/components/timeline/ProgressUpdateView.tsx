/**
 * Progress Update View
 * Displays session data as a progress-focused timeline with achievements
 */

import { SessionMappingItem } from '@journey/schema';
import { TrendingUp, Calendar, Clock, Activity, CheckCircle2 } from 'lucide-react';
import { Badge } from '@journey/components';
import { formatSessionDuration, formatSessionDate } from '../../services/session-api';
import { WORK_TRACK_CATEGORY_LABELS } from '@journey/schema';
import { getSessionDisplayTitle } from '../../utils/node-title';

interface ProgressUpdateViewProps {
  sessions: SessionMappingItem[];
  totalDuration: number;
}

export function ProgressUpdateView({ sessions, totalDuration }: ProgressUpdateViewProps) {
  // Calculate progress metrics
  const completedSessions = sessions.length;
  const avgSessionDuration = completedSessions > 0 ? totalDuration / completedSessions : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-green-900">
          <TrendingUp size={20} />
          Progress Update
        </h3>
        <p className="mt-1 text-sm text-green-700">
          Track your achievements and momentum over time
        </p>
      </div>

      {/* Progress Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Completed</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{completedSessions}</div>
          <div className="text-xs text-gray-500 mt-1">Sessions</div>
        </div>

        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Clock size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Total Time</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatSessionDuration(totalDuration)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Invested</div>
        </div>

        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Activity size={16} />
            <span className="text-xs font-medium uppercase tracking-wide">Average</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatSessionDuration(Math.round(avgSessionDuration))}
          </div>
          <div className="text-xs text-gray-500 mt-1">Per session</div>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Activity Timeline</h4>

        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className="rounded-lg border border-gray-200 bg-white p-4 transition-all hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                {/* Progress indicator */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </div>
                  {index < sessions.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-200" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">
                        {getSessionDisplayTitle(session as any)}
                      </h5>
                      {session.highLevelSummary && (
                        <p className="mt-1 text-sm text-gray-600">
                          {session.highLevelSummary}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 text-xs bg-gray-100 text-gray-700">
                      {WORK_TRACK_CATEGORY_LABELS[session.category] || session.category}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
