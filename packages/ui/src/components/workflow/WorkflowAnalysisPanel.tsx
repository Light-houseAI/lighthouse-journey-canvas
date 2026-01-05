/**
 * Workflow Analysis Panel Component
 *
 * Displays AI-powered workflow insights with:
 * - Executive summary
 * - Detailed insights with impact levels
 * - Workflow distribution chart
 * - Key metrics
 * - Actionable recommendations
 */

import { Badge, Card, Skeleton, ThumbsFeedback } from '@journey/components';
import { FeedbackFeatureType } from '@journey/schema';
import type { WorkflowAnalysisResult, WorkflowInsight } from '@journey/schema';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Lightbulb,
  Loader2,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { useFeedback } from '../../hooks/useFeedback';
import { useWorkflowAnalysis } from '../../hooks/useWorkflowAnalysis';

interface WorkflowAnalysisPanelProps {
  nodeId: string;
  onClose?: () => void;
}

/**
 * Get icon and color for insight type
 */
function getInsightIcon(type: WorkflowInsight['type']) {
  switch (type) {
    case 'pattern':
      return { Icon: TrendingUp, color: 'text-blue-600' };
    case 'bottleneck':
      return { Icon: AlertCircle, color: 'text-red-600' };
    case 'efficiency_gain':
      return { Icon: CheckCircle, color: 'text-green-600' };
    case 'best_practice':
      return { Icon: CheckCircle, color: 'text-emerald-600' };
    case 'improvement_area':
      return { Icon: TrendingDown, color: 'text-orange-600' };
    case 'time_distribution':
      return { Icon: Clock, color: 'text-purple-600' };
    case 'context_switch':
      return { Icon: BarChart3, color: 'text-amber-600' };
    default:
      return { Icon: Lightbulb, color: 'text-gray-600' };
  }
}

/**
 * Get badge color for impact level
 */
function getImpactBadge(impact: 'high' | 'medium' | 'low') {
  switch (impact) {
    case 'high':
      return 'bg-red-100 text-red-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-green-100 text-green-700';
  }
}

/**
 * Insight Card Component
 */
function InsightCard({ insight }: { insight: WorkflowInsight }) {
  const { Icon, color } = getInsightIcon(insight.type);
  const impactColor = getImpactBadge(insight.impact);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${color}`}>
          <Icon size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h5 className="font-medium text-gray-900 text-sm">{insight.title}</h5>
            <Badge variant="secondary" className={`text-xs ${impactColor} flex-shrink-0`}>
              {insight.impact}
            </Badge>
          </div>

          <p className="mt-1 text-sm text-gray-600">{insight.description}</p>

          {insight.recommendations && insight.recommendations.length > 0 && (
            <div className="mt-2 space-y-1">
              {insight.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-500">
                  <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {insight.confidence && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full"
                  style={{ width: `${insight.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {Math.round(insight.confidence * 100)}% confidence
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Workflow Distribution Chart (Simple Bar Chart)
 */
function WorkflowDistribution({ distribution }: { distribution: WorkflowAnalysisResult['workflowDistribution'] }) {
  const maxCount = Math.max(...distribution.map((d) => d.count));

  return (
    <div className="space-y-2">
      {distribution.slice(0, 5).map((item) => (
        <div key={item.tag} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700 capitalize">{item.tag.replace(/_/g, ' ')}</span>
            <span className="text-gray-500">
              {item.count} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="animate-spin" size={16} />
        <span>Analyzing workflow patterns...</span>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Main Workflow Analysis Panel Component
 */
export function WorkflowAnalysisPanel({ nodeId, onClose }: WorkflowAnalysisPanelProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { data: analysis, isLoading, error, trigger } = useWorkflowAnalysis(nodeId);

  // Feedback hook for thumbs up/down
  const feedback = useFeedback({
    featureType: FeedbackFeatureType.WorkflowAnalysis,
    nodeId,
    contextData: analysis ? { analysisId: analysis.id, analyzedAt: analysis.analyzedAt } : undefined,
  });

  // Auto-trigger analysis on mount if no data exists
  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    setTriggerError(null);
    try {
      await trigger();
    } catch (err) {
      console.error('Failed to trigger analysis:', err);
      setTriggerError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsTriggering(false);
    }
  };

  if (isLoading || isTriggering) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mt-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900">Workflow Analysis</h4>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mt-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Workflow Analysis</h4>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-3" />
          <p className="text-sm text-red-600 mb-4">
            {error instanceof Error ? error.message : 'Failed to load workflow analysis'}
          </p>
          <button
            type="button"
            onClick={handleTriggerAnalysis}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mt-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">Workflow Analysis</h4>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            Get AI-powered insights about your workflow patterns
          </p>
          {triggerError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{triggerError}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={isTriggering}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTriggering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Generate Analysis'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-gray-700" />
          <h4 className="text-sm font-semibold text-gray-900">Workflow Analysis</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={isTriggering}
            className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            {isTriggering ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Updating...
              </>
            ) : (
              'Refresh'
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Executive Summary */}
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-2">Executive Summary</h5>
          <p className="text-sm text-gray-700 leading-relaxed">{analysis.executiveSummary}</p>
        </div>

        {/* Key Metrics */}
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-3">Key Metrics</h5>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-3">
              <div className="text-xs text-gray-500">Total Sessions</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {analysis.metrics.totalSessions}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Screenshots</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {analysis.metrics.totalScreenshots}
              </div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Avg Session</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {Math.round(analysis.metrics.averageSessionDurationSeconds / 60)}m
              </div>
            </Card>
            {analysis.metrics.contextSwitches !== undefined && (
              <Card className="p-3">
                <div className="text-xs text-gray-500">Context Switches</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">
                  {analysis.metrics.contextSwitches}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Workflow Distribution */}
        {analysis.workflowDistribution.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3">Workflow Distribution</h5>
            <WorkflowDistribution distribution={analysis.workflowDistribution} />
          </div>
        )}

        {/* Insights */}
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-3">
            Insights ({analysis.insights.length})
          </h5>
          <div className="space-y-3">
            {analysis.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3">Recommendations</h5>
            <div className="space-y-2">
              {analysis.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <Lightbulb size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis metadata and feedback */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Analysis generated on {new Date(analysis.analyzedAt).toLocaleDateString()} at{' '}
              {new Date(analysis.analyzedAt).toLocaleTimeString()} · {analysis.screenshotsAnalyzed}{' '}
              screenshots analyzed
            </p>
            <ThumbsFeedback
              value={feedback.rating}
              onFeedback={feedback.submitRating}
              isLoading={feedback.isSubmitting}
              showSuccess={feedback.showSuccess}
              label="Helpful?"
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowAnalysisPanel;
