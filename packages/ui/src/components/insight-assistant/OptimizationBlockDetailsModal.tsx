/**
 * Optimization Block Details Modal
 *
 * Shows detailed information about an optimization block including
 * step transformations, time savings, and citations.
 */

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from '@journey/components';
import { ArrowRight, CheckCircle, Clock, Copy, ExternalLink, Sparkles, Terminal, X, Zap } from 'lucide-react';
import { useState } from 'react';

import type { OptimizationBlock } from '../../services/insight-assistant-api';

interface OptimizationBlockDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  block: OptimizationBlock | null;
}

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

/**
 * Component to display Claude Code automation prompt with copy functionality
 */
function ClaudeCodePromptSection({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-700">
            Claude Code Prompt
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 px-2 text-xs text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700"
        >
          <Copy className="h-3 w-3" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <div className="rounded bg-white/60 p-2">
        <code className="block whitespace-pre-wrap break-words text-xs text-gray-800">
          {prompt}
        </code>
      </div>
    </div>
  );
}

export function OptimizationBlockDetailsModal({
  isOpen,
  onClose,
  block,
}: OptimizationBlockDetailsModalProps) {
  if (!block) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {block.whyThisMatters}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-600">
                Optimization Strategy Details
              </DialogDescription>
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
          {/* Metrics */}
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-2">
              <Clock className="h-4 w-4 text-green-700" />
              <span className="text-sm font-medium text-green-800">
                Save {formatDuration(block.timeSaved)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2">
              <Zap className="h-4 w-4 text-blue-700" />
              <span className="text-sm font-medium text-blue-800">
                {Math.round(block.relativeImprovement ?? 0)}% faster
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2">
              <span className="text-sm font-medium text-gray-700">
                {Math.round((block.confidence ?? 0) * 100)}% confidence
              </span>
            </div>
          </div>

          {/* Workflow Context */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Workflow Context</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              {block.workflowName}
            </p>
          </div>

          {/* Step Transformations */}
          {block.stepTransformations && block.stepTransformations.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Step Transformations ({block.stepTransformations.length})
              </h3>
              <div className="space-y-4">
                {block.stepTransformations.map((transform, idx) => {
                  const hasMultipleCurrentSteps = (transform.currentSteps?.length ?? 0) > 1;

                  return (
                    <div
                      key={transform.transformationId || idx}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                    >
                      {/* Current → Optimized */}
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

                        {/* Optimized Steps - Categorized by Toolbox */}
                        <div className="flex-1 space-y-2">
                          {/* Steps within user's toolbox */}
                          {(transform.optimizedSteps || [])
                            .filter((step) => step.isInUserToolbox === true)
                            .map((step, stepIdx) => {
                              // Parse description to separate title from reasoning
                              // Format: "Step Title - Reasoning explanation"
                              const description = step.description || step.stepId || '';
                              const separatorIndex = description.indexOf(' - ');
                              const stepTitle = separatorIndex > 0 ? description.substring(0, separatorIndex) : description;
                              const stepReasoning = separatorIndex > 0 ? description.substring(separatorIndex + 3) : null;

                              return (
                                <div
                                  key={step.stepId || `toolbox-${stepIdx}`}
                                  className="rounded-lg border border-green-200 bg-green-50 p-3"
                                >
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-green-600">
                                      Within Your Toolbox
                                    </span>
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {stepTitle}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {step.tool} • {formatDuration(step.estimatedDurationSeconds)}
                                  </div>
                                  {/* Reasoning in blue - parsed from description */}
                                  {stepReasoning && (
                                    <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                                      <span className="text-xs font-medium text-blue-700">
                                        {stepReasoning}
                                      </span>
                                    </div>
                                  )}
                                  {step.claudeCodePrompt && (
                                    <ClaudeCodePromptSection prompt={step.claudeCodePrompt} />
                                  )}
                                </div>
                              );
                            })}

                          {/* Steps outside user's toolbox (new tools) */}
                          {(transform.optimizedSteps || [])
                            .filter((step) => step.isInUserToolbox !== true)
                            .map((step, stepIdx) => {
                              // Parse description to separate title from reasoning
                              // Supports two formats:
                              // 1. "Title - Reasoning explanation" (explicit separator)
                              // 2. "First sentence. Rest of explanation." (split at first sentence)
                              const description = step.description || step.stepId || '';
                              const separatorIndex = description.indexOf(' - ');

                              // Determine title and reasoning based on format
                              let stepTitle: string;
                              let stepReasoning: string | null;

                              if (separatorIndex > 0 && separatorIndex < 100) {
                                // Has " - " separator near the start: use structured format
                                stepTitle = description.substring(0, separatorIndex);
                                stepReasoning = description.substring(separatorIndex + 3);
                              } else if (description.length > 80) {
                                // Long description: split at first real sentence ending
                                // Find ". " followed by capital letter, but skip abbreviations
                                const abbreviations = ['e.g.', 'i.e.', 'etc.', 'vs.', 'Mr.', 'Mrs.', 'Dr.', 'Inc.', 'Ltd.'];
                                let splitIndex = -1;

                                // Find all occurrences of ". " followed by capital letter
                                const regex = /\.\s+[A-Z]/g;
                                let match;
                                while ((match = regex.exec(description)) !== null) {
                                  const beforePeriod = description.substring(0, match.index + 1);
                                  // Check if it ends with an abbreviation
                                  const isAbbreviation = abbreviations.some(abbr =>
                                    beforePeriod.toLowerCase().endsWith(abbr.toLowerCase())
                                  );
                                  if (!isAbbreviation && match.index > 20) {
                                    splitIndex = match.index + 1; // Include the period
                                    break;
                                  }
                                }

                                if (splitIndex > 0) {
                                  // Found a sentence boundary - use first sentence as title
                                  stepTitle = description.substring(0, splitIndex);
                                  stepReasoning = description.substring(splitIndex).trim();
                                } else {
                                  // No clear sentence boundary: use tool as title
                                  stepTitle = step.tool || 'Optimized workflow step';
                                  stepReasoning = description;
                                }
                              } else {
                                // Short description: show as title only
                                stepTitle = description || 'Optimized workflow step';
                                stepReasoning = null;
                              }

                              return (
                                <div
                                  key={step.stepId || `new-${stepIdx}`}
                                  className="rounded-lg border border-purple-200 bg-purple-50 p-3"
                                >
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-purple-600">
                                      New Tool
                                    </span>
                                    <Sparkles className="h-3 w-3 text-purple-600" />
                                  </div>
                                  {/* Show the optimized step title */}
                                  <div className="text-sm font-medium text-gray-900">
                                    {stepTitle}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {step.tool || 'New tool'} • {formatDuration(step.estimatedDurationSeconds)}
                                  </div>
                                  {/* Reasoning in blue box - same styling as "Within Your Toolbox" */}
                                  {stepReasoning && (
                                    <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                                      <span className="text-xs font-medium text-blue-700">
                                        {stepReasoning}
                                      </span>
                                    </div>
                                  )}
                                  {step.claudeCodePrompt && (
                                    <ClaudeCodePromptSection prompt={step.claudeCodePrompt} />
                                  )}
                                </div>
                              );
                            })}
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

          {/* Citations */}
          {block.citations && block.citations.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Sources</h3>
              <div className="space-y-2">
                {block.citations.map((citation, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{citation.title}</div>
                        {citation.excerpt && (
                          <p className="mt-1 text-sm text-gray-600">{citation.excerpt}</p>
                        )}
                      </div>
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Badge */}
          {block.source && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Source:</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 capitalize">
                {block.source.replace('_', ' ')}
              </span>
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
