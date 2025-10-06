import * as React from 'react';
import { cn } from '../lib/utils';

export interface SpacerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spacer (Tailwind spacing scale: 0-96)
   * @default 4
   */
  size?: number;
  /**
   * Direction of the spacer
   * @default 'vertical'
   */
  direction?: 'vertical' | 'horizontal';
}

/**
 * Spacer component for adding explicit space between elements
 * Replaces manual h/w utilities for spacing
 */
export const Spacer = React.forwardRef<HTMLDivElement, SpacerProps>(
  (
    {
      size = 4,
      direction = 'vertical',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          direction === 'vertical' ? `h-${size}` : `w-${size}`,
          className
        )}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

Spacer.displayName = 'Spacer';
