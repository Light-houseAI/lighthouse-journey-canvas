# PRD: API Test Coverage Enhancement

## Document Control
- Version: 1.0
- Last Updated: 2025-09-15
- Next Review: 2025-09-22
- Stakeholders: Engineering Team, QA Team, Product Management

## Executive Summary

This PRD addresses the critical gap in API test coverage for the Lighthouse Journey Canvas API. Currently, only 35% of endpoints (13/38+) have test coverage, leaving significant functionality untested and vulnerable to regressions. This initiative will systematically increase test coverage to >80%, ensuring API reliability, maintainability, and confidence in deployments.

**Business Impact:**
- Reduce production incidents by 60% through comprehensive testing
- Decrease debugging time by 40% with clear test failure indicators
- Enable confident continuous deployment with automated test validation
- Improve developer velocity by 30% through reduced manual testing

## Problem Statement

### Current State
- **Test Coverage**: 35% (13/38+ endpoints tested)
- **Missing Critical Tests**: Timeline/Hierarchy nodes (11 endpoints), GraphRAG search, User management
- **Risk Areas**: Core business logic untested, no regression protection for critical features
- **Technical Debt**: Accumulating untested code makes refactoring risky

### Impact of Problem
- **Production Incidents**: Untested endpoints lead to undetected bugs reaching production
- **Development Velocity**: Manual testing slows down feature delivery
- **Code Quality**: Fear of breaking untested code prevents necessary refactoring
- **Documentation Gap**: Tests serve as living documentation; missing tests mean unclear API contracts

## Goals & Success Metrics

### Primary Goals
1. Achieve >80% API endpoint test coverage
2. Ensure 100% coverage of critical business features
3. Establish sustainable testing practices for new endpoints
4. Improve API reliability and reduce production incidents

### Success Metrics
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Endpoint Coverage | 35% (13/38) | >80% (31/38) | 2 weeks |
| Critical Feature Coverage | ~40% | 100% | 1 week |
| Test Execution Time | N/A | <60 seconds | Ongoing |
| Test Flakiness Rate | Unknown | <1% | Ongoing |
| Production Incidents | Baseline | -60% | 3 months |

### KPIs
- Number of endpoints with test coverage
- Average test coverage per controller
- Test execution time
- Test failure rate in CI/CD pipeline
- Time to identify and fix API regressions

## User Stories & Requirements

### User Stories

#### Story 1: Timeline Node CRUD Testing
**As a** developer
**I want** comprehensive tests for timeline node operations
**So that** I can confidently modify node logic without breaking existing functionality

**Acceptance Criteria:**
- All CRUD operations tested (Create, Read, Update, Delete)
- Edge cases covered (invalid IDs, missing fields, unauthorized access)
- Performance benchmarks verified (<200ms response time)
- Hierarchical relationships validated

#### Story 2: GraphRAG Search Testing
**As a** developer
**I want** thorough tests for GraphRAG search functionality
**So that** I can ensure search quality and performance

**Acceptance Criteria:**
- Search query validation tested
- Result ranking verified
- Performance tested with various data sizes
- Error handling for malformed queries

#### Story 3: Authentication Flow Testing
**As a** security engineer
**I want** complete authentication and authorization tests
**So that** I can ensure system security

**Acceptance Criteria:**
- All auth endpoints tested
- Token refresh flow validated
- Authorization middleware tested
- Rate limiting verified

### Functional Requirements

#### FR1: Test Coverage Implementation
- **FR1.1**: Implement tests for Timeline/Hierarchy Node endpoints (11 endpoints)
- **FR1.2**: Implement tests for GraphRAG Search endpoint
- **FR1.3**: Implement tests for User Management endpoints (2 endpoints)
- **FR1.4**: Implement tests for Organization endpoints (2 endpoints)
- **FR1.5**: Implement tests for remaining Auth endpoints (2 endpoints)
- **FR1.6**: Implement tests for Node Permissions endpoints (6 endpoints)

#### FR2: Test Quality Standards
- **FR2.1**: Each endpoint must have positive and negative test cases
- **FR2.2**: Authentication and authorization must be tested for protected endpoints
- **FR2.3**: Input validation must be tested with boundary values
- **FR2.4**: Response format must match OpenAPI schema
- **FR2.5**: Error responses must follow standardized format

#### FR3: Test Organization
- **FR3.1**: Tests organized by feature domain (auth, timeline, graphrag, etc.)
- **FR3.2**: Shared test utilities extracted to common modules
- **FR3.3**: Test data factories for consistent test data generation
- **FR3.4**: Cleanup procedures to ensure test isolation

## Non-Functional Requirements

### Performance Requirements
- **NFR1**: All API tests must complete within 60 seconds
- **NFR2**: Individual test suites must complete within 10 seconds
- **NFR3**: Memory usage during tests must not exceed 512MB
- **NFR4**: Tests must support parallel execution

### Reliability Requirements
- **NFR5**: Test flakiness rate must be <1%
- **NFR6**: Tests must be deterministic and reproducible
- **NFR7**: Tests must handle async operations correctly
- **NFR8**: Database state must be properly isolated between tests

### Maintainability Requirements
- **NFR9**: Tests must follow DRY principles with shared utilities
- **NFR10**: Test code must be self-documenting with clear descriptions
- **NFR11**: Test data must be easily maintainable
- **NFR12**: Tests must be resilient to minor API changes

### Security Requirements
- **NFR13**: Tests must not expose sensitive data in logs
- **NFR14**: Test database must be separate from development/production
- **NFR15**: Authentication tokens in tests must be properly managed
- **NFR16**: Tests must validate security headers and CORS policies

## Technical Specifications

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│           Test Suite Architecture        │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │     Integration Tests Layer       │ │
│  │  ┌─────────┐  ┌─────────────┐   │ │
│  │  │  Auth   │  │  Timeline   │   │ │
│  │  │  Tests  │  │    Tests    │   │ │
│  │  └─────────┘  └─────────────┘   │ │
│  │  ┌─────────┐  ┌─────────────┐   │ │
│  │  │GraphRAG │  │    User     │   │ │
│  │  │  Tests  │  │    Tests    │   │ │
│  │  └─────────┘  └─────────────┘   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Test Infrastructure          │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   Test Database Setup       │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   Test Data Factories       │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │   Auth Helper Utilities     │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │         Test Runners              │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │      Vitest Framework       │ │ │
│  │  └─────────────────────────────┘ │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │    Supertest HTTP Client    │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Low-Level Design

#### Test File Structure
```
server/tests/
├── api/                          # API integration tests
│   ├── auth.test.ts             # Existing - expand
│   ├── health.test.ts           # Existing - complete
│   ├── onboarding.test.ts       # Existing - expand
│   ├── timeline-nodes.test.ts   # NEW - Priority 1
│   ├── graphrag.test.ts         # NEW - Priority 1
│   ├── users.test.ts            # NEW - Priority 2
│   ├── organizations.test.ts    # NEW - Priority 3
│   └── node-permissions.test.ts # NEW - Priority 2
├── helpers/                      # Test utilities
│   ├── auth.helper.ts           # Auth token management
│   ├── database.helper.ts       # DB setup/teardown
│   ├── factories/               # Test data factories
│   │   ├── user.factory.ts
│   │   ├── node.factory.ts
│   │   └── organization.factory.ts
│   └── assertions.helper.ts     # Custom assertions
└── fixtures/                     # Test data
    ├── users.json
    ├── nodes.json
    └── search-queries.json
```

#### Test Implementation Pattern
```typescript
// Standard test structure for all endpoints
describe('[Feature] API', () => {
  let app: Application;
  let authToken: string;
  let testData: TestDataType;

  beforeAll(async () => {
    app = await createApp();
    const auth = await createTestUser();
    authToken = auth.accessToken;
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await Container.dispose();
  });

  describe('[HTTP_METHOD] /endpoint', () => {
    it('should handle successful case', async () => {
      const response = await request(app)
        .method('/api/endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPayload)
        .expect(expectedStatus);

      validateApiResponse(response.body);
      expect(response.body.data).toMatchObject(expectedData);
    });

    it('should handle validation errors', async () => {
      const response = await request(app)
        .method('/api/endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPayload)
        .expect(400);

      validateApiErrorResponse(response.body);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle authorization', async () => {
      const response = await request(app)
        .method('/api/endpoint')
        .send(validPayload)
        .expect(401);

      validateApiErrorResponse(response.body);
      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });
});
```

### API Specifications

#### Test Coverage Requirements by Endpoint

##### Timeline Node Endpoints (Priority 1)
```yaml
GET /v2/timeline/nodes:
  tests:
    - List all user nodes
    - Filter by type
    - Filter by parentId
    - Pagination (limit/offset)
    - Empty result handling
    - Authorization check

POST /v2/timeline/nodes:
  tests:
    - Create root node
    - Create child node
    - Invalid parent ID
    - Missing required fields
    - Meta validation
    - Authorization check

GET /v2/timeline/nodes/{nodeId}:
  tests:
    - Get existing node
    - Non-existent node (404)
    - Invalid UUID format
    - Authorization check

PATCH /v2/timeline/nodes/{nodeId}:
  tests:
    - Update node meta
    - Partial update
    - Non-existent node
    - Authorization check

DELETE /v2/timeline/nodes/{nodeId}:
  tests:
    - Delete leaf node
    - Delete node with children
    - Non-existent node
    - Authorization check
```

##### GraphRAG Search Endpoint (Priority 1)
```yaml
POST /v2/graphrag/search:
  tests:
    - Basic search query
    - Search with filters
    - Similarity threshold
    - Result limit
    - Empty results
    - Invalid query
    - Performance benchmark
```

### Database Schema for Tests

```sql
-- Test-specific tables or flags
CREATE SCHEMA IF NOT EXISTS test;

-- Test user marking
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT FALSE;

-- Test data cleanup tracking
CREATE TABLE IF NOT EXISTS test.cleanup_registry (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Integration Points

1. **CI/CD Pipeline Integration**
   - Run tests on every commit
   - Block merge if tests fail
   - Generate coverage reports
   - Performance regression detection

2. **Development Workflow**
   - Pre-commit hooks for affected tests
   - Local test execution with watch mode
   - Test debugging with detailed logs

3. **Documentation Generation**
   - Extract API examples from tests
   - Generate coverage reports
   - Create test execution reports

## Implementation Plan

### Phase Breakdown

#### Phase 1: Foundation (Days 1-3)
**Objective**: Establish test infrastructure and utilities

**Tasks**:
1. Create test helper utilities
   - Auth helper for token management
   - Database helper for setup/teardown
   - Response validation helpers
2. Set up test data factories
   - User factory
   - Node factory
   - Organization factory
3. Configure test database isolation
4. Create shared test constants

**Deliverables**:
- Test infrastructure ready
- Helper utilities implemented
- Test data factories operational

#### Phase 2: Critical Features (Days 4-8)
**Objective**: Test high-priority endpoints

**Tasks**:
1. Timeline Node endpoints (11 tests)
   - CRUD operations
   - Hierarchical relationships
   - Permissions
2. GraphRAG Search endpoint
   - Query validation
   - Result verification
   - Performance tests
3. Node Insights endpoints (4 tests)
   - CRUD operations
   - Association with nodes

**Deliverables**:
- 16 critical endpoints tested
- >60% overall coverage achieved

#### Phase 3: Supporting Features (Days 9-11)
**Objective**: Test remaining priority endpoints

**Tasks**:
1. User Management endpoints (2 tests)
2. Node Permissions endpoints (6 tests)
3. Additional Auth endpoints (2 tests)
4. Organization endpoints (2 tests)

**Deliverables**:
- 12 additional endpoints tested
- >80% overall coverage achieved

#### Phase 4: Polish & Documentation (Days 12-14)
**Objective**: Refine tests and documentation

**Tasks**:
1. Refactor common patterns
2. Add performance benchmarks
3. Create test documentation
4. Set up coverage reporting
5. Configure CI/CD integration

**Deliverables**:
- Polished test suite
- Complete documentation
- CI/CD integration

### Task Details

#### Priority 1 Tasks (Must Have)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| T1.1 | Create test infrastructure | 1 day | None |
| T1.2 | Implement Timeline Node tests | 2 days | T1.1 |
| T1.3 | Implement GraphRAG tests | 1 day | T1.1 |
| T1.4 | Set up CI/CD integration | 0.5 day | T1.2, T1.3 |

#### Priority 2 Tasks (Should Have)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| T2.1 | User Management tests | 0.5 day | T1.1 |
| T2.2 | Node Permissions tests | 1 day | T1.2 |
| T2.3 | Performance benchmarks | 1 day | T1.2, T1.3 |

#### Priority 3 Tasks (Nice to Have)
| Task ID | Description | Estimate | Dependencies |
|---------|-------------|----------|--------------|
| T3.1 | Organization tests | 0.5 day | T1.1 |
| T3.2 | Extended Auth tests | 0.5 day | T1.1 |
| T3.3 | Test report generation | 0.5 day | All |

### Milestones & Timeline

| Milestone | Description | Target Date | Success Criteria |
|-----------|-------------|-------------|------------------|
| M1 | Infrastructure Ready | Day 3 | All helpers and factories working |
| M2 | Critical Coverage | Day 8 | Timeline & GraphRAG tested (>60% coverage) |
| M3 | Target Coverage | Day 11 | >80% endpoint coverage achieved |
| M4 | Production Ready | Day 14 | Tests integrated, documented, and stable |

### Dependencies

#### Technical Dependencies
- Vitest testing framework (existing)
- Supertest HTTP client (existing)
- Test database instance
- Container/DI framework (existing)

#### Team Dependencies
- Code review from senior engineers
- QA team validation of test scenarios
- DevOps support for CI/CD integration

### Resource Requirements

#### Human Resources
- 1 Senior Engineer (14 days, 100% allocation)
- 1 QA Engineer (3 days, 50% allocation for test scenario validation)
- 1 DevOps Engineer (1 day for CI/CD setup)

#### Technical Resources
- Test database server
- CI/CD pipeline compute resources
- Test monitoring and reporting tools

## Testing Strategy

### Test Levels
1. **Integration Tests** (Primary Focus)
   - Full API endpoint testing
   - Database integration
   - Authentication/authorization flows

2. **Contract Tests**
   - OpenAPI schema compliance
   - Response format validation
   - Request validation

3. **Performance Tests**
   - Response time benchmarks
   - Concurrent request handling
   - Database query performance

### Test Data Management
- Isolated test database
- Transactional test rollback
- Test data factories for consistency
- Cleanup procedures for test isolation

### Test Execution Strategy
- Parallel test execution where possible
- Test grouping by feature domain
- Progressive test runs (fast tests first)
- Fail-fast strategy for CI/CD

## Risk Assessment

### High-Risk Items
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Test flakiness | Medium | High | Implement retry logic, ensure proper async handling |
| Test execution time | Medium | Medium | Parallel execution, optimize database operations |
| Test data conflicts | Low | High | Proper isolation, unique test data generation |
| Breaking changes | Medium | Medium | Versioned API tests, backward compatibility checks |

### Medium-Risk Items
| Risk | Probability | Impact | Mitigation Strategy |
|------|------------|--------|-------------------|
| Incomplete test scenarios | Medium | Medium | QA review, coverage metrics |
| Maintenance burden | Medium | Medium | Good abstractions, documentation |
| Environment differences | Low | Medium | Containerized test environment |

### Mitigation Plans
1. **Flakiness Mitigation**
   - Implement test retry mechanism (max 3 retries)
   - Add wait conditions for async operations
   - Ensure database state cleanup

2. **Performance Mitigation**
   - Run tests in parallel where possible
   - Optimize database queries in tests
   - Use in-memory database for unit tests

3. **Maintenance Mitigation**
   - Create comprehensive test documentation
   - Establish test review process
   - Regular test suite health checks

## Appendices

### Appendix A: Current Test Coverage Analysis

```
Current Coverage (13/38+ endpoints):
✅ Authentication (6/8)
  - POST /auth/signin
  - POST /auth/signup
  - POST /auth/refresh
  - POST /auth/logout
  - PATCH /auth/profile
  - GET /auth/me (partial)

✅ Health (3/3)
  - GET /health
  - GET /live
  - GET /ready

✅ Onboarding (4/4) 
  - POST /onboarding/interest
  - POST /onboarding/extract-profile
  - POST /onboarding/save-profile
  - POST /onboarding/complete

❌ Timeline Nodes (0/11)
❌ GraphRAG (0/1)
❌ Users (0/2)
❌ Organizations (0/2)
❌ Node Permissions (0/6)
❌ AI Endpoints (0/12)
```

### Appendix B: Test Quality Checklist

- [ ] Each endpoint has at least one happy path test
- [ ] Each endpoint has validation error tests
- [ ] Each endpoint has authorization tests
- [ ] Response format matches OpenAPI schema
- [ ] Error responses use standard format
- [ ] Tests are isolated and repeatable
- [ ] Tests complete within performance budget
- [ ] Test descriptions are clear and meaningful
- [ ] Test data is properly cleaned up
- [ ] Async operations are properly handled

### Appendix C: Sample Test Implementation

```typescript
// Example: Timeline Node Creation Test
describe('Timeline Nodes API', () => {
  let app: Application;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    app = await createApp();
    const auth = await createAuthenticatedUser();
    authToken = auth.accessToken;
    testUser = auth.user;
  });

  describe('POST /v2/timeline/nodes', () => {
    it('should create a root timeline node', async () => {
      const nodeData = {
        type: 'job',
        meta: {
          title: 'Software Engineer',
          company: 'Tech Corp',
          startDate: '2024-01-01',
          description: 'Full-stack development role'
        }
      };

      const response = await request(app)
        .post('/api/v2/timeline/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(nodeData)
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          type: 'job',
          userId: testUser.id,
          parentId: null,
          meta: expect.objectContaining({
            title: 'Software Engineer'
          })
        },
        meta: {
          timestamp: expect.any(String)
        }
      });

      // Cleanup
      await deleteTestNode(response.body.data.id);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing type field
        meta: {
          title: 'Invalid Node'
        }
      };

      const response = await request(app)
        .post('/api/v2/timeline/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('type')
        }
      });
    });
  });
});
```

### Appendix D: References

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [API Testing Best Practices](https://testautomationu.applitools.com/exploring-service-apis-through-test-automation/)
- [OpenAPI Testing Tools](https://openapi.tools/#testing)
- Internal: Lighthouse API Documentation
- Internal: Existing Test Implementations

## Approval Sign-offs

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| QA Lead | | | |
| Product Manager | | | |
| DevOps Lead | | | |

---

**Document Status**: DRAFT - Awaiting Review and Approval

**Next Steps**: 
1. Review with engineering team
2. Obtain stakeholder approval
3. Begin Phase 1 implementation upon approval