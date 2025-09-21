# Test System Documentation

## 🎯 Overview

This test system provides isolated, consistent, and maintainable testing for the career agent functionality using dedicated test data management.

## 🏗️ Architecture

### Test User Management

- **Test User ID**: 999 (dedicated test user)
- **Data Source**: Based on User 19's profile structure
- **Isolation**: Fresh data reset before each test
- **Cleanup**: Automatic cleanup after test suite completion

### Components

#### TestDatabaseManager (`utils/test-database.ts`)

Manages test user data lifecycle:

```typescript
const testDb = TestDatabaseManager.getInstance();
await testDb.setupTestUser(); // Create test user with template data
await testDb.resetTestUserData(); // Reset to fresh state
await testDb.cleanupTestUser(); // Remove test user completely
```

#### Global Setup/Teardown (`setup/`)

- `global-setup.ts`: Creates test user once before all tests
- `global-teardown.ts`: Cleans up test user after all tests

#### Test Fixtures (removed)

- Test template files have been removed as they are no longer used

## 📊 Test Data

### Test User Profile

Based on User 19 data with anonymization:

- **Email**: `test-user@example.com`
- **User ID**: 999
- **Experiences**: 4 career experiences
- **Projects**: Multiple projects across experiences
- **Skills**: Variable skill records

### Data Reset Strategy

Each test starts with identical, fresh data:

1. Delete existing test user data
2. Re-create from templates
3. Test executes with known state
4. Next test repeats the cycle

## 🚀 Usage

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- basic-scenarios

# Run single test
npm test -- --testNamePattern="should add project to TechCorp"
```

### Writing New Tests

```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { TestDatabaseManager } from '../utils/test-database.js';
import { processCareerConversation } from '../../services/ai/simplified-career-agent.js';

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID;

describe('My Test Suite', () => {
  beforeEach(async () => {
    const testDb = TestDatabaseManager.getInstance();
    await testDb.resetTestUserData();
  }, 60000);

  test('should perform some action', async () => {
    const result = await processCareerConversation({
      message: 'Test message',
      userId: TEST_USER_ID.toString(),
      threadId: `test-${Date.now()}`,
    });

    expect(result.updatedProfile).toBe(true);
  });
});
```

## 📁 Test Structure

```
server/tests/
├── add-project-to-experience/          # Test scenarios
│   ├── basic-scenarios.test.ts         # Core functionality
│   ├── conversation-flow.test.ts       # Conversation handling
│   ├── insufficient-details.test.ts    # Missing data scenarios
│   ├── multiple-roles.test.ts          # Role disambiguation
│   ├── novel-companies.test.ts         # New company handling
│   └── edge-cases.test.ts             # Error conditions
├── fixtures/                          # Test data templates
│   ├── test-user-template.json
│   ├── test-profile-template.json
│   └── test-skills-template.json
├── setup/                             # Global hooks
│   ├── global-setup.ts
│   └── global-teardown.ts
└── utils/                             # Test utilities
    ├── test-database.ts               # Database management
    └── export-user-data.ts           # Data export utility
```

## ⚡ Performance

### Before vs After

- **Before**: 30s+ per test (database init overhead)
- **After**: ~30s for first test, faster subsequent tests
- **Isolation**: 100% guaranteed fresh data per test
- **Reliability**: No test pollution or side effects

### Optimization Opportunities

- Mock vector database operations for faster unit tests
- Implement database transactions for instant rollback
- Cache database connections between tests

## 🔧 Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globalSetup: ['./server/tests/setup/global-setup.ts'],
    globalTeardown: ['./server/tests/setup/global-teardown.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    // ... other config
  },
});
```

### Environment Variables

- `NODE_ENV=test`: Ensures test environment
- `DATABASE_URL`: Points to test database

## 🔍 Troubleshooting

### Common Issues

#### Test User Already Exists

```
Error: duplicate key value violates unique constraint
```

**Solution**: Run cleanup manually:

```typescript
const testDb = TestDatabaseManager.getInstance();
await testDb.cleanupTestUser();
```

#### Template Files Missing

```
Error: Failed to load test templates
```

**Solution**: Re-export test data:

```bash
npx tsx server/tests/utils/export-user-data.ts
```

#### Vector Store Errors

```
Error: Index user_entities not found
```

**Solution**: Vector store initialization may take time, increase timeouts

### Debug Mode

Enable verbose logging by running:

```bash
DEBUG=test:* npm test
```

## 📋 Best Practices

### Test Design

- Use AAA pattern (Arrange, Act, Assert)
- Include scenario comments explaining test purpose
- Use descriptive test names
- Test both success and failure paths

### Data Management

- Never hardcode User IDs other than TEST_USER_ID
- Always use `beforeEach` for data reset
- Don't assume test execution order
- Clean up any additional test data created

### Performance

- Use appropriate timeouts (60s for agent tests)
- Avoid unnecessary database queries in tests
- Group related tests in same describe block
- Consider mocking for pure unit tests

## 🚨 Safety

### Production Protection

- Test User ID 999 is dedicated for testing
- Templates use anonymized data
- No real user PII in test fixtures
- Separate test database recommended

### Data Isolation

- Each test starts with identical data
- No cross-test contamination
- Automatic cleanup prevents data leaks
- Vector store data is managed per test user

## 📈 Future Enhancements

### Phase 2 Opportunities

1. **Database Transactions**: Instant rollback instead of delete/recreate
2. **Parallel Testing**: Separate test users per parallel thread
3. **Mock Integration**: Selective mocking for unit vs integration tests
4. **Performance Monitoring**: Track test execution times and trends

### Monitoring

- Test execution time tracking
- Data consistency validation
- Error rate monitoring
- Resource usage optimization

---

## ✅ Migration Complete

The test system has been successfully migrated from hardcoded User 17 to the managed Test User 999 system, providing:

- **Isolated Test Data**: Fresh, consistent data for every test
- **Improved Reliability**: No test interference or flaky failures
- **Better Maintainability**: Centralized test data management
- **Performance Baseline**: Foundation for future optimizations

All tests now use the TestDatabaseManager for consistent, isolated testing with automatic cleanup.
