/**
 * WorkflowSelector - Modal for importing steps from detected workflow patterns
 */

import { X, Loader2, ArrowRight, Clock, Hash } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { getHierarchicalTopWorkflows } from '../../services/workflow-api';

interface WorkflowSelectorProps {
  initialPatternId?: string;
  onSelect: (patternId: string) => void;
  onClose: () => void;
}

interface WorkflowPattern {
  _key: string;
  canonicalName: string;
  occurrenceCount: number;
  avgDuration?: number;
  primaryTools: string[];
  blocks?: Array<{
    _key: string;
    canonicalName: string;
    intent: string;
  }>;
}

export function WorkflowSelector({
  initialPatternId,
  onSelect,
  onClose,
}: WorkflowSelectorProps) {
  const [workflows, setWorkflows] = useState<WorkflowPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    setLoading(true);
    try {
      const data = await getHierarchicalTopWorkflows({ limit: 20 });
      setWorkflows(data?.patterns || []);

      // Auto-select if initial pattern ID provided
      if (initialPatternId) {
        onSelect(initialPatternId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl"
        style={{ maxHeight: '70vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: '#E2E8F0' }}
        >
          <h3 className="text-sm font-semibold text-gray-800">
            Import from Workflow Pattern
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(70vh - 56px)' }}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Loading workflows...</span>
            </div>
          )}

          {error && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: '#FEF2F2', color: '#DC2626' }}
            >
              {error}
            </div>
          )}

          {!loading && workflows.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">
              No repetitive workflows detected yet.
              <br />
              Keep using your tools — patterns will appear here.
            </div>
          )}

          {!loading &&
            workflows.map((wf) => (
              <button
                key={wf._key}
                onClick={() => onSelect(wf._key)}
                className="mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-indigo-300 hover:bg-indigo-50/50"
                style={{ borderColor: '#E2E8F0' }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-700">
                    {wf.canonicalName}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {wf.occurrenceCount} times
                    </span>
                    {wf.avgDuration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.round(wf.avgDuration / 60)}m avg
                      </span>
                    )}
                    {wf.primaryTools?.length > 0 && (
                      <span>{wf.primaryTools.slice(0, 3).join(', ')}</span>
                    )}
                  </div>
                  {wf.blocks && wf.blocks.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {wf.blocks.slice(0, 4).map((block) => (
                        <span
                          key={block._key}
                          className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{ background: '#F1F5F9', color: '#64748B' }}
                        >
                          {block.canonicalName}
                        </span>
                      ))}
                      {wf.blocks.length > 4 && (
                        <span className="text-[10px] text-gray-400">
                          +{wf.blocks.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
