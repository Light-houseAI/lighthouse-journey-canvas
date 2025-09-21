# Lighthouse Node Management API Testing Guide

## Overview

This guide provides comprehensive instructions for testing the Lighthouse Node Management API using Postman, including setup, test scenarios, automation, and troubleshooting.

## Quick Start

### 1. Import Files into Postman

1. Open Postman
2. Click **Import** button
3. Import both files:
   - `Lighthouse-Node-API.postman_collection.json`
   - `Lighthouse-API.postman_environment.json`

### 2. Configure Environment

1. Select "Lighthouse API Environment" from the environment dropdown
2. Update the following variables:
   - `apiBaseUrl`: Your API server URL (default: `http://localhost:3001`)
   - `userEmail`: Your test account email
   - `userPassword`: Your test account password

### 3. Run Authentication

1. Navigate to **Authentication > Login**
2. Click **Send** to authenticate
3. Verify that `authToken` and `profileId` are automatically set in environment variables

### 4. Test API Endpoints

Start with basic CRUD operations:
1. Create a work experience
2. Create an education record  
3. Create a project
4. Test aggregation endpoints

## Test Scenarios

### Scenario 1: Basic CRUD Operations

**Objective**: Test create, read, update, delete operations for each node type.

**Steps**:
1. **Create Work Experience**
   - Navigate to "Work Experiences > Create Work Experience"
   - Modify request body as needed
   - Send request and verify 201 status
   - Check that `workExperienceId` is saved to environment

2. **Read Work Experience**
   - Navigate to "Work Experiences > Get Work Experience by ID"
   - Send request and verify 200 status
   - Verify response data matches created record

3. **Update Work Experience**
   - Navigate to "Work Experiences > Update Work Experience"
   - Modify request body with updates
   - Send request and verify 200 status

4. **Delete Work Experience**
   - Navigate to "Work Experiences > Delete Work Experience"
   - Send request and verify 204 status

**Repeat for Education and Projects**

### Scenario 2: Advanced Filtering and Pagination

**Objective**: Test filtering, sorting, and pagination capabilities.

**Steps**:
1. Create multiple records of each type with varying dates and properties
2. Test pagination:
   - Set `limit=5` and `page=1`
   - Verify `meta` object contains correct pagination info
   - Test `page=2` with same limit
3. Test sorting:
   - Sort by `startDate` ascending
   - Sort by `startDate` descending
   - Sort by `title` alphabetically
4. Test filtering:
   - Filter work experiences by `company`
   - Filter education by `institution`
   - Filter projects by `status`

### Scenario 3: Date Validation and Overlaps

**Objective**: Test date validation logic and overlap detection.

**Steps**:
1. **Test Date Validation**
   - Navigate to "Work Experiences > Advanced Queries > Validate Work Experience Dates"
   - Test valid date range (start before end)
   - Test invalid date range (start after end)
   - Verify appropriate responses

2. **Test Overlap Detection**
   - Create overlapping work experiences
   - Navigate to "Work Experiences > Advanced Queries > Check Overlapping Work Experiences"
   - Verify overlaps are detected and reported

3. **Test Date Range Queries**
   - Navigate to "Work Experiences > Advanced Queries > Get Work Experiences by Date Range"
   - Test various date ranges
   - Verify only matching records are returned

### Scenario 4: Node Aggregation

**Objective**: Test aggregated node operations and statistics.

**Steps**:
1. **Get All Nodes**
   - Navigate to "Node Aggregation > Get All Nodes"
   - Verify all node types are included
   - Check response structure matches expected format

2. **Get Filtered Nodes**
   - Navigate to "Node Aggregation > Get Filtered Nodes"
   - Test various filter combinations:
     - Filter by multiple node types
     - Filter by date ranges
     - Search across titles and descriptions
     - Combine multiple filters

3. **Get Statistics**
   - Navigate to "Node Aggregation > Get Node Statistics"
   - Verify statistics accuracy:
     - Total node counts match actual data
     - Date ranges are correct
     - Technology counts are accurate

### Scenario 5: Error Handling

**Objective**: Test error responses and edge cases.

**Steps**:
1. **Authentication Errors**
   - Remove auth token from environment
   - Send any authenticated request
   - Verify 401 Unauthorized response

2. **Validation Errors**
   - Send create request with missing required fields
   - Verify 400 Bad Request with validation details

3. **Not Found Errors**
   - Request non-existent resource by ID
   - Verify 404 Not Found response

4. **Profile Ownership**
   - Try to access another user's profile (if available)
   - Verify 403 Forbidden response

### Scenario 6: Performance and Rate Limiting

**Objective**: Test API performance and rate limiting.

**Steps**:
1. **Response Time Testing**
   - Monitor response times in test results
   - Verify all responses are under 2000ms (as per collection tests)

2. **Rate Limiting** (if implemented)
   - Send rapid successive requests
   - Monitor rate limit headers
   - Verify 429 status when limit exceeded

## Automated Testing

### Collection Runner

1. **Setup Collection Runner**
   - Select the entire collection or specific folders
   - Choose environment
   - Set iterations and delay

2. **Test Order**
   - Run in this order for dependencies:
     1. Authentication
     2. Work Experiences (Create before Read/Update/Delete)
     3. Education
     4. Projects
     5. Node Aggregation
     6. Utilities

3. **Monitoring Results**
   - Review test results summary
   - Check for failed assertions
   - Export results for reporting

### Custom Test Scripts

The collection includes pre-written test scripts for:

- **Response validation**: Status codes, response structure
- **Data extraction**: Automatically save IDs to environment variables
- **Business logic**: Validate response data consistency
- **Performance**: Response time assertions

### Newman CLI Testing

Run tests from command line using Newman:

```bash
# Install Newman
npm install -g newman

# Run entire collection
newman run Lighthouse-Node-API.postman_collection.json \
  -e Lighthouse-API.postman_environment.json

# Run specific folder
newman run Lighthouse-Node-API.postman_collection.json \
  -e Lighthouse-API.postman_environment.json \
  --folder "Work Experiences"

# Generate reports
newman run Lighthouse-Node-API.postman_collection.json \
  -e Lighthouse-API.postman_environment.json \
  -r html,json --reporter-html-export results.html
```

## Test Data Management

### Sample Data Sets

#### Work Experience Sample Data:
```json
{
  "title": "Senior Software Engineer",
  "company": "TechCorp Inc.",
  "position": "Senior Software Engineer",
  "startDate": "2023-01-15",
  "endDate": null,
  "employmentType": "full-time",
  "technologies": ["TypeScript", "React", "Node.js"],
  "achievements": ["Led team of 4", "Improved performance by 35%"]
}
```

#### Education Sample Data:
```json
{
  "title": "Master of Computer Science",
  "institution": "Tech University",
  "degree": "Master of Science",
  "field": "Computer Science",
  "startDate": "2020-09-01",
  "endDate": "2022-06-15",
  "level": "masters",
  "gpa": 3.8
}
```

#### Project Sample Data:
```json
{
  "title": "E-commerce Platform",
  "description": "Full-stack e-commerce application",
  "status": "completed",
  "startDate": "2023-03-01",
  "endDate": "2023-08-15",
  "technologies": ["React", "Node.js", "PostgreSQL"],
  "projectType": "professional"
}
```

### Environment Variables Reference

| Variable | Description | Auto-populated |
|----------|-------------|----------------|
| `apiBaseUrl` | API server base URL | No |
| `authToken` | Authentication token | Yes (from login) |
| `userEmail` | Login email | No |
| `userPassword` | Login password | No |
| `profileId` | User profile ID | Yes (from login) |
| `workExperienceId` | Created work experience ID | Yes (from create) |
| `educationId` | Created education ID | Yes (from create) |
| `projectId` | Created project ID | Yes (from create) |
| `milestoneId` | Created milestone ID | Yes (from create) |
| `nodeType` | Node type for testing | No |

## Troubleshooting

### Common Issues

#### 1. Authentication Failures
**Symptoms**: 401 Unauthorized responses
**Solutions**:
- Verify credentials in environment variables
- Check if login request completed successfully
- Ensure `authToken` is populated in environment
- Verify token hasn't expired

#### 2. Profile Access Issues
**Symptoms**: 403 Forbidden responses
**Solutions**:
- Verify `profileId` in environment matches authenticated user
- Check user permissions
- Ensure profile exists and is accessible

#### 3. Validation Errors
**Symptoms**: 400 Bad Request with validation details
**Solutions**:
- Review request body against schema requirements
- Check required fields are included
- Verify data types match schema
- Validate date formats (ISO 8601)

#### 4. Network Connection Issues
**Symptoms**: Request timeouts or connection errors
**Solutions**:
- Verify API server is running
- Check `apiBaseUrl` in environment variables
- Test network connectivity
- Check firewall/proxy settings

#### 5. Test Script Failures
**Symptoms**: Test assertions failing in Postman
**Solutions**:
- Check response structure matches expected format
- Verify test data is consistent
- Review test scripts for logic errors
- Check environment variable dependencies

### Debug Strategies

1. **Console Logging**
   - Add `console.log()` statements in test scripts
   - View output in Postman console

2. **Response Inspection**
   - Examine full response body
   - Check response headers
   - Verify HTTP status codes

3. **Environment Verification**
   - Review all environment variables
   - Check variable values are correct
   - Verify auto-population is working

4. **Incremental Testing**
   - Test endpoints individually
   - Build up complexity gradually
   - Isolate problematic requests

## Best Practices

### Test Organization
- Group related tests in folders
- Use descriptive names for requests
- Include comprehensive descriptions
- Maintain consistent naming conventions

### Environment Management
- Use separate environments for different stages
- Keep sensitive data secure
- Document environment setup requirements
- Version control environment templates

### Test Maintenance
- Update tests when API changes
- Review and refactor test scripts regularly
- Keep sample data current and relevant
- Document test scenarios and expectations

### Collaboration
- Share collections and environments with team
- Use team workspaces for collaboration
- Document test procedures and findings
- Establish testing schedules and responsibilities

## Reporting

### Test Results
- Export collection run results
- Generate HTML reports with Newman
- Track test metrics over time
- Document failed test cases

### Performance Metrics
- Monitor response times
- Track error rates
- Measure throughput
- Identify performance bottlenecks

### Issue Tracking
- Document bugs found during testing
- Link test cases to requirements
- Track resolution status
- Maintain test coverage reports

---

## Support

For questions or issues with API testing:

1. Check this guide for common solutions
2. Review API documentation for endpoint details
3. Contact the development team for API-specific issues
4. Refer to Postman documentation for tool-specific help