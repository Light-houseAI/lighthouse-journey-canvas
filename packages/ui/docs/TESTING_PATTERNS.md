# UI Testing Patterns Guide

**Status**: ✅ **Complete** (LIG-203)
**Last Updated**: 2025-10-09

## 📋 Table of Contents

1. [Overview](#overview)
2. [Testing Infrastructure](#testing-infrastructure)
3. [Core Patterns](#core-patterns)
4. [MSW Handler Patterns](#msw-handler-patterns)
5. [Component Testing Patterns](#component-testing-patterns)
6. [Store Testing Patterns](#store-testing-patterns)
7. [Hook Testing Patterns](#hook-testing-patterns)
8. [Common Patterns](#common-patterns)
9. [Troubleshooting](#troubleshooting)

## Overview

This guide documents established patterns for testing UI components, stores, and hooks using:

- **Vitest** - Test runner with fast execution and great DX
- **React Testing Library** - Component testing with user-centric queries
- **MSW v2** - Network-level API mocking
- **Zustand** - State management testing patterns

### Key Principles

1. **Test user behavior, not implementation details**
2. **Use real providers whenever possible** (no manual mocks)
3. **Network-level mocking with MSW** (not fetch/axios mocks)
4. **Single source of truth** for test data (factories + mock-data.ts)
5. **Fake timers** for time-dependent tests

## Testing Infrastructure

### `renderWithProviders` Helper

**Location**: `src/test/renderWithProviders.tsx`

Central helper that wraps components with all necessary providers:

```typescript
import { renderWithProviders } from '../test/renderWithProviders';

const { user } = renderWithProviders(<Component />, {
  // Optional overrides
  authState: { user: mockUser, isAuthenticated: true },
  handlers: [customHandler1, customHandler2],
  initialRoute: '/timeline'
});
```

**Key Features**:
- ✅ **QueryClient**: React Query for server state
- ✅ **Router**: Wouter with memory-location for navigation
- ✅ **Auth Store**: Zustand store with optional initial state
- ✅ **MSW**: Automatic setup with default + custom handlers
- ✅ **User Events**: Pre-configured userEvent instance

**Why This Matters**:
- Eliminates boilerplate in every test
- Ensures consistent provider setup
- Provides real providers (not mocks)
- Handles MSW lifecycle automatically

### Test Factories

**Location**: `src/test/factories.ts`

Type-safe factory functions for generating test data:

```typescript
import { createMockUser, createMockTimelineNode, createMockInsight } from '../test/factories';

// Single item with defaults
const user = createMockUser();

// Override specific fields
const customUser = createMockUser({
  overrides: { email: 'custom@example.com', firstName: 'Custom' }
});

// Generate multiple items
const users = createMockUsers(5, {
  overrides: (index) => ({ email: `user${index}@example.com` })
});
```

**Available Factories**:
- `createMockUser` / `createMockUsers`
- `createMockOrganization` / `createMockOrganizations`
- `createMockTimelineNode` / `createMockTimelineNodes`
- `createMockJobNode` / `createMockEducationNode`
- `createMockHierarchyNode` / `createMockHierarchyNodes`
- `createMockInsight` / `createMockInsights`
- `createMockProfileData`
- `createMockNodePolicy`

### Mock Data

**Location**: `src/mocks/mock-data.ts`

Centralized mock data used by MSW handlers:

```typescript
import { mockOrganizations, mockUsers, mockTimelineNodes } from '../mocks/mock-data';

// Use in tests for assertions
expect(result).toEqual(mockOrganizations[0]);

// Use in handlers for consistent responses
return HttpResponse.json(mockOrganizations);
```

**Key Data Sets**:
- `mockOrganizations` - 3 orgs (Syracuse U, U Maryland, PayPal)
- `mockUsers` - 7 users with varied roles and companies
- `mockTimelineNodes` - Sample job/education nodes
- `mockTimelineNodesJson` - Full node hierarchy with IDs

## Core Patterns

### Pattern 1: Basic Component Test

```typescript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render content', () => {
    renderWithProviders(<MyComponent />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Pattern 2: User Interaction Test

```typescript
it('should handle click', async () => {
  const { user } = renderWithProviders(<MyComponent />);

  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(screen.getByText('Submitted')).toBeInTheDocument();
});
```

### Pattern 3: Async Data Fetching

```typescript
it('should load data', async () => {
  renderWithProviders(<MyComponent />, {
    handlers: [
      http.get('/api/data', () => {
        return HttpResponse.json({ data: ['item1', 'item2'] });
      })
    ]
  });

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  expect(screen.getByText('item1')).toBeInTheDocument();
});
```

## MSW Handler Patterns

### Handler Structure

All MSW handlers follow this pattern:

```typescript
// src/mocks/my-feature-handlers.ts
import { http, HttpResponse } from 'msw';

// Internal state management
let dataStore: Map<string, DataType> = new Map();

// Reset function for tests
export function resetMyFeatureState() {
  dataStore = new Map();
}

// Helper functions
function generateMockData(params: any): DataType {
  // ...
}

export const myFeatureHandlers = [
  // GET - Read operations
  http.get('/api/resource/:id', ({ params }) => {
    const data = dataStore.get(params.id);
    if (!data) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({ success: true, data });
  }),

  // POST - Create operations
  http.post('/api/resource', async ({ request }) => {
    const body = await request.json();
    const newData = generateMockData(body);
    dataStore.set(newData.id, newData);
    return HttpResponse.json({ success: true, data: newData }, { status: 201 });
  }),

  // PUT/PATCH - Update operations
  http.put('/api/resource/:id', async ({ params, request }) => {
    const body = await request.json();
    const existing = dataStore.get(params.id);
    if (!existing) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    dataStore.set(params.id, updated);
    return HttpResponse.json({ success: true, data: updated });
  }),

  // DELETE - Delete operations
  http.delete('/api/resource/:id', ({ params }) => {
    const existed = dataStore.delete(params.id);
    if (!existed) {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json(null, { status: 204 });
  })
];
```

### Handler Testing Pattern

```typescript
// src/mocks/my-feature-handlers.test.tsx
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { myFeatureHandlers, resetMyFeatureState } from './my-feature-handlers';

describe('My Feature Handlers', () => {
  beforeEach(() => {
    resetMyFeatureState();
  });

  describe('POST /api/resource', () => {
    it('should create resource', async () => {
      const TestComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const createResource = async () => {
          const response = await fetch('/api/resource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test' })
          });
          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={createResource}>Create</button>
            {result && (
              <>
                <div data-testid="success">{result.success ? 'success' : 'failure'}</div>
                <div data-testid="name">{result.data?.name}</div>
              </>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TestComponent />, {
        handlers: myFeatureHandlers
      });

      await user.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
        expect(screen.getByTestId('name')).toHaveTextContent('Test');
      });
    });
  });
});
```

### Existing Handler Examples

#### Career Update Handlers
**Location**: `src/mocks/career-update-handlers.ts` + `.test.tsx`

Handles CRUD operations for career transition updates:
- **12 tests** covering create, read, update, delete, pagination
- **State management**: In-memory Map for CRUD operations
- **Seeding**: `seedCareerUpdates()` for test setup
- **Rendered text**: Generates human-readable activity summaries

#### Permission Handlers
**Location**: `src/mocks/permission-handlers.ts` + `.test.tsx`

Handles node sharing and permission management:
- **17 tests** covering permissions CRUD, bulk operations, search
- **Scenario support**: `setMockPermissionsScenario()` for different permission states
- **Search**: User and organization search endpoints
- **Bulk operations**: Multi-node permission management

#### Auth Handlers
**Location**: `src/mocks/auth-handlers.ts`

Comprehensive auth flow handlers:
- Login/logout (signin/signout endpoints)
- Registration (signup endpoint)
- Token refresh
- Profile updates (PATCH /api/auth/profile)
- Onboarding flow
- Password management

#### Search Handlers
**Location**: `src/mocks/search-handlers.ts` + `.test.tsx`

Search and experience matching:
- Basic search with pagination
- Advanced search with filters
- Experience matching for nodes
- Search suggestions/autocomplete
- Search history management

## Component Testing Patterns

### Pattern: Component with MSW

```typescript
import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { InsightCard } from './InsightCard';
import { createMockInsight } from '../test/factories';

describe('InsightCard', () => {
  it('should render insight', () => {
    const mockInsight = createMockInsight({
      overrides: { description: 'Test insight' }
    });

    renderWithProviders(
      <InsightCard insight={mockInsight} nodeId="job-1" />,
      {
        handlers: [
          http.delete('/api/v2/timeline/insights/:insightId', () => {
            return HttpResponse.json({ success: true });
          })
        ]
      }
    );

    expect(screen.getByText('Test insight')).toBeInTheDocument();
  });
});
```

**Key Points**:
- Use `renderWithProviders` instead of plain `render()`
- Import `http` and `HttpResponse` from `renderWithProviders` re-exports
- Use factories to create mock data
- Provide MSW handlers via `handlers` option
- No need for `vi.mock()` - use MSW for API mocking

### Pattern: Component Migration Checklist

When migrating existing component tests to use `renderWithProviders`:

1. ✅ Replace `render()` with `renderWithProviders()`
2. ✅ Replace `userEvent.setup()` with `{ user }` from renderWithProviders
3. ✅ Remove `vi.mock()` for API/hook mocks
4. ✅ Add MSW handlers via `handlers` option
5. ✅ Import `http`, `HttpResponse` from renderWithProviders
6. ✅ Use factories for test data instead of inline objects

**Before**:
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../hooks/useNodeInsights', () => ({
  useNodeInsights: () => ({ data: mockData })
}));

const user = userEvent.setup();
render(<Component />);
```

**After**:
```typescript
import { screen } from '@testing-library/react';
import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';

const { user } = renderWithProviders(<Component />, {
  handlers: [
    http.get('/api/insights', () => HttpResponse.json(mockData))
  ]
});
```

## Store Testing Patterns

### Pattern: Zustand Store Test

```typescript
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { useMyStore } from '../stores/my-store';

describe('MyStore', () => {
  // Test component to interact with store
  const TestComponent = () => {
    const { data, fetchData, updateData } = useMyStore();

    return (
      <div>
        <div data-testid="data">{data?.name || 'empty'}</div>
        <button onClick={fetchData}>Fetch</button>
        <button onClick={() => updateData({ name: 'updated' })}>Update</button>
      </div>
    );
  };

  it('should fetch and update data', async () => {
    const { user } = renderWithProviders(<TestComponent />, {
      handlers: [
        http.get('/api/data', () => {
          return HttpResponse.json({ name: 'fetched' });
        }),
        http.patch('/api/data', () => {
          return HttpResponse.json({ name: 'updated' });
        })
      ]
    });

    // Initial state
    expect(screen.getByTestId('data')).toHaveTextContent('empty');

    // Fetch data
    await user.click(screen.getByText('Fetch'));
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('fetched');
    });

    // Update data
    await user.click(screen.getByText('Update'));
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('updated');
    });
  });
});
```

**Key Points**:
- Create test components to interact with stores
- Use MSW handlers for API calls made by stores
- Use `waitFor()` for async store updates
- Use `await user.click()` - always await user interactions
- Test observable behavior, not internal store state

### Pattern: Store with Initial State

```typescript
it('should work with authenticated user', async () => {
  const mockUser = createMockUser();

  const { user } = renderWithProviders(<TestComponent />, {
    authState: { user: mockUser, isAuthenticated: true }
  });

  expect(screen.getByTestId('username')).toHaveTextContent(mockUser.userName);
});
```

## Hook Testing Patterns

### Pattern: Simple Hook Test

```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });
});
```

### Pattern: Hook with Fake Timers

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // Initial value
    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });

    // Value should not update immediately
    expect(result.current).toBe('initial');

    // Advance time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });
});
```

**Critical Points**:
- ⚠️ **DO NOT use `waitFor()` with fake timers** - it will timeout
- ✅ **DO use `act(() => vi.advanceTimersByTime())`** instead
- ✅ Tests should be **synchronous** when using fake timers
- ✅ Always `vi.restoreAllMocks()` in afterEach

## Common Patterns

### Pattern: Waiting for Element

```typescript
// Wait for loading to complete
await waitFor(() => {
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### Pattern: Query Priorities

```typescript
// ✅ Prefer accessible queries
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText('Email')
screen.getByPlaceholderText('Enter email')

// ✅ Use getByText for non-interactive content
screen.getByText('Hello World')

// ⚠️ Use data-testid as last resort
screen.getByTestId('custom-element')
```

### Pattern: Async User Interactions

```typescript
// ✅ Always await user interactions
await user.click(button);
await user.type(input, 'text');
await user.selectOptions(select, 'option');

// ✅ Then wait for effects
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

### Pattern: Form Submission

```typescript
it('should submit form', async () => {
  const { user } = renderWithProviders(<FormComponent />, {
    handlers: [
      http.post('/api/form', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ success: true, data: body });
      })
    ]
  });

  await user.type(screen.getByLabelText('Name'), 'John Doe');
  await user.type(screen.getByLabelText('Email'), 'john@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### Pattern: Error Handling

```typescript
it('should handle errors', async () => {
  const { user } = renderWithProviders(<Component />, {
    handlers: [
      http.get('/api/data', () => {
        return HttpResponse.json(
          { error: 'Something went wrong' },
          { status: 500 }
        );
      })
    ]
  });

  await user.click(screen.getByText('Load Data'));

  await waitFor(() => {
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Issue: "React is not defined"

**Problem**: Using `React.useState` without importing React

**Solution**:
```typescript
import React from 'react';

const TestComponent = () => {
  const [state, setState] = React.useState(null); // ✅
  // ...
};
```

### Issue: Test Timeout with waitFor

**Problem**: `waitFor()` timing out with fake timers

**Solution**: Don't use `waitFor()` with fake timers. Use `act()` instead:

```typescript
// ❌ This will timeout
await waitFor(() => {
  expect(result.current).toBe('updated');
});

// ✅ This works
act(() => {
  vi.advanceTimersByTime(500);
});
expect(result.current).toBe('updated');
```

### Issue: "element is not defined"

**Problem**: Trying to assert on element before it exists

**Solution**: Use `waitFor()` or query methods:

```typescript
// ❌ May fail if element doesn't exist yet
expect(screen.getByText('Text')).toBeInTheDocument();

// ✅ Wait for it
await waitFor(() => {
  expect(screen.getByText('Text')).toBeInTheDocument();
});

// ✅ Or check if it doesn't exist
expect(screen.queryByText('Text')).not.toBeInTheDocument();
```

### Issue: MSW Handler Not Matching

**Problem**: Requests not being intercepted by MSW

**Debugging**:
1. Check handler is in `handlers` array
2. Verify URL exactly matches (including leading slash)
3. Check HTTP method matches (GET, POST, etc.)
4. Look for "Unhandled request" warnings in console

**Solution**:
```typescript
// ❌ Wrong - missing leading slash
http.get('api/data', ...)

// ✅ Correct - includes leading slash
http.get('/api/data', ...)

// ✅ Or use absolute URL
http.get('http://localhost:3000/api/data', ...)

// ✅ Pass handlers to renderWithProviders
renderWithProviders(<Component />, {
  handlers: [myHandler]
});
```

### Issue: "Cannot find module" for Schema Types

**Problem**: Import errors for `@journey/schema` types

**Solution**: This is a known package resolution issue. Document the issue and use alternative approaches:
- Import types directly from schema package if available
- Use type inference from factory functions
- Define inline types as needed

### Issue: Store State Not Resetting Between Tests

**Problem**: Store retains state from previous tests

**Solution**: Use store reset in beforeEach:

```typescript
beforeEach(() => {
  useMyStore.getState().reset(); // if store has reset method
  // or
  useMyStore.setState(initialState);
});
```

### Issue: User Events Not Working

**Problem**: `user.click()` or `user.type()` not triggering expected behavior

**Solution**:
- Always `await` user interactions
- Check element is not disabled
- Verify element is in document: `screen.debug()`

```typescript
// ❌ Missing await
user.click(button);

// ✅ With await
await user.click(button);

// Debug to see current DOM state
screen.debug();
```

## Test Coverage Summary

### ✅ Completed

- **MSW Handlers** (50+ tests)
  - ✅ Auth handlers (coverage via store tests)
  - ✅ Search handlers (11 tests)
  - ✅ Career update handlers (12 tests)
  - ✅ Permission handlers (17 tests)

- **Stores** (67+ tests)
  - ✅ Auth store (26 tests)
  - ✅ Hierarchy store (24 tests)
  - ✅ Profile review store (19 tests)

- **Hooks** (8+ tests)
  - ✅ use-debounce (8 tests)

- **Infrastructure**
  - ✅ renderWithProviders helper
  - ✅ Test factories (20+ factory functions)
  - ✅ Centralized mock data

### 🚧 In Progress / Blocked

- **Component Tests** (20+ files)
  - ⚠️ Migration blocked by @journey/components package issue
  - ✅ Pattern established in InsightCard.test.tsx
  - Remaining: Timeline components, node cards, forms, etc.

## Additional Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Zustand Testing](https://docs.pmnd.rs/zustand/guides/testing)

## Contributing

When adding new test patterns:

1. Follow existing patterns in this document
2. Add examples with ✅/❌ indicators
3. Document any gotchas or edge cases
4. Update the test coverage summary
5. Add to memory.md for future reference

---

**Questions or Issues?** Check memory.md for detailed implementation notes and troubleshooting steps.
