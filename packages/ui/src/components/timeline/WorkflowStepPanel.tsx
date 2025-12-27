/**
 * WorkflowStepPanel Component
 * Side panel showing "Steps taken" with screenshots when clicking workflow nodes
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { WorkflowNode } from '../../types/workflow-canvas';

interface MicroStep {
  number: number;
  description: string;
  screenshot?: string; // URL to screenshot
}

// Generate micro-steps - this will be replaced with actual session data
const generateMicroSteps = (stepTitle: string): MicroStep[] => {
  // Default steps for any workflow node
  return [
    { number: 1, description: 'Review relevant documentation and context' },
    { number: 2, description: 'Complete the primary task or activity' },
    { number: 3, description: 'Document outcomes and next steps' },
  ];
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

  const microSteps = node ? generateMicroSteps(node.title) : [];

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
              {/* Section header */}
              <div className="mb-6">
                <span className="text-sm font-medium text-gray-600">Steps taken</span>
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
                      <p className="text-sm text-gray-900 leading-relaxed mb-3">
                        {step.description}
                      </p>

                      {/* Screenshot placeholder */}
                      <div className="w-full h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                        <span className="text-xs text-gray-400">Screenshot</span>
                      </div>
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
