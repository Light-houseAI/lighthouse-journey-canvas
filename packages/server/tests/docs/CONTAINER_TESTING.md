# Container Testing Patterns

## Overview

This document describes patterns for testing the Awilix dependency injection container to ensure all services can be resolved without circular dependencies or missing registrations.

## Why Container Smoke Testing?

**Problem**: Awilix uses runtime dependency resolution, which means:
- Misconfigurations are hidden until execution
- No compile-time checking for missing registrations
- Circular dependencies only detected when services are resolved

**Solution**: Comprehensive smoke tests that resolve all container tokens with mocked infrastructure.

## Container Smoke Test Pattern

### Test Structure

```typescript
import { Container } from '../../src/core/container-setup';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mock } from 'vitest-mock-extended';

// CRITICAL: Mock infrastructure at top level (before imports)
// vi.mock is hoisted, so can't access variables from beforeAll
vi.mock('../../src/config/database.connection.js', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mock<Database>()),
  disposeDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  getPoolFromDatabase: vi.fn().mockReturnValue(mock<Pool>()),
}));

describe('Container Smoke Test', () => {
  let mockLogger: Logger;
  let resolvedTokens: Map<string, ResolutionResult>;

  beforeAll(async () => {
    // Create mock logger
    mockLogger = mock<Logger>({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    });

    // Configure container with mocked infrastructure
    await Container.configure(mockLogger);
    resolvedTokens = new Map();
  });

  afterAll(async () => {
    await Container.dispose();
  });

  it('should resolve all service tokens', () => {
    const serviceTokens = [
      'HIERARCHY_SERVICE',
      'USER_SERVICE',
      // ... all registered service tokens
    ];

    serviceTokens.forEach((tokenName) => {
      const token = CONTAINER_TOKENS[tokenName as keyof typeof CONTAINER_TOKENS];
      const startTime = performance.now();

      try {
        const resolved = Container.getContainer().resolve(token);
        const timeMs = performance.now() - startTime;

        expect(resolved).toBeDefined();
        resolvedTokens.set(tokenName, { success: true, timeMs });
      } catch (error: any) {
        const timeMs = performance.now() - startTime;
        resolvedTokens.set(tokenName, {
          success: false,
          timeMs,
          error: error.message
        });
        throw error;
      }
    });
  });
});
```

### Key Patterns

#### 1. Mock Hoisting

**Problem**: vi.mock is hoisted to top of file, can't access variables from beforeAll

**Solution**: Define mocks at top level with inline mock() calls

```typescript
// ✅ CORRECT: Mock at top level
vi.mock('../../src/config/database.connection.js', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mock<Database>()),
}));

describe('Test', () => {
  beforeAll(async () => {
    // Don't create mocks here
  });
});

// ❌ WRONG: Can't access mockDatabase from vi.mock
describe('Test', () => {
  let mockDatabase: Database;

  beforeAll(async () => {
    mockDatabase = mock<Database>();
  });
});

vi.mock('../../src/config/database.connection.js', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mockDatabase), // Error!
}));
```

#### 2. Container API

**Correct API Methods**:
- `Container.configure(logger)` - Initialize container
- `Container.getContainer()` - Get container instance
- `Container.dispose()` - Clean up container

**Common Mistakes**:
```typescript
// ❌ WRONG: getInstance doesn't exist
const container = Container.getInstance();

// ✅ CORRECT: Use getContainer
const container = Container.getContainer();
```

#### 3. Token Registration vs Definition

**Problem**: Token may be defined in CONTAINER_TOKENS but not registered in container-setup.ts

**Solution**: Verify actual registrations before testing

```bash
# Find all actually registered tokens
grep -o "CONTAINER_TOKENS\.[A-Z_]*" src/core/container-setup.ts | sort -u
```

**Test Pattern**:
```typescript
// Only test tokens that are ACTUALLY REGISTERED
const serviceTokens = [
  'USER_SERVICE',      // ✅ Registered in container-setup.ts
  'AUTH_SERVICE',      // ❌ Defined but not registered - REMOVE FROM TEST
];
```

#### 4. Performance Tracking

**Pattern**: Track resolution time for each token

```typescript
interface ResolutionResult {
  success: boolean;
  timeMs: number;
  error?: string;
}

const resolvedTokens = new Map<string, ResolutionResult>();

// Track performance
const startTime = performance.now();
const resolved = container.resolve(token);
const timeMs = performance.now() - startTime;

resolvedTokens.set(tokenName, { success: true, timeMs });
```

**Analysis**:
```typescript
it('should resolve all tokens within acceptable time', () => {
  const times = Array.from(resolvedTokens.values()).map(r => r.timeMs);
  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
  const maxTime = Math.max(...times);

  expect(avgTime).toBeLessThan(50);  // Fast on average
  expect(maxTime).toBeLessThan(200); // No extremely slow resolutions
});
```

#### 5. Singleton Verification

**Pattern**: Verify singleton scope returns same instance

```typescript
it('should return same instance for singleton services', () => {
  const container = Container.getContainer();

  const service1 = container.resolve(CONTAINER_TOKENS.USER_SERVICE);
  const service2 = container.resolve(CONTAINER_TOKENS.USER_SERVICE);

  expect(service1).toBe(service2); // Same instance reference
});
```

#### 6. Health Report Generation

**Pattern**: Generate comprehensive health metrics

```typescript
it('should generate comprehensive health report', () => {
  const totalTokens = resolvedTokens.size;
  const successfulTokens = Array.from(resolvedTokens.values())
    .filter(r => r.success).length;
  const failedTokens = totalTokens - successfulTokens;

  const times = Array.from(resolvedTokens.values())
    .filter(r => r.success)
    .map(r => r.timeMs);

  const healthReport = {
    status: failedTokens === 0 ? 'healthy' : 'unhealthy',
    totalTokens,
    successfulTokens,
    failedTokens,
    performance: {
      averageResolutionTimeMs: avgTime.toFixed(2),
      totalResolutionTimeMs: totalTime.toFixed(2),
    },
    timestamp: new Date().toISOString(),
  };

  console.log('🏥 Container Health Report:', JSON.stringify(healthReport, null, 2));

  expect(healthReport.status).toBe('healthy');
  expect(healthReport.failedTokens).toBe(0);
});
```

## Integration with CI/CD

### Running Container Smoke Tests

```bash
# Local development
pnpm test:unit tests/integration/container-smoke.test.ts

# CI pipeline
pnpm test:unit tests/integration/

# Performance monitoring
pnpm vitest run --no-coverage tests/integration/container-smoke.test.ts | grep "Container Health Report"
```

### Expected Performance

**Benchmarks** (32 tokens):
- Average resolution: < 0.05ms per token
- Max resolution: < 0.5ms per token
- Total resolution: < 2ms for all tokens
- Test execution: < 1 second total

**Performance Degradation Indicators**:
- Average > 50ms: Investigate service constructor overhead
- Max > 200ms: Check for synchronous I/O or heavy initialization
- Total > 10ms: Consider lazy initialization patterns

## Troubleshooting

### Resolution Failures

**Error**: `AwilixResolutionError: Could not resolve 'serviceName'`

**Causes**:
1. Token not registered in container-setup.ts
2. Missing dependency in service constructor
3. Circular dependency between services

**Solution**:
```bash
# 1. Check if token is registered
grep "CONTAINER_TOKENS.SERVICE_NAME" src/core/container-setup.ts

# 2. Check service constructor dependencies
grep "constructor" src/services/service-name.service.ts

# 3. Check for circular dependencies
# If Service A depends on Service B and B depends on A,
# one must be refactored to break the cycle
```

### Mock Setup Failures

**Error**: `ReferenceError: mockDatabase is not defined`

**Cause**: vi.mock hoisting - mock defined in beforeAll can't be accessed

**Solution**: Move mock to top level:
```typescript
vi.mock('../../src/config/database.connection.js', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mock<Database>()),
}));
```

### Performance Issues

**Symptom**: Tests run slower than benchmarks

**Diagnostic Steps**:
1. Check slowest resolutions:
   ```typescript
   const sortedByTime = Array.from(resolvedTokens.entries())
     .sort(([, a], [, b]) => b.timeMs - a.timeMs)
     .slice(0, 5);
   console.log('🐌 Slowest:', sortedByTime);
   ```

2. Profile service constructors for heavy operations
3. Consider lazy initialization for expensive dependencies
4. Verify mocks are actually being used (no real I/O)

## Best Practices

### ✅ DO

- Mock only infrastructure (database, logger, external APIs)
- Test all registered container tokens
- Track performance metrics
- Verify singleton behavior
- Generate health reports
- Run in CI pipeline
- Update tests when adding new services

### ❌ DON'T

- Mock business logic services (test real constructors)
- Test tokens not registered in container
- Skip performance tracking
- Ignore resolution failures
- Hard-code token lists (grep container-setup.ts)
- Run smoke tests with real database

## Example: Full Container Smoke Test

See: `packages/server/tests/integration/container-smoke.test.ts`

**Coverage**:
- 32 container tokens (infrastructure, repositories, services, controllers)
- Performance tracking with statistics
- Singleton behavior verification
- Dependency chain validation
- Error handling tests
- Health report generation

**Results**:
- 100% resolution success rate
- Average 0.03ms per token
- All tests passing in < 1 second
