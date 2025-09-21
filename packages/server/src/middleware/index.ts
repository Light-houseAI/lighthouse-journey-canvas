/**
 * Middleware exports
 *
 * Centralized export of all middleware functions for simplified imports
 */

// Authentication middleware
export { requireAuth, requireGuest } from './auth.middleware.js';

// Validation middleware
export { validateRequestSize } from './validation.middleware.js';

// Logging middleware
export { loggingMiddleware } from './logging.middleware.js';

// Error handler middleware
export { errorHandlerMiddleware } from './error-handler.middleware.js';

// Response interceptor middleware
export {
  requestIdMiddleware,
  responseInterceptorMiddleware,
} from './response-interceptor.middleware.js';

// Container middleware
export { containerMiddleware } from './container.middleware.js';

// Permission middleware (now in auth.middleware)
export {
  requireOwnership,
  requirePermission,
  requireResourceAccess,
  requireRole,
} from './auth.middleware.js';
