/**
 * Error Logging Utility
 *
 * Centralized error logging for error boundaries.
 * Currently logs to console, ready for monitoring integration.
 */

import { ZodError } from 'zod';

export interface ErrorLogContext {
  category: string;
  message: string;
  componentStack?: string;
  timestamp: Date;
  userMessage: string;
}

/**
 * Log error with context
 * Future: Send to monitoring service (Sentry, DataDog, etc.)
 */
export function logError(
  error: Error,
  context: Partial<ErrorLogContext> = {}
): void {
  const logData: ErrorLogContext = {
    category: context.category || 'UNKNOWN',
    message: error.message,
    componentStack: context.componentStack,
    timestamp: new Date(),
    userMessage: context.userMessage || getUserFriendlyMessage(error),
  };

  console.error('[ErrorBoundary]', {
    ...logData,
    originalError: error,
    stack: error.stack,
  });

  // Future: Send to monitoring
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(error, { contexts: { custom: logData } });
  // }
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: Error): string {
  // Zod validation errors
  if (error instanceof ZodError) {
    const firstError = error.errors[0];
    if (firstError) {
      const field = firstError.path.join('.');
      return field ? `${field}: ${firstError.message}` : firstError.message;
    }
    return 'The information provided is not valid. Please check your input.';
  }

  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection')
  ) {
    return 'Connection lost. Please check your internet and try again.';
  }

  // Authentication errors
  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('auth')
  ) {
    return 'Your session has expired. Please log in again.';
  }

  // Authorization errors
  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('permission')
  ) {
    return "You don't have permission to perform this action.";
  }

  // Not found errors
  if (message.includes('404') || message.includes('not found')) {
    return 'The requested item could not be found.';
  }

  // Server errors
  if (message.includes('500') || message.includes('server')) {
    return 'Something went wrong. Please try again in a moment.';
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: Error): boolean {
  return error instanceof ZodError;
}

/**
 * Get error category for classification
 */
export function getErrorCategory(error: Error): string {
  if (error instanceof ZodError) return 'VALIDATION';

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch'))
    return 'NETWORK';
  if (message.includes('401') || message.includes('unauthorized'))
    return 'AUTHENTICATION';
  if (message.includes('403') || message.includes('forbidden'))
    return 'AUTHORIZATION';
  if (message.includes('404') || message.includes('not found'))
    return 'NOT_FOUND';
  if (message.includes('500') || message.includes('server'))
    return 'SERVER_ERROR';

  return 'UNKNOWN';
}
