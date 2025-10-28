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
  plugins: [react()],
  test: {
    // Core settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'], // Unit test setup (no MSW)

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
    ],

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
