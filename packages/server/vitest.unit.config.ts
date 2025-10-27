/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitestReporter } from 'tdd-guard-vitest';

/**
 * Vitest Configuration for Unit Tests
 *
 * Optimized for fast, parallel execution of isolated unit tests.
 * - Parallel execution (threads pool with multiple workers)
 * - Excludes integration tests, e2e tests, and API tests
 * - Shorter timeouts for fast feedback
 * - Higher coverage thresholds (80% for unit tests)
 */
export default defineConfig({
  test: {
    // Core settings
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/openai-mocks.ts'],

    // PARALLEL execution for unit tests (no database, fully mocked)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4, // Utilize multiple CPU cores
        minThreads: 1,
      },
    },

    // Shorter timeouts for unit tests (no database/network operations)
    testTimeout: 5000, // 5 seconds (vs 30s for integration)
    hookTimeout: 3000, // 3 seconds (vs 15s for integration)

    // TDD Guard reporter + defaults
    reporters: ['default', new VitestReporter('./tests')],

    // Retry flaky tests once
    retry: 1,

    // Include only unit tests (exclude integration/e2e/API tests)
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/integration/**',
      'tests/api/**', // Integration tests with real database
      '**/*.integration.test.ts', // Integration test pattern
      '**/*.e2e.test.ts', // E2E test pattern
    ],

    // Coverage configuration for unit tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/*.config.{js,ts}',
        '**/*.test.ts',
        '**/tests/**',
        '**/migrations/**',
        'src/index.ts',
        'src/core/container-setup.ts',
        'src/config/**',
        'scripts/**',
      ],
      thresholds: {
        global: {
          branches: 80, // Higher threshold for unit tests
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../client/src'),
      '@shared': path.resolve(__dirname, '../shared'),
      '@server': path.resolve(__dirname, '.'),
      '@journey/schema': path.resolve(__dirname, '../schema/src'),
    },
  },
});
