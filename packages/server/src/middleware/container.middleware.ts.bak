import { NextFunction, Request, Response } from 'express';

import { Container } from '../core/container-setup.js';

/**
 * Express middleware that creates request-scoped Awilix container
 * Provides dependency injection context for each HTTP request
 */
export const containerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Create request-scoped container that inherits from root container
  (req as any).scope = Container.createRequestScope();

  next();
};
