'use client';

import React from 'react';

import { cn } from '../lib/utils';

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
}

export function MagicCard({ children, className }: MagicCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-background',
        className
      )}
    >
      {children}
    </div>
  );
}
