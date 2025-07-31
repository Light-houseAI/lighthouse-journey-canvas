# PRD: In-Memory Database Testing Implementation

**Document Version**: 1.0  
**Created**: January 30, 2025  
**Author**: Engineering Team  
**Status**: Draft  

---

## 📋 Executive Summary

### Problem Statement
The current testing infrastructure relies on external PostgreSQL databases, creating significant bottlenecks in development velocity and CI/CD performance. Test execution is sequential, slow, and prone to data contamination issues, resulting in unreliable test results and reduced developer productivity.

### Solution Overview
Implement an in-memory database testing system using PGlite with pgvector support, enabling parallel test execution while maintaining full compatibility with the Mastra agent system and production PostgreSQL environment.

### Business Impact
- **Developer Productivity**: 70% reduction in test execution time (5min → 1.5min)
- **CI/CD Efficiency**: Eliminate external database dependencies and provisioning overhead
- **Test Reliability**: 100% test isolation preventing flaky test failures
- **Cost Reduction**: Reduced infrastructure requirements for testing environments

---

## 🔍 Current State Analysis

### Existing Architecture
- **Database**: PostgreSQL with pgvector extension via Neon serverless
- **ORM**: Drizzle ORM with PostgreSQL driver
- **Agent System**: Mastra agent with PostgresStore and PgVector dependencies
- **Testing**: Single test user (ID: 999) with manual cleanup between tests
- **Execution**: Sequential test execution due to shared database state

### Pain Points Identified

#### Performance Issues
- **Test Suite Duration**: 5+ minutes for full test execution
- **Individual Test Time**: 20-30 seconds per test due to database operations
- **CI/CD Bottleneck**: Database connection establishment and cleanup overhead
- **Parallelization Blocked**: Cannot run tests in parallel due to data conflicts

#### Reliability Concerns
- **Test Contamination**: Shared database state causes test interdependencies
- **Flaky Tests**: Network connectivity issues to external database
- **Setup Complexity**: Requires PostgreSQL instance for local development
- **Debugging Difficulty**: Hard to isolate test failures due to shared state

#### Developer Experience
- **Local Setup**: Complex database configuration for new developers
- **Feedback Loop**: Slow test execution delays development iteration
- **Environment Parity**: Differences between local and CI test environments

---

## 🎯 Requirements

### Functional Requirements

#### FR-1: In-Memory Database Support
- **Description**: Implement PGlite-based in-memory PostgreSQL database for testing
- **Acceptance Criteria**:
  - PGlite instances created dynamically for each test
  - pgvector extension enabled and functional
  - All PostgreSQL features used by the application supported
  - Schema compatibility maintained with production PostgreSQL

#### FR-2: Mastra Agent Compatibility
- **Description**: Enable Mastra agent to work with both production PostgreSQL and test PGlite
- **Acceptance Criteria**:
  - Agent accepts configurable database connection
  - Memory management works with both database types
  - Vector operations function identically in both environments
  - No changes required to agent behavior or API

#### FR-3: Parallel Test Execution
- **Description**: Support running multiple test suites simultaneously with isolation
- **Acceptance Criteria**:
  - Each test worker gets isolated database instance
  - No cross-test data contamination
  - Test results deterministic regardless of execution order
  - Configurable worker count (default: 4 workers)

#### FR-4: Environment-Based Configuration
- **Description**: Automatic database selection based on environment variables
- **Acceptance Criteria**:
  - Production uses PostgreSQL (current behavior unchanged)
  - Test environment uses PGlite automatically
  - Configuration injectable for custom scenarios
  - Backward compatibility with existing test setup

### Non-Functional Requirements

#### NFR-1: Performance
- **Target**: 70% reduction in test suite execution time
- **Metric**: Full test suite completes in <2 minutes (from current 5+ minutes)
- **Individual Test**: <5 seconds per test (from current 20-30 seconds)

#### NFR-2: Reliability
- **Target**: 100% test isolation and deterministic results
- **Metric**: Zero flaky test failures due to database state
- **Availability**: No external database dependencies for testing

#### NFR-3: Developer Experience
- **Target**: Zero additional setup for new developers
- **Metric**: `npm test` works immediately after repository clone
- **Documentation**: Clear migration guide for existing tests

#### NFR-4: Resource Efficiency
- **Memory**: <200MB total for all test database instances
- **CPU**: Efficient utilization through parallel execution
- **Disk**: No persistent storage required for test databases

---

## 🏗️ Technical Specification

### Architecture Overview

```
Production Environment:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mastra Agent  │ -> │  Memory Manager  │ -> │   PostgreSQL    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                v
                       ┌──────────────────┐
                       │   PgVector       │
                       │   (pgvector)     │
                       └──────────────────┘

Test Environment:
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mastra Agent  │ -> │  Memory Manager  │ -> │     PGlite      │
└─────────────────┘    └──────────────────┘    │  (in-memory)    │
                                │                └─────────────────┘
                                v                         │
                       ┌──────────────────┐              │
                       │  Vector Support  │ <────────────┘
                       │   (pgvector)     │
                       └──────────────────┘
```

### Database Factory Pattern

```typescript
interface DatabaseConfig {
  connectionString: string;
  schemaName: string;
  type: 'postgresql' | 'pglite';
  pgPoolOptions?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
}

class DatabaseFactory {
  static async createConfig(options?: {
    environment?: 'production' | 'test';
    testId?: string;
  }): Promise<DatabaseConfig> {
    // Implementation details
  }
}
```

### Agent Configuration Injection

```typescript
// Modified Agent Creation
export async function createSimplifiedCareerAgent(options?: {
  databaseConfig?: DatabaseConfig;
}) {
  const dbConfig = options?.databaseConfig || 
    await DatabaseFactory.createConfig();
  
  const { memory } = await createCareerMemory(dbConfig);
  
  return new Agent({
    name: 'Career Assistant',
    memory,
    model: openai('gpt-4o-mini'),
    tools: careerTools,
  });
}
```

### Test Infrastructure

```typescript
// Parallel Test Setup
export class TestDatabaseManager {
  private static instances = new Map<string, PGlite>();
  
  static async createIsolatedAgent(testId: string) {
    const client = new PGlite({
      extensions: { vector: true }
    });
    
    await this.initializeSchema(client);
    this.instances.set(testId, client);
    
    const dbConfig = this.createTestConfig(client);
    return createSimplifiedCareerAgent({ databaseConfig: dbConfig });
  }
  
  static cleanup(testId: string) {
    this.instances.delete(testId); // Auto-cleanup
  }
}
```

### Schema Compatibility

```sql
-- PGlite Schema (identical to PostgreSQL)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  interest TEXT,
  has_completed_onboarding BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  username TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  filtered_data JSONB NOT NULL,
  projects JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Mastra AI Schema
CREATE SCHEMA IF NOT EXISTS mastra_ai;

CREATE TABLE mastra_ai.vectors (
  id SERIAL PRIMARY KEY,
  embedding vector(1536),
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Implementation Plan

### Phase 1: Database Abstraction (Week 1)
**Objective**: Create database factory and configuration system

#### Deliverables
- `database-factory.ts` - Environment-based database creation
- `database-config.ts` - Configuration interfaces and types
- `pglite-setup.ts` - PGlite initialization with pgvector

#### Success Criteria
- Factory creates PostgreSQL config for production
- Factory creates PGlite config for testing
- pgvector extension loads correctly in PGlite
- Schema creation works in both environments

### Phase 2: Mastra Integration (Week 2)
**Objective**: Modify Mastra agent to accept database configuration

#### Deliverables
- Updated `memory-manager.ts` with configurable database
- Updated `simplified-career-agent.ts` with dependency injection
- Backward compatibility for existing production usage
- Unit tests for configuration injection

#### Success Criteria
- Agent works with PostgreSQL (existing behavior)
- Agent works with PGlite (new test behavior)
- Vector operations function identically
- Memory management compatible with both databases

### Phase 3: Parallel Test Infrastructure (Week 3)
**Objective**: Implement isolated test execution with PGlite

#### Deliverables
- Updated `TestDatabaseManager` with PGlite support
- Vitest configuration for parallel execution
- Test isolation setup and teardown
- Migration utilities for existing tests

#### Success Criteria
- Tests run in parallel without conflicts
- Each test gets fresh database instance
- Test execution time reduced by 50%+
- All existing tests pass without modification

### Phase 4: Validation & Optimization (Week 4)
**Objective**: Validate system performance and reliability

#### Deliverables
- Performance benchmarking results
- Stress testing with high worker counts
- Memory usage optimization
- Documentation and migration guide

#### Success Criteria
- 70% reduction in test suite execution time achieved
- Memory usage under 200MB for all test instances
- Zero flaky test failures in CI/CD
- Developer setup guide completed

---

## ✅ Success Metrics

### Performance Benchmarks

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Full Test Suite | 5+ minutes | <2 minutes | CI/CD execution time |
| Individual Test | 20-30 seconds | <5 seconds | Average test duration |
| Test Startup | 30+ seconds | <2 seconds | Database connection time |
| Parallel Execution | Not supported | 4 workers | Concurrent test runs |

### Reliability Metrics

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Test Isolation | 0% (shared DB) | 100% | Cross-test contamination detection |
| Flaky Test Rate | 5-10% | <1% | Test failure analysis over 100 runs |
| Setup Success | 70% (DB dependency) | 100% | New developer onboarding |
| CI/CD Success Rate | 85% | 99% | Build pipeline reliability |

### Developer Experience

| Metric | Current State | Target | Measurement Method |
|--------|---------------|--------|-------------------|
| Local Setup Time | 30+ minutes | <5 minutes | Time from clone to test |
| Test Feedback Loop | 5+ minutes | <2 minutes | Development iteration cycle |
| Debug Complexity | High (shared state) | Low (isolated) | Issue resolution time |
| Environment Parity | 60% | 95% | Local vs CI test consistency |

---

## ⚠️ Risk Assessment

### Technical Risks

#### Risk: PGlite Feature Parity
- **Probability**: Medium
- **Impact**: High
- **Description**: PGlite may not support all PostgreSQL features used by the application
- **Mitigation**: 
  - Comprehensive feature compatibility testing
  - Fallback to external PostgreSQL for unsupported features
  - Regular PGlite version updates

#### Risk: pgvector Compatibility
- **Probability**: Low
- **Impact**: High
- **Description**: Vector operations may behave differently in PGlite vs PostgreSQL
- **Mitigation**:
  - Vector operation validation tests
  - Performance benchmarking between implementations
  - Identical dimension and metric configurations

#### Risk: Memory Consumption
- **Probability**: Medium
- **Impact**: Medium
- **Description**: Multiple PGlite instances may consume excessive memory
- **Mitigation**:
  - Worker count configuration
  - Memory usage monitoring
  - Instance cleanup optimization

### Operational Risks

#### Risk: Migration Complexity
- **Probability**: Low
- **Impact**: Medium
- **Description**: Existing tests may require significant changes
- **Mitigation**:
  - Backward compatibility preservation
  - Gradual migration strategy
  - Comprehensive test validation

#### Risk: Production Impact
- **Probability**: Very Low
- **Impact**: Very High
- **Description**: Changes could affect production database usage
- **Mitigation**:
  - Environment-based configuration
  - Production code paths unchanged
  - Thorough production testing

---

## 🧪 Testing Strategy

### Validation Approach

#### Unit Testing
- Database factory configuration logic
- Agent initialization with different database types
- Vector operation compatibility
- Schema creation and migration

#### Integration Testing
- Full test suite execution with PGlite
- Parallel test execution validation
- Memory and performance benchmarking
- Cross-environment compatibility

#### Performance Testing
- Test execution time measurement
- Memory usage profiling
- Concurrent worker stress testing
- CI/CD pipeline validation

### Test Scenarios

```typescript
describe('Database Factory', () => {
  test('creates PostgreSQL config for production', async () => {
    const config = await DatabaseFactory.createConfig({ 
      environment: 'production' 
    });
    expect(config.type).toBe('postgresql');
  });

  test('creates PGlite config for testing', async () => {
    const config = await DatabaseFactory.createConfig({ 
      environment: 'test' 
    });
    expect(config.type).toBe('pglite');
  });
});

describe('Agent Compatibility', () => {
  test('agent works with PostgreSQL', async () => {
    const agent = await createSimplifiedCareerAgent();
    const result = await agent.process({ message: 'test' });
    expect(result).toBeDefined();
  });

  test('agent works with PGlite', async () => {
    const dbConfig = await DatabaseFactory.createConfig({ 
      environment: 'test' 
    });
    const agent = await createSimplifiedCareerAgent({ databaseConfig: dbConfig });
    const result = await agent.process({ message: 'test' });
    expect(result).toBeDefined();
  });
});
```

---

## 📚 Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "@electric-sql/pglite": "^0.1.5"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.1.5"
  }
}
```

### Updated Configuration
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxWorkers: 4,
        minWorkers: 1,
      },
    },
    testTimeout: 30000,
    setupFiles: ['./server/tests/setup/parallel-setup.ts'],
  },
});
```

---

## 🔄 Migration Guide

### For Developers

#### Before (Current Tests)
```typescript
describe('My Test', () => {
  beforeEach(async () => {
    const testDb = TestDatabaseManager.getInstance()
    await testDb.resetTestUserData()
  }, 60000)
  
  test('should work', async () => {
    const result = await processCareerConversation({
      message: 'test',
      userId: '999',
      threadId: 'test-thread'
    })
    expect(result.updatedProfile).toBe(true)
  })
})
```

#### After (New Tests)
```typescript
describe('My Test', () => {
  test('should work', async ({ testAgent }) => {
    const result = await testAgent.process({
      message: 'test',
      userId: '999',
      threadId: 'test-thread'
    })
    expect(result.updatedProfile).toBe(true)
  })
})
```

### Migration Steps
1. Update vitest configuration for parallel execution
2. Replace TestDatabaseManager usage with test context
3. Remove manual cleanup (automatic with PGlite)
4. Run tests to validate behavior unchanged

---

## 📋 Acceptance Criteria

### Must Have (MVP)
- [ ] PGlite database instances create successfully
- [ ] pgvector extension works in PGlite
- [ ] Mastra agent accepts database configuration
- [ ] Tests run in parallel without conflicts
- [ ] Test execution time reduced by 50%+
- [ ] All existing tests pass without modification
- [ ] Production behavior unchanged

### Should Have (V1.1)
- [ ] Memory usage optimization (<200MB total)
- [ ] Configurable worker count
- [ ] Performance monitoring and reporting
- [ ] Comprehensive migration documentation

### Could Have (Future)
- [ ] Test result caching
- [ ] Database snapshot and restore
- [ ] Advanced parallel execution strategies
- [ ] Integration with external CI/CD metrics

---

## 📞 Stakeholders

### Primary
- **Engineering Team**: Implementation and maintenance
- **QA Team**: Test validation and quality assurance
- **DevOps Team**: CI/CD pipeline integration

### Secondary
- **Product Team**: Performance impact on development velocity
- **Infrastructure Team**: Resource usage and optimization

---

## 📅 Timeline Summary

| Phase | Duration | Key Deliverables | Success Criteria |
|-------|----------|------------------|------------------|
| Phase 1 | Week 1 | Database Factory | Configuration system working |
| Phase 2 | Week 2 | Mastra Integration | Agent works with both DB types |
| Phase 3 | Week 3 | Parallel Testing | Tests run in parallel |
| Phase 4 | Week 4 | Validation | Performance targets met |

**Total Duration**: 4 weeks  
**Target Completion**: February 28, 2025

---

This PRD serves as the definitive guide for implementing in-memory database testing with Mastra agent compatibility and parallel execution support. All implementation decisions should reference this document to ensure alignment with requirements and success criteria.