/**
 * Query Detail View Component
 *
 * Detailed view of a single query trace with:
 * - Query metadata and classification
 * - Agent execution timeline
 * - Collapsible agent accordions with I/O summaries
 * - Data source access details
 */

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  Server,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { useQueryTraceDetail, useAgentPayload } from '../../hooks/useQueryTracing';
import {
  formatProcessingTime,
  getStatusColor,
} from '../../services/query-tracing-api';
import { useQueryTracingStore } from '../../stores/query-tracing-store';
import type {
  AgentTraceWithDataSources,
  DataSourceTrace,
  QueryTraceWithAgents,
} from '../../types/query-tracing.types';

// ============================================================================
// JSON VIEWER
// ============================================================================

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
}

function JsonViewer({ data, maxHeight = '300px' }: JsonViewerProps) {
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <pre
      className="overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"
      style={{ maxHeight }}
    >
      {formattedJson}
    </pre>
  );
}

// ============================================================================
// DATA SOURCE ROW
// ============================================================================

interface DataSourceRowProps {
  source: DataSourceTrace;
}

function DataSourceRow({ source }: DataSourceRowProps) {
  const icons = {
    database: <Database className="h-4 w-4" />,
    api: <Globe className="h-4 w-4" />,
    embedding_search: <Zap className="h-4 w-4" />,
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-gray-400">
        {icons[source.sourceType as keyof typeof icons] ?? <Server className="h-4 w-4" />}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{source.sourceName}</p>
        {source.queryDescription && (
          <p className="text-xs text-gray-500">{source.queryDescription}</p>
        )}
      </div>
      {source.resultCount !== null && (
        <span className="text-xs text-gray-500">{source.resultCount} results</span>
      )}
      {source.latencyMs !== null && (
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {source.latencyMs}ms
        </span>
      )}
    </div>
  );
}

// ============================================================================
// AGENT ACCORDION
// ============================================================================

interface AgentAccordionProps {
  agent: AgentTraceWithDataSources;
  traceId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function AgentAccordion({ agent, traceId, isExpanded, onToggle }: AgentAccordionProps) {
  const [showPayload, setShowPayload] = useState<'input' | 'output' | null>(null);
  const color = getStatusColor(agent.status);

  const { data: inputPayload, isLoading: loadingInput } = useAgentPayload(
    traceId,
    agent.id,
    'input',
    showPayload === 'input' && agent.hasFullPayload
  );

  const { data: outputPayload, isLoading: loadingOutput } = useAgentPayload(
    traceId,
    agent.id,
    'output',
    showPayload === 'output' && agent.hasFullPayload
  );

  const statusColors = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    gray: 'border-gray-200 bg-gray-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  };

  const statusIcons = {
    pending: <Clock className="h-4 w-4 text-gray-400" />,
    running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    completed: <Check className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <ChevronRight className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div className={`rounded-lg border ${statusColors[color]}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}

        <span className="flex items-center gap-2">
          {statusIcons[agent.status]}
          <span className="font-mono text-sm font-medium text-gray-800">
            {agent.agentId}
          </span>
        </span>

        <span className="text-sm text-gray-500">{agent.agentName}</span>

        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          {agent.llmCallCount > 0 && (
            <span>
              {agent.llmCallCount} LLM call{agent.llmCallCount > 1 ? 's' : ''}
            </span>
          )}
          {agent.llmTokensUsed > 0 && (
            <span>{agent.llmTokensUsed.toLocaleString()} tokens</span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatProcessingTime(agent.processingTimeMs)}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-3">
          {/* Input/Output summaries */}
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            {/* Input summary */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase text-gray-500">
                  Input Summary
                </h4>
                {agent.hasFullPayload && (
                  <button
                    onClick={() => setShowPayload(showPayload === 'input' ? null : 'input')}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    {showPayload === 'input' ? 'Hide full payload' : 'View full payload'}
                  </button>
                )}
              </div>
              {showPayload === 'input' ? (
                loadingInput ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : inputPayload ? (
                  <JsonViewer data={inputPayload.payload} />
                ) : (
                  <p className="text-sm text-gray-400">No payload available</p>
                )
              ) : agent.inputSummary ? (
                <JsonViewer data={agent.inputSummary} maxHeight="150px" />
              ) : (
                <p className="text-sm text-gray-400">No input summary</p>
              )}
            </div>

            {/* Output summary */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase text-gray-500">
                  Output Summary
                </h4>
                {agent.hasFullPayload && (
                  <button
                    onClick={() => setShowPayload(showPayload === 'output' ? null : 'output')}
                    className="text-xs text-indigo-600 hover:text-indigo-700"
                  >
                    {showPayload === 'output' ? 'Hide full payload' : 'View full payload'}
                  </button>
                )}
              </div>
              {showPayload === 'output' ? (
                loadingOutput ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : outputPayload ? (
                  <JsonViewer data={outputPayload.payload} />
                ) : (
                  <p className="text-sm text-gray-400">No payload available</p>
                )
              ) : agent.outputSummary ? (
                <JsonViewer data={agent.outputSummary} maxHeight="150px" />
              ) : (
                <p className="text-sm text-gray-400">No output summary</p>
              )}
            </div>
          </div>

          {/* Critique result */}
          {agent.critiqueResult && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                Critique Result
              </h4>
              <div
                className={`rounded-md p-2 ${
                  agent.critiqueResult.passed
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <p className="text-sm font-medium">
                  {agent.critiqueResult.passed ? 'Passed' : 'Issues Found'}
                </p>
                {agent.critiqueResult.issues.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {agent.critiqueResult.issues.map((issue, i) => (
                      <li key={i}>
                        <span className="font-medium">[{issue.severity}]</span>{' '}
                        {issue.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Data sources */}
          {agent.dataSources.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-500">
                Data Sources Accessed
              </h4>
              <div className="flex flex-col gap-2">
                {agent.dataSources.map((source) => (
                  <DataSourceRow key={source.id} source={source} />
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
            {agent.modelUsed && <span>Model: {agent.modelUsed}</span>}
            {agent.retryCount > 0 && <span>Retries: {agent.retryCount}</span>}
            <span>Order: #{agent.executionOrder}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CLASSIFICATION CARD
// ============================================================================

interface ClassificationCardProps {
  trace: QueryTraceWithAgents;
}

function ClassificationCard({ trace }: ClassificationCardProps) {
  const classification = trace.queryClassification;
  const routing = trace.routingDecision;

  if (!classification && !routing) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Query Classification</h3>

      {classification && (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500">Scope</p>
            <p className="text-sm font-medium text-gray-800">{classification.scope}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Intent</p>
            <p className="text-sm font-medium text-gray-800">{classification.intent}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Specificity</p>
            <p className="text-sm font-medium text-gray-800">{classification.specificity}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Confidence</p>
            <p className="text-sm font-medium text-gray-800">
              {Math.round(classification.confidence * 100)}%
            </p>
          </div>
        </div>
      )}

      {routing && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs text-gray-500">Routing Decision</p>
          <p className="mb-2 text-sm text-gray-700">{routing.reason}</p>
          <div className="flex flex-wrap gap-2">
            {routing.agentsToRun.map((agent) => (
              <span
                key={agent}
                className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700"
              >
                {agent}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QueryDetailView() {
  const { selectedTraceId, setSelectedTraceId, expandedAgentIds, toggleAgentExpanded } =
    useQueryTracingStore();

  const { data: trace, isLoading, error } = useQueryTraceDetail(selectedTraceId);

  if (!selectedTraceId) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12 text-center">
        <ExternalLink className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">No trace selected</p>
        <p className="text-xs text-gray-400">
          Select a trace from the list to view details
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">Loading trace details...</p>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-12">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm font-medium text-gray-700">Failed to load trace</p>
        <p className="text-xs text-gray-500">{error?.message ?? 'Trace not found'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => setSelectedTraceId(null)}
          className="mt-1 rounded-md p-1 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{trace.rawQuery}</h2>
          <p className="text-sm text-gray-500">
            {new Date(trace.startedAt).toLocaleString()} •{' '}
            {formatProcessingTime(trace.totalProcessingTimeMs)} total
            {trace.hasAttachedSessions && (
              <span className="ml-2 text-indigo-600">
                {trace.attachedSessionCount} session(s) attached
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Classification */}
      <ClassificationCard trace={trace} />

      {/* Agent Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Agent Execution ({trace.agentTraces.length} agents)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() =>
                useQueryTracingStore
                  .getState()
                  .expandAllAgents(trace.agentTraces.map((a) => a.id))
              }
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              Expand all
            </button>
            <button
              onClick={() => useQueryTracingStore.getState().collapseAllAgents()}
              className="text-xs text-gray-600 hover:text-gray-700"
            >
              Collapse all
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {trace.agentTraces
            .sort((a, b) => a.executionOrder - b.executionOrder)
            .map((agent) => (
              <AgentAccordion
                key={agent.id}
                agent={agent}
                traceId={trace.id}
                isExpanded={expandedAgentIds.has(agent.id)}
                onToggle={() => toggleAgentExpanded(agent.id)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
