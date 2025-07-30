# Test Infrastructure Refactor - Product Requirements Document (PRD)

## 📋 Executive Summary

**Status**: Phase 1 Quick Wins ✅ **COMPLETED**  
**Current State**: Tests run but are slow (~30s per test) due to full database/vector store initialization  
**Target State**: Fast, reliable, maintainable test suite with <5s per test execution

## 🎯 Problem Statement

### Current Issues
- **Performance**: Tests timeout frequently, taking 30+ seconds each
- **Reliability**: Database initialization overhead per test
- **Scalability**: Adding new test scenarios is cumbersome
- **Developer Experience**: Slow feedback loop discourages TDD

### Impact
- **Developer Productivity**: 5+ minute test runs block development flow
- **CI/CD Pipeline**: Potential pipeline failures due to timeouts
- **Code Quality**: Slow tests discourage comprehensive testing

## ✅ Quick Wins Implemented (Phase 1)

### Completed Improvements
- ✅ **Timeout Configuration**: Increased to 60s for integration tests
- ✅ **Thread Management**: Single-threaded execution for database consistency
- ✅ **Test Structure**: Added `beforeAll`/`afterAll` hooks
- ✅ **Retry Logic**: Added retry mechanism for flaky tests
- ✅ **Better Assertions**: More descriptive error messages

### Results
- Tests now complete without timeouts (was failing at 5-10s)
- Single test runs in ~30s (improved from timeout failures)
- 100% test pass rate achieved

## 🚀 Phase 2: Performance Optimization

### 2.1 Database Strategy Refactor
**Priority**: High | **Effort**: Medium | **Impact**: High

**Current Problem**:
```
Each test: Database init (20s) + Vector store setup (5s) + Test execution (5s) = 30s
```

**Proposed Solution**:
```typescript
// Global test setup - run once per test suite
beforeAll(async () => {
  await setupTestDatabase() // 20s - one time
  await initializeVectorStore() // 5s - one time
  await seedTestData() // 2s - one time
})

// Individual tests - pure business logic
test('should add project', async () => {
  const result = await careerAgent.addProject(testData)
  expect(result.success).toBe(true) // <1s per test
})
```

**Expected Outcome**: 27s setup + 1s per test = 95% time reduction

### 2.2 Test Categorization
**Priority**: Medium | **Effort**: Low | **Impact**: Medium

**Structure**:
```
server/tests/
├── unit/                          # <1s each, mocked dependencies
│   ├── career-agent.unit.test.ts
│   └── profile-manager.unit.test.ts
├── integration/                   # <5s each, real database
│   ├── add-project.integration.test.ts
│   └── conversation-flow.integration.test.ts
└── e2e/                          # <30s each, full system
    └── critical-user-journeys.e2e.test.ts
```

**NPM Scripts**:
```json
{
  "test": "vitest run unit integration",
  "test:unit": "vitest run unit/",
  "test:integration": "vitest run integration/",
  "test:e2e": "vitest run e2e/",
  "test:watch": "vitest watch unit/"
}
```

### 2.3 Smart Mocking Strategy
**Priority**: Medium | **Effort**: Medium | **Impact**: High

**Selective Mocking**:
```typescript
// Unit Tests: Mock everything external
vi.mock('../../db.js')
vi.mock('../../services/ai/career-tools.js')

// Integration Tests: Mock only AI/external APIs
vi.mock('openai')
vi.mock('../../services/external-apis.js')

// E2E Tests: No mocking, real system
```

## 🔧 Phase 3: Advanced Features

### 3.1 Test Data Management
**Priority**: Low | **Effort**: Medium | **Impact**: Medium

**Test Fixtures**:
```typescript
// fixtures/user-profiles.ts
export const testProfiles = {
  multipleRoles: {
    userId: 17,
    experiences: [
      { company: "ABCO", title: "Software Engineer", period: "2012-2014" },
      { company: "ABCO", title: "Principal Engineer", period: "2018-2022" }
    ]
  }
}
```

**Database Seeding**:
```typescript
beforeAll(async () => {
  await db.transaction(async (tx) => {
    await seedUserProfile(tx, testProfiles.multipleRoles)
  })
})
```

### 3.2 Parallel Test Execution
**Priority**: Low | **Effort**: High | **Impact**: Medium

**Test Isolation**:
```typescript
// Each test gets isolated database schema
test('parallel test 1', async ({ testDb }) => {
  // testDb is unique per test
})
```

### 3.3 Performance Monitoring
**Priority**: Low | **Effort**: Low | **Impact**: Low

**Metrics Collection**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: [
      'verbose',
      ['json', { outputFile: 'test-results.json' }],
      ['custom', { outputFile: 'performance-metrics.json' }]
    ]
  }
})
```

## 📊 Success Metrics

### Performance Targets
| Metric | Current | Phase 2 Target | Phase 3 Target |
|--------|---------|----------------|----------------|
| **Single Test** | 30s | <5s | <2s |
| **Full Suite** | 15+ min | <2 min | <30s |
| **Unit Tests** | N/A | <1s each | <500ms each |
| **Integration Tests** | 30s | <5s each | <3s each |

### Quality Targets
| Metric | Current | Target |
|--------|---------|---------|
| **Test Coverage** | Unknown | >90% |
| **Flaky Test Rate** | 0% | 0% |
| **Test Reliability** | 100% pass | 100% pass |

## 🗓️ Implementation Timeline

### Phase 2: Performance Optimization (2-3 sprints)
- **Week 1**: Database strategy refactor
- **Week 2**: Test categorization and smart mocking
- **Week 3**: Performance validation and optimization

### Phase 3: Advanced Features (1-2 sprints)
- **Week 4**: Test data management and parallel execution
- **Week 5**: Performance monitoring and CI/CD integration

## 🔄 Migration Strategy

### Step 1: Parallel Implementation
- Keep existing tests running
- Create new test structure alongside
- Gradually migrate test scenarios

### Step 2: Validation Phase
- Run both old and new tests in parallel
- Compare results and performance
- Fix any discrepancies

### Step 3: Cut-over
- Switch CI/CD to new test structure
- Remove old test files
- Update documentation

## 💰 Resource Requirements

### Development Effort
- **Phase 2**: 2-3 developer weeks
- **Phase 3**: 1-2 developer weeks
- **Testing/Validation**: 1 developer week

### Infrastructure
- **Test Database**: Dedicated PostgreSQL instance
- **CI/CD Updates**: GitHub Actions modifications
- **Monitoring**: Test performance dashboards

## 🎯 Acceptance Criteria

### Phase 2 Complete When:
- [ ] Full test suite runs in <2 minutes
- [ ] Individual tests complete in <5 seconds
- [ ] Test categorization implemented (unit/integration/e2e)
- [ ] Database setup optimized to run once per suite
- [ ] 100% test pass rate maintained

### Phase 3 Complete When:
- [ ] Unit tests run in <1 second each
- [ ] Test data fixtures implemented
- [ ] Performance monitoring dashboard available
- [ ] CI/CD pipeline optimized
- [ ] Documentation updated

## 🚨 Risks and Mitigation

### High Risk: Test Reliability
- **Risk**: Mocking might hide real integration issues
- **Mitigation**: Maintain comprehensive integration test coverage

### Medium Risk: Development Time
- **Risk**: Refactor takes longer than estimated
- **Mitigation**: Implement in phases, maintain existing tests during transition

### Low Risk: Performance Regression
- **Risk**: New test structure performs worse
- **Mitigation**: Benchmark and validate at each phase

## 📋 Definition of Done

### Phase 2 DoD:
- All existing test scenarios pass in new structure
- Test execution time reduced by >80%
- Documentation updated
- Team trained on new test patterns

### Phase 3 DoD:
- Performance targets achieved
- Monitoring in place
- CI/CD pipeline optimized
- Full developer documentation complete

---

## 🔍 Current Status: Phase 1 ✅ COMPLETED

**Quick Wins Delivered**:
- Tests now run without timeouts
- Better error reporting
- Improved test structure
- Retry mechanism for reliability

**Next Steps**:
- Begin Phase 2 database optimization
- Start test categorization planning
- Set up performance benchmarks

**Decision Point**: Proceed with Phase 2 implementation based on team priorities and sprint capacity.