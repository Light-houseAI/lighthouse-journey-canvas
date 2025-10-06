import * as React from 'react';
import { Stack, StackProps } from './Stack';

export type VStackProps = Omit<StackProps, 'direction'>;

/**
 * VStack (Vertical Stack) - convenience wrapper for vertical layouts
 * Replaces manual flex/flex-col/gap/space-y utilities
 */
export const VStack = React.forwardRef<HTMLDivElement, VStackProps>(
  (props, ref) => {
    return <Stack ref={ref} direction="vertical" {...props} />;
  }
);

VStack.displayName = 'VStack';
