import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { HStack, VStack } from '../layout';

export interface OptionTileProps {
  value: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
}

export function OptionTile({
  // value, // Reserved for future use
  title,
  description,
  icon,
  selected,
  onSelect,
  disabled = false,
  className,
}: OptionTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'relative flex w-full flex-col items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
        'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {selected && (
        <div className="absolute right-3 top-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </div>
        </div>
      )}

      <HStack spacing={3} align="start">
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            {icon}
          </div>
        )}

        <VStack spacing={1} className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </VStack>
      </HStack>
    </button>
  );
}
