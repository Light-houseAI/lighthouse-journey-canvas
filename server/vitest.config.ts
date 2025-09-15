/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Enable global APIs (test, describe, it, expect)
    environment: 'node', // Server environment
    include: [
      // Test files are now co-located with their source code
      'controllers/**/*.test.ts',
      'services/**/*.test.ts',
      'services/**/__tests__/*.test.ts',
      'repositories/**/*.test.ts',
      'repositories/**/__tests__/*.test.ts',
      'middlewares/**/*.test.ts',
      'core/**/*.test.ts',
      'config/**/*.test.ts',
      'tests/**/*.test.ts', // API and integration tests
    ], // Server test patterns
    exclude: ['**/node_modules/**', 'dist'],
    testTimeout: 30000, // 30 second timeout for database tests
    hookTimeout: 15000, // 15 second timeout for setup/teardown
    reporters: ['verbose', 'json'], // Detailed output + JSON for CI
    pool: 'threads', // Use threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallel execution with database isolation
        minThreads: 1,
        maxThreads: 4, // Allow up to 4 parallel test workers
        isolate: true, // Isolate tests for database safety
      },
    },
    // Enhanced test isolation
    isolate: true,

    // Global setup for enhanced test infrastructure - commented out missing file
    // globalSetup: ['./tests/setup/test-hooks.ts'],

    // Setup files for test context (runs before each test file) - commented out missing file
    // setupFiles: ['./tests/setup/test-hooks.ts'],

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
      include: [
        // Server code
        './**/*.{js,ts}',
        // Client code (when running client tests)
        '../client/src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test/**/*',
        '**/tests/**/*',
        'tests/**/*',
        '../client/src/test/**/*',
        // Exclude build and deployment files
        'dist/**/*',
        'build/**/*',
        'migrations/**/*',
        // Exclude config and setup files
        'core/container-setup.ts',
        'core/logger.ts',
        'config/**/*',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        global: {
          branches: 80, // Increased from 70 to meet PRD requirements
          functions: 80, // Increased from 70 to meet PRD requirements
          lines: 80, // Increased from 70 to meet PRD requirements
          statements: 80, // Increased from 70 to meet PRD requirements
        },
        // Specific thresholds for different areas
        'services/**/*.ts': {
          branches: 85,
          functions: 90,
          lines: 85,
          statements: 85,
        },
        'repositories/**/*.ts': {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80,
        },
        'controllers/**/*.ts': {
          branches: 75,
          functions: 80,
          lines: 75,
          statements: 75,
        },
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
    maxConcurrency: 4, // Limit concurrent tests for database stability

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
    },
  },
});
