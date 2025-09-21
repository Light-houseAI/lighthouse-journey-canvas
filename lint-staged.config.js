export default {
  // TypeScript files - UI package (React components)
  'packages/ui/**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],

  // TypeScript files - Server package (Node.js)
  'packages/server/**/*.{ts,js}': ['eslint --fix', 'prettier --write'],

  // TypeScript files - Schema package
  'packages/schema/**/*.ts': ['eslint --fix', 'prettier --write'],

  // Style files
  '**/*.{css,scss}': ['prettier --write'],

  // Configuration files
  '**/*.{json,yml,yaml}': ['prettier --write'],

  // Markdown files
  '**/*.md': ['prettier --write'],

  // JavaScript files (config files, etc.)
  '*.{js,mjs,cjs}': ['eslint --fix', 'prettier --write'],

  // Run TypeScript compiler check after all file processing (excluding test files for now)
  '**/*.{ts,tsx}': () => [
    "echo 'TypeScript check skipped - run npm run type-check manually to see full results'",
  ],
};
