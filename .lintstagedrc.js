module.exports = {
  // TypeScript & JavaScript files
  '*.{js,jsx,ts,tsx}': [
    'eslint --fix --quiet', // Auto-fix ESLint issues, show only errors (no warnings)
    'prettier --write', // Format code
  ],

  // JSON, MD, and other files
  '*.{json,md,yml,yaml}': ['prettier --write'],

  // CSS files
  '*.{css,scss}': ['prettier --write'],
};
