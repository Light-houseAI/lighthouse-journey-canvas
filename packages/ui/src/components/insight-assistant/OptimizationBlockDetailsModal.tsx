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
import { ExecutiveSummaryView } from './ExecutiveSummaryView';
import { WorkflowTransformationView } from './WorkflowTransformationView';

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
 * FIX-11.5: Group current steps by description to collapse duplicates
 * When multiple steps have the same description, they are merged into one entry
 * with combined duration and a count indicator.
 */
interface GroupedStep {
  description: string;
  tools: string[];
  totalDuration: number;
  count: number;
  stepIds: string[];
}

function groupStepsByDescription(
  steps: Array<{ stepId?: string; tool?: string; durationSeconds?: number; description?: string }>
): GroupedStep[] {
  const groupMap = new Map<string, GroupedStep>();

  for (const step of steps || []) {
    const desc = (step.description || step.stepId || 'Unknown step').toLowerCase().trim();

    if (groupMap.has(desc)) {
      const existing = groupMap.get(desc)!;
      existing.count += 1;
      existing.totalDuration += step.durationSeconds || 0;
      if (step.tool && !existing.tools.includes(step.tool)) {
        existing.tools.push(step.tool);
      }
      if (step.stepId) {
        existing.stepIds.push(step.stepId);
      }
    } else {
      groupMap.set(desc, {
        description: step.description || step.stepId || 'Unknown step',
        tools: step.tool ? [step.tool] : [],
        totalDuration: step.durationSeconds || 0,
        count: 1,
        stepIds: step.stepId ? [step.stepId] : [],
      });
    }
  }

  return Array.from(groupMap.values());
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

          {/* Executive Summary - Shows before/after comparison table when enriched data is available */}
          {block.summaryMetrics && (
            <ExecutiveSummaryView
              summaryMetrics={block.summaryMetrics}
              currentSteps={block.currentWorkflowSteps}
              recommendedSteps={block.recommendedWorkflowSteps}
              title={block.workflowName || 'Workflow Optimization'}
              subtitle="Current Manual Process vs. Recommended Automation"
            />
          )}

          {/* Workflow Context - Only show when no executive summary (legacy view) */}
          {!block.summaryMetrics && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Workflow Context</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                {block.workflowName}
              </p>
            </div>
          )}

          {/* Workflow Transformation - Use enriched view when data is available */}
          {block.currentWorkflowSteps && block.currentWorkflowSteps.length > 0 ? (
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                Workflow Transformation
              </h3>
              <WorkflowTransformationView
                currentSteps={block.currentWorkflowSteps}
                recommendedSteps={block.recommendedWorkflowSteps}
                implementationOptions={block.implementationOptions}
                keyBenefits={block.keyBenefits}
                summaryMetrics={block.summaryMetrics}
              />
            </div>
          ) : (
            /* Legacy view - Step Transformations */
            block.stepTransformations && block.stepTransformations.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  {block.isNewWorkflowSuggestion ? 'Suggested Workflow' : 'Step Transformations'}
                </h3>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  {/*
                   * FIX: When isNewWorkflowSuggestion is true, user doesn't have a matching workflow.
                   * Don't show "Current Steps" - only show the suggested/optimized steps.
                   */}
                  {block.isNewWorkflowSuggestion ? (
                    /* New workflow suggestion - only show optimized steps */
                    <>
                      {/* Header */}
                      <div className="border-b border-gray-200 bg-purple-50 px-4 py-3">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                          <Sparkles className="h-4 w-4" />
                          Suggested Approach (from peer workflows)
                        </h4>
                        <p className="mt-1 text-xs text-purple-600">
                          This workflow pattern is used by high-performing peers but isn&apos;t in your current toolset.
                        </p>
                      </div>

                      {/* Suggested Steps */}
                      <div className="divide-y divide-gray-100">
                        {block.stepTransformations.flatMap((transform, transformIdx) =>
                          (transform.optimizedSteps || []).map((step, stepIdx) => {
                            const description = step.description || step.stepId || '';
                            const separatorIndex = description.indexOf(' - ');
                            const stepTitle = separatorIndex > 0 ? description.substring(0, separatorIndex) : description;
                            const isInToolbox = step.isInUserToolbox === true;

                            return (
                              <div key={step.stepId || `${transformIdx}-${stepIdx}`} className="p-4">
                                <div className="mb-1 flex items-center gap-2">
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                    Step {stepIdx + 1}
                                  </span>
                                  {isInToolbox && (
                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                      <CheckCircle className="h-3 w-3" />
                                      In your toolbox
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {stepTitle}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {step.tool} • {formatDuration(step.estimatedDurationSeconds)}
                                </div>
                                {step.claudeCodePrompt && (
                                  <ClaudeCodePromptSection prompt={step.claudeCodePrompt} />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Summary Footer */}
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {block.stepTransformations[0]?.rationale}
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Existing workflow optimization - show side-by-side comparison */
                    <>
                      {/* Header Row */}
                      <div className="grid grid-cols-[1fr_auto_1fr] border-b border-gray-200">
                        <div className="bg-red-50 px-4 py-3">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-red-700">
                            <Clock className="h-4 w-4" />
                            Current Steps
                          </h4>
                        </div>
                        <div className="flex items-center justify-center bg-gray-50 px-3">
                          <ArrowRight className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="bg-green-50 px-4 py-3">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <Zap className="h-4 w-4" />
                            Optimized Steps
                          </h4>
                        </div>
                      </div>

                      {/* Steps Grid */}
                      <div className="grid grid-cols-[1fr_auto_1fr]">
                        {/* Current Steps Column */}
                        <div className="divide-y divide-gray-100 bg-red-50/30">
                          {block.stepTransformations.flatMap((transform) => {
                            const groupedSteps = groupStepsByDescription(transform.currentSteps || []);
                            return groupedSteps.map((group, groupIdx) => (
                              <div key={group.stepIds[0] || groupIdx} className="p-4">
                                <div className="mb-1 text-xs font-medium text-gray-500">
                                  {group.count > 1 ? `${group.count} similar steps` : 'Step'}
                                </div>
                                <div className="text-sm font-medium text-gray-900">
                                  {group.description}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {group.tools.filter(t => t && t !== 'unknown').join(', ') || 'Manual'} • {formatDuration(group.totalDuration)}
                                </div>
                              </div>
                            ));
                          })}
                        </div>

                        {/* Center Arrow Column */}
                        <div className="flex flex-col items-center justify-around border-x border-gray-100 bg-gray-50 px-2">
                          {block.stepTransformations.flatMap((transform) => {
                            const groupedSteps = groupStepsByDescription(transform.currentSteps || []);
                            return groupedSteps.map((_, idx) => (
                              <div key={idx} className="flex min-h-[60px] items-center">
                                <ArrowRight className="h-4 w-4 text-gray-300" />
                              </div>
                            ));
                          })}
                        </div>

                        {/* Optimized Steps Column */}
                        <div className="divide-y divide-gray-100 bg-green-50/30">
                          {block.stepTransformations.flatMap((transform, transformIdx) =>
                            (transform.optimizedSteps || []).map((step, stepIdx) => {
                              const description = step.description || step.stepId || '';
                              const separatorIndex = description.indexOf(' - ');
                              const stepTitle = separatorIndex > 0 ? description.substring(0, separatorIndex) : description;
                              const isInToolbox = step.isInUserToolbox === true;

                              return (
                                <div key={step.stepId || `${transformIdx}-${stepIdx}`} className="p-4">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className={`text-xs font-medium ${isInToolbox ? 'text-green-600' : 'text-purple-600'}`}>
                                      {isInToolbox ? 'Your Toolbox' : 'New Tool'}
                                    </span>
                                    {isInToolbox ? (
                                      <CheckCircle className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Sparkles className="h-3 w-3 text-purple-600" />
                                    )}
                                  </div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {stepTitle}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    {step.tool} • {formatDuration(step.estimatedDurationSeconds)}
                                  </div>
                                  {step.claudeCodePrompt && (
                                    <ClaudeCodePromptSection prompt={step.claudeCodePrompt} />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Summary Footer */}
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {block.stepTransformations.map((transform, idx) => (
                            <span key={idx} className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              <Zap className="h-3 w-3" />
                              Save {formatDuration(transform.timeSavedSeconds)}
                            </span>
                          ))}
                          <span className="text-xs text-gray-500">
                            {block.stepTransformations[0]?.rationale}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
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
