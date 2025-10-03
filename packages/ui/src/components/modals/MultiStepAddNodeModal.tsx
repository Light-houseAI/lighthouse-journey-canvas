import { TimelineNodeType } from '@journey/schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@journey/components';  // was: dialog
import { NodeModalRouter } from './NodeModalRouter';
import { NodeType, NodeTypeSelector } from './NodeTypeSelector';

interface NodeContext {
  insertionPoint: 'between' | 'after' | 'branch';
  parentNode?: {
    id: string;
    title: string;
    type: string;
  };
  targetNode?: {
    id: string;
    title: string;
    type: string;
  };
  availableTypes: string[];
  suggestedData?: any;
}

interface MultiStepAddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  context: NodeContext;
}

type ModalStep = 'typeSelection' | 'formDetails';

export const MultiStepAddNodeModal: React.FC<MultiStepAddNodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  context,
}) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>('typeSelection');
  const [selectedType, setSelectedType] = useState<NodeType | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStep('typeSelection');
      setSelectedType(null);
    }
  }, [isOpen]);

  const handleTypeSelect = useCallback((type: NodeType) => {
    setSelectedType(type);
  }, []);

  const handleNextStep = useCallback(() => {
    if (currentStep === 'typeSelection' && selectedType) {
      setCurrentStep('formDetails');
    }
  }, [currentStep, selectedType]);

  const handlePreviousStep = useCallback(() => {
    if (currentStep === 'formDetails') {
      setCurrentStep('typeSelection');
    }
  }, [currentStep]);

  const handleFormSubmit = useCallback(() => {
    // Reset modal state after successful submission
    setCurrentStep('typeSelection');
    setSelectedType(null);

    // Close the modal
    onClose();

    // Call parent success callback if provided
    if (onSuccess) {
      onSuccess();
    }
  }, [onClose, onSuccess]);

  // Helper function to map NodeType to TimelineNodeType
  const mapNodeTypeToTimelineNodeType = (
    nodeType: NodeType
  ): TimelineNodeType => {
    const mapping: Record<NodeType, TimelineNodeType> = {
      job: TimelineNodeType.Job,
      education: TimelineNodeType.Education,
      project: TimelineNodeType.Project,
      event: TimelineNodeType.Event,
      action: TimelineNodeType.Action,
      careerTransition: TimelineNodeType.CareerTransition,
    };
    return mapping[nodeType];
  };

  // If we're on the form details step, render the specific modal for the selected type
  if (currentStep === 'formDetails' && selectedType) {
    const enhancedContext = {
      ...context,
      nodeType: mapNodeTypeToTimelineNodeType(selectedType), // Set the correct TimelineNodeType
      availableTypes: [selectedType], // Only show the selected type
      parentId: context.parentNode?.id, // Pass the parentId for hierarchical creation
      suggestedData: {
        type: selectedType,
        ...context.suggestedData,
      },
    };

    return (
      <NodeModalRouter
        isOpen={isOpen}
        onClose={onClose}
        onSuccess={handleFormSubmit}
        context={enhancedContext}
      />
    );
  }

  // Type selection step
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay
        data-testid="multi-step-modal-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-black/50 backdrop-blur-sm"
      />
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border border-slate-200 bg-white shadow-2xl">
        {/* Clean minimal background */}
        <div className="absolute left-0 top-0 h-[1px] w-full bg-slate-100"></div>

        <div className="relative z-10">
          {/* Enhanced Step Indicator */}
          <div className="mb-8 mt-6 flex items-center justify-center">
            <div className="flex items-center space-x-4">
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                  currentStep === 'typeSelection'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600'
                }`}
              >
                <span className="relative z-10">1</span>
                {currentStep === 'typeSelection' && (
                  <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-blue-600 to-purple-700 opacity-0"></div>
                )}
              </div>
              <div
                className={`h-1 w-20 rounded-full transition-all duration-300 ${
                  currentStep === 'formDetails'
                    ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                    : 'bg-slate-200'
                }`}
              />
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                  currentStep === 'formDetails'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <span className="relative z-10">2</span>
                {currentStep === 'formDetails' && (
                  <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-blue-600 to-purple-700 opacity-0"></div>
                )}
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="relative min-h-[400px]">
            <div className="relative z-10">
              {currentStep === 'typeSelection' && (
                <NodeTypeSelector
                  onSelect={handleTypeSelect}
                  selectedType={selectedType || undefined}
                  availableTypes={context.availableTypes}
                />
              )}
            </div>
          </div>

          {/* Enhanced Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200/50 pt-8">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-button"
              className="group relative overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-r from-slate-100 to-slate-200 px-6 py-3 font-medium text-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]"></div>
              <span className="relative z-10">Cancel</span>
            </button>

            <div className="flex space-x-3">
              {currentStep === 'formDetails' && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  data-testid="back-button"
                  className="group relative overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-r from-slate-100 to-slate-200 px-6 py-3 font-medium text-slate-700 transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]"></div>
                  <span className="relative z-10 flex items-center">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </span>
                </button>
              )}

              {currentStep === 'typeSelection' && (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!selectedType}
                  data-testid="next-button"
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]"></div>
                  <span className="relative z-10 flex items-center">
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
