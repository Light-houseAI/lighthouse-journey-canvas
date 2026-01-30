/**
 * Executive Summary View
 *
 * Displays an executive summary comparison table showing:
 * - Current vs Recommended metrics side by side
 * - Key metrics: Manual Steps, Time to Complete, Error Risk, Repeatability
 *
 * Design based on executive summary presentations showing before/after comparisons.
 */

import { AlertTriangle, CheckCircle, Clock, RefreshCw, Repeat, Zap } from 'lucide-react';

import type { OptimizationSummaryMetrics, EnrichedWorkflowStep } from '../../services/insight-assistant-api';

// ============================================================================
// Props Interface
// ============================================================================

interface ExecutiveSummaryViewProps {
  /** Summary metrics for at-a-glance comparison */
  summaryMetrics?: OptimizationSummaryMetrics;
  /** Current workflow steps (used to derive additional metrics) */
  currentSteps?: EnrichedWorkflowStep[];
  /** Recommended workflow steps (used to derive additional metrics) */
  recommendedSteps?: EnrichedWorkflowStep[];
  /** Title for the summary section */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
}

// ============================================================================
// Metric Row Component
// ============================================================================

interface MetricRowProps {
  icon: typeof Clock;
  iconColor: string;
  label: string;
  currentValue: string;
  recommendedValue: string;
  improvement?: string;
  isHighlighted?: boolean;
}

function MetricRow({
  icon: Icon,
  iconColor,
  label,
  currentValue,
  recommendedValue,
  improvement,
  isHighlighted = false,
}: MetricRowProps) {
  return (
    <tr className={`border-b border-gray-100 last:border-0 ${isHighlighted ? 'bg-green-50/50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-gray-600">{currentValue}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium text-gray-900">{recommendedValue}</span>
        {improvement && (
          <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {improvement}
          </span>
        )}
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExecutiveSummaryView({
  summaryMetrics,
  currentSteps,
  recommendedSteps,
  title = 'Executive Summary',
  subtitle = 'Current Manual Process vs. Recommended Automation',
}: ExecutiveSummaryViewProps) {
  // Derive metrics from props or use defaults
  const currentStepCount = currentSteps?.length ?? summaryMetrics?.stepsAutomated ?? 0;
  const recommendedStepCount = recommendedSteps?.length ?? 3;
  const stepsAutomated = summaryMetrics?.stepsAutomated ?? Math.max(0, currentStepCount - recommendedStepCount);
  const stepsKept = summaryMetrics?.stepsKept ?? recommendedStepCount;

  // Determine error risk levels based on automation
  const currentErrorRisk = stepsAutomated > 2 ? 'High' : stepsAutomated > 0 ? 'Medium' : 'Low';
  const recommendedErrorRisk = 'Low';

  // Determine repeatability
  const currentRepeatability = 'Manual each time';
  const recommendedRepeatability = 'Automated & consistent';

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-blue-100">{subtitle}</p>
      </div>

      {/* Metrics Table */}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-1/3 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Metric
            </th>
            <th className="w-1/3 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-blue-600">
              Current
            </th>
            <th className="w-1/3 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-green-600">
              Recommended
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Manual Steps */}
          <MetricRow
            icon={RefreshCw}
            iconColor="text-blue-500"
            label="Manual Steps"
            currentValue={`${currentStepCount} steps`}
            recommendedValue={`${stepsKept} steps`}
            improvement={stepsAutomated > 0 ? `-${stepsAutomated}` : undefined}
          />

          {/* Time to Complete */}
          {summaryMetrics && (
            <MetricRow
              icon={Clock}
              iconColor="text-amber-500"
              label="Time to Complete"
              currentValue={summaryMetrics.currentTotalTime}
              recommendedValue={summaryMetrics.optimizedTotalTime}
              improvement={summaryMetrics.timeReductionPercent > 0 ? `${summaryMetrics.timeReductionPercent}% faster` : undefined}
              isHighlighted={true}
            />
          )}

          {/* Error Risk */}
          <MetricRow
            icon={AlertTriangle}
            iconColor={currentErrorRisk === 'High' ? 'text-red-500' : currentErrorRisk === 'Medium' ? 'text-amber-500' : 'text-green-500'}
            label="Error Risk"
            currentValue={currentErrorRisk}
            recommendedValue={recommendedErrorRisk}
          />

          {/* Repeatability */}
          <MetricRow
            icon={Repeat}
            iconColor="text-purple-500"
            label="Repeatability"
            currentValue={currentRepeatability}
            recommendedValue={recommendedRepeatability}
          />
        </tbody>
      </table>

      {/* Summary Footer */}
      {summaryMetrics && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                {summaryMetrics.timeReductionPercent}% time reduction
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                {summaryMetrics.stepsAutomated} steps automated
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {summaryMetrics.stepsKept} manual steps kept for human judgment
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Summary Bar (Alternative Display)
// ============================================================================

interface CompactSummaryBarProps {
  summaryMetrics?: OptimizationSummaryMetrics;
}

export function CompactSummaryBar({ summaryMetrics }: CompactSummaryBarProps) {
  if (!summaryMetrics) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 p-3">
      {/* Before → After */}
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-600">{summaryMetrics.currentTotalTime}</span>
        <span className="text-gray-400">→</span>
        <span className="text-sm font-medium text-green-700">{summaryMetrics.optimizedTotalTime}</span>
      </div>

      {/* Time Reduction */}
      <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5">
        <Zap className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700">
          {summaryMetrics.timeReductionPercent}% faster
        </span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5">
        <CheckCircle className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">
          {summaryMetrics.stepsAutomated} automated • {summaryMetrics.stepsKept} manual
        </span>
      </div>
    </div>
  );
}
