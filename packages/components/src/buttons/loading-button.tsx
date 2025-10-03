import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '../base/button';

export interface LoadingButtonProps extends ButtonProps {
  isLoading: boolean;
  loadingText?: string;
  spinnerPosition?: 'start' | 'end';
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      isLoading,
      loadingText,
      spinnerPosition = 'start',
      children,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Button ref={ref} disabled={isLoading || disabled} className={className} {...props}>
        {isLoading && spinnerPosition === 'start' && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {isLoading ? loadingText || children : children}
        {isLoading && spinnerPosition === 'end' && (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        )}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';
