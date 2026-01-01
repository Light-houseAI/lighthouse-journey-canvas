/**
 * TopWorkflowPanel Component
 *
 * Displays top/frequently repeated workflow patterns with interactive flow diagrams.
 * Uses hybrid search (Graph RAG + semantic + BM25) to identify common patterns.
 */

import { useState, useCallback } from 'react';
import {
  X,
  RefreshCw,
  TrendingUp,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Zap,
  ArrowRight,
  Database,
  Search,
  Brain,
} from 'lucide-react';
import { Button, Badge } from '@journey/components';
import type { TopWorkflowPattern, TopWorkflowStep } from '@journey/schema';

import { useTopWorkflows } from '../../hooks/useTopWorkflows';

interface TopWorkflowPanelProps {
  nodeId?: string;
  onClose?: () => void;
}

/**
 * Flow diagram component for a single workflow pattern
 */
function WorkflowFlowDiagram({ pattern }: { pattern: TopWorkflowPattern }) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const getStepColor = (tag: string): string => {
    const colors: Record<string, string> = {
      research: 'bg-blue-500',
      coding: 'bg-green-500',
      debugging: 'bg-red-500',
      testing: 'bg-yellow-500',
      documentation: 'bg-purple-500',
      design: 'bg-pink-500',
      meeting: 'bg-orange-500',
      planning: 'bg-indigo-500',
      learning: 'bg-cyan-500',
      code_review: 'bg-teal-500',
      deployment: 'bg-emerald-500',
      analysis: 'bg-violet-500',
      market_analysis: 'bg-rose-500',
      writing: 'bg-amber-500',
      communication: 'bg-sky-500',
      other: 'bg-gray-500',
    };
    return colors[tag] || 'bg-gray-500';
  };

  const toggleStep = (stepId: string) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  return (
    <div className="relative py-4">
      {/* Flow diagram - horizontal on desktop, vertical on mobile */}
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {pattern.steps.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            {/* Step node */}
            <div
              className={`
                relative flex flex-col items-center justify-center
                min-w-[100px] max-w-[140px] p-3 rounded-lg
                ${getStepColor(step.workflowTag)} text-white
                cursor-pointer transition-all duration-200
                hover:scale-105 hover:shadow-lg
                ${expandedStep === step.id ? 'ring-2 ring-white ring-offset-2' : ''}
              `}
              onClick={() => toggleStep(step.id)}
            >
              {/* Step number badge */}
              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center shadow">
                {idx + 1}
              </div>

              {/* Step title */}
              <span className="text-sm font-medium text-center line-clamp-2">
                {step.title}
              </span>

              {/* Occurrence count */}
              <span className="text-xs opacity-80 mt-1">
                {step.occurrenceCount}x
              </span>

              {/* Expand indicator */}
              {expandedStep === step.id ? (
                <ChevronUp size={14} className="mt-1 opacity-60" />
              ) : (
                <ChevronDown size={14} className="mt-1 opacity-60" />
              )}
            </div>

            {/* Arrow connector */}
            {idx < pattern.steps.length - 1 && (
              <ArrowRight size={24} className="text-gray-400 mx-1 flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Expanded step details */}
      {expandedStep && (
        <StepDetails
          step={pattern.steps.find(s => s.id === expandedStep)!}
          onClose={() => setExpandedStep(null)}
        />
      )}
    </div>
  );
}

/**
 * Step details panel shown when a step is clicked
 */
function StepDetails({ step, onClose }: { step: TopWorkflowStep; onClose: () => void }) {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in slide-in-from-top-2">
      <div className="flex items-start justify-between">
        <div>
          <h5 className="font-medium text-gray-900">{step.title}</h5>
          <p className="text-sm text-gray-600 mt-1">{step.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Avg Duration:</span>
          <span className="ml-2 font-medium">
            {Math.round(step.averageDurationSeconds / 60)} min
          </span>
        </div>
        <div>
          <span className="text-gray-500">Confidence:</span>
          <span className="ml-2 font-medium">
            {Math.round(step.confidence * 100)}%
          </span>
        </div>
      </div>

      {step.apps && step.apps.length > 0 && (
        <div className="mt-3">
          <span className="text-sm text-gray-500">Common Apps:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {step.apps.map((app, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {app}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single pattern card with flow diagram
 */
function PatternCard({ pattern, index }: { pattern: TopWorkflowPattern; index: number }) {
  const [isExpanded, setIsExpanded] = useState(index === 0); // First one expanded by default

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Pattern header */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              <h4 className="font-semibold text-gray-900">{pattern.title}</h4>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {pattern.description}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {/* Frequency badge */}
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {pattern.frequency}x repeated
            </Badge>
            {/* Expand/collapse icon */}
            {isExpanded ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>~{Math.round(pattern.averageDurationSeconds / 60)} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Layers size={12} />
            <span>{pattern.steps.length} steps</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-green-600 font-medium">
              {Math.round(pattern.confidence * 100)}% confidence
            </span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Flow diagram */}
          <div className="p-4 bg-gray-50">
            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Workflow Flow
            </h5>
            <WorkflowFlowDiagram pattern={pattern} />
          </div>

          {/* Insights and suggestions */}
          {(pattern.insights?.length || pattern.optimizationSuggestions?.length) && (
            <div className="p-4 space-y-4">
              {/* Insights */}
              {pattern.insights && pattern.insights.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} className="text-yellow-500" />
                    <h5 className="text-sm font-medium text-gray-700">Insights</h5>
                  </div>
                  <ul className="space-y-1">
                    {pattern.insights.map((insight, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-400 mt-1">-</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Optimization suggestions */}
              {pattern.optimizationSuggestions && pattern.optimizationSuggestions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-green-500" />
                    <h5 className="text-sm font-medium text-gray-700">Optimization Tips</h5>
                  </div>
                  <ul className="space-y-1">
                    {pattern.optimizationSuggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-400 mt-1">-</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Search strategy indicator
 */
function SearchStrategyBadge({ strategy }: { strategy: NonNullable<TopWorkflowsResult['searchStrategy']> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Powered by:</span>
      <div className="flex items-center gap-1">
        {strategy.graphRAGUsed && (
          <Badge variant="outline" className="text-xs py-0.5 px-1.5">
            <Database size={10} className="mr-1" />
            Graph RAG
          </Badge>
        )}
        {strategy.semanticSearchUsed && (
          <Badge variant="outline" className="text-xs py-0.5 px-1.5">
            <Brain size={10} className="mr-1" />
            Semantic
          </Badge>
        )}
        {strategy.bm25SearchUsed && (
          <Badge variant="outline" className="text-xs py-0.5 px-1.5">
            <Search size={10} className="mr-1" />
            BM25
          </Badge>
        )}
      </div>
    </div>
  );
}

type TopWorkflowsResult = NonNullable<ReturnType<typeof useTopWorkflows>['data']>;

/**
 * Main TopWorkflowPanel component
 */
export function TopWorkflowPanel({ nodeId, onClose }: TopWorkflowPanelProps) {
  const {
    data,
    patterns,
    isLoading,
    error,
    refetch,
    isRefreshing,
    hasPatterns,
    totalScreenshots,
    searchStrategy,
  } = useTopWorkflows({
    nodeId,
    limit: 5,
    minOccurrences: 2,
    lookbackDays: 30,
    includeGraphRAG: true,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top Workflows</h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Analyzing workflow patterns...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top Workflows</h3>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">
            Failed to load top workflows: {error.message}
          </p>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw size={14} className="mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Top Workflows
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Frequently repeated workflow patterns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isRefreshing}
            >
              <RefreshCw
                size={14}
                className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>
              <strong>{patterns.length}</strong> patterns found
            </span>
            <span>
              <strong>{totalScreenshots}</strong> screenshots analyzed
            </span>
            {data?.dataRangeStart && (
              <span className="text-gray-400">
                Last {data.searchStrategy?.hybridWeight ? '30' : '30'} days
              </span>
            )}
          </div>
          {searchStrategy && <SearchStrategyBadge strategy={searchStrategy} />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!hasPatterns ? (
          <div className="text-center py-12">
            <Layers size={48} className="mx-auto text-gray-300 mb-4" />
            <h4 className="text-gray-600 font-medium mb-2">
              No Repeated Patterns Found
            </h4>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              We couldn't find frequently repeated workflow patterns yet.
              Continue working to build up more data, or try adjusting the
              analysis parameters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {patterns.map((pattern, index) => (
              <PatternCard key={pattern.id} pattern={pattern} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopWorkflowPanel;
