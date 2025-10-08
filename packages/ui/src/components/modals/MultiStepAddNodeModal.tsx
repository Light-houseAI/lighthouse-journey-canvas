import { TimelineNodeType } from '@journey/schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  GradientButton,
  HStack,
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border border-slate-200 bg-white shadow-2xl !z-[100]">
        <DialogTitle className="sr-only">
          {currentStep === 'typeSelection' ? 'Select Node Type' : 'Add Node Details'}
        </DialogTitle>

        {/* Clean minimal background */}
        <div className="absolute left-0 top-0 h-[1px] w-full bg-slate-100"></div>

        <div className="relative z-10">
          {/* Enhanced Step Indicator */}
          <div className="mb-8 mt-6 flex items-center justify-center">
            <HStack spacing={4} className="flex items-center">
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
            </HStack>
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
            <GradientButton
              type="button"
              onClick={onClose}
              data-testid="cancel-button"
              variant="secondary"
            >
              Cancel
            </GradientButton>

            <HStack spacing={3} className="flex">
              {currentStep === 'formDetails' && (
                <GradientButton
                  type="button"
                  onClick={handlePreviousStep}
                  data-testid="back-button"
                  variant="secondary"
                  iconLeft={<ChevronLeft className="h-4 w-4" />}
                >
                  Back
                </GradientButton>
              )}

              {currentStep === 'typeSelection' && (
                <GradientButton
                  type="button"
                  onClick={handleNextStep}
                  disabled={!selectedType}
                  data-testid="next-button"
                  variant="primary"
                  iconRight={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </GradientButton>
              )}
            </HStack>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
