/**
 * Workflow Transformation View
 *
 * Renders the enriched workflow transformation with:
 * - Summary metrics bar (time saved, % faster, steps automated)
 * - Current Manual Workflow table with status badges
 * - Recommended Automated Workflow table
 * - Implementation Options table with commands
 * - Key Benefits section
 */

import { ArrowRight, CheckCircle, Clock, Sparkles, XCircle, Zap } from 'lucide-react';

import type {
  EnrichedWorkflowStep,
  EnrichedStepStatus,
  ImplementationOption,
  OptimizationSummaryMetrics,
} from '../../services/insight-assistant-api';

// ============================================================================
// Props Interface
// ============================================================================

interface WorkflowTransformationViewProps {
  currentSteps?: EnrichedWorkflowStep[];
  recommendedSteps?: EnrichedWorkflowStep[];
  implementationOptions?: ImplementationOption[];
  keyBenefits?: string[];
  summaryMetrics?: OptimizationSummaryMetrics;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: EnrichedStepStatus }) {
  const config: Record<
    EnrichedStepStatus,
    { icon: typeof CheckCircle; text: string; bg: string; color: string }
  > = {
    keep: {
      icon: CheckCircle,
      text: 'Keep',
      bg: 'bg-green-100',
      color: 'text-green-700',
    },
    automate: {
      icon: XCircle,
      text: 'Automate',
      bg: 'bg-red-100',
      color: 'text-red-700',
    },
    modify: {
      icon: Sparkles,
      text: 'Modify',
      bg: 'bg-yellow-100',
      color: 'text-yellow-700',
    },
    remove: {
      icon: XCircle,
      text: 'Remove',
      bg: 'bg-gray-100',
      color: 'text-gray-700',
    },
    new: {
      icon: Sparkles,
      text: 'NEW',
      bg: 'bg-purple-100',
      color: 'text-purple-700',
    },
  };

  const { icon: Icon, text, bg, color } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${color}`}
    >
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

// ============================================================================
// Workflow Table Component
// ============================================================================

function WorkflowTable({
  title,
  steps,
  showStatus = true,
}: {
  title: string;
  steps: EnrichedWorkflowStep[];
  showStatus?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="w-12 px-4 py-2 text-left text-xs font-medium text-gray-500">
              Step
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Action</th>
            {showStatus && (
              <th className="w-24 px-4 py-2 text-right text-xs font-medium text-gray-500">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {steps.map((step, idx) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-3 align-top text-sm font-medium text-gray-900">
                {step.stepNumber}
              </td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">{step.action}</div>
                {step.tool && step.durationDisplay && (
                  <div className="mt-0.5 text-xs text-gray-500">
                    {step.tool} &bull; {step.durationDisplay}
                  </div>
                )}
                {step.subActions && step.subActions.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {step.subActions.map((sub, subIdx) => (
                      <li
                        key={subIdx}
                        className="flex items-start gap-1.5 text-xs text-gray-600"
                      >
                        <span className="mt-0.5 text-gray-400">&bull;</span>
                        {sub}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              {showStatus && (
                <td className="px-4 py-3 align-top text-right">
                  <StatusBadge status={step.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Implementation Options Table Component
// ============================================================================

function ImplementationOptionsTable({ options }: { options: ImplementationOption[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h4 className="text-sm font-semibold text-gray-700">Implementation Options</h4>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/50">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Option</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
              User Experience
            </th>
            <th className="w-24 px-4 py-2 text-left text-xs font-medium text-gray-500">
              Setup Time
            </th>
            <th className="w-28 px-4 py-2 text-left text-xs font-medium text-gray-500">
              Recommendation
            </th>
          </tr>
        </thead>
        <tbody>
          {options.map((opt, idx) => (
            <tr
              key={opt.id || idx}
              className={`border-b border-gray-100 last:border-0 ${
                opt.isRecommended ? 'bg-green-50/50' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">
                  {String.fromCharCode(65 + idx)}: {opt.name}
                </div>
              </td>
              <td className="px-4 py-3">
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">
                  {opt.command}
                </code>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{opt.setupTime}</td>
              <td className="px-4 py-3">
                {opt.isRecommended ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    <Sparkles className="h-3 w-3" />
                    {opt.recommendation}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">{opt.recommendation}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Summary Metrics Bar Component
// ============================================================================

function SummaryMetricsBar({ metrics }: { metrics: OptimizationSummaryMetrics }) {
  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5">
        <Clock className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700">
          {metrics.currentTotalTime} &rarr; {metrics.optimizedTotalTime}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5">
        <Zap className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700">
          {metrics.timeReductionPercent}% faster
        </span>
      </div>
      <div className="rounded-full bg-gray-100 px-3 py-1.5">
        <span className="text-sm text-gray-600">
          {metrics.stepsAutomated} steps automated &bull; {metrics.stepsKept} kept manual
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Key Benefits List Component
// ============================================================================

function KeyBenefitsList({ benefits }: { benefits: string[] }) {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <h4 className="mb-2 text-sm font-semibold text-green-800">Key Benefits</h4>
      <ul className="space-y-1.5">
        {benefits.map((benefit, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-green-700">
            <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {benefit}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkflowTransformationView({
  currentSteps,
  recommendedSteps,
  implementationOptions,
  keyBenefits,
  summaryMetrics,
}: WorkflowTransformationViewProps) {
  const hasEnrichedData = currentSteps && currentSteps.length > 0;

  if (!hasEnrichedData) {
    return null; // Fall back to legacy view in parent component
  }

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      {summaryMetrics && <SummaryMetricsBar metrics={summaryMetrics} />}

      {/* Current Workflow */}
      {currentSteps && currentSteps.length > 0 && (
        <WorkflowTable title="Current Manual Workflow" steps={currentSteps} showStatus={true} />
      )}

      {/* Arrow indicator */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <ArrowRight className="h-5 w-5" />
          <span className="text-sm">transforms to</span>
          <ArrowRight className="h-5 w-5" />
        </div>
      </div>

      {/* Recommended Workflow */}
      {recommendedSteps && recommendedSteps.length > 0 && (
        <WorkflowTable
          title="Recommended Automated Workflow"
          steps={recommendedSteps}
          showStatus={true}
        />
      )}

      {/* Implementation Options */}
      {implementationOptions && implementationOptions.length > 0 && (
        <ImplementationOptionsTable options={implementationOptions} />
      )}

      {/* Key Benefits */}
      {keyBenefits && keyBenefits.length > 0 && <KeyBenefitsList benefits={keyBenefits} />}
    </div>
  );
}
