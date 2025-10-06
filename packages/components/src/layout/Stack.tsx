import * as React from 'react';
import { cn } from '../lib/utils';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The gap between items (Tailwind spacing scale: 0-96)
   * @default 4
   */
  spacing?: number;
  /**
   * The direction of the stack
   * @default 'vertical'
   */
  direction?: 'vertical' | 'horizontal';
  /**
   * Align items along the cross axis
   */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /**
   * Justify items along the main axis
   */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /**
   * Whether items should wrap
   * @default false
   */
  wrap?: boolean;
}

/**
 * Stack component for consistent vertical or horizontal spacing
 * Replaces manual flex/gap/space-y/space-x utilities
 */
export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      spacing = 4,
      direction = 'vertical',
      align,
      justify,
      wrap = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isVertical = direction === 'vertical';

    return (
      <div
        ref={ref}
        className={cn(
          'flex',
          isVertical ? 'flex-col' : 'flex-row',
          `gap-${spacing}`,
          align && {
            start: isVertical ? 'items-start' : 'items-start',
            center: isVertical ? 'items-center' : 'items-center',
            end: isVertical ? 'items-end' : 'items-end',
            stretch: isVertical ? 'items-stretch' : 'items-stretch',
          }[align],
          justify && {
            start: 'justify-start',
            center: 'justify-center',
            end: 'justify-end',
            between: 'justify-between',
            around: 'justify-around',
            evenly: 'justify-evenly',
          }[justify],
          wrap && 'flex-wrap',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';
