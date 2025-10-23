/**
 * Global Error Boundary (Tier 1)
 *
 * Top-level error boundary that catches all unhandled errors in the application.
 * Uses react-error-boundary library for functional component support.
 */

import { ErrorBoundary } from 'react-error-boundary';

import { getErrorCategory, logError } from '../../utils/error-logger';
import { GlobalErrorFallback } from './ErrorFallbacks';

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global error boundary component
 * Wraps the entire application to catch catastrophic errors
 */
export function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const handleError = (error: Error, info: { componentStack?: string }) => {
    // Log error with context
    logError(error, {
      category: getErrorCategory(error),
      componentStack: info.componentStack,
    });

    // Future: Send to monitoring service
    // if (process.env.NODE_ENV === 'production') {
    //   sendToMonitoring({ error, componentStack: info.componentStack });
    // }
  };

  return (
    <ErrorBoundary
      FallbackComponent={GlobalErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset any global state if needed
        // For now, just log
        console.log('[GlobalErrorBoundary] Reset triggered');
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
