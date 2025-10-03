import * as React from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '../base/sheet';
import { Button } from '../base/button';
import { cn } from '../lib/utils';

export interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  withCloseButton?: boolean;
  children: React.ReactNode;
  className?: string;
}

const sizeMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

export function SlideOver({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  description,
  footer,
  withCloseButton = true,
  children,
  className,
}: SlideOverProps) {
  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={side} className={cn(sizeMap[size], className)}>
        {(title || description || withCloseButton) && (
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {title && <SheetTitle>{title}</SheetTitle>}
                {description && <SheetDescription>{description}</SheetDescription>}
              </div>
              {withCloseButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-6 w-6 rounded-md"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              )}
            </div>
          </SheetHeader>
        )}

        <div className="flex-1 overflow-y-auto py-4">{children}</div>

        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
