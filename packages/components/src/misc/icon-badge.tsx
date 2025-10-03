import * as React from 'react';
import { cn } from '../lib/utils';

export interface IconBadgeProps {
  icon: React.ReactNode;
  variant?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  solid: 'bg-primary text-primary-foreground',
  soft: 'bg-primary/10 text-primary',
  outline: 'border border-primary text-primary bg-transparent',
};

const sizeStyles = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

export function IconBadge({
  icon,
  variant = 'soft',
  size = 'md',
  className,
}: IconBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {icon}
    </div>
  );
}
