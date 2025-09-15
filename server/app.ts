import express from 'express';

import { Container } from './core/container-setup';
import { errorHandlerMiddleware, loggingMiddleware } from './middleware';
import routes from './routes';

/**
 * Create Express application with container initialization and all middleware
 * This handles both container setup and app creation for all environments
 */
export async function createApp(): Promise<express.Application> {
  // Initialize container with appropriate logger based on environment
  const isTest = process.env.NODE_ENV === 'test';
  const logger = isTest
    ? {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: console.error,
      }
    : {
        debug: console.log,
        info: console.log,
        warn: console.warn,
        error: console.error,
      };

  // Configure container if not already configured
  await Container.configure(logger);

  // Create Express app
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  app.use(loggingMiddleware);

  // Register all routes
  app.use('/', routes);

  // Global error handler - must be registered after routes
  app.use(errorHandlerMiddleware);

  return app;
}
