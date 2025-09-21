import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildSchema() {
  try {
    // Build the main bundle
    await build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'es2020',
      outfile: 'dist/index.js',
      sourcemap: true,
      packages: 'external',
      external: [
        // External dependencies that should not be bundled
        'drizzle-orm',
        'drizzle-zod',
        'zod',
        'postgres',
        '@neondatabase/serverless'
      ],
      loader: {
        '.ts': 'ts',
        '.json': 'json'
      }
    });

    console.log('✅ Schema build completed successfully');
  } catch (error) {
    console.error('❌ Schema build failed:', error);
    process.exit(1);
  }
}

buildSchema();