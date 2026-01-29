/**
 * Strategy Proposal Details Modal
 *
 * Shows detailed information about a strategy proposal including
 * step transformations and optimization rationale.
 */

import { Button, Dialog, DialogContent } from '@journey/components';
import { ArrowRight, CheckCircle, Sparkles, X } from 'lucide-react';

import type { OptimizationBlock } from '../../services/insight-assistant-api';
import type { StrategyProposal } from '../../types/insight-assistant.types';

/**
 * Format seconds into a human-readable string
 */
function formatDuration(seconds: number | undefined | null): string {
  if (seconds == null || isNaN(seconds)) {
    return '0s';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface StrategyProposalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: StrategyProposal | null;
  /** Optimization block with step transformations to display */
  optimizationBlock?: OptimizationBlock | null;
}

export function StrategyProposalDetailsModal({
  isOpen,
  onClose,
  proposal,
  optimizationBlock,
}: StrategyProposalDetailsModalProps) {
  if (!proposal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 bg-white p-0">
        {/* Header */}
        <div className="relative border-b border-gray-200">
          <div className="flex gap-4 p-6 pb-5">
            {/* Icon */}
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[10px]"
              style={{ background: '#EEF2FF' }}
            >
              <Sparkles className="h-6 w-6" style={{ color: '#4F46E5' }} />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {proposal.title}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Strategy Proposal Details
              </p>
            </div>

            {/* Close Button */}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-6 w-6 rounded-lg p-2.5 transition-colors hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tags */}
          <div className="mb-6 flex flex-wrap gap-2">
            {proposal.tags.efficiency !== undefined && (
              <span
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ background: '#D1FAE5', color: '#065F46' }}
              >
                {proposal.tags.efficiency}% Efficiency Gain
              </span>
            )}
            {proposal.tags.confidence !== undefined && (
              <span
                className="rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ background: '#F1F5F9', color: '#475569' }}
              >
                {proposal.tags.confidence}% Confidence
              </span>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Why This Matters</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              {proposal.description}
            </p>
          </div>

          {/* Step Transformations - Side by Side Layout */}
          {optimizationBlock?.stepTransformations && optimizationBlock.stepTransformations.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Step Transformations ({optimizationBlock.stepTransformations.length})
              </h3>
              <div className="space-y-4">
                {optimizationBlock.stepTransformations.map((transform, idx) => {
                  const hasMultipleCurrentSteps = (transform.currentSteps?.length ?? 0) > 1;

                  return (
                    <div
                      key={transform.transformationId || idx}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      {/* Current → Optimized (Side by Side) */}
                      <div className="mb-3 flex items-start gap-3">
                        {/* Current Step(s) */}
                        <div className="flex-1 space-y-2">
                          {(transform.currentSteps || []).map((step, stepIdx) => (
                            <div
                              key={step.stepId || stepIdx}
                              className="rounded-lg border border-red-200 bg-red-50 p-3"
                            >
                              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-red-600">
                                Current {hasMultipleCurrentSteps ? `(${stepIdx + 1}/${transform.currentSteps.length})` : ''}
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {step.description || step.stepId}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {step.tool} • {formatDuration(step.durationSeconds)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Arrow */}
                        <div className="flex h-full items-center pt-6">
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>

                        {/* Optimized Steps */}
                        <div className="flex-1 space-y-2">
                          {/* Steps within user's toolbox */}
                          {(transform.optimizedSteps || [])
                            .filter((step) => step.isInUserToolbox === true)
                            .map((step, stepIdx) => (
                              <div
                                key={step.stepId || `toolbox-${stepIdx}`}
                                className="rounded-lg border border-green-200 bg-green-50 p-3"
                              >
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-xs font-medium uppercase tracking-wide text-green-600">
                                    Optimized
                                  </span>
                                  <CheckCircle className="h-3 w-3 text-green-600" />
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {step.description || step.stepId}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {step.tool} • {formatDuration(step.estimatedDurationSeconds)}
                                </div>
                                {step.claudeCodePrompt && (
                                  <div className="mt-2 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                                    Can be automated with Claude Code
                                  </div>
                                )}
                              </div>
                            ))}

                          {/* Steps outside user's toolbox (new tools) */}
                          {(transform.optimizedSteps || [])
                            .filter((step) => step.isInUserToolbox !== true)
                            .map((step, stepIdx) => (
                              <div
                                key={step.stepId || `new-${stepIdx}`}
                                className="rounded-lg border border-purple-200 bg-purple-50 p-3"
                              >
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="text-xs font-medium uppercase tracking-wide text-purple-600">
                                    New
                                  </span>
                                  <Sparkles className="h-3 w-3 text-purple-600" />
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {step.description || step.stepId}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {step.tool} • {formatDuration(step.estimatedDurationSeconds)}
                                </div>
                                {step.claudeCodePrompt && (
                                  <div className="mt-2 rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                                    Can be automated with Claude Code
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Rationale */}
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Save {formatDuration(transform.timeSavedSeconds)}
                          </span>
                          <span className="text-xs text-gray-500">{transform.rationale}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Info message */}
          <div
            className="rounded-lg p-4 text-center"
            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            <p className="text-sm text-gray-500">
              Use the chat to ask follow-up questions about this recommendation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-white p-6">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="px-5 py-3 font-semibold"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
