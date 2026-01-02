/**
 * HierarchicalWorkflowPanel Component
 *
 * Displays hierarchical workflow patterns with 3 levels:
 * - Level 1: WorkflowPattern (intent-driven sequences)
 * - Level 2: Block (tool-level execution units) - default view
 * - Level 3: Step (fine-grained UI actions) - drill-down on demand
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  RefreshCw,
  TrendingUp,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Wrench,
  Lightbulb,
  Calendar,
  BarChart3,
  Zap,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge } from '@journey/components';

import {
  getHierarchicalTopWorkflows,
  getBlockSteps,
  type HierarchicalWorkflowPattern,
  type HierarchicalBlock,
  type BlockStep,
  type HierarchicalWorkflowsParams,
} from '../../services/workflow-api';

interface HierarchicalWorkflowPanelProps {
  nodeId?: string;
  onClose?: () => void;
}

/**
 * Color mapping for block intents
 */
const getIntentColor = (intent: string): string => {
  const colors: Record<string, string> = {
    ai_prompt: 'bg-purple-500',
    code_edit: 'bg-green-500',
    code_review: 'bg-teal-500',
    terminal_command: 'bg-gray-700',
    file_navigation: 'bg-blue-400',
    web_research: 'bg-blue-600',
    git_operation: 'bg-orange-500',
    documentation: 'bg-indigo-500',
    testing: 'bg-yellow-500',
    debugging: 'bg-red-500',
    communication: 'bg-pink-500',
  };
  return colors[intent] || 'bg-gray-500';
};

/**
 * Format intent label for display
 */
const formatIntent = (intent: string): string => {
  return intent
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Block drill-down panel showing steps
 */
function BlockDrilldown({
  block,
  onClose,
}: {
  block: HierarchicalBlock;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['blockSteps', block.id],
    queryFn: () => getBlockSteps(block.id, true),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const steps = data?.data?.steps || [];

  return (
    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h5 className="font-semibold text-gray-900 flex items-center gap-2">
            <Eye size={16} className="text-blue-500" />
            Steps in "{block.canonicalName}"
          </h5>
          <p className="text-sm text-gray-500 mt-1">
            Fine-grained UI actions extracted from screenshots
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <X size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Extracting steps...</span>
        </div>
      ) : error ? (
        <div className="text-center py-6 text-red-500">
          Failed to load steps. Try again later.
        </div>
      ) : steps.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          No steps extracted for this block yet.
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <StepCard key={step.id} step={step} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual step card
 */
function StepCard({ step, index }: { step: BlockStep; index: number }) {
  const getActionIcon = (actionType: string) => {
    const icons: Record<string, string> = {
      prompt_entered: '💬',
      button_clicked: '🖱️',
      file_opened: '📂',
      file_saved: '💾',
      text_selected: '📝',
      text_pasted: '📋',
      tab_switched: '🔄',
      command_executed: '⚡',
      shortcut_used: '⌨️',
      scroll_action: '📜',
      menu_selected: '📑',
      dialog_interaction: '🪟',
    };
    return icons[actionType] || '•';
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getActionIcon(step.actionType)}</span>
          <span className="font-medium text-gray-900 text-sm">
            {formatIntent(step.actionType)}
          </span>
          <span className="text-xs text-gray-400">
            {Math.round(step.confidence * 100)}% confidence
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
          {step.description}
        </p>
        {step.rawInput && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-gray-700 line-clamp-2">
            {step.rawInput}
          </div>
        )}
        {step.screenshot && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span>App: {step.screenshot.appName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Block flow diagram showing Level 2 hierarchy
 */
function BlockFlowDiagram({
  pattern,
  onBlockClick,
  expandedBlockId,
}: {
  pattern: HierarchicalWorkflowPattern;
  onBlockClick: (block: HierarchicalBlock) => void;
  expandedBlockId: string | null;
}) {
  return (
    <div className="relative py-4">
      {/* Horizontal flow of blocks */}
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {pattern.blocks.map((block, idx) => (
          <div key={block.id} className="flex items-center">
            {/* Block node */}
            <div
              className={`
                relative flex flex-col items-center justify-center
                min-w-[120px] max-w-[160px] p-3 rounded-lg
                ${getIntentColor(block.intent)} text-white
                cursor-pointer transition-all duration-200
                hover:scale-105 hover:shadow-lg
                ${expandedBlockId === block.id ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-100' : ''}
              `}
              onClick={() => onBlockClick(block)}
            >
              {/* Block order badge */}
              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white text-gray-900 text-xs font-bold flex items-center justify-center shadow">
                {idx + 1}
              </div>

              {/* Block name */}
              <span className="text-sm font-medium text-center line-clamp-2">
                {block.canonicalName}
              </span>

              {/* Tool name */}
              <span className="text-xs opacity-80 mt-1 flex items-center gap-1">
                <Wrench size={10} />
                {block.primaryTool}
              </span>

              {/* Occurrence count */}
              <span className="text-xs opacity-70 mt-0.5">
                {block.occurrenceCount}x
              </span>

              {/* Drill-down indicator */}
              <ChevronDown
                size={14}
                className={`mt-1 opacity-60 transition-transform ${
                  expandedBlockId === block.id ? 'rotate-180' : ''
                }`}
              />
            </div>

            {/* Arrow connector */}
            {idx < pattern.blocks.length - 1 && (
              <div className="flex items-center mx-1">
                <ArrowRight size={20} className="text-gray-400" />
                {/* Show probability if available */}
                {pattern.blockConnections.find(
                  (c) => c.from === block.id && c.to === pattern.blocks[idx + 1]?.id
                ) && (
                  <span className="text-xs text-gray-400 -ml-1">
                    {Math.round(
                      (pattern.blockConnections.find(
                        (c) => c.from === block.id && c.to === pattern.blocks[idx + 1]?.id
                      )?.probability || 0) * 100
                    )}%
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Single pattern card with block flow and drill-down
 */
function PatternCard({
  pattern,
  index,
}: {
  pattern: HierarchicalWorkflowPattern;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const handleBlockClick = (block: HierarchicalBlock) => {
    setExpandedBlockId(expandedBlockId === block.id ? null : block.id);
  };

  const expandedBlock = pattern.blocks.find((b) => b.id === expandedBlockId);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Pattern header (Level 1) */}
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-500" />
              <h4 className="font-semibold text-gray-900">{pattern.canonicalName}</h4>
              <Badge variant="outline" className="text-xs">
                {formatIntent(pattern.intentCategory)}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {pattern.description}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            {/* Frequency badge */}
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {pattern.occurrenceCount}x repeated
            </Badge>
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
            <span>~{Math.round(pattern.avgDurationSeconds / 60)} min</span>
          </div>
          <div className="flex items-center gap-1">
            <Layers size={12} />
            <span>{pattern.blocks.length} blocks</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{pattern.sessionCount} sessions</span>
          </div>
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <BarChart3 size={12} />
            <span>{Math.round(pattern.confidence * 100)}% confidence</span>
          </div>
        </div>
      </div>

      {/* Expanded content (Level 2: Blocks) */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Block flow diagram */}
          <div className="p-4 bg-gray-50">
            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              <Layers size={12} />
              Workflow Blocks (click to drill down to steps)
            </h5>
            <BlockFlowDiagram
              pattern={pattern}
              onBlockClick={handleBlockClick}
              expandedBlockId={expandedBlockId}
            />

            {/* Block drill-down (Level 3: Steps) */}
            {expandedBlock && (
              <BlockDrilldown
                block={expandedBlock}
                onClose={() => setExpandedBlockId(null)}
              />
            )}
          </div>

          {/* Tools and concepts */}
          <div className="p-4 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              {/* Tools used */}
              {pattern.tools.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Wrench size={12} />
                    Tools Used
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {pattern.tools.slice(0, 5).map((tool, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tool.name} ({tool.usageCount}x)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Related concepts */}
              {pattern.concepts.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Lightbulb size={12} />
                    Related Concepts
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {pattern.concepts.slice(0, 5).map((concept, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {concept.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tool-agnostic indicator */}
            {pattern.toolAgnostic && pattern.toolVariants.length > 1 && (
              <div className="mt-3 p-2 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <Zap size={14} />
                  <span className="font-medium">Tool-Agnostic Pattern</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  This workflow works across: {pattern.toolVariants.join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Recent sessions */}
          {pattern.recentSessions.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Calendar size={12} />
                Recent Occurrences
              </h5>
              <div className="space-y-1">
                {pattern.recentSessions.slice(0, 3).map((session, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      <ChevronRight size={12} className="text-gray-400" />
                      {session.nodeTitle || 'Session'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main HierarchicalWorkflowPanel component
 */
export function HierarchicalWorkflowPanel({
  nodeId,
  onClose,
}: HierarchicalWorkflowPanelProps) {
  const queryParams: HierarchicalWorkflowsParams = {
    limit: 10,
    minOccurrences: 1, // Lowered from 3 to show patterns with limited data
    minConfidence: 0.6,
    includeGlobal: false,
  };

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['hierarchicalTopWorkflows', nodeId, queryParams],
    queryFn: () => getHierarchicalTopWorkflows(queryParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // httpClient unwraps the response, so data is already the inner data object
  const patterns = data?.workflows || [];
  const hasPatterns = patterns.length > 0;

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
            Failed to load top workflows: {(error as Error).message}
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
              <Badge variant="secondary" className="text-xs ml-2">
                Hierarchical
              </Badge>
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              3-level workflow patterns: Patterns → Blocks → Steps
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isFetching}
            >
              <RefreshCw
                size={14}
                className={`mr-2 ${isFetching ? 'animate-spin' : ''}`}
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
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
          <span>
            <strong>{patterns.length}</strong> patterns found
          </span>
          {data?.metadata && (
            <span className="text-gray-400">
              Generated at {new Date(data.metadata.generatedAt).toLocaleTimeString()}
            </span>
          )}
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

export default HierarchicalWorkflowPanel;
