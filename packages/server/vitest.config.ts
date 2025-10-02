/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitestReporter } from 'tdd-guard-vitest';

export default defineConfig({
  test: {
    // Core settings
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/openai-mocks.ts'],

    // Database integration testing (serial execution for stability)
    pool: 'forks', // Vitest 2.0 default - better for database tests
    poolOptions: {
      forks: {
        singleFork: true, // Serial execution for database isolation
      },
    },

    // Timeouts for database operations
    testTimeout: 30000,
    hookTimeout: 15000,

    // TDD Guard reporter + defaults
    reporters: ['default', new VitestReporter('./tests')],

    // Retry flaky database/network tests once
    retry: 1,

    // Coverage
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
      '@server': path.resolve(__dirname, '.'),
      '@journey/schema': path.resolve(__dirname, '../schema/src'),
    },
  },
});
