import { Request, Response, NextFunction } from 'express';
import { asValue } from 'awilix';
import { Container } from '../core/container-setup';

/**
 * Express middleware that creates request-scoped Awilix container
 * Provides dependency injection context for each HTTP request
 */
export const containerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Extract user ID from existing Lighthouse auth middleware
  const userId = req.user?.id || (req as any).session?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
    });
  }

  // Create request-scoped container that inherits from root container
  (req as any).scope = Container.createRequestScope();

  // Register request-specific data in the scoped container
  (req as any).scope.register({
    userId: asValue(userId),
    currentUser: asValue(req.user || { id: userId }),
    requestId: asValue(req.headers['x-request-id'] || `req_${Date.now()}`),
  });

  next();
};
