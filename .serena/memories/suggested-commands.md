# Essential Development Commands

## Development Server
```bash
# Start development server (client + server)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Database Management
```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Check migration status
pnpm db:migrate:status

# Push schema to database
pnpm db:push
```

## Testing Commands
```bash
# All tests
pnpm test

# Client tests only
pnpm test:client

# Server tests only  
pnpm test:server

# E2E tests
pnpm test:e2e

# E2E with UI
pnpm test:e2e:ui

# E2E debug mode
pnpm test:e2e:debug

# API contract tests
pnpm test:api
```

## Code Quality
```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Check formatting
pnpm format:check

# Type check
pnpm type-check

# Pre-commit checks
pnpm pre-commit
```

## Modern CLI Tools (Darwin System)
```bash
# Fast searching
rg "pattern" --type ts                    # Search in TypeScript files
rg "TODO|FIXME" --type ts                # Find todos and fixmes
rg "export.*Service" --type ts           # Find all exported services

# Better file listing
eza -la --git --header                   # Detailed view with git status
eza --tree --level=3 -I node_modules     # Tree view excluding node_modules

# Directory structure
tree -I 'node_modules|dist|.git' -L 3   # Project structure overview

# Fast file finding
fd "test" --type f --extension ts        # Find all TypeScript test files
fd "component" --type f --extension tsx  # Find React components

# Enhanced file viewing
bat package.json                         # View with syntax highlighting
bat src/index.ts | head -50              # Preview files
```

## Project Structure Navigation
```bash
# Client structure
eza client/src --tree --only-dirs       # View client source structure

# Server structure  
eza server --tree --only-dirs           # View server structure

# Find specific file types
fd "*.test.ts" client/                  # Find all test files
fd "*.store.ts" client/src/stores/      # Find store files
```