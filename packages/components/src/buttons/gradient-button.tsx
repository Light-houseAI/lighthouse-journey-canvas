import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const gradientButtonVariants = cva(
  'group relative overflow-hidden rounded-xl font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/25',
        secondary:
          'border border-slate-300 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 hover:shadow-lg hover:shadow-slate-500/25',
        destructive:
          'bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-lg hover:shadow-red-500/25 disabled:cursor-not-allowed',
        emerald:
          'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/25',
        purple:
          'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:shadow-lg hover:shadow-purple-600/25',
        violet:
          'bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:shadow-lg hover:shadow-violet-500/25',
        cyan:
          'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:shadow-lg hover:shadow-cyan-500/25',
        orange:
          'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/25',
      },
      size: {
        default: 'px-6 py-3',
        sm: 'px-4 py-2 text-sm',
        lg: 'px-8 py-4 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

const hoverGradientVariants = cva(
  'absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-blue-600 to-purple-700',
        secondary: 'bg-gradient-to-r from-slate-200 to-slate-300',
        destructive: 'bg-gradient-to-r from-red-600 to-red-700',
        emerald: 'bg-gradient-to-r from-emerald-600 to-teal-700',
        purple: 'bg-gradient-to-r from-purple-700 to-purple-800',
        violet: 'bg-gradient-to-r from-violet-600 to-violet-700',
        cyan: 'bg-gradient-to-r from-cyan-600 to-cyan-700',
        orange: 'bg-gradient-to-r from-orange-600 to-orange-700',
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  }
);

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof gradientButtonVariants> {
  asChild?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(gradientButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {/* Hover gradient overlay */}
        <div className={cn(hoverGradientVariants({ variant }))} />

        {/* Shimmer effect */}
        <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />

        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {iconLeft && iconLeft}
          {children}
          {iconRight && iconRight}
        </span>
      </Comp>
    );
  }
);

GradientButton.displayName = 'GradientButton';

export { GradientButton, gradientButtonVariants };
