# Networks Tab Implementation Learnings

## Date: 2025-01-17

## Feature: LIG-170 - Share Modal Networks Tab

## Key Architectural Decisions

### 1. Centralized MSW Mock Data Architecture

**Problem**: Tests were using manually mocked data directly in stores instead of fetching from APIs, leading to:

- Inconsistent data between handlers and tests
- Difficult to maintain multiple test scenarios
- Not following MSW best practices

**Solution**: Created centralized mock data architecture with:

- `client/src/mocks/mock-data.ts` - Single source of truth for all test data
- Factory/builder functions for API responses
- Scenario-based permission mocking

**Implementation Pattern**:

```typescript
// mock-data.ts
export const mockOrganizations: Organization[] = [...];
export const mockTimelineNodes: TimelineNode[] = [...];
export const mockNodePolicies: Record<string, NodePolicy[]> = {
  empty: [],
  allOrganizations: [...]
};

// Builder functions
export function buildBulkPermissionsResponse(nodeIds, scenario) {...}
export function buildOrganizationsResponse() {...}
```

### 2. Store Architecture - Global vs Feature State

**Decision**: Move organizations from share-store to auth-store

**Reasoning**:

- Organizations are global app data (like user info)
- Needed across multiple features, not just sharing
- Loaded once at login/auth check
- Persisted in localStorage for offline access

**Implementation**:

```typescript
// auth-store.ts
interface AuthState {
  organizations: Organization[];
  isLoadingOrganizations: boolean;
  loadOrganizations: () => Promise<void>;
}
```

### 3. MSW Integration Testing Pattern

**Best Practice**: Tests should fetch data from MSW-mocked APIs, not manually set data

**Before** (Anti-pattern):

```typescript
beforeEach(() => {
  const store = useShareStore.getState();
  store.openModal(mockNodes); // Manually setting nodes
});
```

**After** (Correct pattern):

```typescript
beforeEach(async () => {
  // Fetch from MSW-mocked API
  const nodes = await hierarchyApi.listNodes();
  const store = useShareStore.getState();
  store.openModal(nodes);
});
```

### 4. Scenario-Based Test Data Management

**Pattern**: Use scenarios to switch between different test states

```typescript
// Helper functions in permission-handlers.ts
export const setMockPermissionsScenario = (
  scenario: 'empty' | 'allOrganizations'
) => {
  if (scenario === 'empty') {
    mockPermissions = [];
  } else if (scenario === 'allOrganizations') {
    mockPermissions = [...mockNodePolicies.allOrganizations];
  }
};

// Usage in tests
setMockPermissionsScenario('allOrganizations');
```

## Technical Learnings

### 1. MSW Handler Organization

**Best Practice**: Handlers should be feature-focused and use centralized data

- `profile-handlers.ts` - Profile and timeline node endpoints
- `permission-handlers.ts` - Permission and organization endpoints
- Each handler imports from `mock-data.ts` for consistency

### 2. API Response Format Considerations

**Learning**: Different endpoints may expect different formats for the same data

Example:

- `/api/v2/timeline/nodes` without username returns array of nodes
- `/api/v2/timeline/nodes?username=X` returns ProfileResponse object

Solution: Conditionally return different formats based on query parameters:

```typescript
if (!username) {
  return HttpResponse.json(mockTimelineNodesJson); // Array format
}
// else return ProfileResponse format
```

### 3. TypeScript Type Safety with Mock Data

**Pattern**: Create separate JSON-serializable versions for API responses

```typescript
// For TypeScript type checking
export const mockTimelineNodes: TimelineNode[] = [...];

// For API responses (dates as strings)
export const mockTimelineNodesJson = mockTimelineNodes.map(node => ({
  ...node,
  createdAt: node.createdAt.toISOString(),
  updatedAt: node.updatedAt.toISOString(),
}));
```

## Testing Best Practices Discovered

### 1. Component Testing with MSW

- Always reset mock permissions in `beforeEach`
- Load organizations through store actions (uses MSW)
- Wait for async operations with `waitFor`
- Use `act` for state updates

### 2. Assertion Patterns for Access Levels

```typescript
// Test multiple access levels in one test
const limitedElements = screen.getAllByText('Limited access');
expect(limitedElements).toHaveLength(2); // Syracuse and PayPal

expect(screen.getByText('Full access')).toBeInTheDocument(); // Maryland
expect(screen.getByText('No access')).toBeInTheDocument(); // Public
```

### 3. ESLint and Prettier Integration

**Learning**: Pre-commit hooks will auto-format and lint

- Fix unused variables before committing
- Prettier will auto-format (don't fight it)
- Use `_` prefix for intentionally unused parameters

## Reusable Patterns

### 1. Calculating Access Levels

```typescript
const calculateAccessLevel = (orgId: number): string => {
  const permission = orgPermissions[orgId];
  if (!permission || permission.nodes.length === 0) {
    return 'No access';
  }

  const totalNodes = userNodes.length;
  const accessibleNodes = permission.nodes.length;

  if (permission.accessLevel === 'full' || accessibleNodes === totalNodes) {
    return 'Full access';
  }

  return 'Limited access';
};
```

### 2. Dynamic Icon Selection

```typescript
const getOrgIcon = (type: string) => {
  return type === 'educational_institution' ? GraduationCap : Building;
};
```

## Future Improvements

1. **Consider using @mswjs/data** for more sophisticated data modeling
2. **Add more scenarios** beyond 'empty' and 'allOrganizations'
3. **Create test utilities** for common test setup patterns
4. **Document MSW patterns** in project README

## Commands and Tools

### Running Tests

```bash
pnpm test ShareModal.networks.test.tsx
```

### Debugging MSW

- Console logs in handlers show in test output
- Use `console.log('📦 Mock response:', JSON.stringify(data, null, 2))`

### File Structure

```
client/src/
├── mocks/
│   ├── mock-data.ts          # Centralized test data
│   ├── permission-handlers.ts # Permission endpoints
│   └── profile-handlers.ts    # Profile/node endpoints
├── components/share/
│   ├── NetworksAccessSection.tsx
│   └── ShareModal.networks.test.tsx
└── stores/
    └── auth-store.ts          # Global organizations state
```

## Key Takeaways

1. **Centralize mock data** - Single source of truth prevents inconsistencies
2. **Use MSW properly** - Fetch from mocked APIs in tests, don't manually set data
3. **Think global vs feature state** - Organizations belong in auth-store, not share-store
4. **Scenario-based testing** - Makes tests more maintainable and readable
5. **Follow MSW best practices** - As confirmed by web search, centralized mocks are industry standard

## References

- [MSW Documentation](https://mswjs.io/)
- [MSW Best Practices](https://mswjs.io/docs/best-practices)
- [@mswjs/data for data modeling](https://github.com/mswjs/data)
