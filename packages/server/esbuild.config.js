// Force unbuffered output for CI debugging
process.stderr.write('[esbuild] Step 1: Script starting...\n');
process.stderr.write('[esbuild] Node version: ' + process.version + '\n');
process.stderr.write('[esbuild] CWD: ' + process.cwd() + '\n');

async function main() {
  try {
    process.stderr.write('[esbuild] Step 2: Loading esbuild module...\n');
    const { build } = await import('esbuild');
    process.stderr.write('[esbuild] Step 3: esbuild loaded successfully\n');

    const { fileURLToPath } = await import('url');
    const path = await import('path');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    process.stderr.write('[esbuild] Step 4: __dirname = ' + __dirname + '\n');

    process.stderr.write('[esbuild] Step 5: Starting build...\n');
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

    process.stderr.write('[esbuild] Step 6: Build completed successfully!\n');
    console.log('✅ Build completed successfully');
  } catch (error) {
    process.stderr.write('[esbuild] ERROR: Build failed\n');
    process.stderr.write('[esbuild] Error message: ' + error.message + '\n');
    process.stderr.write('[esbuild] Error stack: ' + error.stack + '\n');
    if (error.errors) {
      error.errors.forEach((e, i) => {
        process.stderr.write('[esbuild] Build error ' + i + ': ' + e.text + '\n');
        if (e.location) {
          process.stderr.write('[esbuild]   at ' + e.location.file + ':' + e.location.line + ':' + e.location.column + '\n');
        }
      });
    }
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write('[esbuild] UNCAUGHT ERROR: ' + error.message + '\n');
  process.stderr.write('[esbuild] Stack: ' + error.stack + '\n');
  process.exit(1);
});
