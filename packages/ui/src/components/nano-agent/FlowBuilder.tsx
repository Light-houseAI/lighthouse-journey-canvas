/**
 * FlowBuilder - Create/edit automation flows from natural language or workflow imports
 */

import {
  Sparkles,
  Plus,
  Save,
  Play,
  Loader2,
  Import,
  AlertCircle,
} from 'lucide-react';
import React, { useState, useCallback } from 'react';

import type { ExecutableAction, NanoAgentFlow } from '../../services/nano-agent-api';
import * as nanoAgentApi from '../../services/nano-agent-api';

import { StepCard } from './StepCard';
import { WorkflowSelector } from './WorkflowSelector';

interface FlowBuilderProps {
  editingFlow?: NanoAgentFlow | null;
  onFlowSaved: (flow: NanoAgentFlow) => void;
  onRunFlow: (flow: NanoAgentFlow) => void;
  importWorkflowId?: string | null;
}

export function FlowBuilder({
  editingFlow,
  onFlowSaved,
  onRunFlow,
  importWorkflowId,
}: FlowBuilderProps) {
  // Flow metadata
  const [flowName, setFlowName] = useState(editingFlow?.name || '');
  const [flowDescription, setFlowDescription] = useState(editingFlow?.description || '');
  const [tags, setTags] = useState<string[]>(editingFlow?.tags || []);
  const [tagInput, setTagInput] = useState('');

  // Steps input
  const [stepsInput, setStepsInput] = useState('');
  const [actions, setActions] = useState<ExecutableAction[]>(
    (editingFlow?.actions as ExecutableAction[]) || []
  );

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(!!importWorkflowId);

  /**
   * Generate actions from natural language steps
   */
  const handleGenerate = useCallback(async () => {
    const lines = stepsInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError('Enter at least one step');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generated = await nanoAgentApi.generateActionsFromNL(lines);
      setActions((prev) => [...prev, ...generated]);
      setStepsInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate actions');
    } finally {
      setIsGenerating(false);
    }
  }, [stepsInput]);

  /**
   * Import actions from a workflow pattern
   */
  const handleWorkflowImport = useCallback(
    async (patternId: string) => {
      setIsGenerating(true);
      setError(null);
      setShowWorkflowSelector(false);

      try {
        const generated = await nanoAgentApi.generateActionsFromWorkflow(patternId);
        setActions((prev) => [...prev, ...generated]);
      } catch (err: any) {
        setError(err.message || 'Failed to import workflow');
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  /**
   * Save the flow
   */
  const handleSave = useCallback(async () => {
    if (!flowName.trim()) {
      setError('Flow name is required');
      return;
    }
    if (actions.length === 0) {
      setError('Add at least one action');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let flow: NanoAgentFlow;
      if (editingFlow) {
        flow = await nanoAgentApi.updateFlow(editingFlow.id, {
          name: flowName,
          description: flowDescription,
          actions,
          tags,
        });
      } else {
        flow = await nanoAgentApi.createFlow({
          name: flowName,
          description: flowDescription,
          actions,
          tags,
          sourceType: 'custom',
        });
      }
      onFlowSaved(flow);
    } catch (err: any) {
      setError(err.message || 'Failed to save flow');
    } finally {
      setIsSaving(false);
    }
  }, [flowName, flowDescription, actions, tags, editingFlow, onFlowSaved]);

  /**
   * Delete a step
   */
  const handleDeleteStep = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Update a step
   */
  const handleUpdateStep = useCallback(
    (index: number, updated: ExecutableAction) => {
      setActions((prev) => prev.map((a, i) => (i === index ? updated : a)));
    },
    []
  );

  /**
   * Add tag
   */
  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  return (
    <div className="flex h-full flex-col">
      {/* Workflow Selector Modal */}
      {showWorkflowSelector && (
        <WorkflowSelector
          initialPatternId={importWorkflowId || undefined}
          onSelect={handleWorkflowImport}
          onClose={() => setShowWorkflowSelector(false)}
        />
      )}

      {/* Error banner */}
      {error && (
        <div
          className="mx-4 mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: '#FEF2F2', color: '#DC2626' }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Flow Name & Description */}
        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Flow name"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400"
            style={{ borderColor: '#E2E8F0' }}
          />
          <textarea
            placeholder="Description (optional)"
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400"
            style={{ borderColor: '#E2E8F0' }}
          />

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ background: '#EEF2FF', color: '#4F46E5' }}
              >
                {tag}
                <button
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="ml-0.5 hover:text-red-500"
                >
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="w-24 rounded border-none bg-transparent py-0.5 text-xs outline-none"
            />
          </div>
        </div>

        {/* NL Step Input */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Describe steps in plain English (one per line)
          </label>
          <textarea
            placeholder={`Go to gmail.com\nClick Compose\nType "Hi, following up on our call..." in the message body\nClick Send`}
            value={stepsInput}
            onChange={(e) => setStepsInput(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400"
            style={{ borderColor: '#E2E8F0' }}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !stepsInput.trim()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: '#4F46E5' }}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate Actions
            </button>
            <button
              onClick={() => setShowWorkflowSelector(true)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              style={{ borderColor: '#E2E8F0' }}
            >
              <Import className="h-3.5 w-3.5" />
              Import from Workflow
            </button>
          </div>
        </div>

        {/* Generated Actions List */}
        {actions.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                Actions ({actions.length})
              </span>
              <button
                onClick={() => setActions([])}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((action, i) => (
                <StepCard
                  key={action.actionId}
                  action={action}
                  index={i}
                  onDelete={handleDeleteStep}
                  onUpdate={handleUpdateStep}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {actions.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-400">
              Type steps above and click "Generate Actions" to create your automation flow
            </p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {actions.length > 0 && (
        <div
          className="flex items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: '#E2E8F0', background: '#FAFAFA' }}
        >
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            style={{ borderColor: '#E2E8F0' }}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Flow
          </button>
          <button
            onClick={() => {
              if (editingFlow) {
                onRunFlow(editingFlow);
              }
            }}
            disabled={!editingFlow}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ background: '#4F46E5' }}
          >
            <Play className="h-3.5 w-3.5" />
            Run Flow
          </button>
        </div>
      )}
    </div>
  );
}
