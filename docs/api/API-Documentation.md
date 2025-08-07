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

## Authentication

The API uses session-based authentication with bearer tokens.

### Authentication Flow

1. **Login**: POST to `/auth/signin` with email/password
2. **Get Token**: Extract token from successful login response
3. **Use Token**: Include token in `Authorization` header for all API calls
4. **Token Format**: `Authorization: Bearer <token>`

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

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "meta": {
    // Optional metadata (pagination, totals, etc.)
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      // Optional array of detailed error information
    ]
  }
}
```

## Error Handling

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Business rule violation |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## Rate Limiting

- **Rate Limit**: 100 requests per minute per user
- **Headers**: Rate limit information included in response headers
  - `X-RateLimit-Limit`: Request limit per minute
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Timestamp when limit resets

## Endpoints

### Authentication Endpoints

#### POST /auth/signin

Login with email and password to obtain authentication token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "user@example.com",
      "profileId": 456
    }
  }
}
```

#### GET /auth/me

Get current authenticated user information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "user@example.com",
    "profileId": 456,
    "hasCompletedOnboarding": true
  }
}
```

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