import { TimelineNodeType } from '@journey/schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback,useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '../../components/ui/dialog';

import { NodeModalRouter } from './NodeModalRouter';
import { NodeType,NodeTypeSelector } from './NodeTypeSelector';

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
  isSubmitting?: boolean;
}

type ModalStep = 'typeSelection' | 'formDetails';

export const MultiStepAddNodeModal: React.FC<MultiStepAddNodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
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
      job: 'Job',
      careerTransition: 'Career Transition',
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

  // Helper function to map NodeType to TimelineNodeType
  const mapNodeTypeToTimelineNodeType = (nodeType: NodeType): TimelineNodeType => {
    const mapping: Record<NodeType, TimelineNodeType> = {
      'job': TimelineNodeType.Job,
      'education': TimelineNodeType.Education,
      'project': TimelineNodeType.Project,
      'event': TimelineNodeType.Event,
      'action': TimelineNodeType.Action,
      'careerTransition': TimelineNodeType.CareerTransition
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
        ...context.suggestedData
      }
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
        className="bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 shadow-2xl">
        {/* Clean minimal background */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-slate-100"></div>

        <div className="relative z-10">

          {/* Enhanced Step Indicator */}
          <div className="flex items-center justify-center mb-8 mt-6">
            <div className="flex items-center space-x-4">
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all duration-300 ${
                currentStep === 'typeSelection'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600'
              }`}>
                <span className="relative z-10">1</span>
                {currentStep === 'typeSelection' && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 animate-pulse"></div>
                )}
              </div>
              <div className={`w-20 h-1 rounded-full transition-all duration-300 ${
                currentStep === 'formDetails'
                  ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                  : 'bg-slate-200'
              }`} />
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all duration-300 ${
                currentStep === 'formDetails'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'bg-slate-200 text-slate-500'
              }`}>
                <span className="relative z-10">2</span>
                {currentStep === 'formDetails' && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 animate-pulse"></div>
                )}
              </div>
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px] relative">
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
          <div className="flex justify-between items-center pt-8 border-t border-slate-200/50 mt-8">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-button"
              className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-medium transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25 overflow-hidden border border-slate-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
              <span className="relative z-10">Cancel</span>
            </button>

            <div className="flex space-x-3">
              {currentStep === 'formDetails' && (
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  data-testid="back-button"
                  className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-medium transition-all duration-300 hover:shadow-lg hover:shadow-slate-500/25 overflow-hidden border border-slate-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10 flex items-center">
                    <ChevronLeft className="w-4 h-4 mr-2" />
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
                  className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                  <span className="relative z-10 flex items-center">
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
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

export default MultiStepAddNodeModal;
