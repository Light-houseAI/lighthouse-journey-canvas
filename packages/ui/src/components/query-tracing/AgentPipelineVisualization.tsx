/**
 * Agent Pipeline Visualization Component
 *
 * Horizontal flow diagram showing the agent execution path.
 * Displays each agent as a node connected by arrows.
 */

import {
  ArrowRight,
  Check,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import React from 'react';

import { formatProcessingTime, getStatusColor } from '../../services/query-tracing-api';
import type { AgentTraceWithDataSources } from '../../types/query-tracing.types';

// ============================================================================
// TYPES
// ============================================================================

interface AgentNodeProps {
  agent: AgentTraceWithDataSources;
  isSelected?: boolean;
  onClick?: () => void;
}

interface AgentPipelineVisualizationProps {
  agents: AgentTraceWithDataSources[];
  selectedAgentId?: string | null;
  onAgentClick?: (agentId: string) => void;
}

// ============================================================================
// AGENT NODE
// ============================================================================

function AgentNode({ agent, isSelected, onClick }: AgentNodeProps) {
  const color = getStatusColor(agent.status);

  const colorClasses = {
    blue: 'border-blue-400 bg-blue-50',
    green: 'border-green-400 bg-green-50',
    red: 'border-red-400 bg-red-50',
    gray: 'border-gray-300 bg-gray-50',
    yellow: 'border-yellow-400 bg-yellow-50',
  };

  const statusIcons = {
    pending: <Clock className="h-3 w-3 text-gray-400" />,
    running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    completed: <Check className="h-3 w-3 text-green-500" />,
    failed: <XCircle className="h-3 w-3 text-red-500" />,
    skipped: <Clock className="h-3 w-3 text-gray-400" />,
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex min-w-[120px] flex-col items-center rounded-lg border-2 px-3 py-2 transition-all
        ${colorClasses[color]}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
        ${onClick ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}
      `}
    >
      <div className="mb-1 flex items-center gap-1.5">
        {statusIcons[agent.status]}
        <span className="font-mono text-xs font-semibold text-gray-800">
          {agent.agentId}
        </span>
      </div>
      <span className="text-xs text-gray-500">
        {formatProcessingTime(agent.processingTimeMs)}
      </span>
      {agent.llmCallCount > 0 && (
        <span className="mt-0.5 text-[10px] text-gray-400">
          {agent.llmCallCount} call{agent.llmCallCount > 1 ? 's' : ''}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// ARROW CONNECTOR
// ============================================================================

function ArrowConnector() {
  return (
    <div className="flex items-center px-1">
      <ArrowRight className="h-5 w-5 text-gray-300" />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentPipelineVisualization({
  agents,
  selectedAgentId,
  onAgentClick,
}: AgentPipelineVisualizationProps) {
  // Sort by execution order
  const sortedAgents = [...agents].sort((a, b) => a.executionOrder - b.executionOrder);

  if (sortedAgents.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-gray-400">
        No agents executed
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex items-center justify-center gap-1">
        {sortedAgents.map((agent, index) => (
          <React.Fragment key={agent.id}>
            <AgentNode
              agent={agent}
              isSelected={agent.id === selectedAgentId}
              onClick={onAgentClick ? () => onAgentClick(agent.id) : undefined}
            />
            {index < sortedAgents.length - 1 && <ArrowConnector />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TIMELINE VISUALIZATION (Alternative view)
// ============================================================================

interface AgentTimelineProps {
  agents: AgentTraceWithDataSources[];
  totalTimeMs: number;
}

export function AgentTimeline({ agents, totalTimeMs }: AgentTimelineProps) {
  const sortedAgents = [...agents].sort((a, b) => a.executionOrder - b.executionOrder);

  // Calculate cumulative times for stacking
  let cumulativeTime = 0;
  const agentBars = sortedAgents.map((agent) => {
    const startPercent = (cumulativeTime / totalTimeMs) * 100;
    const widthPercent = ((agent.processingTimeMs ?? 0) / totalTimeMs) * 100;
    cumulativeTime += agent.processingTimeMs ?? 0;

    return {
      agent,
      startPercent,
      widthPercent,
    };
  });

  const color = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-400';
      case 'failed':
        return 'bg-red-400';
      case 'running':
        return 'bg-blue-400';
      case 'skipped':
        return 'bg-gray-300';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-2">
      {/* Timeline bar */}
      <div className="relative h-8 overflow-hidden rounded-lg bg-gray-100">
        {agentBars.map(({ agent, startPercent, widthPercent }) => (
          <div
            key={agent.id}
            className={`absolute top-0 flex h-full items-center justify-center ${color(agent.status)}`}
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(widthPercent, 1)}%`,
            }}
            title={`${agent.agentId}: ${formatProcessingTime(agent.processingTimeMs)}`}
          >
            {widthPercent > 8 && (
              <span className="truncate px-1 text-[10px] font-medium text-white">
                {agent.agentId}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {sortedAgents.map((agent) => (
          <div key={agent.id} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded ${color(agent.status)}`} />
            <span className="font-mono text-xs text-gray-600">{agent.agentId}</span>
            <span className="text-xs text-gray-400">
              {formatProcessingTime(agent.processingTimeMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
