# Lighthouse Journey Timeline - Claude Instructions

## 📋 PROJECT OVERVIEW

**Project**: Lighthouse Journey Timeline
**Repository**: Multi-package monorepo with pnpm workspaces

## 🎯 LINEAR INTEGRATION

**Team Name**: LighthouseAI
**Team ID**: 4e1f8fdb-9fe8-4a87-b4cb-9ead3c75317c
**Team URL**: https://linear.app/lighthouseai/team/LIG/all
**Ticket Prefix**: LIG-

Use this team when creating Linear tickets via MCP or manually.

## 🏗️ PROJECT STRUCTURE

```
packages/
├── server/     - Backend server code (Node.js/TypeScript/Vitest)
├── ui/         - Frontend UI code (React/TypeScript)
└── schema/     - Shared schema and types (Drizzle ORM)
```

## 🛠️ DEVELOPMENT COMMANDS

### Local Package Commands

```bash
# Navigate to package first
cd packages/[package-name]

# Common commands
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm test:unit    # Run unit tests only (FAST - excludes e2e/integration)
pnpm test         # Run all tests including e2e/integration (SLOW)
pnpm type-check   # Type checking
pnpm lint         # Linting

# Run specific test files (PREFERRED - fast, ~1 second per file)
pnpm vitest run --no-coverage src/services/__tests__/user.service.test.ts
pnpm vitest run --no-coverage src/services/__tests__/hierarchy-service-advanced.test.ts

# Watch mode for continuous feedback (auto-reruns on file changes)
pnpm vitest --no-coverage src/services/__tests__/user.service.test.ts
pnpm vitest --no-coverage  # Watch all unit tests in current package
```

### Workspace Commands (From Project Root)

```bash
# Nx smart test execution (only affected packages)
pnpm test:changed           # ⚡️ FAST - Unit tests for changed packages only
pnpm test:changed:base      # ⚡️ FAST - Unit tests vs main branch
pnpm test:changed:all       # 🐢 SLOW - All tests (unit + e2e) for changed packages

# Traditional commands (all packages)
pnpm test:unit              # ⚡️ FAST - Unit tests in all packages
pnpm test                   # 🐢 SLOW - All tests (unit + e2e) in all packages
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages

# Single package
pnpm --filter @journey/[package-name] [command]

# Examples:
pnpm --filter @journey/server dev
pnpm --filter @journey/server test:unit
```

### Database Operations (Schema Package)

```bash
cd packages/schema
pnpm db:generate  --name migration_name   # Run migrations
pnpm db:migrate   # Run migrations

# Or from root:
pnpm --filter @journey/schema db:migrate
```

## 🔍 KEY FILES

### Documentation & Specifications

- `docs/` - **Feature specifications and PRDs**
- `docs/PRD-*.md` - Product Requirements Documents for specific features
- `docs/architecture/` - System architecture documentation
- `docs/implementation/` - Implementation guides

### Server-side Implementation

- `packages/server/src/services/hierarchy-service.ts` - Main hierarchy service
- `packages/server/src/services/experience-matches.service.ts` - Experience matching logic
- `packages/server/src/utils/experience-utils.ts` - Experience utility functions
- `packages/server/src/services/__tests__/` - Test files

### Schema/Types

- `packages/schema/src/types.ts` - TypeScript type definitions
- `packages/schema/src/schema.ts` - Database schema (Drizzle)

### UI Components

- `packages/ui/src/components/timeline/` - Timeline components
- `packages/ui/src/stores/` - State management

## 🧪 TESTING NOTES

### Running Tests

**IMPORTANT**: Use Nx smart testing for best performance.

```bash
# RECOMMENDED: Nx smart testing (from project root)
pnpm test:changed           # ⚡️ Only test changed packages (unit tests)
pnpm test:changed:all       # 🐢 Test changed packages (unit + e2e)

# Package-level testing
cd packages/[package-name]

# Run specific test file (fast, ~1 second)
pnpm vitest run --no-coverage src/services/updates-api.test.ts

# Watch mode - auto-rerun tests on file changes (background feedback)
pnpm vitest --no-coverage src/services/__tests__/user.service.test.ts

# Run all unit tests in package (fast - excludes e2e/integration)
pnpm test:unit

# Run ALL tests including e2e (slow - only when needed)
pnpm test
```

**Testing Strategy:**

- **Local development**: `pnpm test:changed` (⚡️ RECOMMENDED - only tests affected by your changes)
- **Per-file testing**: `pnpm vitest run --no-coverage [file]` (when you need to focus on one specific test)
- **Watch mode**: `pnpm vitest --no-coverage [file]` (auto-rerun on save for TDD)
- **Pre-push check**: `pnpm test:changed:all` (includes e2e for changed packages)
- **Final verification**: `pnpm test` (all tests, all packages - use sparingly)

**What's Excluded from Unit Tests:**

- `tests/e2e/**` - End-to-end tests requiring full setup
- `tests/integration/**` - Integration tests with external dependencies
- `tests/e2e-playwright/**` - Playwright browser tests

**Performance:**

- Single test file: ~1 second
- Affected unit tests (Nx): ~10-30 seconds (depends on changes)
- Full unit test suite: ~1-2 minutes
- Full suite with e2e: several minutes

### Mock Setup Patterns

- Use `vitest-mock-extended` for TypeScript-compatible mocks
- Always mock `experienceMatchesService.shouldShowMatches` in hierarchy service tests
- Mock `nodePermissionService.canAccess` when testing permission-related functionality

### Common Test Issues

- **Missing mock setup**: Ensure all service dependencies are properly mocked
- **TypeScript errors**: Use proper type casting for mock return values
- **Async handling**: Always use `await` with service method calls in tests

## 📝 COMMON PATTERNS

### Error Handling

- Always provide fallback values for service integrations
- Use try-catch blocks for external service calls
- Log errors with context but don't fail core operations

### Test Patterns

- Mock all external service dependencies
- Use `vitest-mock-extended` for TypeScript compatibility
- Always await async operations in tests
- Provide proper mock return values for all service methods

## 🚨 IMPORTANT REMINDERS

1. **Use `pnpm test:changed`** during development - it's fast and only runs affected tests
2. **Mock all external dependencies** in unit tests
3. **Follow existing patterns** in the codebase
4. **Use pnpm** instead of npm for package management
5. **Run `pnpm test:changed:all`** before pushing to verify e2e tests pass
6. **See `docs/NX_USAGE.md`** for detailed Nx testing documentation
