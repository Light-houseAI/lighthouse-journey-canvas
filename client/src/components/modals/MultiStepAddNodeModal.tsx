import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NodeTypeSelector, NodeType } from './NodeTypeSelector';
import { AddNodeModal } from './AddNodeModal';

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
  onSubmit: (data: any) => Promise<void>;
  context: NodeContext;
  isSubmitting?: boolean;
}

type ModalStep = 'typeSelection' | 'formDetails';

export const MultiStepAddNodeModal: React.FC<MultiStepAddNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
  isSubmitting = false
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

  const handleFormSubmit = useCallback(async (formData: any) => {
    try {
      await onSubmit(formData);
      // Reset modal state after successful submission
      setCurrentStep('typeSelection');
      setSelectedType(null);
    } catch (error) {
      // Error handling is done in the form component
      throw error;
    }
  }, [onSubmit]);

  const getStepTitle = () => {
    switch (currentStep) {
      case 'typeSelection':
        return 'Add New Milestone';
      case 'formDetails':
        return `Add ${selectedType ? getTypeDisplayName(selectedType) : 'Milestone'}`;
      default:
        return 'Add New Milestone';
    }
  };

  const getTypeDisplayName = (type: NodeType): string => {
    const typeNames: Record<NodeType, string> = {
      education: 'Education',
      workExperience: 'Work Experience',
      jobTransition: 'Job Transition',
      project: 'Project',
      event: 'Event',
      action: 'Action'
    };
    return typeNames[type] || type;
  };

  const getContextDescription = () => {
    switch (context.insertionPoint) {
      case 'between':
        return (
          <span>
            Adding between <strong>{context.parentNode?.title}</strong> and{' '}
            <strong>{context.targetNode?.title}</strong>
          </span>
        );
      case 'after':
        return (
          <span>
            Adding after <strong>{context.targetNode?.title}</strong>
          </span>
        );
      case 'branch':
        return (
          <span>
            Adding to <strong>{context.parentNode?.title}</strong>
          </span>
        );
      default:
        return 'Adding new milestone';
    }
  };

  // If we're on the form details step, render the existing AddNodeModal
  if (currentStep === 'formDetails' && selectedType) {
    const enhancedContext = {
      ...context,
      availableTypes: [selectedType], // Only show the selected type
      suggestedData: {
        type: selectedType,
        ...context.suggestedData
      }
    };

    return (
      <AddNodeModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={handleFormSubmit}
        context={enhancedContext}
        isSubmitting={isSubmitting}
      />
    );
  }

  // Type selection step
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay data-testid="multi-step-modal-overlay" />
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 border-gray-200 shadow-2xl">
        <DialogHeader className="pb-6 border-b border-gray-200">
          <DialogTitle className="text-center text-xl font-semibold text-gray-900">{getStepTitle()}</DialogTitle>
          <p className="text-sm text-gray-600 text-center mt-2">
            {getContextDescription()}
          </p>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              currentStep === 'typeSelection' 
                ? 'bg-purple-600 text-white' 
                : 'bg-purple-100 text-purple-600'
            }`}>
              1
            </div>
            <div className="w-16 h-0.5 bg-gray-200" />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              currentStep === 'formDetails' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 'typeSelection' && (
            <NodeTypeSelector
              onSelect={handleTypeSelect}
              selectedType={selectedType}
              availableTypes={context.availableTypes}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="cancel-button"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 bg-white"
          >
            Cancel
          </Button>

          <div className="flex space-x-3">
            {currentStep === 'formDetails' && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                data-testid="back-button"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            
            {currentStep === 'typeSelection' && (
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={!selectedType}
                data-testid="next-button"
                className="bg-purple-600 hover:bg-purple-700"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MultiStepAddNodeModal;