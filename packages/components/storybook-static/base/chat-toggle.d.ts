import { default as React } from '../../../../node_modules/.pnpm/react@18.3.1/node_modules/react';
interface ChatToggleProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    className?: string;
}
/**
 * Toggle component for switching between Chat mode and Manual mode
 * Used in timeline to control node addition behavior
 */
export declare const ChatToggle: React.FC<ChatToggleProps>;
export {};
//# sourceMappingURL=chat-toggle.d.ts.map