// Use dynamic import to ensure console.log runs first
console.log('🔄 [1/6] Starting esbuild config...');
console.log('🔄 [2/6] Node version:', process.version);
console.log('🔄 [3/6] Working directory:', process.cwd());

async function main() {
  try {
    console.log('🔄 [4/6] Loading esbuild...');
    const { build } = await import('esbuild');
    console.log('✅ [5/6] esbuild loaded successfully');

    const { fileURLToPath } = await import('url');
    const path = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    console.log('📂 __dirname:', __dirname);

    console.log('🏗️ [6/6] Starting build...');
    await build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      outfile: 'dist/index.js',
      sourcemap: true,
      minify: process.env.NODE_ENV === 'production',
      packages: 'external',
      external: [
        // Only exclude native Node modules and large dependencies
        'bcrypt',
        'pg',
        'vite',
        'playwright',
        'puppeteer-core',
        'jsdom',
        '@playwright/*',
      ],
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.js': 'js',
        '.json': 'json',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      },
    });

    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:');
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    if (error.errors) {
      console.error('Build errors:');
      error.errors.forEach((e, i) => {
        console.error(`  [${i}] ${e.text}`);
        if (e.location) {
          console.error(`      at ${e.location.file}:${e.location.line}:${e.location.column}`);
        }
      });
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Uncaught error in main:', error);
  process.exit(1);
});