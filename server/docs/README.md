# Lighthouse Node Management API Documentation

This directory contains comprehensive documentation and testing resources for the Lighthouse Node Management API.

## 📁 Files Overview

### 🔧 **Postman Collection & Environment**
- **`Lighthouse-Node-API.postman_collection.json`** - Complete Postman collection with all API endpoints, examples, and test scripts
- **`Lighthouse-API.postman_environment.json`** - Environment variables template for API testing

### 📖 **Documentation**
- **`API-Documentation.md`** - Complete API reference documentation with endpoints, schemas, and examples
- **`API-Testing-Guide.md`** - Comprehensive testing guide with scenarios, automation, and troubleshooting
- **`README.md`** - This overview file

## 🚀 Quick Start

### 1. Import into Postman
1. Open Postman
2. Click **Import** > **Upload Files**
3. Import both JSON files:
   - `Lighthouse-Node-API.postman_collection.json`
   - `Lighthouse-API.postman_environment.json`

### 2. Configure Environment
1. Select "Lighthouse API Environment" from dropdown
2. Update these variables:
   - `apiBaseUrl`: Your API server URL (default: `http://localhost:3001`)
   - `userEmail`: Test account email
   - `userPassword`: Test account password

### 3. Test Authentication
1. Navigate to **Authentication > Login**
2. Click **Send**
3. Verify `authToken` and `profileId` are auto-populated

### 4. Start Testing
- Work through the collection folders in order
- Each request includes example data and test scripts
- Environment variables are automatically managed

## 📚 API Overview

### **Endpoint Categories**

#### 🔐 Authentication
- Login/logout functionality
- User profile access
- Session-based authentication with bearer tokens

#### 💼 Work Experiences
- Full CRUD operations
- Advanced filtering (company, employment type, dates)
- Date validation and overlap detection
- Comprehensive work history management

#### 🎓 Education
- Education record management
- Institution, degree, and field tracking
- GPA, honors, and project documentation
- Academic timeline management

#### 🚀 Projects
- Project lifecycle management
- Technology stack tracking
- Status monitoring (planning → completed)
- Repository and live URL management

#### 🔄 Node Aggregation
- Unified view across all node types
- Advanced filtering and sorting
- Comprehensive statistics and analytics
- Timeline visualization support

#### 🏷️ Legacy Milestones
- Backward compatibility endpoints
- Migration support from old milestone system

#### ⚡ Utilities
- Health check monitoring
- API documentation endpoint
- System status verification

## 🎯 Key Features

### **Advanced Capabilities**
- **Date Range Queries**: Filter records by start/end dates
- **Overlap Detection**: Identify conflicting time periods
- **Technology Analytics**: Track skills and technology usage
- **Statistics Dashboard**: Comprehensive profile analytics
- **Search Functionality**: Full-text search across titles and descriptions

### **Data Validation**
- Schema validation with Zod
- Business rule enforcement
- Date logic validation
- Required field checking

### **Response Format**
```json
{
  "success": true,
  "data": { /* Response data */ },
  "meta": { /* Optional metadata */ }
}
```

### **Error Handling**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description",
    "details": [ /* Optional details */ ]
  }
}
```

## 🧪 Testing Features

### **Automated Test Scripts**
- Response validation (status codes, structure)
- Data extraction (auto-save IDs to environment)
- Business logic validation
- Performance assertions (< 2000ms)

### **Test Scenarios Included**
1. **CRUD Operations**: Create, read, update, delete for each node type
2. **Advanced Filtering**: Date ranges, search, multi-field filters
3. **Validation Testing**: Date logic, required fields, business rules
4. **Error Handling**: Authentication, validation, not found scenarios
5. **Performance**: Response time monitoring
6. **Integration**: Cross-node-type operations

### **Pre-request Scripts**
- Authentication token management
- Environment variable validation
- Request data preparation

## 📊 Node Types Supported

| Type | Description | Key Fields |
|------|-------------|------------|
| **Work Experience** | Employment history | Company, position, technologies, achievements |
| **Education** | Academic background | Institution, degree, GPA, projects |
| **Project** | Personal/professional projects | Status, technologies, repository, outcomes |
| **Event** | Conferences, meetups | Type, role, takeaways (future) |
| **Action** | Certifications, achievements | Category, status, evidence (future) |
| **Career Transition** | Role/industry changes | Transition type, motivations (future) |

## 🔧 Environment Variables

| Variable | Description | Auto-populated |
|----------|-------------|----------------|
| `apiBaseUrl` | API server URL | ❌ Manual |
| `authToken` | Authentication token | ✅ From login |
| `userEmail` | Login email | ❌ Manual |
| `userPassword` | Login password | ❌ Manual |
| `profileId` | User profile ID | ✅ From login |
| `workExperienceId` | Work experience ID | ✅ From creation |
| `educationId` | Education record ID | ✅ From creation |
| `projectId` | Project ID | ✅ From creation |

## 📋 Common Query Parameters

### **Pagination**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

### **Sorting**
- `sortBy`: Field name (startDate, endDate, title, etc.)
- `sortOrder`: `asc` or `desc`

### **Filtering**
- Date filters: `startDate`, `endDate`, date ranges
- Status filters: `active`, `completed`, `in-progress`
- Type-specific filters: `company`, `institution`, `status`
- Search: `search` parameter for full-text search

## 🐛 Troubleshooting

### **Common Issues**

1. **401 Unauthorized**
   - Check `authToken` in environment
   - Verify login was successful
   - Ensure token hasn't expired

2. **403 Forbidden**
   - Verify `profileId` matches authenticated user
   - Check user permissions

3. **400 Bad Request**
   - Review request body against schema
   - Check required fields
   - Validate date formats (ISO 8601)

4. **404 Not Found**
   - Verify resource IDs are correct
   - Check if resource was created successfully

### **Debug Tips**
- Use Postman console for logging
- Check response bodies for detailed error messages
- Verify environment variables are populated
- Test endpoints individually before running full collection

## 📈 Performance Expectations

- **Response Time**: < 2000ms for all endpoints
- **Rate Limit**: 100 requests/minute per user
- **Pagination**: Max 100 items per page
- **Search**: Full-text search across titles and descriptions

## 🤝 Contributing

When updating the API documentation:

1. **Update Collection**: Modify Postman collection for new endpoints
2. **Update Environment**: Add new environment variables as needed
3. **Update Docs**: Keep `API-Documentation.md` synchronized
4. **Update Tests**: Add test scenarios for new functionality
5. **Version Control**: Commit all changes together

## 📞 Support

For questions or issues:

1. **Check Documentation**: Review `API-Documentation.md` for endpoint details
2. **Check Testing Guide**: Review `API-Testing-Guide.md` for testing issues
3. **Development Team**: Contact for API-specific questions
4. **Postman Help**: Refer to Postman documentation for tool issues

---

## 📝 Change Log

### Version 1.0.0 (Current)
- ✅ Complete API collection with all endpoints
- ✅ Comprehensive environment configuration
- ✅ Automated test scripts and validation
- ✅ Full documentation suite
- ✅ Error handling and edge cases
- ✅ Performance monitoring
- ✅ Sample data and examples

### Future Enhancements
- 🔄 Event node type implementation
- 🔄 Action node type implementation  
- 🔄 Career transition node type implementation
- 🔄 Advanced analytics endpoints
- 🔄 Bulk operations support
- 🔄 Export/import functionality