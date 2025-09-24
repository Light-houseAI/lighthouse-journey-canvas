# Lighthouse Journey Timeline - Claude Instructions

## 📋 PROJECT OVERVIEW

**Project**: Lighthouse Journey Timeline
**Repository**: Multi-package monorepo with pnpm workspaces

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
pnpm test         # Run tests
pnpm test -- --watch    # Watch mode
pnpm test -- --coverage # Test coverage
pnpm type-check   # Type checking
pnpm lint         # Linting

# Test-specific examples
pnpm test -- --run src/services/__tests__/hierarchy-service-advanced.test.ts
pnpm test -- [test-file-pattern]
```

### Workspace Commands (From Project Root)
```bash
# Single package
pnpm --filter @journey/[package-name] [command]

# Examples:
pnpm --filter @journey/server dev
pnpm --filter @journey/server test
pnpm --filter @journey/server test -- --run src/services/__tests__/hierarchy-service-advanced.test.ts

# All packages
pnpm [command]

# Examples:
pnpm build
pnpm test
pnpm lint
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

1. **Always run tests** before committing changes
2. **Mock all external dependencies** in unit tests
3. **Follow existing patterns** in the codebase
4. **Use pnpm** instead of npm for package management
5. **Test from correct directory** - tests must be run from package directories or use workspace filters
