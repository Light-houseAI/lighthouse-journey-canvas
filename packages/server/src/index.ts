import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

console.log('🔄 Starting server initialization...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

import { createApp } from './app';
import { log, serveStatic, setupVite } from './vite';
import { getLangfuse, shutdownLangfuse } from './core/langfuse';

// Application startup
async function startServer() {
  try {
    console.log('📦 Creating Express app...');
    // Create Express app with container initialization and all middleware
    const app = await createApp();
    console.log('✅ Express app created');

    // Initialize Langfuse for LLM observability
    const langfuse = getLangfuse();
    if (langfuse) {
      console.log('✅ Langfuse initialized for LLM observability');
    } else {
      console.log('ℹ️ Langfuse not configured (set LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY to enable)');
    }

    // Create HTTP server
    const server = createServer(app);
    console.log('✅ HTTP server created');

    // Setup Vite in development or serve static files in production
    // Must be done after routes to avoid interference with API routes
    const env = app.get('env');
    console.log('🔍 Express env:', env);
    
    if (env === 'development') {
      console.log('🔧 Setting up Vite for development...');
      await setupVite(app as any, server);
    } else {
      console.log('📁 Setting up static file serving for production...');
      serveStatic(app as any);
      console.log('✅ Static file serving configured');
    }

    // Start the server
    const port = parseInt(process.env.PORT || '5000', 10);
    // Default to 0.0.0.0 in production for cloud platforms (Render, etc.)
    // Use 127.0.0.1 in development for security
    const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
    console.log(`🚀 Starting server on ${host}:${port}...`);
    server.listen(port, host, () => {
      log(`🚀 Server running on http://${host}:${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Flush Langfuse events before shutdown
  try {
    await shutdownLangfuse();
    console.log('✅ Langfuse flushed and shut down');
  } catch (error) {
    console.error('Failed to shutdown Langfuse:', error);
  }

  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the application
startServer();
