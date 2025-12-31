/**
 * Cross-Session Insights Component
 *
 * Displays Graph RAG insights from previous sessions including:
 * - Top entities (technologies, tools)
 * - Key concepts (programming patterns, activities)
 * - Workflow patterns and transitions
 * - Related sessions
 */

import type { CrossSessionContextResponse } from '@journey/schema';
import {
  Activity,
  Brain,
  Clock,
  Code2,
  GitBranch,
  Hash,
  TrendingUp,
  Wrench,
} from 'lucide-react';

interface CrossSessionInsightsProps {
  data: CrossSessionContextResponse;
  isLoading?: boolean;
}

export function CrossSessionInsights({ data, isLoading }: CrossSessionInsightsProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-32 rounded-lg bg-gray-100" />
        <div className="h-32 rounded-lg bg-gray-100" />
      </div>
    );
  }

  const hasAnyData =
    data.entities.length > 0 ||
    data.concepts.length > 0 ||
    data.workflowPatterns.length > 0 ||
    data.relatedSessions.length > 0;

  if (!hasAnyData) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <Brain className="mx-auto mb-2 text-gray-400" size={32} />
        <p className="text-sm text-gray-500">
          No cross-session insights available yet. Keep working to build up your
          knowledge graph!
        </p>
      </div>
    );
  }

  // Get top entities and concepts
  const topEntities = data.entities.slice(0, 8);
  const topConcepts = data.concepts.slice(0, 6);
  const topPatterns = data.workflowPatterns.slice(0, 5);
  const recentSessions = data.relatedSessions.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Brain size={20} className="text-indigo-600" />
            Cross-Session Insights
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Patterns and connections from your recent work
          </p>
        </div>
        {data.retrievalMetadata && (
          <div className="text-right text-xs text-gray-500">
            <div>{data.retrievalMetadata.fusedResultCount} insights</div>
            <div>{data.retrievalMetadata.totalTimeMs}ms</div>
          </div>
        )}
      </div>

      {/* Top Technologies & Tools */}
      {topEntities.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Wrench size={16} className="text-blue-600" />
            Top Technologies & Tools
          </h4>
          <div className="flex flex-wrap gap-2">
            {topEntities.map((entity, idx) => (
              <div
                key={`${entity.entityName}-${idx}`}
                className="group relative flex items-center gap-2 rounded-md bg-blue-50 px-3 py-1.5 text-sm transition-colors hover:bg-blue-100"
              >
                <Code2 size={14} className="text-blue-600" />
                <span className="font-medium text-blue-900">{entity.entityName}</span>
                <span className="flex items-center gap-1 text-xs text-blue-700">
                  <Hash size={12} />
                  {entity.frequency}
                </span>
                {entity.similarity !== undefined && (
                  <div className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    {Math.round(entity.similarity * 100)}% similar
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Concepts */}
      {topConcepts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Brain size={16} className="text-purple-600" />
            Key Concepts & Activities
          </h4>
          <div className="space-y-2">
            {topConcepts.map((concept, idx) => (
              <div
                key={`${concept.conceptName}-${idx}`}
                className="flex items-center justify-between rounded-md bg-purple-50 px-3 py-2 transition-colors hover:bg-purple-100"
              >
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    {concept.conceptName}
                  </span>
                  <span className="rounded bg-purple-200 px-1.5 py-0.5 text-xs text-purple-800">
                    {concept.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-purple-700">
                  <span className="flex items-center gap-1">
                    <Hash size={12} />
                    {concept.frequency}
                  </span>
                  {concept.similarity !== undefined && (
                    <span className="text-purple-600">
                      {Math.round(concept.similarity * 100)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Patterns */}
      {topPatterns.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <GitBranch size={16} className="text-green-600" />
            Common Workflow Transitions
          </h4>
          <div className="space-y-2">
            {topPatterns.map((pattern, idx) => (
              <div
                key={`${pattern.transition}-${idx}`}
                className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-green-600" />
                  <span className="text-sm font-medium text-green-900">
                    {pattern.transition}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-green-700">
                  <span className="flex items-center gap-1">
                    <Hash size={12} />
                    {pattern.frequency}x
                  </span>
                  {pattern.avgTransitionTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {Math.round(pattern.avgTransitionTime / 60000)}m
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Sessions */}
      {recentSessions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Activity size={16} className="text-orange-600" />
            Related Sessions
          </h4>
          <div className="space-y-2">
            {recentSessions.map((session, idx) => (
              <div
                key={`${session.sessionId}-${idx}`}
                className="flex items-center justify-between rounded-md bg-orange-50 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-orange-900">
                    {session.workflowClassification || 'Work Session'}
                  </span>
                  <span className="text-xs text-orange-700">
                    {new Date(session.startTime).toLocaleDateString()} • {session.activityCount} activities
                  </span>
                </div>
                {session.similarity !== undefined && (
                  <span className="rounded bg-orange-200 px-2 py-1 text-xs font-medium text-orange-800">
                    {Math.round(session.similarity * 100)}% match
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
