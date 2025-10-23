/**
 * Error Fallback Components
 *
 * Reusable error UI components for different boundary levels.
 * Uses existing @journey/components for consistency.
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
} from '@journey/components';
import { AlertCircle, Home, RefreshCcw } from 'lucide-react';
import { FallbackProps } from 'react-error-boundary';

import { getUserFriendlyMessage } from '../../utils/error-logger';

/**
 * Global Error Fallback (Tier 1)
 * Shown when the entire app crashes
 */
export function GlobalErrorFallback({
  error,
  resetErrorBoundary,
}: FallbackProps) {
  const userMessage = getUserFriendlyMessage(error);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-lg font-semibold">
            Application Error
          </AlertTitle>
          <AlertDescription className="mt-3 space-y-4">
            <p className="text-sm">{userMessage}</p>
            <p className="text-muted-foreground text-xs">
              If this problem persists, please contact support.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetErrorBoundary}
                className="flex items-center gap-2"
              >
                <RefreshCcw className="h-3 w-3" />
                Try Again
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleReload}
                className="flex items-center gap-2"
              >
                Reload Page
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

/**
 * Section Error Fallback (Tier 2)
 * Shown when a specific section/feature crashes
 */
interface SectionErrorFallbackProps extends FallbackProps {
  sectionName: string;
}

export function SectionErrorFallback({
  error,
  resetErrorBoundary,
  sectionName,
}: SectionErrorFallbackProps) {
  const userMessage = getUserFriendlyMessage(error);

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-[300px] items-center justify-center p-4">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error in {sectionName}</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm">{userMessage}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetErrorBoundary}
              className="flex items-center gap-2"
            >
              <RefreshCcw className="h-3 w-3" />
              Retry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoHome}
              className="flex items-center gap-2"
            >
              <Home className="h-3 w-3" />
              Go Home
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
