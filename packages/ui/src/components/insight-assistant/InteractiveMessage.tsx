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
import type { InsightGenerationResult, OptimizationBlock } from '../../services/insight-assistant-api';

interface InteractiveMessageProps {
  content: string;
  type: 'ai' | 'user';
  confidence?: number;
  sources?: RetrievedSource[];
  suggestedFollowUps?: string[];
  insightResult?: InsightGenerationResult | null;
  onFollowUpClick?: (followUp: string) => void;
  onViewOptimization?: (block: OptimizationBlock) => void;
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

// Optimization preview card
function OptimizationPreviewCard({
  block,
  onViewDetails,
}: {
  block: OptimizationBlock;
  onViewDetails?: (block: OptimizationBlock) => void;
}) {
  const timeSavedMinutes = Math.round(block.timeSaved / 60);

  return (
    <div className="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-500" />
            <h4 className="font-medium text-gray-900">{block.workflowName}</h4>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {block.whyThisMatters}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <Clock className="h-3 w-3" />
              Save {timeSavedMinutes}+ min
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              <TrendingUp className="h-3 w-3" />
              {Math.round(block.relativeImprovement)}% faster
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {Math.round(block.confidence * 100)}% confidence
            </span>
          </div>
        </div>
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(block)}
            className="ml-3 flex-shrink-0 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            View Details
          </button>
        )}
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
  onViewOptimization,
}: InteractiveMessageProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  // Parse content for special sections (metrics, tips, warnings)
  const { mainContent, hasMetrics } = useMemo(() => {
    // Check if content contains metrics-style data
    const hasMetrics = insightResult?.executiveSummary != null;
    return { mainContent: content, hasMetrics };
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
        {/* Main content with markdown */}
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

        {/* Executive Summary Metrics (if available) */}
        {hasMetrics && insightResult?.executiveSummary && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-900">
                Analysis Summary
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricsCard
                icon={Clock}
                label="Time Savings"
                value={`${Math.round(insightResult.executiveSummary.totalTimeReduced / 60)}`}
                subValue="minutes"
                color="green"
                trend="up"
              />
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

        {/* Optimization Blocks Preview */}
        {insightResult?.optimizationPlan?.blocks &&
          insightResult.optimizationPlan.blocks.length > 0 && (
            <CollapsibleSection
              title="Optimization Opportunities"
              icon={Zap}
              badge={insightResult.optimizationPlan.blocks.length}
              defaultOpen={true}
            >
              <div className="space-y-3">
                {insightResult.optimizationPlan.blocks.slice(0, 3).map((block) => (
                  <OptimizationPreviewCard
                    key={block.blockId}
                    block={block}
                    onViewDetails={onViewOptimization}
                  />
                ))}
                {insightResult.optimizationPlan.blocks.length > 3 && (
                  <p className="text-center text-sm text-gray-500">
                    +{insightResult.optimizationPlan.blocks.length - 3} more
                    optimizations in the Strategy Proposals panel
                  </p>
                )}
              </div>
            </CollapsibleSection>
          )}

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
    </div>
  );
}

export default InteractiveMessage;
