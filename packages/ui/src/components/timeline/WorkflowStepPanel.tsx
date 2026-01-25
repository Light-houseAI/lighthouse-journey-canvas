/**
 * WorkflowStepPanel Component
 * Side panel showing real granular steps from session chapter data
 * Supports both V1 (chapters with granular_steps) and V2 (workflows with semantic_steps)
 */

import { useEffect, useRef } from 'react';
import { X, Bot, User, Eye, Sparkles } from 'lucide-react';
import { Badge } from '@journey/components';
import type { WorkflowNode } from '../../types/workflow-canvas';
import type { GranularStep, SemanticStep } from '@journey/schema';
import { ClassificationHierarchy } from '../workflow/ClassificationHierarchy';

interface MicroStep {
  number: number;
  description: string;
  screenshot?: string;
  timestamp?: string;
  app?: string;
  // V2 specific fields
  agenticPattern?: string;
  clusteredActions?: number;
}

// Agentic pattern display configuration
const AGENTIC_PATTERNS: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  the_architect: { label: 'The Architect', icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  the_operator: { label: 'The Operator', icon: Bot, color: 'text-blue-600 bg-blue-50' },
  the_reviewer: { label: 'The Reviewer', icon: Eye, color: 'text-green-600 bg-green-50' },
  the_centaur: { label: 'The Centaur', icon: User, color: 'text-orange-600 bg-orange-50' },
};

// Convert granular steps (V1) or semantic steps (V2) to display format
const getMicroSteps = (node: WorkflowNode | null): MicroStep[] => {
  // V2: Check for semantic_steps in workflowData
  if (node?.workflowData?.semantic_steps && node.workflowData.semantic_steps.length > 0) {
    return node.workflowData.semantic_steps.map((step: SemanticStep, index: number) => ({
      number: index + 1,
      description: step.step_name || step.description,
      agenticPattern: step.agentic_pattern,
      clusteredActions: step.raw_action_count,
      // Semantic steps don't have timestamps/apps at step level
      timestamp: undefined,
      app: undefined,
      screenshot: undefined,
    }));
  }

  // V1: Check for granular_steps in chapterData
  if (node?.chapterData?.granular_steps && node.chapterData.granular_steps.length > 0) {
    return node.chapterData.granular_steps.map((step: GranularStep, index: number) => ({
      number: index + 1,
      description: step.description,
      timestamp: step.timestamp,
      app: step.app,
      screenshot: undefined,
    }));
  }

  // Fallback if no steps available
  const summary = node?.workflowData?.semantic_steps?.[0]?.step_name ||
    node?.chapterData?.summary ||
    'Review session activity';
  return [{ number: 1, description: summary }];
};

interface WorkflowStepPanelProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
}

export function WorkflowStepPanel({ node, isOpen, onClose }: WorkflowStepPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && isOpen) {
        onClose();
      }
    };
    // Add slight delay to prevent immediate close on open click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const microSteps = getMicroSteps(node);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`
          fixed inset-0 bg-gray-900/5 z-40
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`
          fixed top-0 right-0 bottom-0 w-[400px] bg-white z-50
          border-l border-gray-200 shadow-2xl
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {node && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 pr-4 leading-tight">
                {node.title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 -m-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto h-[calc(100%-88px)]">
              {/* V2: Classification Hierarchy */}
              {node.workflowData?.classification && (
                <div className="mb-6">
                  <span className="text-sm font-medium text-gray-600 block mb-3">Classification</span>
                  <ClassificationHierarchy
                    classification={node.workflowData.classification}
                    variant="compact"
                  />
                </div>
              )}

              {/* Section header */}
              <div className="mb-6">
                <span className="text-sm font-medium text-gray-600">
                  {node.workflowData ? 'Semantic Steps' : 'Steps taken'}
                </span>
              </div>

              {/* Micro-steps list */}
              <div className="space-y-5">
                {microSteps.map((step) => (
                  <div key={step.number} className="flex gap-4">
                    {/* Step number */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">{step.number}</span>
                    </div>

                    {/* Step content */}
                    <div className="flex-1 pt-1">
                      <p className="text-sm text-gray-900 leading-relaxed mb-2">
                        {step.description}
                      </p>

                      {/* V2: Agentic pattern badge */}
                      {step.agenticPattern && AGENTIC_PATTERNS[step.agenticPattern] && (
                        <div className="mb-2">
                          {(() => {
                            const pattern = AGENTIC_PATTERNS[step.agenticPattern!];
                            const Icon = pattern.icon;
                            return (
                              <Badge variant="secondary" className={`${pattern.color} border-0 gap-1`}>
                                <Icon size={12} />
                                {pattern.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      )}

                      {/* Metadata */}
                      {(step.timestamp || step.app || step.clusteredActions) && (
                        <div className="flex gap-3 mb-3 text-xs text-gray-500">
                          {step.app && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              {step.app}
                            </span>
                          )}
                          {step.timestamp && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                          {step.clusteredActions && step.clusteredActions > 1 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                              {step.clusteredActions} actions clustered
                            </span>
                          )}
                        </div>
                      )}

                      {/* Screenshot placeholder */}
                      {step.screenshot ? (
                        <img
                          src={step.screenshot}
                          alt={`Step ${step.number}`}
                          className="w-full rounded-lg border border-gray-200"
                        />
                      ) : (
                        <div className="w-full h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                          <span className="text-xs text-gray-400">Screenshot</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
