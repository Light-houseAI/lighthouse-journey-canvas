import { defineWorkspace } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineWorkspace([
  // Unit tests project (fast jsdom)
  {
    extends: './vite.config.ts',
    plugins: [react()],
    test: {
      name: 'unit',
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.unit.ts'],
      include: ['**/*.test.tsx', '**/*.test.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/e2e-playwright/**',
        '**/integration/**',
        '**/*.integration.test.*',
        '**/*.stories.tsx'
      ],
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  },
  // Storybook tests project (browser-based)
  {
    extends: './vite.config.ts',
    plugins: [
      storybookTest({
        // Path to Storybook configuration
        configDir: '.storybook',
        // Stories with 'test' tag will run as tests
        tags: {
          include: ['test', 'autodocs'],
          exclude: ['no-test'],
        },
      }),
    ],
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        name: 'chromium',
        provider: 'playwright',
        headless: true,
      },
      setupFiles: ['./.storybook/vitest.setup.ts'],
    },
  },
])
