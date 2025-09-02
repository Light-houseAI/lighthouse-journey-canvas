import { toast } from '@/hooks/use-toast';

interface APIErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

const ERROR_MESSAGES = {
  // Network and connection errors
  NETWORK_ERROR: "Connection lost. Please check your internet and try again.",
  FETCH_FAILED: "Unable to connect. Please check your connection.",
  
  // Authentication errors
  AUTH_ERROR: "Your session has expired. Please log in again.",
  AUTHENTICATION_REQUIRED: "Please log in to continue.",
  TOKEN_EXPIRED: "Your session has expired. Please log in again.",
  INVALID_TOKEN: "Your session has expired. Please log in again.",
  MISSING_TOKEN: "Please log in to continue.",
  INVALID_REFRESH_TOKEN: "Your session has expired. Please log in again.",
  REFRESH_TOKEN_EXPIRED: "Your session has expired. Please log in again.",
  REFRESH_ERROR: "Session refresh failed. Please log in again.",
  USER_NOT_FOUND: "Account not found. Please check your credentials.",
  ALREADY_AUTHENTICATED: "You are already logged in.",
  
  // Authorization errors
  UNAUTHORIZED: "You don't have permission to perform this action.",
  ACCESS_DENIED: "You don't have permission to access this resource.",
  INSUFFICIENT_PERMISSIONS: "You don't have permission to perform this action.",
  INSUFFICIENT_ROLE: "You don't have the required permissions.",
  
  // Validation errors
  VALIDATION_ERROR: "Please check your input and try again.",
  INVALID_DATA: "The information provided is not valid.",
  PAYLOAD_TOO_LARGE: "The file or data you're trying to upload is too large.",
  BUSINESS_RULE_ERROR: "This action violates a business rule. Please try a different approach.",
  
  // Resource errors
  NOT_FOUND: "The requested item could not be found.",
  NODE_NOT_FOUND: "The timeline item you're looking for doesn't exist.",
  CONFLICT: "This action conflicts with existing data.",
  
  // Server errors
  SERVER_ERROR: "Something went wrong. Our team has been notified.",
  INTERNAL_ERROR: "A technical issue occurred. Please try again in a moment.",
  INTERNAL_SERVER_ERROR: "A technical issue occurred. Please try again in a moment.",
  CONTAINER_ERROR: "A technical issue occurred. Please try again in a moment.",
  AUTHORIZATION_ERROR: "Permission check failed. Please try again.",
  CREATE_NODE_ERROR: "Failed to create the timeline item. Please try again.",
  ERROR_CODE: "A technical issue occurred. Please try again in a moment.",
  BAD_REQUEST: "Invalid request. Please check your input and try again.",
  
  // Default fallback
  DEFAULT: "An unexpected error occurred. Please try again."
} as const;

/**
 * Extracts a user-friendly error message from various error types
 */
function extractErrorMessage(error: Error | APIErrorResponse | string): string {
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle APIErrorResponse (from our standardized server responses)
  if (typeof error === 'object' && 'success' in error && error.success === false) {
    const errorCode = error.error?.code;
    const message = error.error?.message || '';
    
    // First, check if we have a specific mapping for the error code
    if (errorCode && errorCode in ERROR_MESSAGES) {
      return ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES];
    }
    
    // Fallback: Map common server error messages to user-friendly ones
    if (message.toLowerCase().includes('network') || message.toLowerCase().includes('connection')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('authentication')) {
      return ERROR_MESSAGES.AUTH_ERROR;
    }
    if (message.toLowerCase().includes('validation') || message.toLowerCase().includes('invalid')) {
      return ERROR_MESSAGES.VALIDATION_ERROR;
    }
    if (message.toLowerCase().includes('not found')) {
      return ERROR_MESSAGES.NOT_FOUND;
    }
    
    // Check if the message looks like a technical error code that shouldn't be shown to users
    if (message.match(/^[A-Z_]+$/) || message.includes('_ERROR') || message.includes('_TOKEN')) {
      return ERROR_MESSAGES.DEFAULT;
    }
    
    // Return the server message if it's already user-friendly
    return message || ERROR_MESSAGES.DEFAULT;
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Map common error patterns
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return ERROR_MESSAGES.AUTH_ERROR;
    }
    if (message.includes('403')) {
      return ERROR_MESSAGES.UNAUTHORIZED;
    }
    if (message.includes('404')) {
      return ERROR_MESSAGES.NOT_FOUND;
    }
    if (message.includes('409')) {
      return ERROR_MESSAGES.CONFLICT;
    }
    if (message.includes('500') || message.includes('internal')) {
      return ERROR_MESSAGES.SERVER_ERROR;
    }
    
    // For user-friendly messages, return as-is
    if (!message.includes('http') && !message.includes('status') && !message.includes('error!')) {
      return error.message;
    }
  }

  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Shows a user-friendly toast notification for API errors
 */
export function showErrorToast(error: Error | APIErrorResponse | string): void {
  const message = extractErrorMessage(error);
  
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}

/**
 * Shows a success toast notification
 */
export function showSuccessToast(message: string): void {
  toast({
    title: "Success",
    description: message,
  });
}

/**
 * Shows a warning toast notification
 */
export function showWarningToast(message: string): void {
  toast({
    title: "Warning", 
    description: message,
    variant: "destructive", // Use destructive for now, can be customized later
  });
}

/**
 * Extracts a user-friendly error message from any error type (for use in stores/components)
 * This doesn't show a toast - just returns the message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error || (typeof error === 'object' && error !== null)) {
    return extractErrorMessage(error as Error | APIErrorResponse);
  }
  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Handles API errors consistently across the application
 * Use this in catch blocks for API calls
 */
export function handleAPIError(error: unknown, context?: string): void {
  console.error(context ? `${context}:` : 'API Error:', error);
  
  if (error instanceof Error || (typeof error === 'object' && error !== null)) {
    showErrorToast(error as Error | APIErrorResponse);
  } else {
    showErrorToast(ERROR_MESSAGES.DEFAULT);
  }
}