import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true, // Enable global APIs (test, describe, it, expect)
    environment: 'node', // Test environment for Node.js/Express app
    include: ['server/tests/**/*.test.ts'], // Test file patterns
    exclude: ['node_modules', 'dist', 'server/tests/utils/**'], // Exclude patterns
    testTimeout: 30000, // 30 second timeout for agent tests (reduced from 60s due to faster PGlite)
    hookTimeout: 10000, // 10 second timeout for setup/teardown (reduced from 30s)
    reporters: ['verbose'], // Detailed output for debugging
    pool: 'threads', // Use threads for parallel execution
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallel execution with PGlite isolation
        minThreads: 1,
        maxThreads: 4, // Allow up to 4 parallel test workers
      },
    },
    // Global test setup and teardown
    globalSetup: ['./server/tests/setup/global-setup.ts'],
    globalTeardown: ['./server/tests/setup/global-teardown.ts'],
    // Setup files for test context
    setupFiles: ['./server/tests/setup/parallel-setup.ts'],
    // Retry failed tests once in case of flaky issues
    retry: 1,
    // Better error output
    outputFile: {
      junit: './test-results.xml'
    }
  }
})
