/**
 * Strategy Proposal Details Modal
 *
 * Shows detailed information about a strategy proposal including
 * step transformations and optimization rationale.
 */

import { Button, Dialog, DialogContent } from '@journey/components';
import { ArrowRight, Clock, Sparkles, X, Zap } from 'lucide-react';
import React from 'react';

import type { OptimizationBlock } from '../../services/insight-assistant-api';
import type { StrategyProposal } from '../../types/insight-assistant.types';

interface StrategyProposalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: StrategyProposal | null;
  optimizationBlock: OptimizationBlock | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export function StrategyProposalDetailsModal({
  isOpen,
  onClose,
  proposal,
  optimizationBlock,
}: StrategyProposalDetailsModalProps) {
  if (!proposal) return null;

  const hasDetailedData = !!optimizationBlock;

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
                <Zap className="h-4 w-4" />
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
            {hasDetailedData && (
              <span
                className="rounded-full px-3 py-1.5 text-sm font-medium capitalize"
                style={{ background: '#FEF3C7', color: '#92400E' }}
              >
                Source: {optimizationBlock.source.replace(/_/g, ' ')}
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

          {/* Time Savings Summary */}
          {hasDetailedData && (
            <div
              className="mb-6 rounded-lg p-4"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Time Impact</h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Current:</span>
                  <span className="font-semibold text-gray-900">
                    {formatDuration(optimizationBlock.currentTimeTotal)}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">Optimized:</span>
                  <span className="font-semibold text-green-600">
                    {formatDuration(optimizationBlock.optimizedTimeTotal)}
                  </span>
                </div>
                <div
                  className="ml-auto rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ background: '#D1FAE5', color: '#065F46' }}
                >
                  Save {formatDuration(optimizationBlock.timeSaved)}
                </div>
              </div>
            </div>
          )}

          {/* Step Transformations */}
          {hasDetailedData && optimizationBlock.stepTransformations.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Step-by-Step Optimizations
              </h3>
              <div className="space-y-4">
                {optimizationBlock.stepTransformations.map((transformation, idx) => (
                  <div
                    key={transformation.transformationId}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Transformation {idx + 1}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: '#D1FAE5', color: '#065F46' }}
                      >
                        Saves {formatDuration(transformation.timeSavedSeconds)}
                      </span>
                    </div>

                    {/* Current Steps */}
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Current Steps
                      </p>
                      <div className="space-y-1">
                        {transformation.currentSteps.map((step) => (
                          <div
                            key={step.stepId}
                            className="flex items-center gap-2 rounded bg-gray-50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-gray-600">{step.tool}</span>
                            <span className="text-gray-400">-</span>
                            <span className="flex-1 text-gray-600">{step.description}</span>
                            <span className="text-gray-400">
                              {formatDuration(step.durationSeconds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="mb-3 flex justify-center">
                      <ArrowRight className="h-5 w-5 rotate-90 text-indigo-500" />
                    </div>

                    {/* Optimized Steps */}
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Optimized Steps
                      </p>
                      <div className="space-y-1">
                        {transformation.optimizedSteps.map((step) => (
                          <div
                            key={step.stepId}
                            className="flex items-center gap-2 rounded px-3 py-2 text-sm"
                            style={{
                              background: step.isNew ? '#EEF2FF' : '#F0FDF4',
                              border: step.isNew ? '1px solid #C7D2FE' : '1px solid #BBF7D0',
                            }}
                          >
                            <span className="font-medium text-gray-700">{step.tool}</span>
                            <span className="text-gray-400">-</span>
                            <span className="flex-1 text-gray-700">{step.description}</span>
                            {step.isNew && (
                              <span
                                className="rounded px-1.5 py-0.5 text-xs font-medium"
                                style={{ background: '#4F46E5', color: '#FFFFFF' }}
                              >
                                NEW
                              </span>
                            )}
                            <span className="text-gray-500">
                              {formatDuration(step.estimatedDurationSeconds)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rationale */}
                    <div
                      className="rounded-lg p-3"
                      style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
                    >
                      <p className="text-sm text-amber-800">
                        <span className="font-semibold">Rationale:</span>{' '}
                        {transformation.rationale}
                      </p>
                    </div>

                    {/* Claude Code Prompt if available */}
                    {transformation.optimizedSteps.some((s) => s.claudeCodePrompt) && (
                      <div className="mt-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Claude Code Prompt
                        </p>
                        {transformation.optimizedSteps
                          .filter((s) => s.claudeCodePrompt)
                          .map((step) => (
                            <div
                              key={`prompt-${step.stepId}`}
                              className="rounded-lg bg-gray-900 p-3"
                            >
                              <code className="text-sm text-gray-100">
                                {step.claudeCodePrompt}
                              </code>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback when no detailed data */}
          {!hasDetailedData && (
            <div
              className="rounded-lg p-4 text-center"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              <p className="text-sm text-gray-500">
                Detailed optimization steps are not available for this proposal.
              </p>
            </div>
          )}
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
