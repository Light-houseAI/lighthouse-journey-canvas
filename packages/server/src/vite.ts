import { randomUUID } from 'crypto';
import express, { type Express } from 'express';
import fs from 'fs';
import { type Server } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamic import of vite - only needed in development
  // This prevents the production build from failing when vite isn't installed
  const { createLogger, createServer: createViteServer } = await import('vite');
  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // We'll use the vite config inline here to avoid import issues
  const viteConfig = {};

  const vite = await createViteServer({
    ...viteConfig,
    root: path.resolve(__dirname, '..', '..', 'ui'),
    configFile: path.resolve(__dirname, '..', '..', 'ui', 'vite.config.ts'),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        '..',
        '..',
        'ui',
        'index.html'
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  console.log('📁 serveStatic: __dirname =', __dirname);
  const distPath = path.resolve(__dirname, '..', '..', '..', 'dist', 'ui');
  console.log('📁 serveStatic: distPath =', distPath);

  if (!fs.existsSync(distPath)) {
    console.error('❌ serveStatic: distPath does not exist!');
    // List parent directories to help debug
    const parentPath = path.resolve(__dirname, '..', '..', '..');
    console.log('📁 serveStatic: parentPath =', parentPath);
    try {
      const parentContents = fs.readdirSync(parentPath);
      console.log('📁 serveStatic: parentPath contents =', parentContents);
    } catch (e) {
      console.error('❌ serveStatic: Could not read parentPath:', e);
    }
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  console.log('✅ serveStatic: distPath exists');
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use('*', (_req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}
