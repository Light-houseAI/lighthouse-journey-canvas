# Testing Guide

This document explains the test structure and how to run tests in the UI package.

## Test Types

We have two types of tests, each with their own configuration:

### 1. Unit Tests (Fast ⚡️)

**Configuration**: `vitest.config.unit.ts`
**Setup File**: `src/test/setup.ts`

Unit tests are fast, isolated tests that:
- Use `vi.mock()` to mock dependencies
- Do **NOT** use MSW (Mock Service Worker)
- Test individual components, hooks, and utilities in isolation
- Run in ~1-30 seconds

**Location**: `src/**/*.test.{ts,tsx}` (excluding MSW-based tests)

**Run unit tests:**
```bash
# From packages/ui/
pnpm test:unit

# From project root:
pnpm --filter @journey/ui test:unit
# or
pnpm test:unit  # runs unit tests in all packages
```

### 2. Integration Tests (Slower 🐢)

**Configuration**: `vitest.config.integration.ts`
**Setup File**: `tests/integration/setup.ts`

Integration tests are slower tests that:
- Use MSW (Mock Service Worker) to mock HTTP requests
- Test component interactions with "real" API calls (mocked by MSW)
- Test more complex scenarios and user flows
- Run in ~30-60 seconds

**Location**:
- `tests/integration/**/*.test.{ts,tsx}`
- MSW-based tests in `src/` (ApplicationMaterialsModal.test.tsx, ApplicationMaterialsStep.test.tsx)

**Run integration tests:**
```bash
# From packages/ui/
pnpm test:integration

# From project root:
pnpm --filter @journey/ui test:integration
# or
pnpm test:integration  # runs integration tests in all packages
```

## Test Commands

### Local Development

```bash
# Run unit tests (fast)
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run both
pnpm test

# Watch mode (unit tests only)
pnpm test:watch

# Watch mode (integration tests)
pnpm test:watch:integration

# Coverage (unit tests)
pnpm test:coverage

# Coverage (integration tests)
pnpm test:coverage:integration
```

### From Project Root

```bash
# Run unit tests in all packages (fast, RECOMMENDED for development)
pnpm test:unit

# Run integration tests in all packages
pnpm test:integration

# Nx smart testing (only tests affected by changes)
pnpm test:changed           # Only unit tests for changed packages
pnpm test:changed:all       # All tests (unit + integration) for changed packages
```

## When to Use Each Type

### Write a Unit Test When:
- Testing a single component in isolation
- Testing a utility function or helper
- Testing a custom hook with mocked dependencies
- You want fast feedback during development

### Write an Integration Test When:
- Testing component interactions with API calls
- Testing complex user flows that involve multiple components
- Testing MSW-based scenarios
- You need to verify HTTP request/response handling

## Test File Structure

### Unit Test Example
```typescript
// src/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MyComponent } from './MyComponent';

// Mock dependencies
vi.mock('../services/api', () => ({
  api: {
    getData: vi.fn(),
  },
}));

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Integration Test Example
```typescript
// tests/integration/components/MyComponent.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent Integration', () => {
  it('fetches and displays data', async () => {
    // Setup MSW handler
    server.use(
      http.get('/api/data', () => {
        return HttpResponse.json({ message: 'Hello' });
      })
    );

    render(<MyComponent />);

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });
});
```

## Configuration Details

### Unit Test Config (`vitest.config.unit.ts`)
- ✅ No MSW setup (faster startup)
- ✅ Excludes integration tests
- ✅ Uses `src/test/setup.ts`
- ✅ Includes all tests in `src/` except MSW-based tests

### Integration Test Config (`vitest.config.integration.ts`)
- ✅ MSW server setup in `tests/integration/setup.ts`
- ✅ Only includes integration tests
- ✅ Uses `pool: 'forks'` for MSW compatibility
- ✅ Configured with MSW v2 settings

## Best Practices

1. **Default to unit tests** - They're faster and easier to maintain
2. **Use integration tests sparingly** - Only when you need to test HTTP interactions
3. **Mock at the boundary** - For unit tests, mock API clients. For integration tests, mock HTTP with MSW
4. **Keep tests isolated** - Each test should be independent
5. **Use factories for test data** - See `src/test/factories/` for examples

## Troubleshooting

### Tests are slow
- Make sure you're running `pnpm test:unit` instead of `pnpm test`
- Unit tests should run in ~10-30 seconds
- If a specific test file is slow, it might need to be an integration test

### MSW not working
- Check that the test is included in `vitest.config.integration.ts`
- Verify the test is using `server.use()` to set up handlers
- Make sure `tests/integration/setup.ts` is being loaded

### Tests can't find modules
- Check that imports use the `@/` alias
- Verify the module is exported from its source file
- Check `vitest.config.*.ts` resolve.alias configuration

## Migration Notes

Prior to this change, all tests used MSW globally, which made tests slower. Now:
- Most tests are unit tests (fast, no MSW)
- Only 2 test files in `src/` use MSW (ApplicationMaterialsModal, ApplicationMaterialsStep)
- Integration tests are in `tests/integration/`

If you're updating an existing test:
1. Does it use `http.get()`, `http.post()`, etc. from MSW? → Move to integration tests
2. Does it use `vi.mock()` to mock APIs? → Keep as unit test
