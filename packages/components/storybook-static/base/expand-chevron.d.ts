import { default as React } from '../../../../node_modules/.pnpm/react@18.3.1/node_modules/react';
export interface ExpandChevronProps {
    isExpanded: boolean;
    onExpand?: () => void;
    onCollapse?: () => void;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    disabled?: boolean;
    variant?: 'default' | 'glass' | 'solid';
}
/**
 * Reusable chevron button for expanding/collapsing nodes
 * Matches the Career Journey app design with smooth rotation animations
 */
export declare const ExpandChevron: React.FC<ExpandChevronProps>;
/**
 * Simplified chevron for inline use (just the icon with rotation)
 */
export declare const ChevronIcon: React.FC<{
    isExpanded: boolean;
    size?: number;
    className?: string;
}>;
//# sourceMappingURL=expand-chevron.d.ts.map