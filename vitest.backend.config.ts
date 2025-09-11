import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'server/**/*.{test,spec}.{js,ts}',
      'shared/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/client/**',
      '**/*.d.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'server/**/*.{js,ts}',
        'shared/**/*.{js,ts}'
      ],
      exclude: [
        'server/test-*.ts',
        'server/**/*.test.ts',
        'server/**/*.spec.ts',
        'server/scripts/**',
        'shared/**/*.test.*',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 4,
        useAtomics: true
      }
    },
    maxConcurrency: 10,
    fileParallelism: true,
    testTimeout: 10000,
    hookTimeout: 5000
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
});