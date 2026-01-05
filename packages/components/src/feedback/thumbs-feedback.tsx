/**
 * ThumbsFeedback Component
 *
 * A compact thumbs up/down feedback widget for collecting user ratings.
 * Can be used in both desktop and web applications.
 *
 * Features:
 * - Thumbs up/down buttons
 * - Optional text label
 * - Loading state during submission
 * - Success confirmation
 * - Compact and full variants
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';
import { Button } from '../base/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../base/tooltip';

// SVG icons as inline components for portability
const ThumbsUpIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 10v12" />
    <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
  </svg>
);

const ThumbsDownIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 14V2" />
    <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('animate-spin', className)}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// Variant definitions
const thumbsFeedbackVariants = cva('inline-flex items-center gap-1', {
  variants: {
    variant: {
      default: '',
      compact: '',
      inline: 'flex-row',
    },
    size: {
      sm: 'gap-1',
      md: 'gap-2',
      lg: 'gap-3',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

const thumbButtonVariants = cva(
  'rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
  {
    variants: {
      size: {
        sm: 'p-1.5',
        md: 'p-2',
        lg: 'p-2.5',
      },
      state: {
        default: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
        selected: '',
        disabled: 'opacity-50 cursor-not-allowed',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
    },
  }
);

export type FeedbackRating = 'thumbs_up' | 'thumbs_down';

export interface ThumbsFeedbackProps
  extends VariantProps<typeof thumbsFeedbackVariants> {
  /** Currently selected rating */
  value?: FeedbackRating | null;
  /** Callback when rating changes */
  onFeedback?: (rating: FeedbackRating) => void | Promise<void>;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Show success state after submission */
  showSuccess?: boolean;
  /** Label text to show before the buttons */
  label?: string;
  /** Tooltip for thumbs up */
  thumbsUpTooltip?: string;
  /** Tooltip for thumbs down */
  thumbsDownTooltip?: string;
  /** Additional CSS classes */
  className?: string;
  /** Size of the icons */
  iconSize?: 'sm' | 'md' | 'lg';
}

const iconSizeMap = {
  sm: 14,
  md: 16,
  lg: 20,
};

export function ThumbsFeedback({
  value,
  onFeedback,
  isLoading = false,
  disabled = false,
  showSuccess = false,
  label,
  thumbsUpTooltip = 'Helpful',
  thumbsDownTooltip = 'Not helpful',
  className,
  variant,
  size = 'md',
  iconSize,
}: ThumbsFeedbackProps) {
  const [localSuccess, setLocalSuccess] = React.useState(false);
  const [pendingRating, setPendingRating] = React.useState<FeedbackRating | null>(null);

  const effectiveIconSize = iconSize || size || 'md';
  const iconDimension = iconSizeMap[effectiveIconSize];

  const handleClick = async (rating: FeedbackRating) => {
    if (disabled || isLoading) return;

    setPendingRating(rating);

    try {
      await onFeedback?.(rating);
      if (showSuccess) {
        setLocalSuccess(true);
        setTimeout(() => setLocalSuccess(false), 2000);
      }
    } finally {
      setPendingRating(null);
    }
  };

  const isThumbsUpSelected = value === 'thumbs_up';
  const isThumbsDownSelected = value === 'thumbs_down';
  const isThumbsUpLoading = isLoading && pendingRating === 'thumbs_up';
  const isThumbsDownLoading = isLoading && pendingRating === 'thumbs_down';

  // Show success state
  if (localSuccess && value) {
    return (
      <div className={cn(thumbsFeedbackVariants({ variant, size }), className)}>
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckIcon className="h-4 w-4" />
          <span className="text-xs font-medium">Thanks for your feedback!</span>
        </div>
      </div>
    );
  }

  const ThumbsUpButton = (
    <button
      type="button"
      onClick={() => handleClick('thumbs_up')}
      disabled={disabled || isLoading}
      className={cn(
        thumbButtonVariants({
          size,
          state: disabled ? 'disabled' : isThumbsUpSelected ? 'selected' : 'default',
        }),
        isThumbsUpSelected && 'text-green-600 bg-green-50 hover:bg-green-100',
        'focus:ring-green-500'
      )}
      aria-label={thumbsUpTooltip}
      aria-pressed={isThumbsUpSelected}
    >
      {isThumbsUpLoading ? (
        <LoaderIcon style={{ width: iconDimension, height: iconDimension }} />
      ) : (
        <ThumbsUpIcon
          className={cn(
            isThumbsUpSelected && 'fill-green-600'
          )}
        />
      )}
    </button>
  );

  const ThumbsDownButton = (
    <button
      type="button"
      onClick={() => handleClick('thumbs_down')}
      disabled={disabled || isLoading}
      className={cn(
        thumbButtonVariants({
          size,
          state: disabled ? 'disabled' : isThumbsDownSelected ? 'selected' : 'default',
        }),
        isThumbsDownSelected && 'text-red-600 bg-red-50 hover:bg-red-100',
        'focus:ring-red-500'
      )}
      aria-label={thumbsDownTooltip}
      aria-pressed={isThumbsDownSelected}
    >
      {isThumbsDownLoading ? (
        <LoaderIcon style={{ width: iconDimension, height: iconDimension }} />
      ) : (
        <ThumbsDownIcon
          className={cn(
            isThumbsDownSelected && 'fill-red-600'
          )}
        />
      )}
    </button>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(thumbsFeedbackVariants({ variant, size }), className)}>
        {label && (
          <span className="text-xs text-gray-500 mr-1">{label}</span>
        )}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>{ThumbsUpButton}</TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {thumbsUpTooltip}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>{ThumbsDownButton}</TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {thumbsDownTooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

ThumbsFeedback.displayName = 'ThumbsFeedback';

export default ThumbsFeedback;
