# Lighthouse Node Management API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Jobs](#jobs)
  - [Education](#education)
  - [Projects](#projects)
  - [Actions](#actions)
  - [Events](#events)
  - [Career Transitions](#career-transitions)
- [Data Models](#data-models)
- [Query Parameters](#query-parameters)
- [Status Codes](#status-codes)
- [Examples](#examples)

## Overview

The Lighthouse Node Management API provides clean, simple CRUD endpoints for managing career journey nodes. This API follows RESTful principles and supports only essential CRUD operations with basic pagination.

### Key Features

- **Simple CRUD Operations**: Create, read, update, and delete career nodes
- **Six Node Types**: Jobs, Education, Projects, Actions, Events, and Career Transitions
- **Basic Pagination**: Simple page-based pagination for list endpoints
- **Clean Structure**: Simplified API without complex filtering or aggregation

### Recent API Improvements

- **JWT Authentication**: Secure stateless authentication with access/refresh token rotation
- **Standardized Responses**: Consistent response format across all endpoints
- **Enhanced Security**: Proper token management and secure logout functionality
- **Improved Error Handling**: Standardized error codes for better client integration
- **Request Tracing**: Request ID tracking for debugging and monitoring

## Authentication

The API uses JWT-based authentication with access tokens and refresh tokens for secure, stateless authentication.

### Authentication Flow

1. **Register/Login**: POST to `/auth/signup` or `/auth/signin` with credentials
2. **Get Tokens**: Extract access token and refresh token from successful response
3. **Use Access Token**: Include access token in `Authorization` header for API calls
4. **Token Format**: `Authorization: Bearer <access_token>`
5. **Refresh Tokens**: Use refresh token to get new access tokens when they expire
6. **Logout**: POST to `/auth/logout` to revoke refresh tokens

### Authorization

- Users can only access their own profile data
- Profile ownership is validated for all endpoints
- Unauthorized access returns 401/403 status codes

## Base URL

```
http://localhost:3001
```

For production environments, replace with the appropriate domain.

## Request/Response Format

### Content Type

All API requests and responses use `application/json` content type.

### Success Response Format

All successful API responses follow a standardized format:

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_123456",
    "count": 10,
    // Pagination metadata for list responses
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response Format

All error responses follow a standardized format with consistent error codes:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      // Additional error context (validation errors, etc.)
    }
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

## Error Handling

### Standard Error Codes

The API uses standardized error codes for consistent client-side error handling:

#### Validation Errors (400)
| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `INVALID_REQUEST` | Invalid request format |
| `MISSING_REQUIRED_FIELD` | Required field missing |

#### Authentication & Authorization (401/403)
| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | Authentication required |
| `INVALID_CREDENTIALS` | Invalid login credentials |
| `ACCESS_DENIED` | Access denied |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions |

#### Resource Errors (404/409)
| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found |
| `ALREADY_EXISTS` | Resource already exists |
| `RESOURCE_CONFLICT` | Resource conflict |

#### Business Logic (422)
| Code | Description |
|------|-------------|
| `BUSINESS_RULE_ERROR` | Business rule violation |
| `INVALID_OPERATION` | Operation not valid |
| `OPERATION_NOT_ALLOWED` | Operation not allowed |

#### System Errors (500)
| Code | Description |
|------|-------------|
| `INTERNAL_SERVER_ERROR` | Internal server error |
| `DATABASE_ERROR` | Database operation failed |
| `EXTERNAL_SERVICE_ERROR` | External service error |

## Rate Limiting

- **Rate Limit**: 100 requests per minute per user
- **Headers**: Rate limit information included in response headers
  - `X-RateLimit-Limit`: Request limit per minute
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when limit resets

## Endpoints

### Authentication Endpoints

#### POST /auth/signup

Register a new user account with JWT tokens.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "userName": "johndoe",
  "email": "john@example.com",
  "password": "securePassword123!",
  "interest": "Software Development"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userName": "johndoe",
      "interest": "Software Development",
      "hasCompletedOnboarding": false
    }
  }
}
```

#### POST /auth/signin

Login with email and password to obtain JWT tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userName": "johndoe",
      "interest": "Software Development",
      "hasCompletedOnboarding": true
    }
  }
}
```

#### POST /auth/refresh

Refresh access token using refresh token (token rotation).

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST /auth/logout

Logout user and revoke refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### POST /auth/revoke-all

Revoke all refresh tokens for the current user (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Revoked 3 refresh tokens",
    "revokedCount": 3
  }
}
```

#### GET /auth/me

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "userName": "johndoe",
      "interest": "Software Development",
      "hasCompletedOnboarding": true
    }
  }
}
```

#### PATCH /auth/profile

Update user profile information (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "Jonathan",
  "lastName": "Smith",
  "userName": "jsmith",
  "interest": "Machine Learning"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "email": "john@example.com",
      "firstName": "Jonathan",
      "lastName": "Smith",
      "userName": "jsmith",
      "interest": "Machine Learning",
      "hasCompletedOnboarding": true
    }
  }
}
```

#### GET /auth/debug/tokens (Development Only)

Debug endpoint to view user's active refresh tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userTokens": [
      {
        "tokenId": "token_123",
        "createdAt": "2024-01-01T10:00:00Z",
        "lastUsedAt": "2024-01-01T12:00:00Z",
        "expiresAt": "2024-01-08T10:00:00Z",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit..."
      }
    ],
    "stats": {
      "totalTokens": 1,
      "activeTokens": 1
    }
  }
}
```

### User Onboarding Endpoints

#### POST /onboarding/interest

Update user's interest during onboarding (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "interest": "Software Development"
}
```

#### POST /onboarding/extract-profile

Extract profile information from resume/LinkedIn (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

#### POST /onboarding/save-profile

Save extracted profile information (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

#### POST /onboarding/complete

Complete the onboarding process (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Onboarding completed successfully",
    "user": {
      "hasCompletedOnboarding": true
    }
  }
}
```

### Documentation Endpoints

#### GET /docs/

Get the latest API documentation (redirects to v2).

#### GET /docs/v1

Get v1 API documentation.

#### GET /docs/v2

Get v2 API documentation.

## Jobs

Jobs are career positions including full-time employment, contracts, internships, and freelance work.

### GET /api/v1/profiles/:profileId/jobs

Get all job records for a profile with pagination.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "job-1",
      "type": "job",
      "title": "Senior Software Engineer",
      "description": "Led development of microservices architecture",
      "company": "Google",
      "position": "Senior Software Engineer",
      "startDate": "2022-01-15",
      "endDate": "2023-12-31",
      "location": "Mountain View, CA",
      "employmentType": "full-time",
      "responsibilities": [
        "Lead team of 4 developers",
        "Architect microservices solutions"
      ],
      "achievements": [
        "Reduced API latency by 40%",
        "Delivered 3 major features ahead of schedule"
      ],
      "technologies": ["TypeScript", "Node.js", "Kubernetes"],
      "teamSize": 4,
      "salary": {
        "amount": 150000,
        "currency": "USD",
        "frequency": "yearly"
      },
      "manager": "Jane Smith",
      "industry": "Technology",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### POST /api/v1/profiles/:profileId/jobs

Create a new job record.

### GET /api/v1/profiles/:profileId/jobs/:id

Get a specific job by ID.

### PUT /api/v1/profiles/:profileId/jobs/:id

Update an existing job record.

### DELETE /api/v1/profiles/:profileId/jobs/:id

Delete a job record.

## Education

Education records include formal education, certifications, bootcamps, and online courses.

### GET /api/v1/profiles/:profileId/education

Get all education records for a profile.

**Query Parameters:**
- `page` (number, default: 1): Page number  
- `limit` (number, default: 10, max: 100): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "edu-1",
      "type": "education",
      "title": "Master of Computer Science",
      "description": "Focused on machine learning and distributed systems",
      "institution": "Stanford University",
      "degree": "Master of Science",
      "field": "Computer Science",
      "startDate": "2020-09-01",
      "endDate": "2022-06-15",
      "location": "Stanford, CA",
      "gpa": 3.85,
      "honors": ["Dean's List", "Graduate Fellowship"],
      "relevantCourses": [
        "Machine Learning",
        "Distributed Systems",
        "Advanced Algorithms"
      ],
      "projects": [
        "Distributed ML Training Platform",
        "Real-time Recommendation System"
      ],
      "activities": ["CS Graduate Student Association"],
      "thesis": "Scalable Machine Learning on Edge Devices",
      "advisor": "Dr. Jane Johnson",
      "level": "masters",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### POST /api/v1/profiles/:profileId/education

Create a new education record.

### GET /api/v1/profiles/:profileId/education/:id

Get a specific education record by ID.

### PUT /api/v1/profiles/:profileId/education/:id

Update an existing education record.

### DELETE /api/v1/profiles/:profileId/education/:id

Delete an education record.

## Projects

Projects include professional work, personal projects, academic assignments, and open-source contributions.

### GET /api/v1/profiles/:profileId/projects

Get all projects for a profile.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "project-1",
      "type": "project",
      "title": "E-commerce Platform",
      "description": "Full-stack e-commerce platform with microservices architecture",
      "status": "completed",
      "startDate": "2023-03-01",
      "endDate": "2023-08-15",
      "technologies": ["React", "Node.js", "PostgreSQL", "Docker", "Kubernetes"],
      "repositoryUrl": "https://github.com/user/ecommerce-platform",
      "liveUrl": "https://ecommerce-platform.example.com",
      "role": "Full-Stack Developer",
      "teamSize": 3,
      "keyFeatures": [
        "User authentication and authorization",
        "Product catalog with search and filtering",
        "Shopping cart and checkout process"
      ],
      "challenges": [
        "Implementing real-time inventory updates",
        "Optimizing database queries for large product catalogs"
      ],
      "outcomes": [
        "Successfully launched with 1000+ initial users",
        "99.9% uptime achieved"
      ],
      "clientOrganization": "StartupXYZ",
      "budget": 50000,
      "projectType": "professional",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 7,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

### POST /api/v1/profiles/:profileId/projects

Create a new project record.

### GET /api/v1/profiles/:profileId/projects/:id

Get a specific project by ID.

### PUT /api/v1/profiles/:profileId/projects/:id

Update an existing project record.

### DELETE /api/v1/profiles/:profileId/projects/:id

Delete a project record.

## Actions

Actions represent specific achievements, initiatives, or significant contributions in your career.

### GET /api/v1/profiles/:profileId/actions

Get all action records for a profile.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

**Example Action:**
```json
{
  "id": "action-1",
  "type": "action",
  "title": "Led Team Migration",
  "description": "Successfully migrated entire team to new technology stack",
  "category": "leadership",
  "impact": "high",
  "date": "2023-06-15",
  "skills": ["leadership", "project management", "technical migration"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### POST /api/v1/profiles/:profileId/actions

Create a new action record.

### GET /api/v1/profiles/:profileId/actions/:id

Get a specific action by ID.

### PUT /api/v1/profiles/:profileId/actions/:id

Update an existing action record.

### DELETE /api/v1/profiles/:profileId/actions/:id

Delete an action record.

## Events

Events include conferences, workshops, networking events, and other career-related activities.

### GET /api/v1/profiles/:profileId/events

Get all event records for a profile.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

**Example Event:**
```json
{
  "id": "event-1",
  "type": "event",
  "title": "React Conference 2023",
  "description": "Attended React conference and learned about new features",
  "eventType": "conference",
  "location": "San Francisco, CA",
  "startDate": "2023-10-15",
  "endDate": "2023-10-17",
  "skills": ["React", "JavaScript", "web development"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### POST /api/v1/profiles/:profileId/events

Create a new event record.

### GET /api/v1/profiles/:profileId/events/:id

Get a specific event by ID.

### PUT /api/v1/profiles/:profileId/events/:id

Update an existing event record.

### DELETE /api/v1/profiles/:profileId/events/:id

Delete an event record.

## Career Transitions

Career transitions track significant role changes, promotions, or career pivots.

### GET /api/v1/profiles/:profileId/career-transitions

Get all career transition records for a profile.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

**Example Career Transition:**
```json
{
  "id": "transition-1",
  "type": "careerTransition",
  "title": "Senior Developer to Tech Lead",
  "description": "Transitioned from individual contributor to technical leadership role",
  "fromRole": "Senior Software Developer",
  "toRole": "Tech Lead",
  "transitionDate": "2023-01-15",
  "skills": ["leadership", "mentoring", "architecture"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### POST /api/v1/profiles/:profileId/career-transitions

Create a new career transition record.

### GET /api/v1/profiles/:profileId/career-transitions/:id

Get a specific career transition by ID.

### PUT /api/v1/profiles/:profileId/career-transitions/:id

Update an existing career transition record.

### DELETE /api/v1/profiles/:profileId/career-transitions/:id

Delete a career transition record.

## Data Models

### Base Node Interface

All node types inherit from a base structure:

```typescript
interface BaseNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Job (formerly Work Experience)

```typescript
interface Job extends BaseNode {
  type: 'job';
  company: string;
  position: string;
  location?: string;
  responsibilities?: string[];
  achievements?: string[];
  technologies?: string[];
  teamSize?: number;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance';
  salary?: {
    amount?: number;
    currency?: string;
    frequency?: 'hourly' | 'monthly' | 'yearly';
  };
  reasonForLeaving?: string;
  manager?: string;
  industry?: string;
}
```

### Education

```typescript
interface Education extends BaseNode {
  type: 'education';
  institution: string;
  degree?: string;
  field?: string;
  location?: string;
  gpa?: number;
  honors?: string[];
  relevantCourses?: string[];
  projects?: string[];
  activities?: string[];
  thesis?: string;
  advisor?: string;
  level?: 'high-school' | 'associates' | 'bachelors' | 'masters' | 'doctorate' | 'certification' | 'bootcamp';
}
```

### Project

```typescript
interface Project extends BaseNode {
  type: 'project';
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  technologies?: string[];
  repositoryUrl?: string;
  liveUrl?: string;
  role?: string;
  teamSize?: number;
  keyFeatures?: string[];
  challenges?: string[];
  outcomes?: string[];
  clientOrganization?: string;
  budget?: number;
  projectType?: 'personal' | 'professional' | 'academic' | 'freelance' | 'open-source';
}
```

### Action

```typescript
interface Action extends BaseNode {
  type: 'action';
  category?: string;
  impact?: 'low' | 'medium' | 'high' | 'very high';
  date: string;
  skills?: string[];
}
```

### Event

```typescript
interface Event extends BaseNode {
  type: 'event';
  eventType?: 'conference' | 'workshop' | 'networking' | 'training' | 'webinar' | 'meetup';
  location?: string;
  skills?: string[];
}
```

### Career Transition

```typescript
interface CareerTransition extends BaseNode {
  type: 'careerTransition';
  fromRole: string;
  toRole: string;
  transitionDate: string;
  skills?: string[];
}
```

## Query Parameters

### Pagination

- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 100): Items per page

### Date Formats

All dates should be provided in ISO 8601 format:
- `YYYY-MM-DD` for dates
- `YYYY-MM-DDTHH:mm:ss.sssZ` for timestamps

## Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Successful GET, PUT requests |
| 201 | Created | Successful POST request |
| 204 | No Content | Successful DELETE request |
| 400 | Bad Request | Invalid request format or validation error |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Access denied (insufficient permissions) |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Business rule violation or constraint error |
| 422 | Unprocessable Entity | Semantic validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Examples

### Creating a Complete Career Timeline

1. **Create Job Record**
```bash
POST /api/v1/profiles/123/jobs
{
  "title": "Software Engineer",
  "company": "TechCorp",
  "position": "Software Engineer",
  "startDate": "2021-06-01",
  "endDate": "2023-05-31",
  "technologies": ["React", "Node.js"]
}
```

2. **Create Education Record**
```bash
POST /api/v1/profiles/123/education
{
  "title": "Bachelor of Computer Science",
  "institution": "State University",
  "degree": "Bachelor of Science",
  "startDate": "2017-09-01",
  "endDate": "2021-05-31"
}
```

3. **Create Project**
```bash
POST /api/v1/profiles/123/projects
{
  "title": "Portfolio Website",
  "status": "completed",
  "startDate": "2021-01-01",
  "endDate": "2021-03-01",
  "technologies": ["React", "TypeScript"]
}
```

4. **Create Action**
```bash
POST /api/v1/profiles/123/actions
{
  "title": "Led Team Migration",
  "description": "Successfully migrated entire team to new technology stack",
  "category": "leadership",
  "impact": "high",
  "date": "2023-06-15",
  "skills": ["leadership", "project management"]
}
```

5. **Create Event**
```bash
POST /api/v1/profiles/123/events
{
  "title": "React Conference 2023",
  "description": "Attended React conference",
  "eventType": "conference",
  "startDate": "2023-10-15",
  "endDate": "2023-10-17",
  "skills": ["React", "JavaScript"]
}
```

6. **Create Career Transition**
```bash
POST /api/v1/profiles/123/career-transitions
{
  "title": "Junior to Senior Developer",
  "description": "Promoted to senior developer role",
  "fromRole": "Junior Software Developer",
  "toRole": "Senior Software Developer",
  "transitionDate": "2022-01-15",
  "skills": ["leadership", "mentoring"]
}
```

---

## Getting Started

1. **Import Collection**: Import `Lighthouse-Node-API.postman_collection.json` into Postman
2. **Import Environment**: Import `Lighthouse-API.postman_environment.json`
3. **Set Variables**: Update environment variables with your API base URL and credentials
4. **Authenticate**: Run the Login request to obtain authentication token
5. **Test Endpoints**: Use the pre-configured requests to test API functionality

The API now provides a clean, simple interface with exactly 5 CRUD endpoints for each of the 6 node types, plus authentication endpoints. All advanced querying, aggregation, and milestone functionality has been removed for a streamlined developer experience.

For support or questions, please contact the development team or refer to the project documentation.