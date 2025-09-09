/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Enable global APIs (test, describe, it, expect)
    environment: 'node', // Default environment for server tests
    include: ['**/*.test.ts'], // Server test patterns
    exclude: ['**/node_modules/**', 'dist', 'tests/utils/**'], // Exclude patterns
    testTimeout: 60000, // 60 second timeout for agent tests
    hookTimeout: 10000, // 10 second timeout for setup/teardown
    reporters: ['verbose'], // Detailed output for debugging
    pool: 'threads', // Use threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallel execution with PGlite isolation
        minThreads: 1,
        maxThreads: 4, // Allow up to 4 parallel test workers
      },
    },
    // Global test setup and teardown (currently disabled)
    // globalSetup: ['./tests/setup/global-setup.ts'],
    // globalTeardown: ['./tests/setup/global-teardown.ts'],
    // Setup files for test context
    // setupFiles: ['./tests/setup/parallel-setup.ts'],
    // Retry failed tests once in case of flaky issues
    retry: 1,
    // Better error output
    outputFile: {
      junit: './test-results.xml',
    },
    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['../client/src/**/*.{js,jsx,ts,tsx}', './**/*.{js,ts}'],
      exclude: [
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test/**/*',
        '**/tests/**/*',
        'tests/**/*',
        '../client/src/test/**/*',
      ],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../client/src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
