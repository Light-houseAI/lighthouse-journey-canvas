import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export interface InfoSectionProps {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles = {
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    description: 'text-blue-700 dark:text-blue-300',
    defaultIcon: Info,
  },
  success: {
    container:
      'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    icon: 'text-green-600 dark:text-green-400',
    title: 'text-green-900 dark:text-green-100',
    description: 'text-green-700 dark:text-green-300',
    defaultIcon: CheckCircle2,
  },
  warning: {
    container:
      'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600 dark:text-yellow-400',
    title: 'text-yellow-900 dark:text-yellow-100',
    description: 'text-yellow-700 dark:text-yellow-300',
    defaultIcon: AlertTriangle,
  },
  danger: {
    container: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    description: 'text-red-700 dark:text-red-300',
    defaultIcon: XCircle,
  },
  neutral: {
    container: 'bg-muted border-border',
    icon: 'text-muted-foreground',
    title: 'text-foreground',
    description: 'text-muted-foreground',
    defaultIcon: AlertCircle,
  },
};

export function InfoSection({
  variant = 'info',
  icon,
  title,
  description,
  actions,
  children,
  className,
}: InfoSectionProps) {
  const styles = variantStyles[variant];
  const DefaultIcon = styles.defaultIcon;
  const IconComponent = icon || <DefaultIcon className="h-5 w-5" />;

  return (
    <div className={cn('rounded-lg border p-4', styles.container, className)}>
      <div className="flex gap-3">
        <div className={cn('flex-shrink-0', styles.icon)}>{IconComponent}</div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className={cn('text-sm font-semibold', styles.title)}>{title}</h3>
              {description && (
                <p className={cn('text-sm', styles.description)}>{description}</p>
              )}
            </div>

            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>

          {children && <div className="pt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}
