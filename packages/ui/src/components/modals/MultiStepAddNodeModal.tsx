import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  type Step,
} from '@journey/components';
import { TimelineNodeType } from '@journey/schema';
import React, { useCallback, useState } from 'react';

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

export const MultiStepAddNodeModal: React.FC<MultiStepAddNodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  context,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<NodeType | null>(null);

  // Get display name for selected type
  const getTypeDisplayName = () => {
    if (!selectedType) return 'Item';
    const displayMap: Record<NodeType, string> = {
      job: 'Job',
      education: 'Education',
      project: 'Project',
      event: 'Event',
      action: 'Action',
      careerTransition: 'Career Transition',
    };
    return displayMap[selectedType];
  };

  // Define wizard steps dynamically
  const steps: Step[] = [
    { id: 'type', label: 'Select Type' },
    {
      id: 'details',
      label: selectedType
        ? `Add ${getTypeDisplayName()} Details`
        : 'Add Details',
    },
  ];

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setSelectedType(null);
    }
  }, [isOpen]);

  const handleTypeSelect = useCallback((type: NodeType) => {
    setSelectedType(type);
  }, []);

  const handleNextStep = useCallback(() => {
    if (currentStepIndex === 0 && selectedType) {
      setCurrentStepIndex(1);
    }
  }, [currentStepIndex, selectedType]);

  const handleBackStep = useCallback(() => {
    if (currentStepIndex === 1) {
      setCurrentStepIndex(0);
    }
  }, [currentStepIndex]);

  const handleFormSubmit = useCallback(() => {
    // Reset modal state after successful submission
    setCurrentStepIndex(0);
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

  // Prepare context for form step
  const enhancedContext = selectedType
    ? {
        ...context,
        nodeType: mapNodeTypeToTimelineNodeType(selectedType),
        availableTypes: [selectedType],
        parentId: context.parentNode?.id,
        suggestedData: {
          type: selectedType,
          ...context.suggestedData,
        },
      }
    : context;

  // Render step content
  const renderStepContent = () => {
    if (currentStepIndex === 0) {
      return (
        <NodeTypeSelector
          onSelect={handleTypeSelect}
          selectedType={selectedType || undefined}
          availableTypes={context.availableTypes}
        />
      );
    }

    if (currentStepIndex === 1 && selectedType) {
      return (
        <NodeModalRouter
          isOpen={true}
          onClose={onClose}
          onSuccess={handleFormSubmit}
          context={enhancedContext}
          renderWithoutDialog={true}
        />
      );
    }

    return null;
  };

  // Get form ID based on selected type for step 2
  const getFormId = () => {
    if (!selectedType) return undefined;
    const formIdMap: Record<NodeType, string> = {
      job: 'job-form',
      education: 'education-form',
      project: 'project-form',
      event: 'event-form',
      action: 'action-form',
      careerTransition: 'career-transition-form',
    };
    return formIdMap[selectedType];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!z-[100] max-h-[90vh] min-h-[600px] max-w-6xl overflow-hidden border border-slate-200 bg-white shadow-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Add to your journey</DialogTitle>

        <div className="flex h-full flex-col">
          {/* Step Indicator */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-center">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex items-center gap-3">
                      {/* Step number/check */}
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                          isCompleted || isCurrent
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isCompleted ? (
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      {/* Step label */}
                      <span
                        className={`text-sm font-medium ${
                          isCurrent
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>

                    {/* Connector line */}
                    {index < steps.length - 1 && (
                      <div
                        className={`mx-4 h-0.5 w-20 transition-colors ${
                          index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {renderStepContent()}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4">
            {currentStepIndex === 0 ? (
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  onClick={onClose}
                  data-testid="cancel-button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!selectedType}
                  data-testid="next-button"
                >
                  Next
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  onClick={handleBackStep}
                  data-testid="back-button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  form={getFormId()}
                  data-testid="submit-button"
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
