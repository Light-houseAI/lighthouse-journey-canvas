import { MotionProps, UseInViewOptions } from 'framer-motion';
type MarginType = UseInViewOptions['margin'];
interface BlurFadeProps extends MotionProps {
    children: React.ReactNode;
    className?: string;
    variant?: {
        hidden: {
            y: number;
        };
        visible: {
            y: number;
        };
    };
    duration?: number;
    delay?: number;
    offset?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    inView?: boolean;
    inViewMargin?: MarginType;
    blur?: string;
}
export declare function BlurFade({ children, className, variant, duration, delay, offset, direction, inView, inViewMargin, blur, ...props }: BlurFadeProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=blur-fade.d.ts.map