/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for UNIT TESTS only
 *
 * Unit tests:
 * - Use vi.mock() to mock dependencies
 * - Do not use MSW (Mock Service Worker)
 * - Are fast and isolated
 * - Located in src/**\/*.test.{ts,tsx}
 *
 * To run unit tests:
 *   pnpm test:unit
 **/
export default defineConfig({
  plugins: [
    react({
      // Optimize React plugin for faster transforms
      babel: {
        plugins: [],
      },
    }),
  ],
  test: {
    // Core settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'], // Unit test setup (no MSW)

    // Parallel execution for unit tests (fast, isolated, no MSW)
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 8, // Increased from 4 for better parallelization
        minThreads: 2,
      },
    },

    // Performance optimizations
    isolate: true, // Isolate tests for better parallelization

    // Faster test running
    testTimeout: 10000, // 10s timeout (default is 5s)
    hookTimeout: 10000, // 10s for setup/teardown

    // Exclude integration and e2e tests
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/e2e-playwright/**',
      '**/integration/**',
      'tests/integration/**',
      'tests/e2e/**',
      'tests/e2e-playwright/**',
      // Exclude MSW-based tests (these belong in integration tests)
      '**/ApplicationMaterialsModal.test.tsx',
      '**/ApplicationMaterialsStep.test.tsx',
      // Exclude integration flow tests
      '**/pages/__tests__/onboarding-flow.test.tsx',
      // Exclude ShareModal tests that use MSW
      '**/share/ShareModal.networks.test.tsx',
      '**/share/ShareModal.people.test.tsx',
      '**/share/NetworksAccessSection.test.tsx',
      '**/share/PeopleAccessSection.test.tsx',
      '**/share/BulkPersonPermissionsView.test.tsx',
      // Exclude search tests that may use MSW
      '**/search/page/LeftPanel.test.tsx',
      '**/search/page/ProfileListItem.test.tsx',
      '**/pages/search-results.test.tsx',
    ],

    // Cache for faster subsequent runs
    cache: {
      dir: 'node_modules/.vitest/unit',
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
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
