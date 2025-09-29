/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import { VitestReporter } from 'tdd-guard-vitest';

export default defineConfig({
  plugins: [],
  test: {
    globals: true, // Enable global APIs (test, describe, it, expect)
    environment: 'node', // Server environment
    include: [
      // Test files are now co-located with their source code
      'src/**/*.test.ts',
      'src/**/__tests__/*.test.ts',
      'tests/**/*.test.ts', // API and integration tests
    ], // Server test patterns
    exclude: ['**/node_modules/**', 'dist'],
    testTimeout: 30000, // 30 second timeout for database tests
    hookTimeout: 15000, // 15 second timeout for setup/teardown
    reporters: ['verbose', 'json', new VitestReporter('./tests')],
    pool: 'threads', // Use threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallel execution with database isolation
        minThreads: 1,
        maxThreads: 1, // Allow up to 4 parallel test workers
        isolate: true, // Isolate tests for database safety
      },
    },
    // Enhanced test isolation
    isolate: true,

    // Global setup for enhanced test infrastructure - commented out missing file
    // globalSetup: ['./tests/setup/test-hooks.ts'],

    // Setup files for test context (runs before each test file)
    setupFiles: ['./tests/setup/openai-mocks.ts'],

    // Retry failed tests once for flaky network/database issues
    retry: 1,

    // Better error output and CI integration
    outputFile: {
      junit: './test-results.xml',
      json: './test-results.json',
    },

    // Enhanced coverage configuration
    coverage: {
      provider: 'v8',
      enabled: true,
      include: ['src/**/*.{js,ts}'],
      exclude: [
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test/**/*',
        '**/tests/**/*',
        'tests/**/*',
        '**/node_modules/**',
        '**/dist/**/*',
        '**/build/**/*',
        '**/migrations/**/*',
        // Exclude setup and config files
        'src/index.ts',
        'src/core/container-setup.ts',
        'src/core/logger.ts',
        'src/config/**/*',
        // Exclude scripts
        'scripts/**/*',
      ],
      reporter: [
        'text',
        'text-summary',
        'json',
        'json-summary',
        'html',
        'lcov',
        'cobertura',
      ],
      reportsDirectory: './coverage',
      all: true, // Include all source files in coverage report
      clean: true, // Clean coverage results before running tests
      skipFull: false, // Show files with 100% coverage
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        // Specific thresholds for critical areas
        'src/services/**/*.ts': {
          branches: 75,
          functions: 80,
          lines: 75,
          statements: 75,
        },
        'src/repositories/**/*.ts': {
          branches: 70,
          functions: 75,
          lines: 70,
          statements: 70,
        },
        'src/controllers/**/*.ts': {
          branches: 65,
          functions: 70,
          lines: 65,
          statements: 65,
        },
      },
      // Coverage watermarks for HTML report
      watermarks: {
        lines: [70, 85],
        functions: [70, 85],
        branches: [70, 85],
        statements: [70, 85],
      },
    },

    // Enhanced database test configuration
    env: {
      NODE_ENV: 'test',
      USE_TEST_DB: 'true',
      TEST_LOG_LEVEL: 'warn',
      // Ensure test isolation
      TEST_ISOLATION: 'true',
      // Performance optimization
      TEST_PARALLEL: 'true',
    },

    // File watching configuration for TDD
    watch: {
      include: [
        'src/**/*.{js,ts}',
        'services/**/*.{js,ts}',
        'repositories/**/*.{js,ts}',
        'controllers/**/*.{js,ts}',
        '../shared/**/*.{js,ts}',
      ],
      exclude: ['tests/**/*', 'node_modules/**/*', 'dist/**/*'],
    },

    // Performance optimization
    maxConcurrency: 1, // Limit concurrent tests for database stability

    // Enhanced test organization
    sequence: {
      shuffle: false, // Keep predictable test order for debugging
      concurrent: true, // Allow concurrent test execution
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
