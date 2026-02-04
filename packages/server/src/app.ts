import express, { Request, Response } from 'express';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import cors from 'cors';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

import { Container } from './core/container-setup';
import { errorHandlerMiddleware, loggingMiddleware } from './middleware';
import routes from './routes';
import { initializeArangoDBSchema } from './config/arangodb.init';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Production domains allowed for CORS
const ALLOWED_ORIGINS = [
  'https://www.krama-ai.com',
  'https://krama-ai.com',
  'https://light-houseai.com',
  'https://www.light-houseai.com',
  // Allow localhost for serving static files in production mode locally
  'http://localhost:5004',
  'http://127.0.0.1:5004',
];

// Parse additional origins from environment variable (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  ALLOWED_ORIGINS.push(...envOrigins);
}

// In development, allow localhost
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push(
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:5004',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5004',
    'http://127.0.0.1:8080'
  );
}

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

  // Initialize ArangoDB schema for hierarchical workflows (creates collections if needed)
  try {
    await initializeArangoDBSchema();
    logger.info('ArangoDB schema initialized successfully');
  } catch (error) {
    logger.warn('ArangoDB schema initialization failed (ArangoDB may not be running)', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't fail startup - ArangoDB features will be degraded
  }

  // Create Express app
  const app = express();

  // CORS middleware - allow requests from production domains
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }
        if (ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
  );

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
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });
  });

  // Global error handler - must be registered after routes
  app.use(errorHandlerMiddleware);

  return app;
}
