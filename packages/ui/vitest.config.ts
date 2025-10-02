/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Core settings
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],

    // MSW compatibility (required for MSW v2 + JSDOM)
    pool: 'forks',
    fakeTimers: {
      // Exclude queueMicrotask to prevent MSW hanging
      toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
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
        '**/main.tsx',
        '**/App.tsx',
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
    conditions: ['node'], // MSW v2 export conditions fix
  },
});
