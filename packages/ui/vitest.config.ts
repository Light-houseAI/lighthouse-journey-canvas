/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fix MSW v2 + Vitest export conditions issue
    pool: 'forks', // Use forks instead of threads for MSW compatibility
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      '.vercel',
      '.turbo',
      'tests/**/*',
    ],
    testTimeout: 10000,
    hookTimeout: 5000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      enabled: true,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.{js,ts}',
        'src/**/*.test.{js,jsx,ts,tsx}',
        'src/**/*.spec.{js,jsx,ts,tsx}',
        'src/test/**/*',
        'src/main.tsx',
        'src/App.tsx',
        'src/index.css',
        'src/vite-env.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
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
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
        // Specific thresholds for different component types
        'src/components/**/*.{tsx,ts}': {
          branches: 50,
          functions: 60,
          lines: 60,
          statements: 60,
        },
        'src/hooks/**/*.{tsx,ts}': {
          branches: 70,
          functions: 75,
          lines: 70,
          statements: 70,
        },
        'src/stores/**/*.{tsx,ts}': {
          branches: 70,
          functions: 75,
          lines: 70,
          statements: 70,
        },
        'src/utils/**/*.{tsx,ts}': {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80,
        },
      },
      // Coverage watermarks for HTML report
      watermarks: {
        lines: [60, 80],
        functions: [60, 80],
        branches: [60, 80],
        statements: [60, 80],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
    conditions: ['node'], // Fix MSW v2 export conditions with JSDOM
  },
});
