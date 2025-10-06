import * as React from 'react';
import { Stack, StackProps } from './Stack';

export type HStackProps = Omit<StackProps, 'direction'>;

/**
 * HStack (Horizontal Stack) - convenience wrapper for horizontal layouts
 * Replaces manual flex/flex-row/gap utilities
 */
export const HStack = React.forwardRef<HTMLDivElement, HStackProps>(
  (props, ref) => {
    return <Stack ref={ref} direction="horizontal" {...props} />;
  }
);

HStack.displayName = 'HStack';
