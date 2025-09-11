import express from 'express';
import { createServer } from 'http';

import { Container } from './core/container-setup';
import {
  errorHandlerMiddleware,
  loggingMiddleware,
  requestIdMiddleware,
  responseInterceptorMiddleware,
} from './middleware';
// Database connection is now managed by Awilix DI container
import routes from './routes';
import { log, serveStatic, setupVite } from './vite';

// Initialize application container
async function initializeContainer() {
  const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  await Container.configure(mockLogger);
}

// Create Express application with all middleware and handlers
function createApp() {
  const app = express();

  // Request ID middleware - must be first to ensure all requests have IDs
  app.use(requestIdMiddleware);

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Request logging middleware
  app.use(loggingMiddleware);

  // Response interceptor middleware - wraps legacy responses
  app.use(responseInterceptorMiddleware);

  app.use('/', routes);

  // Global error handler - must be registered after routes
  app.use(errorHandlerMiddleware);

  return app;
}

// Application startup
async function startServer() {
  try {
    // Initialize dependency injection container
    await initializeContainer();

    // Create Express app with all middleware and handlers configured
    const app = createApp();

    // Create HTTP server
    const server = createServer(app);

    // Setup Vite in development or serve static files in production
    // Must be done after routes to avoid interference with API routes
    if (app.get('env') === 'development') {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen(
      {
        port,
        host: '0.0.0.0',
        reusePort: true,
      },
      () => {
        log(`🚀 Server running on port ${port}`);
      }
    );
  } catch (error) {
    throw new Error(`Failed to start server: ${error}`);
  }
}

// Start the application
startServer();
