/**
 * AI Usage Overview Panel Component
 *
 * Displays AI-powered insights about user's AI tool usage patterns with:
 * - Key metrics (sessions, adoption rate, tools used)
 * - Top AI tools usage breakdown
 * - AI-related concepts and practices
 * - Top workflows involving AI
 * - Usage trends over time
 * - Recent AI-involving sessions
 */

import { Badge, Card, Skeleton, ThumbsFeedback } from '@journey/components';
import { FeedbackFeatureType } from '@journey/schema';
import type {
  AIUsageOverviewResult,
  AIToolUsage,
  AIConceptUsage,
  AIWorkflow,
  AIUsageTrendPoint,
} from '@journey/schema';
import {
  Bot,
  Brain,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Zap,
  Loader2,
  X,
  Sparkles,
  Activity,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

import { useAIUsageOverview } from '../../hooks/useAIUsageOverview';
import { useFeedback } from '../../hooks/useFeedback';
import { getSessionDisplayTitle } from '../../utils/node-title';

interface AIUsageOverviewPanelProps {
  nodeId: string;
  onClose?: () => void;
}

/**
 * Get icon for AI tool category
 */
function getToolCategoryIcon(category: AIToolUsage['category']) {
  switch (category) {
    case 'llm':
      return { Icon: Brain, color: 'text-purple-600' };
    case 'code_assistant':
      return { Icon: Zap, color: 'text-blue-600' };
    case 'image_generation':
      return { Icon: Sparkles, color: 'text-pink-600' };
    case 'search':
      return { Icon: Activity, color: 'text-green-600' };
    case 'automation':
      return { Icon: Bot, color: 'text-orange-600' };
    case 'analytics':
      return { Icon: BarChart3, color: 'text-cyan-600' };
    default:
      return { Icon: Bot, color: 'text-gray-600' };
  }
}

/**
 * Get badge color for concept category
 */
function getConceptBadgeColor(category: AIConceptUsage['category']) {
  switch (category) {
    case 'prompt_engineering':
      return 'bg-purple-100 text-purple-700';
    case 'ai_assisted_coding':
      return 'bg-blue-100 text-blue-700';
    case 'ai_debugging':
      return 'bg-red-100 text-red-700';
    case 'ai_research':
      return 'bg-green-100 text-green-700';
    case 'ai_content_generation':
      return 'bg-pink-100 text-pink-700';
    case 'ai_data_analysis':
      return 'bg-cyan-100 text-cyan-700';
    case 'ai_automation':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\bai\b/gi, 'AI')
    .replace(/\bllm\b/gi, 'LLM')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * AI Tool Card Component
 */
function AIToolCard({ tool }: { tool: AIToolUsage }) {
  const { Icon, color } = getToolCategoryIcon(tool.category);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${color}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h5 className="font-medium text-gray-900 text-sm">{tool.name}</h5>
            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600 flex-shrink-0">
              {tool.usageCount} uses
            </Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {formatCategoryName(tool.category)} • {tool.sessionCount} sessions
          </p>
          {tool.trends && (
            <div className="mt-2 flex items-center gap-2">
              {tool.trends.weeklyChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${tool.trends.weeklyChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tool.trends.weeklyChange > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  <span>{Math.abs(tool.trends.weeklyChange)}% this week</span>
                </div>
              )}
            </div>
          )}
          {tool.confidence && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full"
                  style={{ width: `${tool.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {Math.round(tool.confidence * 100)}% confidence
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * AI Concept Badge Component
 */
function AIConceptBadge({ concept }: { concept: AIConceptUsage }) {
  const badgeColor = getConceptBadgeColor(concept.category);

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
      <Badge variant="secondary" className={`text-xs ${badgeColor}`}>
        {formatCategoryName(concept.category)}
      </Badge>
      <span className="text-sm text-gray-700">{concept.name}</span>
      <span className="text-xs text-gray-500 ml-auto">{concept.frequency}x</span>
    </div>
  );
}

/**
 * AI Workflow Card Component
 */
function AIWorkflowCard({ workflow }: { workflow: AIWorkflow }) {
  return (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h5 className="font-medium text-gray-900 text-sm truncate">{workflow.name}</h5>
          {workflow.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{workflow.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {workflow.aiToolsUsed.slice(0, 3).map((tool) => (
              <Badge key={tool} variant="secondary" className="text-xs bg-purple-50 text-purple-600">
                {tool}
              </Badge>
            ))}
            {workflow.aiToolsUsed.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">
                +{workflow.aiToolsUsed.length - 3}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-gray-900">{workflow.occurrenceCount}x</div>
          <div className="text-xs text-gray-500">
            ~{Math.round(workflow.avgDurationSeconds / 60)}m
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Usage Trend Chart (Simple Bar Chart)
 */
function UsageTrendChart({ trends }: { trends: AIUsageTrendPoint[] }) {
  const maxSessions = Math.max(...trends.map((t) => t.sessionCount), 1);

  return (
    <div className="space-y-2">
      {trends.slice(-7).map((point, index) => {
        const date = new Date(point.date);
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div key={index} className="flex items-center gap-3">
            <div className="w-16 text-xs text-gray-500 text-right">
              <div>{dayLabel}</div>
              <div className="text-gray-400">{dateLabel}</div>
            </div>
            <div className="flex-1">
              <div className="bg-gray-200 rounded-full h-4 relative overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all"
                  style={{ width: `${(point.sessionCount / maxSessions) * 100}%` }}
                />
                {point.sessionCount > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {point.sessionCount} sessions
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
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
        <span>Analyzing AI usage patterns...</span>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Main AI Usage Overview Panel Component
 */
export function AIUsageOverviewPanel({ nodeId, onClose }: AIUsageOverviewPanelProps) {
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const { data: overview, isLoading, error, trigger } = useAIUsageOverview(nodeId);

  // Feedback hook for thumbs up/down
  const feedback = useFeedback({
    featureType: FeedbackFeatureType.AIUsageOverview,
    nodeId,
    contextData: overview ? { analyzedAt: overview.analyzedAt, sessionsAnalyzed: overview.retrievalMetadata.sessionsAnalyzed } : undefined,
  });

  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    setTriggerError(null);
    try {
      await trigger({ forceReanalysis: true });
    } catch (err) {
      console.error('Failed to trigger AI usage analysis:', err);
      setTriggerError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsTriggering(false);
    }
  };

  if (isLoading || isTriggering) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mt-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900">AI Usage Overview</h4>
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
          <h4 className="text-sm font-semibold text-gray-900">AI Usage Overview</h4>
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
            {error instanceof Error ? error.message : 'Failed to load AI usage overview'}
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

  if (!overview) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 mt-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-900">AI Usage Overview</h4>
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
          <Bot className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            Get insights about your AI tool usage patterns and practices
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
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTriggering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Bot className="mr-2 h-4 w-4" />
                Generate AI Usage Analysis
              </>
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
          <Bot size={18} className="text-purple-600" />
          <h4 className="text-sm font-semibold text-gray-900">AI Usage Overview</h4>
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
        {/* Key Metrics */}
        <div>
          <h5 className="text-sm font-medium text-gray-900 mb-3">Key Metrics</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="text-xs text-gray-500">AI Adoption</div>
              <div className="text-2xl font-semibold text-purple-600 mt-1">
                {Math.round(overview.metrics.aiAdoptionRate)}%
              </div>
              <div className="text-xs text-gray-400">of sessions</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Sessions with AI</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {overview.metrics.sessionsWithAI}
              </div>
              <div className="text-xs text-gray-400">of {overview.metrics.totalSessions}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">AI Tools Used</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {overview.metrics.uniqueAITools}
              </div>
              <div className="text-xs text-gray-400">unique tools</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-gray-500">Avg Tools/Session</div>
              <div className="text-2xl font-semibold text-gray-900 mt-1">
                {overview.metrics.avgAIToolsPerSession.toFixed(1)}
              </div>
              <div className="text-xs text-gray-400">tools used</div>
            </Card>
          </div>
        </div>

        {/* Top AI Tools */}
        {overview.topAITools.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3">
              Top AI Tools ({overview.topAITools.length})
            </h5>
            <div className="space-y-3">
              {overview.topAITools.slice(0, 5).map((tool, index) => (
                <AIToolCard key={`${tool.name}-${index}`} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* AI Concepts & Practices */}
        {overview.aiConcepts.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3">
              AI Concepts & Practices ({overview.aiConcepts.length})
            </h5>
            <div className="space-y-2">
              {overview.aiConcepts.slice(0, 6).map((concept, index) => (
                <AIConceptBadge key={`${concept.name}-${index}`} concept={concept} />
              ))}
            </div>
          </div>
        )}

        {/* Top AI Workflows */}
        {overview.topAIWorkflows.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3">
              Top Workflows with AI ({overview.topAIWorkflows.length})
            </h5>
            <div className="space-y-2">
              {overview.topAIWorkflows.slice(0, 4).map((workflow) => (
                <AIWorkflowCard key={workflow.id} workflow={workflow} />
              ))}
            </div>
          </div>
        )}

        {/* Usage Trends */}
        {overview.usageTrends.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Calendar size={14} />
              Usage Trends (Last 7 Days)
            </h5>
            <UsageTrendChart trends={overview.usageTrends} />
          </div>
        )}

        {/* Recent AI Sessions */}
        {overview.recentAISessions.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock size={14} />
              Recent AI Sessions ({overview.recentAISessions.length})
            </h5>
            <div className="space-y-2">
              {overview.recentAISessions.slice(0, 5).map((session) => {
                const sessionDate = new Date(session.date);
                return (
                  <div
                    key={session.sessionId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {getSessionDisplayTitle(session as any)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {sessionDate.toLocaleDateString()} • {Math.round(session.durationSeconds / 60)}m
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-2">
                      {session.aiToolsUsed.slice(0, 2).map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-xs bg-purple-50 text-purple-600">
                          {tool}
                        </Badge>
                      ))}
                      {session.aiToolsUsed.length > 2 && (
                        <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">
                          +{session.aiToolsUsed.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Analysis metadata and feedback */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Analysis generated on {new Date(overview.analyzedAt).toLocaleDateString()} at{' '}
              {new Date(overview.analyzedAt).toLocaleTimeString()} • {overview.retrievalMetadata.sessionsAnalyzed}{' '}
              sessions analyzed • {overview.retrievalMetadata.totalTimeMs}ms
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

export default AIUsageOverviewPanel;
