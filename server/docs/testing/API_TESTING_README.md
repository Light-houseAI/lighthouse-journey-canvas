# Journey Canvas API Testing Suite

This directory contains comprehensive API testing for the Journey Canvas Enhancement project using Postman collections and Newman automated testing.

## 🎯 Purpose

This testing suite validates the backend API implementation against the PRD requirements specified in `PRD_JOURNEY_CANVAS_ENHANCEMENT.md`. It provides:

1. **Automated API Testing** - Test all endpoints systematically
2. **PRD Compliance Validation** - Verify implementation matches requirements
3. **Performance Testing** - Check response times and system behavior
4. **Error Handling Validation** - Test edge cases and error scenarios
5. **Integration Testing** - Verify component interactions work correctly

## 📁 Test Files

- `postman-collection.json` - Complete API test collection (35+ requests)
- `postman-environment.json` - Test environment configuration
- `run-api-tests.js` - Newman test runner with PRD compliance reporting
- `API_TESTING_README.md` - This documentation

## 🚀 Quick Start

### Prerequisites

1. **Start the development server**:

   ```bash
   npm run dev
   ```

   Server should be running on `http://localhost:3000`

2. **Ensure database is set up**:
   ```bash
   npm run db:push
   ```

### Run Tests

```bash
# Run the complete API test suite
npm run test:api

# Or run directly with node
node run-api-tests.js
```

### Watch Mode (Development)

```bash
# Automatically re-run tests when server code changes
npm run test:api:watch
```

## 📊 Test Categories

### 1. Authentication & User Management

- ✅ User signup/signin
- ✅ Session management
- ✅ User profile retrieval
- ✅ Authentication validation

### 2. Profile Management

- ✅ Profile creation with LinkedIn data
- ✅ Profile retrieval and updates
- ✅ Experience and education data handling

### 3. AI Chat System (PRD US1, US2)

- ✅ Initial welcome messages
- ✅ Company mention detection (PRD US1 test)
- ✅ Progressive time selection (PRD US4)
- ✅ Streaming response handling

### 4. Skill Extraction System (PRD US3)

- ✅ Automatic skill extraction from text
- ✅ Skill categorization (technical, soft, domain)
- ✅ Confidence scoring
- ✅ User skill management

### 5. Milestone Management (PRD US5)

- ✅ Milestone CRUD operations
- ✅ Sub-milestone creation
- ✅ STAR details storage
- ✅ Smart categorization

### 6. Timeline Navigation (PRD Missing)

- ❌ Timeline navigation endpoint (`/api/timeline/navigate`)
- ⚠️ Company-based navigation testing

### 7. Performance & Error Testing

- ✅ Response time validation (<5s for AI chat)
- ✅ Large message handling
- ✅ Invalid data validation
- ✅ Unauthorized access protection

## 📋 PRD Compliance Testing

The test suite specifically validates these PRD user stories:

### US1: Dynamic Timeline Navigation

**Test**: "When I mention 'Google' in chat, timeline scrolls to Google experience node"

- ✅ AI processes company mentions in chat
- ❌ Timeline navigation endpoint missing
- **Status**: Partially implemented

### US2: Contextual Welcome Messages

**Test**: "Personalized welcome messages based on previous conversations"

- ✅ Welcome message generation
- ✅ User context integration
- **Status**: Implemented

### US3: Automatic Skill Tracking

**Test**: "Skills automatically identified and tracked"

- ✅ Real-time skill extraction
- ✅ Categorization and confidence scoring
- ✅ Skill storage and retrieval
- **Status**: Fully implemented

### US4: Progressive Information Capture

**Test**: "Updates that match available time"

- ✅ Time-based conversation flows
- ✅ Question adaptation
- **Status**: Implemented

### US5: Smart Project Organization

**Test**: "Projects automatically categorized and positioned"

- ✅ Milestone categorization
- ✅ Hierarchical organization
- **Status**: Implemented

## 📊 Generated Reports

After running tests, you'll find these reports:

1. **`test-results.html`** - Visual HTML test report
2. **`test-results.json`** - Detailed JSON results
3. **`prd-compliance-report.json`** - PRD compliance analysis

### PRD Compliance Report Structure

```json
{
  "timestamp": "2025-01-25T...",
  "totalRequests": 25,
  "passedTests": 22,
  "failedTests": 3,
  "successRate": "88.00",
  "prdCompliance": {
    "authentication": { "status": "compliant", "tests": [...] },
    "aiChat": { "status": "compliant", "tests": [...] },
    "skillExtraction": { "status": "compliant", "tests": [...] },
    "milestoneManagement": { "status": "compliant", "tests": [...] },
    "timelineNavigation": { "status": "non_compliant", "tests": [...] },
    "performanceTests": { "status": "partially_compliant", "tests": [...] }
  },
  "issues": [...],
  "recommendations": [...]
}
```

## 🔧 Configuration

### Environment Variables

The test environment can be configured in `postman-environment.json`:

```json
{
  "baseUrl": "http://localhost:3000",
  "testUserEmail": "test.user@journeycanvas.test",
  "testUserPassword": "testPassword123!"
}
```

### Test Timeouts

- Default request timeout: 30 seconds
- Delay between requests: 500ms
- AI chat timeout: 5 seconds (performance requirement)

## 🐛 Troubleshooting

### Common Issues

1. **Server not running**

   ```
   ❌ Server is not running on http://localhost:3000
   ```

   **Solution**: Run `npm run dev` to start the development server

2. **Database connection errors**

   ```
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```

   **Solution**: Ensure PostgreSQL is running and database is set up

3. **Authentication failures**

   ```
   401 Unauthorized
   ```

   **Solution**: Check session management and cookie handling

4. **Newman not found**
   ```
   command not found: newman
   ```
   **Solution**: Install Newman: `npm install -g newman` or use `npx newman`

### Debug Mode

For detailed debugging, you can run Newman directly:

```bash
# Run with verbose output
npx newman run postman-collection.json \
  -e postman-environment.json \
  --reporters cli,json \
  --reporter-json-export debug-results.json \
  --verbose
```

## 📈 Performance Expectations

Based on PRD requirements:

- **Chat response time**: < 2 seconds (target), < 5 seconds (test threshold)
- **Timeline rendering**: < 1 second
- **Skill extraction**: < 500ms
- **Error rate**: < 1%

## 🎯 Integration Issues Detection

The test suite identifies these integration issues:

1. **Missing Endpoints**: PRD-specified endpoints not implemented
2. **Response Format Mismatches**: API responses don't match PRD schemas
3. **Authentication Issues**: Session/auth not working correctly
4. **Performance Problems**: Response times exceeding thresholds
5. **Data Consistency**: Database state not matching expectations

## 📝 Adding New Tests

To add new tests to the collection:

1. Open `postman-collection.json`
2. Add new test item to appropriate folder
3. Include proper test assertions
4. Update PRD compliance mapping in `run-api-tests.js`

Example test structure:

```json
{
  "name": "New Test",
  "event": [
    {
      "listen": "test",
      "script": {
        "exec": [
          "pm.test('Test assertion', function () {",
          "    pm.response.to.have.status(200);",
          "});"
        ]
      }
    }
  ],
  "request": {
    "method": "POST",
    "url": "{{baseUrl}}/api/new-endpoint"
  }
}
```

## 🚀 Continuous Integration

This test suite can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run API Tests
  run: |
    npm run dev &
    sleep 10  # Wait for server to start
    npm run test:api
    pkill -f "tsx server/index.ts"  # Stop server
```

## 📊 Success Criteria

Test suite passes when:

- ✅ All authentication flows work correctly
- ✅ AI chat system responds within performance thresholds
- ✅ Skill extraction accuracy is maintained
- ✅ Milestone management operates correctly
- ✅ Error handling is robust
- ⚠️ Timeline navigation endpoint implementation (PRD gap)

The test suite provides comprehensive validation of the Journey Canvas Enhancement backend against PRD requirements, highlighting both implemented features and gaps that need attention.
