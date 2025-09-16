// @ts-check
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      '.husky/**',
      'client/dist/**',
      '**/*.min.js',
    ],
  },

  // Base JavaScript recommended rules
  js.configs.recommended,

  // TypeScript recommended rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'unused-imports': unusedImports,
    },
    rules: {
      ...typescript.configs.recommended.rules,

      // Turn off base rules that conflict with TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // Turn off overly strict TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // Use unused-imports plugin for auto-fixing
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },

  // React recommended rules for client files
  {
    files: ['client/**/*.{tsx,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript for props
    },
  },

  // Node.js configuration files
  {
    files: ['*.config.{js,ts}', '.lintstagedrc.js', 'server/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
  },

  // Apply Prettier config last to disable conflicting rules
  prettier,
];
