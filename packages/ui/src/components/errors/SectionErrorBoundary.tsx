/**
 * Section Error Boundary (Tier 2)
 *
 * Feature-level error boundary that isolates errors to specific sections.
 * Allows the rest of the application to continue working.
 */

import { ErrorBoundary } from 'react-error-boundary';

import { getErrorCategory, logError } from '../../utils/error-logger';
import { SectionErrorFallback } from './ErrorFallbacks';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  sectionName: string;
}

/**
 * Section error boundary component
 * Wraps specific sections/features to isolate errors
 */
export function SectionErrorBoundary({
  children,
  sectionName,
}: SectionErrorBoundaryProps) {
  const handleError = (error: Error, info: { componentStack?: string }) => {
    // Log error with section context
    logError(error, {
      category: `${getErrorCategory(error)}_SECTION`,
      componentStack: info.componentStack,
    });

    console.log(`[SectionErrorBoundary: ${sectionName}] Error caught`);

    // Future: Send to monitoring with section name
    // if (process.env.NODE_ENV === 'production') {
    //   sendToMonitoring({ error, section: sectionName, componentStack: info.componentStack });
    // }
  };

  return (
    <ErrorBoundary
      FallbackComponent={(props) => (
        <SectionErrorFallback {...props} sectionName={sectionName} />
      )}
      onError={handleError}
      onReset={() => {
        // Reset section state if needed
        console.log(`[SectionErrorBoundary: ${sectionName}] Reset triggered`);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
