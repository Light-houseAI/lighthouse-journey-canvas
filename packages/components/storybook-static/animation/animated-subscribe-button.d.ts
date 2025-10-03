import { HTMLMotionProps } from 'framer-motion';
import { default as React } from '../../../../node_modules/.pnpm/react@18.3.1/node_modules/react';
interface AnimatedSubscribeButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
    subscribeStatus?: boolean;
    children: React.ReactNode;
    className?: string;
}
export declare const AnimatedSubscribeButton: React.ForwardRefExoticComponent<AnimatedSubscribeButtonProps & React.RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=animated-subscribe-button.d.ts.map