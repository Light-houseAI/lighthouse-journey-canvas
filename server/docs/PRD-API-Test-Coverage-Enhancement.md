# PRD: API Test Coverage Enhancement

## 📋 Overview

**Product**: Lighthouse Journey Canvas API Test Suite  
**Version**: 1.0  
**Status**: Draft  
**Created**: 2025-09-15  
**Priority**: High  

## 🎯 Problem Statement

The current API test suite has only **35% endpoint coverage** (13/38+ endpoints tested), leaving critical core features untested including Timeline Nodes, GraphRAG Search, and User Management. This creates significant risk for production deployments and reduces confidence in API stability.

## 🎯 Product Goals

1. **Achieve >80% API endpoint test coverage** 
2. **Ensure OpenAPI schema synchronization** with all implemented endpoints
3. **Establish consistent testing patterns** across all API modules
4. **Validate core feature reliability** before production deployment
5. **Enable confident continuous deployment** with comprehensive test coverage

## 📊 Current State Analysis

### ✅ Tested Endpoints (13 endpoints - 35%)
- **Authentication**: 6/8 endpoints tested
- **Health Checks**: 3/3 endpoints tested  
- **Onboarding**: 4/4 endpoints tested

### ❌ Missing Test Coverage (25+ endpoints - 65%)
- **Timeline/Hierarchy Nodes**: 0/11 endpoints tested ⚠️ **CRITICAL**
- **GraphRAG Search**: 0/1 endpoints tested ⚠️ **CRITICAL**
- **User Management**: 0/2 endpoints tested
- **Organizations**: 0/2 endpoints tested
- **Additional Auth**: 0/2 endpoints tested

## 📋 Requirements

### 🎯 Functional Requirements

#### FR1: Timeline Node API Testing
**Priority: P0 (Critical)**
- Test all 11 timeline node endpoints
- Validate CRUD operations (Create, Read, Update, Delete)
- Test hierarchical relationships (parent-child nodes)
- Verify permission-based access control
- Test node insights functionality

**Endpoints to Test:**
```
POST /v2/timeline/nodes - Create timeline node
GET /v2/timeline/nodes - List user's timeline nodes
GET /v2/timeline/nodes/:id - Get node by ID
PATCH /v2/timeline/nodes/:id - Update timeline node
DELETE /v2/timeline/nodes/:id - Delete timeline node
GET /v2/timeline/nodes/:nodeId/insights - Get node insights
POST /v2/timeline/nodes/:nodeId/insights - Create node insight
PUT /v2/timeline/insights/:insightId - Update insight
DELETE /v2/timeline/insights/:insightId - Delete insight
GET /v2/timeline/nodes/:nodeId/permissions - Get node permissions
POST /v2/timeline/nodes/:nodeId/permissions - Set node permissions
```

#### FR2: GraphRAG Search API Testing
**Priority: P0 (Critical)**
- Test vector similarity search functionality
- Validate search query processing
- Test result ranking and scoring
- Verify multi-tenant search isolation

**Endpoints to Test:**
```
POST /v2/graphrag/search - Vector + graph search
```

#### FR3: User Management API Testing
**Priority: P1 (High)**
- Test user search functionality
- Validate user profile retrieval
- Test pagination and filtering

**Endpoints to Test:**
```
GET /users/search - Search users
GET /users/:userId - Get user by ID
```

#### FR4: Organization API Testing
**Priority: P2 (Medium)**
- Test organization listing and search
- Validate organization data structure

**Endpoints to Test:**
```
GET /organizations - List organizations
GET /organizations/search - Search organizations
```

#### FR5: Additional Authentication Testing
**Priority: P2 (Medium)**
- Test token revocation functionality
- Validate debug endpoints (dev only)

**Endpoints to Test:**
```
POST /auth/revoke-all - Revoke all tokens
GET /auth/debug/tokens - Debug tokens (dev only)
```

### 🛡️ Non-Functional Requirements

#### NFR1: Testing Architecture Consistency
- Follow existing app-based testing pattern (not URL-based)
- Use `createApp()` for test app instance creation
- Implement proper container initialization and disposal
- Maintain authentication context setup patterns

#### NFR2: Response Validation Standards
- Validate `ApiSuccessResponse` structure (`success`, `data`, `meta`)
- Verify `ApiErrorResponse` format for error cases
- Test HTTP status code compliance with OpenAPI spec
- Validate Content-Type headers

#### NFR3: Performance and Reliability
- All tests must complete within 30-second timeout
- Implement proper test isolation (no shared state)
- Use unique test data generation (timestamps + process ID)
- Clean database state between test runs

#### NFR4: Schema Compliance
- Ensure 100% OpenAPI schema adherence
- Validate request/response schemas match documentation
- Test all required and optional fields
- Verify data type compliance

## 🏗️ Technical Implementation

### Test File Structure
```
server/tests/api/
├── auth.test.ts ✅ (existing)
├── health.test.ts ✅ (existing)  
├── onboarding.test.ts ✅ (existing)
├── timeline-nodes.test.ts ❌ (new - P0)
├── graphrag.test.ts ❌ (new - P0)
├── users.test.ts ❌ (new - P1)
├── organizations.test.ts ❌ (new - P2)
└── auth-extended.test.ts ❌ (new - P2)
```

### Implementation Pattern Template
```typescript
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../app';
import { Container } from '../../core/container-setup';

describe('API Module Name', () => {
  let app: Application;
  let authToken: string;
  
  beforeAll(async () => {
    app = await createApp();
    // Setup authentication context
    const authResponse = await request(app)
      .post('/api/auth/signup')
      .send(testUserData);
    authToken = authResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('GET /endpoint', () => {
    test('should return successful response', async () => {
      const response = await request(app)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      // Validate ApiSuccessResponse structure
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.meta.timestamp).toBeDefined();
      
      // Validate specific response data
      // ... endpoint-specific validations
    });
  });
});
```

### Authentication Context Setup
```typescript
// Standard test user generation with uniqueness
const generateTestUser = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const processId = process.pid;
  
  return {
    email: `test.user.${timestamp}.${random}.${processId}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    userName: `testuser${timestamp}${random}${processId}`,
    interest: 'grow-career'
  };
};
```

## ✅ Acceptance Criteria

### AC1: Test Coverage Metrics
- [ ] **>80% endpoint coverage** achieved (32+ of 38+ endpoints tested)
- [ ] **All P0 endpoints tested** (Timeline Nodes, GraphRAG Search)
- [ ] **All P1 endpoints tested** (User Management)
- [ ] **Test suite passes with >95% success rate**

### AC2: OpenAPI Schema Synchronization
- [ ] **All implemented endpoints documented** in openapi-schema.yaml
- [ ] **Request/response schemas match** actual implementation
- [ ] **Error codes align** with schema definitions
- [ ] **No undocumented endpoints** exist in route files

### AC3: Testing Pattern Compliance
- [ ] **App-based testing pattern** used consistently
- [ ] **Standardized response validation** implemented
- [ ] **Proper authentication setup** in all protected endpoints
- [ ] **Database isolation** maintained between tests

### AC4: Quality Assurance
- [ ] **All tests pass** in CI/CD pipeline
- [ ] **No flaky tests** (consistent >98% pass rate)
- [ ] **Performance requirements met** (<30s timeout)
- [ ] **Code coverage reports** generated and reviewed

## 📅 Implementation Timeline

### Phase 1: Foundation (Week 1)
- [ ] Create timeline-nodes.test.ts (P0)
- [ ] Create graphrag.test.ts (P0)
- [ ] Validate OpenAPI schema synchronization
- [ ] Commit existing changes with proper organization

### Phase 2: Core Coverage (Week 2)
- [ ] Create users.test.ts (P1)
- [ ] Enhance authentication test coverage
- [ ] Implement comprehensive response validation
- [ ] Achieve 60%+ endpoint coverage

### Phase 3: Complete Coverage (Week 3)
- [ ] Create organizations.test.ts (P2)
- [ ] Create auth-extended.test.ts (P2)
- [ ] Achieve >80% endpoint coverage target
- [ ] Performance optimization and cleanup

### Phase 4: Quality Assurance (Week 4)
- [ ] End-to-end testing validation
- [ ] CI/CD pipeline integration
- [ ] Documentation updates
- [ ] Production readiness assessment

## 🚀 Success Metrics

- **Endpoint Coverage**: >80% (Target: 32+/38+ endpoints)
- **Test Pass Rate**: >95% consistently
- **Test Execution Time**: <5 minutes total
- **Schema Compliance**: 100% OpenAPI adherence
- **Critical Path Coverage**: 100% (auth, timeline, search)

## 🔄 Maintenance Strategy

- **Automated Coverage Reports**: Generated on each PR
- **Schema Validation**: Automated OpenAPI compliance checks
- **Performance Monitoring**: Track test execution time trends
- **Regular Review**: Monthly test coverage and quality assessment

## 📚 References

- [Current OpenAPI Schema](../server/openapi-schema.yaml)
- [Existing Test Patterns](../server/tests/api/)
- [Vitest Configuration](../server/vitest.config.ts)
- [API Architecture Documentation](../docs/api/)