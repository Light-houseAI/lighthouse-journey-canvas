/**
 * Custom Tab Components
 *
 * Reusable tab components matching the ShareModal styling pattern
 * Features inline tabs with gradient overlay on active state
 */

import * as React from 'react';

import { Button } from './button';
import { cn } from '../lib/utils';

export interface TabOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface TabsGroupProps<T extends string> {
  options: TabOption<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  label?: string;
  className?: string;
}

/**
 * TabsGroup - Container for custom tab buttons with ShareModal styling
 */
export function TabsGroup<T extends string>({
  options,
  activeTab,
  onTabChange,
  label,
  className,
}: TabsGroupProps<T>) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      {label && (
        <span className="text-base font-semibold text-gray-900">{label}</span>
      )}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
        {options.map((option) => (
          <TabButton
            key={option.value}
            active={activeTab === option.value}
            onClick={() => onTabChange(option.value)}
          >
            {option.label}
          </TabButton>
        ))}
      </div>
    </div>
  );
}

export interface TabButtonProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * TabButton - Individual tab button with gradient overlay when active
 */
export const TabButton = React.forwardRef<HTMLButtonElement, TabButtonProps>(
  ({ active = false, onClick, children, className }, ref) => {
    return (
      <Button
        ref={ref}
        onClick={onClick}
        variant="ghost"
        className={cn(
          'relative rounded-[7px] px-[18px] py-2 text-sm font-semibold transition-all duration-200',
          active
            ? 'bg-gray-900 text-white shadow-sm hover:bg-gray-900 hover:text-white'
            : 'text-gray-600 hover:text-gray-900',
          className
        )}
      >
        {active && (
          <div className="absolute inset-0 rounded-[7px] bg-gradient-to-b from-white/10 to-transparent" />
        )}
        <span className="relative">{children}</span>
      </Button>
    );
  }
);

TabButton.displayName = 'TabButton';
