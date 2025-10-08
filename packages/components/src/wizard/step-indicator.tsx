import { Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { HStack, VStack } from '../layout';

export interface Step {
  id: string;
  label: string;
}

export interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  orientation = 'horizontal',
  compact = false,
  className,
}: StepIndicatorProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <nav
      aria-label="Progress"
      className={className}
    >
      {isHorizontal ? (
        <HStack justify="between" align="center">
        {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && index <= currentStep;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center',
              isHorizontal && index < steps.length - 1 && 'flex-1'
            )}
          >
            <button
              type="button"
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2',
                isClickable && 'cursor-pointer hover:opacity-75',
                !isClickable && 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary text-primary',
                  !isCompleted && !isCurrent && 'border-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>

              {!compact && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent && 'text-foreground',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              )}
            </button>

            {isHorizontal && index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 transition-colors',
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
        </HStack>
      ) : (
        <VStack spacing={4}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center',
                isHorizontal && index < steps.length - 1 && 'flex-1'
              )}
            >
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2',
                  isClickable && 'cursor-pointer hover:opacity-75',
                  !isClickable && 'cursor-default'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary text-primary',
                    !isCompleted && !isCurrent && 'border-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {!compact && (
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isCurrent && 'text-foreground',
                      !isCurrent && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                )}
              </button>

              {isHorizontal && index < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 flex-1 transition-colors',
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
        </VStack>
      )}
    </nav>
  );
}
