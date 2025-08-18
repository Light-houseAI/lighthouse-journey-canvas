/**
 * Middleware exports
 * 
 * Centralized export of all middleware functions for simplified imports
 */

// Authentication middleware
export { requireAuth, requireGuest } from './auth.middleware';

// Validation middleware
export { validateRequestSize } from './validation.middleware';

// Session middleware
export { sessionMiddleware } from './session.middleware';

// Logging middleware
export { loggingMiddleware } from './logging.middleware';

// Error handler middleware
export { errorHandlerMiddleware } from './error-handler.middleware';

// Container middleware
export { containerMiddleware } from './container.middleware';

// Permission middleware (now in auth.middleware)
export { requirePermission, requireRole, requireResourceAccess, requireOwnership } from './auth.middleware';