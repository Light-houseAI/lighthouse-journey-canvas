# Nx Smart Test Execution Guide

## Overview

Nx provides intelligent test execution based on Git changes and dependency graphs. Run only the tests for packages affected by your changes.

## Commands

### Run Tests for Changed Packages

```bash
# Test only packages with changes (compares to main branch)
pnpm test:changed

# Explicitly specify base branch
pnpm test:changed:base
```

### Run All Tests (Traditional)

```bash
# Run all package tests (backward compatible)
pnpm test
```

## How It Works

### Affected Detection

Nx analyzes:
1. **Git changes**: Files modified since the base branch (main)
2. **Dependency graph**: Packages that depend on changed packages
3. **Implicit dependencies**: Global config files (tsconfig, vitest.config, etc.)

### Example Scenarios

**Scenario 1: Single Package Change**
```bash
# Edit packages/server/src/services/user.service.ts
pnpm test:changed
# → Only @journey/server tests run
```

**Scenario 2: Schema Package Change**
```bash
# Edit packages/schema/src/schema.ts
pnpm test:changed
# → @journey/schema, @journey/server, @journery/ui tests run
# (all packages depend on schema)
```

**Scenario 3: Global Config Change**
```bash
# Edit vitest.config.ts or tsconfig.json
pnpm test:changed
# → ALL package tests run (implicit dependency)
```

### Caching

Nx caches test results. Unchanged packages return instant results:

```bash
pnpm test:changed
# → First run: 68s

pnpm test:changed
# → Second run: <1s (cache hit)
```

Cache invalidates when:
- Source files change
- Test files change
- Config files change (vitest.config, tsconfig, etc.)

## Migration from Lerna

**Old Command** (deprecated):
```bash
pnpm test-changed  # Used Lerna with hardcoded branch
```

**New Commands**:
```bash
pnpm test:changed       # Dynamic base branch detection
pnpm test:changed:base  # Explicit main branch comparison
```

## Advanced Usage

### Check Which Packages Are Affected

```bash
npx nx show projects --affected
```

### Run Affected Tests with Custom Base

```bash
npx nx affected -t test --base=develop --head=HEAD
```

### Clear Nx Cache

```bash
npx nx reset
```

### Dry Run (See What Would Execute)

```bash
npx nx affected -t test --parallel --dry-run
```

## Troubleshooting

### Issue: All packages always show as affected

**Cause**: Global config files changed or cache is stale

**Solution**:
```bash
# Check what changed
git diff main

# Clear cache and retry
npx nx reset
pnpm test:changed
```

### Issue: Expected package not detected as affected

**Cause**: Package dependencies not declared in package.json

**Solution**: Verify `dependencies` or `devDependencies` in package.json include all required packages

```json
{
  "dependencies": {
    "@journey/schema": "workspace:*"
  }
}
```

### Issue: Cache hits when code changed

**Cause**: Change not committed to Git

**Solution**: Nx compares committed changes. Stage and commit your changes:

```bash
git add .
git commit -m "feat: your changes"
pnpm test:changed
```

### Issue: Tests fail with "Unable to resolve local plugin @nx/js"

**Cause**: @nx/js plugin not installed

**Solution**:
```bash
pnpm add -D -w @nx/js
```

## Best Practices

### Local Development

1. **Use `test:changed` for quick feedback**
   ```bash
   pnpm test:changed
   ```

2. **Run full test suite before pushing**
   ```bash
   pnpm test
   ```

3. **Commit frequently** to get accurate affected detection

### When to Use Each Command

| Command | When to Use |
|---------|------------|
| `pnpm test:changed` | Quick local development loop |
| `pnpm test:changed:base` | Verify all changes in feature branch |
| `pnpm test` | Final verification before commit/PR |

### Performance Tips

1. **Parallel execution**: Already enabled (`--parallel` flag)
2. **Cache management**: Cache stored in `.nx/cache` (gitignored)
3. **Incremental commits**: Smaller changesets = faster affected detection

## Future Enhancements

### CI/CD Integration

When adding CI/CD later:

```yaml
# Example GitHub Actions
- name: Run affected tests
  run: |
    npx nx affected -t test --base=origin/main --parallel
```

### Nx Cloud (Optional)

For shared cache across team:

```bash
npx nx connect
```

Benefits:
- Distributed caching
- Remote execution
- Team-wide performance boost

## Configuration

### Nx Config (`nx.json`)

Key settings:
- `affected.defaultBase`: "main" - Base branch for comparison
- `plugins`: ["@nx/js"] - Auto-detects packages from package.json
- `implicitDependencies`: Global files that affect all packages
- `targetDefaults.test.cache`: true - Enable test caching

### Nx Ignore (`.nxignore`)

Excluded from affected detection:
- `node_modules/`
- `dist/`, `build/`
- `coverage/`
- `.nx/` (cache)

## Support

For Nx-specific issues, see:
- [Nx Documentation](https://nx.dev)
- [Nx Affected](https://nx.dev/concepts/affected)

For project-specific questions, refer to the main [CLAUDE.md](../CLAUDE.md)
