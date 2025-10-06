import * as React from 'react';
import { cn } from '../lib/utils';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Number of columns (1-12)
   * @default 12
   */
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  /**
   * Gap between grid items (Tailwind spacing scale: 0-96)
   * @default 4
   */
  gap?: number;
  /**
   * Row gap (Tailwind spacing scale: 0-96)
   * If not specified, uses gap value
   */
  rowGap?: number;
  /**
   * Column gap (Tailwind spacing scale: 0-96)
   * If not specified, uses gap value
   */
  columnGap?: number;
}

/**
 * Grid component for consistent grid layouts
 * Replaces manual grid/grid-cols/gap utilities
 */
export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      columns = 12,
      gap = 4,
      rowGap,
      columnGap,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const getColumnsClass = () => {
      if (typeof columns === 'number') {
        return `grid-cols-${columns}`;
      }

      const classes = [];
      if (columns.sm) classes.push(`sm:grid-cols-${columns.sm}`);
      if (columns.md) classes.push(`md:grid-cols-${columns.md}`);
      if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`);
      if (columns.xl) classes.push(`xl:grid-cols-${columns.xl}`);
      return classes.join(' ');
    };

    return (
      <div
        ref={ref}
        className={cn(
          'grid',
          getColumnsClass(),
          rowGap !== undefined ? `gap-y-${rowGap}` : `gap-${gap}`,
          columnGap !== undefined ? `gap-x-${columnGap}` : gap !== undefined && rowGap === undefined && `gap-${gap}`,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';
