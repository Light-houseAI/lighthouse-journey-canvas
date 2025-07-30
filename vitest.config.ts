import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true, // Enable global APIs (test, describe, it, expect)
    environment: 'node', // Test environment for Node.js/Express app
    include: ['server/tests/**/*.test.ts'], // Test file patterns
    exclude: ['node_modules', 'dist', 'server/tests/utils/**'], // Exclude patterns
    testTimeout: 60000, // 60 second timeout for agent tests (increased from 30s)
    hookTimeout: 30000, // 30 second timeout for setup/teardown (increased from 10s)
    reporters: ['verbose'], // Detailed output for debugging
    pool: 'threads', // Use threads for better performance
    poolOptions: {
      threads: {
        singleThread: true, // Run tests in sequence for database consistency
        minThreads: 1,
        maxThreads: 1 // Force single thread to prevent database conflicts
      }
    },
    // Global test setup and teardown
    globalSetup: ['./server/tests/setup/global-setup.ts'],
    globalTeardown: ['./server/tests/setup/global-teardown.ts'],
    // Retry failed tests once in case of flaky network/database issues
    retry: 1,
    // Better error output
    outputFile: {
      junit: './test-results.xml'
    }
  }
})