import { defineWorkspace } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

export default defineWorkspace([
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
