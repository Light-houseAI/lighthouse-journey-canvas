import 'express-async-errors';

import express, { type RequestHandler } from 'express';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { Container } from './core/container-setup';
import { errorHandlerMiddleware, loggingMiddleware } from './middleware';
import routes from './routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  // Configure express-jsdoc-swagger (only in non-production environments)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerOptions = {
      info: {
        title: 'Lighthouse Journey Canvas API',
        description: 'Career journey timeline platform API with hierarchical timeline nodes and GraphRAG search capabilities',
        version: '2.0.0',
      },
      baseDir: __dirname,
      filesPattern: [
        './controllers/**/*.ts',
        './routes/**/*.ts',
      ],
      swaggerUIPath: '/api/docs',
      exposeSwaggerUI: true,
      exposeApiDocs: true,
      apiDocsPath: '/api/docs.json',
      security: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    };

    expressJSDocSwagger(app)(swaggerOptions);
  }

  // Register API routes - only handle /api/* routes here
  app.use('/api', routes);

  // Catch-all 404 handler for unknown API routes
  const notFoundHandler: RequestHandler = (req, res) => {
    const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    res.setHeader('X-Request-ID', requestId);
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint not found: ${req.method} ${req.path}`,
      },
    });
  };
  app.use('/api/*', notFoundHandler);

  // Global error handler - must be registered after routes
  app.use(errorHandlerMiddleware);

  return app;
}
