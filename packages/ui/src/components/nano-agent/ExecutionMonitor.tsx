/**
 * ExecutionMonitor - Polling-driven execution tracking
 */

import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Loader2,
  StopCircle,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import type { ExecutableAction } from '../../services/nano-agent-api';
import * as nanoAgentApi from '../../services/nano-agent-api';

interface ExecutionMonitorProps {
  executionId: string;
  flowName: string;
  actions: ExecutableAction[];
  onClose: () => void;
}

type StepStatus =
  | 'pending'
  | 'confirmed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

interface StepState {
  actionId: string;
  description: string;
  status: StepStatus;
  error?: string;
  durationMs?: number;
}

export function ExecutionMonitor({
  executionId,
  flowName,
  actions,
  onClose,
}: ExecutionMonitorProps) {
  const [steps, setSteps] = useState<StepState[]>(
    actions.map((a) => ({
      actionId: a.actionId,
      description: a.description,
      status: 'pending',
    }))
  );
  const [executionStatus, setExecutionStatus] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Poll execution status via authenticated HTTP (replaces broken EventSource SSE)
  useEffect(() => {
    setLoading(true);
    setError(null);

    const poller = nanoAgentApi.pollExecution(
      executionId,
      (exec) => {
        setLoading(false);
        setError(null);
        setExecutionStatus(exec.status);

        if (exec.stepResults && Array.isArray(exec.stepResults)) {
          setSteps((prev) =>
            prev.map((s, i) => {
              const dbStep = exec.stepResults[i];
              if (dbStep && dbStep.status !== 'pending') {
                return {
                  ...s,
                  status: dbStep.status as StepStatus,
                  error: dbStep.error || undefined,
                  durationMs: dbStep.durationMs || undefined,
                };
              }
              if (exec.status === 'running' && i === exec.currentStep && s.status === 'pending') {
                return { ...s, status: 'executing' };
              }
              return s;
            })
          );
        }
      },
      (err) => {
        setLoading(false);
        setError(err.message);
        console.error('[ExecutionMonitor] Polling error:', err);
      },
      1500
    );

    return () => {
      poller.stop();
    };
  }, [executionId]);

  const handleAbort = useCallback(async () => {
    try {
      await nanoAgentApi.abortExecution(executionId);
    } catch (err) {
      console.error('Failed to abort:', err);
    }
  }, [executionId]);

  const completedCount = steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const isFinished =
    executionStatus === 'completed' ||
    executionStatus === 'aborted' ||
    executionStatus === 'failed';

  const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-gray-300" />,
    confirmed: <Clock className="h-4 w-4 text-yellow-500" />,
    executing: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
    skipped: <SkipForward className="h-4 w-4 text-gray-400" />,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{flowName}</h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  executionStatus === 'running'
                    ? 'animate-pulse bg-blue-500'
                    : executionStatus === 'completed'
                      ? 'bg-green-500'
                      : executionStatus === 'aborted' || executionStatus === 'failed'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                }`}
              />
              {executionStatus === 'running'
                ? 'Running'
                : executionStatus === 'completed'
                  ? 'Completed'
                  : executionStatus === 'aborted'
                    ? 'Aborted'
                    : executionStatus === 'failed'
                      ? 'Failed'
                      : 'Pending'}
              {loading && !isFinished && (
                <span className="text-gray-400">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> Connecting...
                </span>
              )}
            </div>
          </div>

          {!isFinished && (
            <button
              onClick={handleAbort}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              <StopCircle className="h-3 w-3" />
              Abort
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            Connection error: {error}
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-gray-400">
            <span>
              {completedCount} of {steps.length} steps
            </span>
            <span>{progress}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: '#F1F5F9' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background:
                  executionStatus === 'failed' || executionStatus === 'aborted'
                    ? '#EF4444'
                    : '#4F46E5',
              }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <div
              key={step.actionId}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                step.status === 'executing'
                  ? 'bg-blue-50'
                  : step.status === 'failed'
                    ? 'bg-red-50'
                    : ''
              }`}
              style={{
                borderLeft:
                  step.status === 'executing'
                    ? '3px solid #3B82F6'
                    : step.status === 'completed'
                      ? '3px solid #22C55E'
                      : step.status === 'failed'
                        ? '3px solid #EF4444'
                        : '3px solid transparent',
              }}
            >
              {STATUS_ICON[step.status]}
              <span
                className={`flex-1 ${
                  step.status === 'completed' || step.status === 'skipped'
                    ? 'text-gray-400 line-through'
                    : 'text-gray-700'
                }`}
              >
                {step.description}
              </span>
              {step.durationMs && (
                <span className="text-xs text-gray-400">{step.durationMs}ms</span>
              )}
              {step.error && (
                <span className="max-w-[120px] truncate text-xs text-red-500" title={step.error}>
                  {step.error}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {isFinished && (
        <div
          className="flex items-center justify-end border-t px-4 py-3"
          style={{ borderColor: '#E2E8F0' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
