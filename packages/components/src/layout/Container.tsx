import * as React from 'react';
import { cn } from '../lib/utils';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum width of the container
   * @default 'lg'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /**
   * Whether to center the container
   * @default true
   */
  centerContent?: boolean;
  /**
   * Horizontal padding (Tailwind spacing scale: 0-96)
   * @default 4
   */
  px?: number;
  /**
   * Vertical padding (Tailwind spacing scale: 0-96)
   */
  py?: number;
}

/**
 * Container component for consistent content width and centering
 * Replaces manual max-w/mx-auto/px utilities
 */
export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  (
    {
      maxWidth = 'lg',
      centerContent = true,
      px = 4,
      py,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          maxWidth !== 'full' && {
            sm: 'max-w-screen-sm',
            md: 'max-w-screen-md',
            lg: 'max-w-screen-lg',
            xl: 'max-w-screen-xl',
            '2xl': 'max-w-screen-2xl',
          }[maxWidth],
          centerContent && 'mx-auto',
          px !== undefined && `px-${px}`,
          py !== undefined && `py-${py}`,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';
