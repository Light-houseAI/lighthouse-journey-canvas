/**
 * Middleware exports
 *
 * Centralized export of all middleware functions for simplified imports
 */

// Authentication middleware
export { requireAuth, requireGuest } from './auth.middleware';

// Validation middleware
export { validateRequestSize } from './validation.middleware';

// Logging middleware
export { loggingMiddleware } from './logging.middleware';

// Error handler middleware
export { errorHandlerMiddleware } from './error-handler.middleware';

// Request ID middleware
export { requestIdMiddleware } from './response-interceptor.middleware';

// Container middleware
export { containerMiddleware } from './container.middleware';

// Permission middleware (now in auth.middleware)
export {
  requireOwnership,
  requirePermission,
  requireResourceAccess,
  requireRole,
} from './auth.middleware';
