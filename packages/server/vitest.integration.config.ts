/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitestReporter } from 'tdd-guard-vitest';

/**
 * Vitest Configuration for Integration Tests
 *
 * Optimized for stable, serial execution of integration tests with real database.
 * - Serial execution (forks pool with single fork for database isolation)
 * - Includes integration tests and API tests only
 * - Longer timeouts for database/network operations
 * - Standard coverage thresholds (70%)
 */
export default defineConfig({
  test: {
    // Core settings
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/openai-mocks.ts'],

    // SERIAL execution for integration tests (database isolation required)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Serial execution for database stability
      },
    },

    // Longer timeouts for integration tests (database/network operations)
    testTimeout: 30000, // 30 seconds
    hookTimeout: 15000, // 15 seconds

    // TDD Guard reporter + defaults
    reporters: ['default', new VitestReporter('./tests')],

    // Retry flaky database/network tests once
    retry: 1,

    // Include only integration tests and API tests
    include: [
      'tests/api/**/*.test.ts', // API integration tests
      'src/**/*.integration.test.ts', // Integration test pattern
      'tests/integration/**/*.test.ts', // Integration tests directory
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.e2e.test.ts',
    ],

    // Coverage configuration for integration tests
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
          branches: 70, // Standard threshold for integration tests
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
      '@server': path.resolve(__dirname, '.'),
      '@journey/schema': path.resolve(__dirname, '../schema/src'),
    },
  },
});
