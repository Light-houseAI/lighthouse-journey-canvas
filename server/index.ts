import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import { db } from "./config/database.config";
import routes from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Container } from "./core/container-setup";
import { sessionMiddleware, loggingMiddleware, errorHandlerMiddleware } from "./middleware";

// Initialize application container
async function initializeContainer() {
  const mockLogger = {
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error,
  };

  await Container.configure(db, mockLogger);
  console.log('✅ Application container initialized successfully');
}

// Create Express application with all middleware and handlers
function createApp() {
  const app = express();

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Session middleware
  app.use(sessionMiddleware);

  // Request logging middleware
  app.use(loggingMiddleware);

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
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start the server
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`🚀 Server running on port ${port}`);
      },
    );

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();
