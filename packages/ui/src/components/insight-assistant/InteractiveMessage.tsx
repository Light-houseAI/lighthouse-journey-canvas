/**
 * Interactive Message Component
 *
 * Renders AI messages with rich markdown, collapsible sections,
 * inline metrics, and interactive elements.
 */

import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Zap,
  ExternalLink,
  Lightbulb,
  AlertCircle,
  BookOpen,
  Sparkles,
} from 'lucide-react';

import type { RetrievedSource } from '../../services/workflow-api';
import type { InsightGenerationResult, OptimizationBlock, FeatureAdoptionTip } from '../../services/insight-assistant-api';
import { OptimizationBlockDetailsModal } from './OptimizationBlockDetailsModal';
import { DownloadFileBlock } from './DownloadFileBlock';
import { parseDownloadableFiles, type ParsedDownloadFile } from '../../utils/download-file-parser';

/**
 * Keywords that indicate an efficiency/optimization-focused query
 * These are intentionally specific to avoid false positives
 * Use specific phrases rather than generic single words
 */
const EFFICIENCY_KEYWORDS = [
  // Efficiency related
  'efficien', // matches: efficiency, efficient, inefficiency, inefficient
  'productiv', // matches: productivity, productive
  'inefficienc', // matches: inefficiency, inefficiencies
  // Analysis related (specific to workflow/time analysis)
  'analysis summary',
  'analyze my',
  'analyse my',
  'analyze these',
  'analyse these',
  'analyzing sessions',
  'analysing sessions',
  'provide insights',
  'work sessions',
  'workflow analysis',
  'time analysis',
  // Automation related
  'automat', // matches: automation, automate, automated, automatic
  // Optimization related - use specific phrases to avoid false positives
  'optimize my',
  'optimise my',
  'optimization for my',
  'optimisation for my',
  'optimize workflow',
  'optimise workflow',
  // Improvement related - use specific phrases
  'improve my workflow',
  'improve this workflow',
  'improve the workflow',
  'improve workflow',
  'improve my productivity',
  'improve my time',
  'improve my efficiency',
  'improve efficiency',
  'improvement suggestion',
  'improvement recommend',
  'how do i improve',
  'how can i improve',
  // Time-saving related - specific phrases
  'save time',
  'time saving',
  'save me time',
  // Performance improvement phrases
  'work better',
  'work faster',
  'faster workflow',
  'be more efficient',
  'speed up my',
  'streamline my',
  // Strategy related - specific workflow phrases
  'workflow strateg', // matches: workflow strategy, workflow strategies
  'productivity strateg',
  'efficiency strateg',
  // Waste/inefficiency detection
  'waste time',
  'wasting time',
  'time wasted',
  // Reduce time specifically
  'reduce time',
  'reduce my time',
];

/**
 * Keywords that indicate the query is NOT about workflow efficiency
 * Even if efficiency keywords match, these exclusions take precedence
 */
const EXCLUSION_KEYWORDS = [
  // Technology alternatives/comparisons
  'alternative',
  'instead of',
  'replace with',
  'replacement for',
  'substitute',
  'versus',
  ' vs ',
  'compare to',
  'compared to',
  'comparison',
  'switch to',
  'switch from',
  'migrate to',
  'migrate from',
  'migration',
  // Technology recommendations (not workflow)
  'what database',
  'which database',
  'what tool should',
  'which tool should',
  'what framework',
  'which framework',
  'what library',
  'which library',
  'what technology',
  'which technology',
  'tech stack',
  'graph db',
  'graph database',
  // General questions about concepts (but NOT "how do i improve/optimize" which is efficiency-related)
  'what is a',
  'what is the',
  'what are the',
  'how does',
  'how do i set up',
  'how do i install',
  'how do i configure',
  'how do i use',
  'explain',
  'definition of',
  'define',
  'difference between',
  'pros and cons',
];

/**
 * Detect if a query is about efficiency, analysis, automation, or optimization.
 * Returns true if the query contains efficiency-related keywords AND
 * does NOT contain exclusion keywords that indicate a different type of query.
 */
function isEfficiencyRelatedQuery(query: string | undefined): boolean {
  if (!query) return false;
  const lowerQuery = query.toLowerCase();

  // First check exclusions - if any exclusion keyword matches, return false
  const hasExclusion = EXCLUSION_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
  if (hasExclusion) return false;

  // Then check for efficiency keywords
  return EFFICIENCY_KEYWORDS.some(keyword => lowerQuery.includes(keyword));
}

/**
 * Format seconds into appropriate time unit (minutes, hours, or days)
 */
function formatTimeSavings(seconds: number): { value: string; unit: string } {
  if (seconds < 60) {
    // Less than a minute - show as seconds
    return { value: Math.round(seconds).toString(), unit: 'seconds' };
  } else if (seconds < 3600) {
    // Less than an hour - show as minutes
    const minutes = seconds / 60;
    return { value: minutes.toFixed(1), unit: 'min' };
  } else if (seconds < 86400) {
    // Less than a day - show as hours
    const hours = seconds / 3600;
    return { value: hours.toFixed(1), unit: 'hours' };
  } else if (seconds < 604800) {
    // Less than a week - show as days
    const days = seconds / 86400;
    return { value: days.toFixed(1), unit: 'days' };
  } else {
    // A week or more - show as weeks
    const weeks = seconds / 604800;
    return { value: weeks.toFixed(1), unit: 'weeks' };
  }
}

/**
 * Truncate long text to a short card title (max 50 chars)
 * Used as a fallback when no explicit title is provided
 */
function truncateForCardTitle(text: string): string {
  if (!text) return 'Optimization';

  // If already short enough, return as-is
  if (text.length <= 50) return text;

  // Take first 6-7 words
  const words = text.split(/\s+/).slice(0, 7);
  let title = words.join(' ');

  // Remove trailing punctuation
  title = title.replace(/[.,;:!?]$/, '');

  // Ensure it ends cleanly with ellipsis
  if (title.length > 50) {
    title = title.slice(0, 47) + '...';
  } else if (title.length < text.length) {
    title = title + '...';
  }

  return title;
}

interface InteractiveMessageProps {
  content: string;
  type: 'ai' | 'user';
  confidence?: number;
  sources?: RetrievedSource[];
  suggestedFollowUps?: string[];
  insightResult?: InsightGenerationResult | null;
  onFollowUpClick?: (followUp: string) => void;
}

// Code block with copy button
function CodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const code = String(children).replace(/\n$/, '');
  const language = className?.replace('language-', '') || '';

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-900">
      {language && (
        <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-4 py-2">
          <span className="text-xs font-medium text-gray-400">{language}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-gray-100">{code}</code>
      </pre>
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 opacity-0 transition-opacity hover:bg-gray-600 group-hover:opacity-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

// Inline code styling
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-indigo-600">
      {children}
    </code>
  );
}

// Collapsible section component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {badge !== undefined && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Metrics card for displaying key stats
function MetricsCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color = 'indigo',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'indigo' | 'green' | 'orange' | 'red';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${colorClasses[color]}`}
    >
      <div className="rounded-full bg-white p-2">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium opacity-75">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-semibold">{value}</span>
          {subValue && (
            <span className="text-xs opacity-75">{subValue}</span>
          )}
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
        </div>
      </div>
    </div>
  );
}

// Quick action button
function QuickActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-all hover:bg-indigo-100 hover:shadow-sm"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// Source citation component
function SourceCitation({
  sources,
  expanded,
  onToggle,
}: {
  sources: RetrievedSource[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-700"
      >
        <BookOpen className="h-3 w-3" />
        Based on {sources.length} sources
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {sources.map((source, idx) => (
            <div
              key={source.id || idx}
              className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2"
            >
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {source.title}
                </p>
                <p className="text-xs text-gray-500">
                  {source.type} • {Math.round((source.relevanceScore || 0) * 100)}%
                  relevance
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InteractiveMessage({
  content,
  type,
  confidence,
  sources,
  suggestedFollowUps,
  insightResult,
  onFollowUpClick,
}: InteractiveMessageProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<OptimizationBlock | null>(null);

  // Parse content for special sections (metrics, tips, warnings, downloadable files)
  // Only show efficiency-related cards if the query is about efficiency/optimization
  const { mainContent, hasMetrics, showEfficiencyCards, downloadableFiles } = useMemo(() => {
    // Parse downloadable files from content
    const { cleanContent, downloadableFiles } = parseDownloadableFiles(content);

    // Check if content contains metrics-style data
    const hasMetrics = insightResult?.executiveSummary != null;
    // Check if there are optimization blocks (backend did the analysis)
    const hasOptimizationBlocks = (insightResult?.optimizationPlan?.blocks?.length ?? 0) > 0;
    // Only show efficiency cards if:
    // 1. The query is about efficiency/optimization/analysis/automation
    // 2. AND there are meaningful metrics (not just zeros)
    // 3. OR the backend returned optimization blocks (regardless of query keywords)
    const hasMeaningfulMetrics = insightResult?.executiveSummary && (
      insightResult.executiveSummary.totalTimeReduced > 0 ||
      insightResult.executiveSummary.totalRelativeImprovement > 0 ||
      insightResult.executiveSummary.topInefficiencies.length > 0 ||
      insightResult.executiveSummary.claudeCodeInsertionPoints.length > 0
    );
    const showEfficiencyCards = (isEfficiencyRelatedQuery(insightResult?.query) && hasMeaningfulMetrics) || hasOptimizationBlocks;
    return { mainContent: cleanContent, hasMetrics, showEfficiencyCards, downloadableFiles };
  }, [content, insightResult]);

  // User messages get simpler styling
  if (type === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[600px] rounded-2xl px-4 py-3"
          style={{ background: '#4F46E5' }}
        >
          <p className="whitespace-pre-line text-base text-white">{content}</p>
        </div>
      </div>
    );
  }

  // AI messages get rich interactive styling
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className="max-w-[700px] rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
      >
        {/* Executive Summary Metrics (if available and query is efficiency-related) - shown at top */}
        {hasMetrics && showEfficiencyCards && insightResult?.executiveSummary && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-900">
                Analysis Summary
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const timeSavings = formatTimeSavings(insightResult.executiveSummary.totalTimeReduced);
                return (
                  <MetricsCard
                    icon={Clock}
                    label="Time Savings"
                    value={timeSavings.value}
                    subValue={timeSavings.unit}
                    color="green"
                    trend="up"
                  />
                );
              })()}
              <MetricsCard
                icon={TrendingUp}
                label="Efficiency Gain"
                value={`${Math.round(insightResult.executiveSummary.totalRelativeImprovement)}%`}
                color="indigo"
              />
            </div>

            {/* Top Inefficiencies */}
            {insightResult.executiveSummary.topInefficiencies.length > 0 && (
              <CollapsibleSection
                title="Top Inefficiencies Found"
                icon={AlertCircle}
                badge={insightResult.executiveSummary.topInefficiencies.length}
              >
                <ul className="space-y-2">
                  {insightResult.executiveSummary.topInefficiencies.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Automation Opportunities */}
            {insightResult.executiveSummary.claudeCodeInsertionPoints.length > 0 && (
              <CollapsibleSection
                title="Automation Opportunities"
                icon={Lightbulb}
                badge={insightResult.executiveSummary.claudeCodeInsertionPoints.length}
              >
                <ul className="space-y-2">
                  {insightResult.executiveSummary.claudeCodeInsertionPoints.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Downloadable Files */}
        {downloadableFiles.length > 0 && (
          <div className="mb-4 space-y-3">
            {downloadableFiles.map((file, idx) => (
              <DownloadFileBlock
                key={`${file.filename}-${idx}`}
                filename={file.filename}
                content={file.content}
                mimeType={file.mimeType}
                language={file.language}
              />
            ))}
          </div>
        )}

        {/* Main content with markdown - shown after summary sections */}
        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:text-gray-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ inline, className, children, ...props }: {
                inline?: boolean;
                className?: string;
                children?: React.ReactNode;
              }) => {
                // react-markdown v9 provides inline prop
                if (inline) {
                  return <InlineCode>{children}</InlineCode>;
                }
                return (
                  <CodeBlock className={className}>{children}</CodeBlock>
                );
              },
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 no-underline hover:text-indigo-700 hover:underline"
                >
                  {children}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-indigo-300 bg-indigo-50 py-1 pl-4 pr-2 italic text-gray-700">
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul className="my-2 list-disc space-y-1 pl-4">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-2 list-decimal space-y-1 pl-4">{children}</ol>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-left font-medium text-gray-900">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-gray-100 px-3 py-2 text-gray-700">
                  {children}
                </td>
              ),
            }}
          >
            {mainContent}
          </ReactMarkdown>
        </div>

        {/* Confidence Badge */}
        {confidence !== undefined && (
          <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background:
                  confidence > 0.7
                    ? '#DCFCE7'
                    : confidence > 0.4
                      ? '#FEF9C3'
                      : '#FEE2E2',
                color:
                  confidence > 0.7
                    ? '#166534'
                    : confidence > 0.4
                      ? '#854D0E'
                      : '#991B1B',
              }}
            >
              {Math.round(confidence * 100)}% confidence
            </span>
          </div>
        )}

        {/* Sources */}
        {sources && sources.length > 0 && (
          <SourceCitation
            sources={sources}
            expanded={sourcesExpanded}
            onToggle={() => setSourcesExpanded(!sourcesExpanded)}
          />
        )}

        {/* Optimization Strategies (only shown for efficiency-related queries) */}
        {/* Debug logging for optimization strategies */}
        {(() => {
          const blockCount = insightResult?.optimizationPlan?.blocks?.length ?? 0;
          const totalTimeSaved = insightResult?.executiveSummary?.totalTimeReduced ?? 0;
          console.log(`[InteractiveMessage] showEfficiencyCards=${showEfficiencyCards}, blockCount=${blockCount}, query="${insightResult?.query ?? 'none'}", totalTimeSaved=${totalTimeSaved}`);
          if (blockCount > 0 && !showEfficiencyCards) {
            console.warn('[InteractiveMessage] WARNING: Optimization blocks exist but showEfficiencyCards is FALSE!');
            console.warn('[InteractiveMessage] isEfficiencyRelatedQuery:', isEfficiencyRelatedQuery(insightResult?.query));
          }
          if (blockCount > 0) {
            console.log('[InteractiveMessage] Optimization blocks:', JSON.stringify(insightResult?.optimizationPlan?.blocks?.map(b => ({ id: b.blockId, whyThisMatters: b.whyThisMatters, timeSaved: b.timeSaved })), null, 2));
          }
          return null;
        })()}
        {showEfficiencyCards && insightResult?.optimizationPlan && insightResult.optimizationPlan.blocks.length > 0 && (
          <CollapsibleSection
            title="Optimization Strategies"
            icon={Sparkles}
            defaultOpen={true}
          >
            <div className="space-y-3">
              {insightResult.optimizationPlan.blocks.map((block, idx) => (
                <div
                  key={block.blockId || idx}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    {/* Card title - use short title if available, fallback to truncated whyThisMatters */}
                    <div className="font-semibold text-gray-900 text-base">
                      {block.title || truncateForCardTitle(block.whyThisMatters)}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {(() => {
                        const timeSavings = formatTimeSavings(block.timeSaved || 0);
                        return (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Save {timeSavings.value} {timeSavings.unit}
                          </span>
                        );
                      })()}
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {Math.round(block.relativeImprovement)}% faster
                      </span>
                    </div>
                  </div>
                  {/* Description - show if title is different from whyThisMatters */}
                  {block.whyThisMatters && block.title && block.whyThisMatters !== block.title && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {block.whyThisMatters}
                    </p>
                  )}
                  {block.stepTransformations.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      {block.stepTransformations.length} step{block.stepTransformations.length !== 1 ? 's' : ''} optimized
                    </div>
                  )}
                  {block.citations && block.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {block.citations.slice(0, 2).map((citation, cidx) => (
                        <span key={cidx} className="text-xs text-indigo-600">
                          {citation.url ? (
                            <a href={citation.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {citation.title}
                            </a>
                          ) : (
                            citation.title
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedBlock(block)}
                    className="mt-3 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-2 text-center text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Workflow Tips - A5 Feature Adoption Tips (displayed separately, not as step transformations) */}
        {insightResult?.featureAdoptionTips && insightResult.featureAdoptionTips.length > 0 && (
          <CollapsibleSection
            title="Workflow Tips"
            icon={Lightbulb}
            badge={insightResult.featureAdoptionTips.length}
            defaultOpen={false}
          >
            <div className="space-y-3">
              {insightResult.featureAdoptionTips.map((tip, idx) => (
                <div
                  key={tip.tipId || idx}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {tip.toolName}
                      </span>
                      <span className="font-medium text-gray-900">{tip.featureName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const timeSavings = formatTimeSavings(tip.estimatedSavingsSeconds || 0);
                        return (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Save {timeSavings.value} {timeSavings.unit}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{tip.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800">
                      {tip.triggerOrShortcut}
                    </code>
                    <span className="text-xs text-gray-500">
                      {tip.addressesPattern}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>

      {/* Follow-up Suggestions */}
      {suggestedFollowUps && suggestedFollowUps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestedFollowUps.map((followUp, idx) => (
            <QuickActionButton
              key={idx}
              label={followUp}
              icon={Sparkles}
              onClick={() => onFollowUpClick?.(followUp)}
            />
          ))}
        </div>
      )}

      {/* Optimization Block Details Modal */}
      <OptimizationBlockDetailsModal
        isOpen={selectedBlock !== null}
        onClose={() => setSelectedBlock(null)}
        block={selectedBlock}
      />
    </div>
  );
}

export default InteractiveMessage;
