# Testing Guide

This document explains the testing philosophy and practices for the UI package.

## Testing Philosophy

**We focus on unit tests that test real component logic**, not just rendering.

### ✅ Good Unit Tests

- Test actual business logic and data transformations
- Test user workflows and state changes
- Test error handling and edge cases
- Mock only external dependencies (APIs, external services)
- Verify behavior, not implementation details

### ❌ Avoid

- Tests that only check "component renders"
- Over-mocking (mocking everything makes tests worthless)
- Testing implementation details (CSS classes, internal state names)
- Shallow tests that don't exercise actual logic

## Test Structure

**Configuration**: `vitest.config.unit.ts`
**Setup File**: `src/test/setup.ts`
**Location**: `src/**/*.test.{ts,tsx}`

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Open coverage report
pnpm coverage:html
```

## Writing Good Component Tests

### Example: Testing Form Logic

```typescript
// ❌ BAD - Only tests rendering
it('should render title input', () => {
  render(<MyForm />);
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
});

// ✅ GOOD - Tests actual logic
it('should validate title and show error on submit', async () => {
  const user = userEvent.setup();
  const mockOnSubmit = vi.fn();

  render(<MyForm onSubmit={mockOnSubmit} />);

  // Try to submit without title
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Should show validation error
  expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  expect(mockOnSubmit).not.toHaveBeenCalled();

  // Fill title and submit
  await user.type(screen.getByLabelText(/title/i), 'My Title');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Should call onSubmit with correct data
  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith({
      title: 'My Title'
    });
  });
});
```

### Mocking Guidelines

**Mock external dependencies:**

- API clients (`vi.mock('../services/api')`)
- External libraries with side effects
- Browser APIs (localStorage, fetch) - already mocked in test setup

**Don't mock:**

- Components under test
- Pure utility functions
- React hooks (unless they have external dependencies)
- Child components (test integration, not isolation)

## Test Factories

Use test factories in `src/test/factories/` to create test data:

```typescript
import { createMockUser, createMockTimelineNode } from '@/test/factories';

const user = createMockUser({ email: 'test@example.com' });
const node = createMockTimelineNode({
  type: 'job',
  title: 'Software Engineer',
});
```

## Coverage Goals

**Target**: 80% coverage for components, hooks, and utils

**Current Coverage**: Run `pnpm coverage:html` to see detailed report

**Focus Areas**:

1. **Components**: Test user interactions and state changes
2. **Hooks**: Test state management and side effects
3. **Utils**: Test pure functions and transformations
4. **Services**: Test API interactions (with mocked HTTP)
5. **Stores**: Test Zustand stores and persistence

## Common Patterns

### Testing Forms

```typescript
describe('MyForm', () => {
  it('should handle form submission', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = vi.fn();

    render(<MyForm onSubmit={mockOnSubmit} />);

    // Fill form
    await user.type(screen.getByLabelText(/name/i), 'John');
    await user.type(screen.getByLabelText(/email/i), 'john@test.com');

    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Verify
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@test.com'
      });
    });
  });
});
```

### Testing Async State

```typescript
describe('MyComponent', () => {
  it('should load data on mount', async () => {
    const mockData = [{ id: 1, name: 'Item 1' }];
    vi.mocked(api.fetchData).mockResolvedValue(mockData);

    render(<MyComponent />);

    // Should show loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Should show data after loading
    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });
  });
});
```

### Testing Error Handling

```typescript
describe('MyComponent', () => {
  it('should display error message on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveData).mockRejectedValue(new Error('Network error'));

    render(<MyComponent />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Hooks

```typescript
describe('useMyHook', () => {
  it('should manage state correctly', () => {
    const { result } = renderHook(() => useMyHook());

    // Initial state
    expect(result.current.value).toBe(0);

    // Update state
    act(() => {
      result.current.increment();
    });

    // Verify new state
    expect(result.current.value).toBe(1);
  });
});
```

## Troubleshooting

### Tests are slow

- Check if you're using `waitFor` unnecessarily
- Reduce timeouts in test setup
- Mock expensive operations

### Tests are flaky

- Use `waitFor` for async operations
- Don't rely on timers - use `vi.useFakeTimers()` if needed
- Ensure proper cleanup in `beforeEach`/`afterEach`

### Can't find elements

- Use `screen.debug()` to see rendered output
- Check that you're using correct queries (`getByRole`, `getByLabelText`, etc.)
- Verify element is visible (not `display: none`)

## Best Practices

1. **Test behavior, not implementation** - Focus on what users see and do
2. **Keep tests readable** - Use descriptive test names and clear arrange/act/assert
3. **One assertion per concept** - Test one thing at a time
4. **Use factories** - Create test data with factories, not inline objects
5. **Avoid magic numbers** - Use named constants for test data
6. **Test edge cases** - Empty states, errors, loading states
7. **Keep tests fast** - Mock slow operations, avoid unnecessary waits

## Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest Docs](https://vitest.dev/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
