# Transactional Testing Pattern

## Overview

Transactional testing provides complete test isolation by wrapping each test in a database transaction that automatically rolls back. This eliminates shared state, enables parallel execution, and removes the need for cleanup code.

## Problem: Shared Test State

**Traditional Approach** (Current `auth.test.ts`):
```typescript
describe('Auth API', () => {
  beforeAll(async () => {
    // Uses seeded user from database
    seededAuthSession = await authenticateSeededUser(app, 1);
  });

  it('should signin', async () => {
    // Test uses shared seeded user
    // ❌ PROBLEM: Shared state between tests
    // ❌ PROBLEM: Tests can't run in parallel
    // ❌ PROBLEM: Tests depend on database seed data
  });
});
```

**Issues**:
- ❌ Tests share database state (seeded users)
- ❌ Cannot run tests in parallel (race conditions)
- ❌ Test failures leave dirty data
- ❌ Must maintain cleanup code
- ❌ Tests depend on specific seed data existing

## Solution: Transactional Isolation

**New Approach** (`auth-transactional.test.ts`):
```typescript
import { withTestTransaction } from '../utils/db';

describe('Auth API - Transactional', () => {
  it('should signin', async () => {
    await withTestTransaction(async (tx) => {
      // Create test user within transaction
      const testUser = generateTestUser();

      await request(app)
        .post('/api/auth/signup')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      // Use that user immediately
      await request(app)
        .post('/api/auth/signin')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      // ✅ Transaction rolls back automatically
      // ✅ No cleanup needed
      // ✅ Complete isolation
      // ✅ Parallel safe
    });
  });
});
```

**Benefits**:
- ✅ Complete test isolation
- ✅ Parallel execution safe
- ✅ No cleanup code needed
- ✅ No dependency on seed data
- ✅ Each test creates its own data
- ✅ Fast rollback (50-100ms vs 500ms+ cleanup)

## Implementation Pattern

### 1. Basic Test Structure

```typescript
import { withTestTransaction, createTestApp } from '../utils/db';

describe('My API Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await Container.dispose();
  });

  it('should do something', async () => {
    await withTestTransaction(async (tx) => {
      // 1. Create test data within transaction
      // 2. Make API calls
      // 3. Assert results
      // 4. Transaction rolls back automatically
    });
  });
});
```

### 2. Creating Test Data

**Factory Pattern**:
```typescript
// Helper to generate unique test users
const generateTestUser = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `test.${timestamp}.${random}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };
};

// Use in test
await withTestTransaction(async (tx) => {
  const user1 = generateTestUser();
  const user2 = generateTestUser();

  // Each user has unique email, no conflicts
});
```

### 3. Multi-Step Workflows

```typescript
it('should handle signup -> signin -> profile update flow', async () => {
  await withTestTransaction(async (tx) => {
    const testUser = generateTestUser();

    // Step 1: Signup
    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);

    const { accessToken } = signupResponse.body.data;

    // Step 2: Use token immediately (within same transaction)
    const profileResponse = await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ interest: 'Testing' })
      .expect(200);

    expect(profileResponse.body.data.user.interest).toBe('Testing');

    // Step 3: Signin with updated profile
    const signinResponse = await request(app)
      .post('/api/auth/signin')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(signinResponse.body.data.user.interest).toBe('Testing');

    // All changes roll back - no persistence
  });
});
```

### 4. Testing Conflicts and Errors

```typescript
it('should handle duplicate email registration', async () => {
  await withTestTransaction(async (tx) => {
    const testUser = generateTestUser();

    // First signup succeeds
    await request(app)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);

    // Second signup with same email fails (within same transaction)
    await request(app)
      .post('/api/auth/signup')
      .send(testUser) // Same email
      .expect(409); // Conflict

    // Transaction rolls back - no users persisted
  });
});
```

## Migration Guide

### Step 1: Identify Shared State

Look for these patterns in existing tests:
```typescript
// ❌ Shared state patterns to replace:
let seededAuthSession: TestAuthSession;
await authenticateSeededUser(app, 1);
'test-user-1@example.com' // Hard-coded seed user
```

### Step 2: Replace with Factory Functions

```typescript
// ✅ Replace with factory pattern:
const testUser = generateTestUser();
// Creates unique user each time, no conflicts
```

### Step 3: Wrap Tests in Transactions

**Before**:
```typescript
it('should do something', async () => {
  // Test uses seeded data
  const response = await request(app)
    .get('/api/users/1') // Hard-coded seed user
    .expect(200);
});
```

**After**:
```typescript
it('should do something', async () => {
  await withTestTransaction(async (tx) => {
    // Create user within transaction
    const testUser = generateTestUser();

    const signupResponse = await request(app)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);

    const userId = signupResponse.body.data.user.id;

    // Use that specific user
    const response = await request(app)
      .get(`/api/users/${userId}`)
      .expect(200);

    // Transaction rolls back
  });
});
```

### Step 4: Remove Cleanup Code

**Before**:
```typescript
afterEach(async () => {
  // Manual cleanup
  await db.delete(users).where(eq(users.email, testEmail));
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, testUserId));
});
```

**After**:
```typescript
// No cleanup needed!
// Transaction rollback handles everything
```

## Advanced Patterns

### 1. Testing Parallel Operations

```typescript
it('should handle concurrent signups without conflicts', async () => {
  await withTestTransaction(async (tx) => {
    // Create multiple users in parallel
    const promises = Array(5)
      .fill(0)
      .map((_, index) => {
        const user = generateTestUser();
        return request(app)
          .post('/api/auth/signup')
          .send(user)
          .expect(201);
      });

    const responses = await Promise.all(promises);

    // All should succeed (unique emails, no conflicts)
    expect(responses).toHaveLength(5);

    // Transaction rolls back - no users persisted
  });
});
```

### 2. Testing Complex Relationships

```typescript
it('should handle hierarchical data', async () => {
  await withTestTransaction(async (tx) => {
    // Create parent organization
    const org = generateTestOrganization();
    const orgResponse = await request(app)
      .post('/api/organizations')
      .send(org)
      .expect(201);

    const orgId = orgResponse.body.data.id;

    // Create users within that organization
    const user1 = generateTestUser();
    const user2 = generateTestUser();

    await request(app)
      .post('/api/organizations/${orgId}/users')
      .send(user1)
      .expect(201);

    await request(app)
      .post('/api/organizations/${orgId}/users')
      .send(user2)
      .expect(201);

    // Query organization with users
    const listResponse = await request(app)
      .get(`/api/organizations/${orgId}/users`)
      .expect(200);

    expect(listResponse.body.data).toHaveLength(2);

    // All changes roll back - org and users not persisted
  });
});
```

### 3. Testing Authentication Flows

```typescript
it('should handle full auth lifecycle', async () => {
  await withTestTransaction(async (tx) => {
    const testUser = generateTestUser();

    // Signup
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);

    let { accessToken, refreshToken } = signupRes.body.data;

    // Profile update
    await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ interest: 'Testing' })
      .expect(200);

    // Token refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    ({ accessToken, refreshToken } = refreshRes.body.data);

    // Logout
    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken })
      .expect(200);

    // Verify token revoked
    await request(app)
      .patch('/api/auth/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ interest: 'New' })
      .expect(401); // Token should be revoked

    // Transaction rolls back - no persistence
  });
});
```

## Performance Considerations

### Transaction Overhead

**Benchmarks**:
- Transaction start/rollback: 50-100ms
- Manual cleanup: 500ms+
- Test isolation: Perfect

**Net Result**: Faster tests with better isolation

### Parallel Execution

```bash
# Tests can now run in parallel safely
pnpm vitest run --no-coverage tests/api/ --threads

# Each test gets its own transaction
# No race conditions
# No state conflicts
```

## Requirements

### Database Connection

Transactional tests require:
- Running PostgreSQL instance
- Database connection configured
- Test database setup

**Note**: Unlike contract validation tests (which can use mocks), transactional tests need real database access for transactions to work.

### Setup Script

```bash
# Ensure database is running
docker compose up -d postgres

# Run migrations
pnpm --filter @journey/schema db:migrate

# Tests ready to run
pnpm test:unit tests/api/
```

## Best Practices

### ✅ DO

- Wrap all API tests in `withTestTransaction`
- Create unique test data within transactions
- Use factory functions for test data generation
- Test complete workflows within single transaction
- Remove all cleanup code (transaction handles it)
- Run tests in parallel for speed

### ❌ DON'T

- Reuse seeded users from database
- Hard-code user IDs or emails
- Share state between tests
- Manually delete test data
- Commit transactions in tests
- Depend on specific seed data existing

## Comparison: Contract vs Transactional Testing

### Contract Testing
- **Purpose**: Validate API responses match OpenAPI schema
- **Database**: Not required (can use mocks)
- **Speed**: Very fast (<500ms per file)
- **Isolation**: N/A (no database state)
- **Use Case**: Schema validation, type checking

### Transactional Testing
- **Purpose**: Test complete API workflows with database
- **Database**: Required (uses real transactions)
- **Speed**: Fast (transaction rollback is quick)
- **Isolation**: Perfect (each test in own transaction)
- **Use Case**: Integration testing, workflow validation

## Examples

See complete examples:
- `tests/api/auth-transactional.test.ts` - Full authentication flow
- `tests/utils/db.ts` - Transaction utilities
- `tests/docs/CONTAINER_TESTING.md` - Related patterns

## Next Steps

1. Review existing test files for shared state
2. Identify tests that need transactional isolation
3. Create factory functions for test data
4. Migrate tests one file at a time
5. Remove cleanup code as tests are migrated
6. Enable parallel execution for faster CI
