/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for INTEGRATION TESTS only
 *
 * Integration tests:
 * - Use MSW (Mock Service Worker) to mock HTTP requests
 * - Test component interactions with real API calls (mocked by MSW)
 * - Are slower than unit tests
 * - Located in tests/integration/**\/*.test.{ts,tsx}
 *
 * To run integration tests:
 *   pnpm test:integration
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // Core settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/integration/setup.ts'], // Integration test setup (with MSW)

    // Include ONLY integration tests (including MSW-based tests in src/)
    include: [
      'tests/integration/**/*.test.{ts,tsx}',
      // MSW-based tests that need to run with integration setup
      '**/ApplicationMaterialsModal.test.tsx',
      '**/ApplicationMaterialsStep.test.tsx',
    ],

    // MSW compatibility (required for MSW v2 + JSDOM)
    pool: 'forks',
    fakeTimers: {
      // Exclude queueMicrotask to prevent MSW hanging
      toFake: [
        'setTimeout',
        'setInterval',
        'clearTimeout',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'Date',
      ],
    },

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/*.config.{js,ts}',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/test/**',
        '**/tests/**',
        '**/main.tsx',
        '**/App.tsx',
        '**/mocks/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
    conditions: ['node'], // MSW v2 export conditions fix
  },
});
