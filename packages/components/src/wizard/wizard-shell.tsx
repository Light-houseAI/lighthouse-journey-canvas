import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StepIndicator, Step } from './step-indicator';
import { Button } from '../base/button';
import { cn } from '../lib/utils';

export interface WizardShellProps {
  currentStep: number;
  steps: Step[];
  onStepChange: (step: number) => void;
  content: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  backButtonText?: string;
  nextButtonText?: string;
  submitButtonText?: string;
  className?: string;
}

export function WizardShell({
  currentStep,
  steps,
  onStepChange,
  content,
  footer,
  onBack,
  onNext,
  onSubmit,
  backButtonText = 'Back',
  nextButtonText = 'Next',
  submitButtonText = 'Submit',
  className,
}: WizardShellProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (currentStep < steps.length - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    }
  };

  return (
    <div className={cn('flex min-h-[600px] flex-col', className)}>
      {/* Step Indicator */}
      <div className="border-b pb-6">
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          onStepClick={onStepChange}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-6">{content}</div>

      {/* Footer */}
      <div className="border-t pt-6">
        {footer || (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {backButtonText}
            </Button>

            {isLastStep ? (
              <Button onClick={handleSubmit}>{submitButtonText}</Button>
            ) : (
              <Button onClick={handleNext} className="gap-2">
                {nextButtonText}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
