import { default as React, ComponentPropsWithoutRef } from '../../../../node_modules/.pnpm/react@18.3.1/node_modules/react';
export interface ShimmerButtonProps extends ComponentPropsWithoutRef<'button'> {
    shimmerColor?: string;
    shimmerSize?: string;
    borderRadius?: string;
    shimmerDuration?: string;
    background?: string;
    className?: string;
    children?: React.ReactNode;
}
export declare const ShimmerButton: React.ForwardRefExoticComponent<ShimmerButtonProps & React.RefAttributes<HTMLButtonElement>>;
//# sourceMappingURL=shimmer-button.d.ts.map