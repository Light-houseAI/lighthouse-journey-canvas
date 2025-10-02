import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();


import { createApp } from './app';
import { log,serveStatic, setupVite } from './vite';

// Application startup
async function startServer() {
  try {
    // Create Express app with container initialization and all middleware
    const app = await createApp();

    // Create HTTP server
    const server = createServer(app);

    // Setup Vite in development or serve static files in production
    // Must be done after routes to avoid interference with API routes
    if (app.get('env') === 'development') {
      await setupVite(app as any, server);
    } else {
      serveStatic(app as any);
    }

    // Start the server
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = process.env.HOST || '127.0.0.1';
    server.listen(port, host, () => {
      log(`🚀 Server running on http://${host}:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();
