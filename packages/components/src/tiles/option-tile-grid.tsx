import * as React from 'react';
import { cn } from '../lib/utils';

export interface OptionTileGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

const columnMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

export function OptionTileGrid({
  children,
  columns = 2,
  className,
}: OptionTileGridProps) {
  return (
    <div className={cn('grid gap-4', columnMap[columns], className)}>
      {children}
    </div>
  );
}
