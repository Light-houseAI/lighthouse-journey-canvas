// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import unusedImports from 'eslint-plugin-unused-imports'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['*.js', '*.mjs', '*.cjs'],
				},
				tsconfigRootDir: process.cwd(),
			},
		},
	},
	{
		files: ['packages/**/src/**/*.ts', 'packages/**/src/**/*.tsx', 'packages/**/tests/**/*.ts'],
		plugins: {
			'unused-imports': unusedImports,
			'simple-import-sort': simpleImportSort,
		},
		rules: {
			// Import organization
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
			
			// Remove unused imports
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{ allowNumber: true, allowBoolean: true, allowNever: true },
			],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-deprecated': 'warn',
		},
	},
	{
		ignores: [
			'**/assets/**/*',
			'**/dist/**/*',
			'**/build/**/*',
			'**/node_modules/**/*',
			'**/coverage/**/*',
			'**/playwright-report/**/*',
			'**/.husky/**/*',
			'**/ui/dist/**/*',
			'**/server/public/**/*',
			'**/server/dist/public/**/*',
			'**/*.min.js',
			'**/ui/public/mockServiceWorker.js',
			'**/*.config.js',
			'**/*.config.ts',
			'**/*.config.cjs',
			'**/drizzle.config.ts',
			'**/esbuild.config.js',
			'**/migrations/**/*',
		],
	},
	{
		files: ['**/tailwind.config.js', '**/postcss.config.cjs', '**/*.config.js', '**/*.config.ts'],
		languageOptions: {
			globals: {
				require: 'readonly',
				module: 'readonly',
				exports: 'readonly',
				process: 'readonly',
				console: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				Buffer: 'readonly',
				global: 'readonly',
			},
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
)
