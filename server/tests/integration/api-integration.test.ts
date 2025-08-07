/**
 * API Integration Tests
 * 
 * Tests the complete REST API endpoints for node management system.
 * Validates the full flow from HTTP requests to database operations.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { bootstrapContainer } from '../../core/bootstrap';
import { initializeApiV1Router } from '../../routes/api/v1';
import type { WorkExperienceCreateDTO, EducationCreateDTO, ProjectCreateDTO } from '@shared/schema';

describe('Node Management API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  const testUserId = 17; // Using the dev mode user ID

  beforeAll(async () => {
    // Bootstrap the DI container
    await bootstrapContainer();

    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Session middleware (simplified for testing)
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Initialize the API router
    const apiRouter = await initializeApiV1Router();
    app.use('/api/v1', apiRouter);

    // Start test server
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Set dev mode for auth bypass
    process.env.DEV_MODE = 'true';
  });

  describe('Health and Documentation', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.version).toBe('v1');
    });

    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api/v1/docs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.endpoints).toHaveProperty('workExperiences');
      expect(response.body.data.endpoints).toHaveProperty('education');
      expect(response.body.data.endpoints).toHaveProperty('projects');
      expect(response.body.data.endpoints).toHaveProperty('nodes');
    });
  });

  describe('Work Experience Management', () => {
    const sampleWorkExp: WorkExperienceCreateDTO = {
      title: 'Senior Software Engineer',
      description: 'Led development of microservices architecture',
      startDate: '2022-01-01',
      endDate: '2023-12-31',
      company: 'TechCorp Inc',
      position: 'Senior Software Engineer',
      location: 'San Francisco, CA',
      responsibilities: [
        'Design and implement REST APIs',
        'Mentor junior developers',
        'Lead technical architecture decisions'
      ],
      achievements: [
        'Reduced API response time by 40%',
        'Implemented automated testing pipeline'
      ],
      technologies: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
      employmentType: 'full-time' as const
    };

    let createdWorkExpId: string;

    it('should create a work experience', async () => {
      const response = await request(app)
        .post(`/api/v1/profiles/${testUserId}/work-experiences`)
        .send(sampleWorkExp)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(sampleWorkExp.title);
      expect(response.body.data.company).toBe(sampleWorkExp.company);
      
      createdWorkExpId = response.body.data.id;
    });

    it('should get work experience by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/work-experiences/${createdWorkExpId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdWorkExpId);
      expect(response.body.data.title).toBe(sampleWorkExp.title);
    });

    it('should list all work experiences', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/work-experiences`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
    });

    it('should update work experience', async () => {
      const updates = {
        title: 'Principal Software Engineer',
        description: 'Updated role with additional responsibilities'
      };

      const response = await request(app)
        .put(`/api/v1/profiles/${testUserId}/work-experiences/${createdWorkExpId}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updates.title);
      expect(response.body.data.description).toBe(updates.description);
    });

    it('should validate dates', async () => {
      const response = await request(app)
        .post(`/api/v1/profiles/${testUserId}/work-experiences/validate-dates`)
        .send({
          startDate: '2023-01-01',
          endDate: '2022-01-01' // End before start - should fail
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.error).toContain('end date');
    });

    it('should delete work experience', async () => {
      const response = await request(app)
        .delete(`/api/v1/profiles/${testUserId}/work-experiences/${createdWorkExpId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('deleted successfully');
    });
  });

  describe('Education Management', () => {
    const sampleEducation: EducationCreateDTO = {
      title: 'Bachelor of Science in Computer Science',
      description: 'Focused on software engineering and data structures',
      startDate: '2018-09-01',
      endDate: '2022-05-31',
      institution: 'State University',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      location: 'Boston, MA',
      gpa: 3.8,
      honors: ['Magna Cum Laude', 'Dean\'s List'],
      relevantCourses: [
        'Data Structures and Algorithms',
        'Software Engineering',
        'Database Systems'
      ],
      level: 'bachelors' as const
    };

    let createdEducationId: string;

    it('should create an education record', async () => {
      const response = await request(app)
        .post(`/api/v1/profiles/${testUserId}/education`)
        .send(sampleEducation)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(sampleEducation.title);
      expect(response.body.data.institution).toBe(sampleEducation.institution);
      
      createdEducationId = response.body.data.id;
    });

    it('should get education by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/education/${createdEducationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(createdEducationId);
      expect(response.body.data.degree).toBe(sampleEducation.degree);
    });

    it('should list all education records', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/education`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Project Management', () => {
    const sampleProject: ProjectCreateDTO = {
      title: 'E-commerce Platform',
      description: 'Full-stack web application for online shopping',
      startDate: '2023-01-01',
      endDate: '2023-06-30',
      status: 'completed' as const,
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
      repositoryUrl: 'https://github.com/user/ecommerce-platform',
      liveUrl: 'https://mystore.com',
      role: 'Full-stack Developer',
      teamSize: 3,
      keyFeatures: [
        'User authentication and authorization',
        'Payment processing with Stripe',
        'Admin dashboard'
      ],
      outcomes: [
        'Successfully launched with 100+ users',
        'Generated $10k in first month'
      ],
      projectType: 'professional' as const
    };

    let createdProjectId: string;

    it('should create a project', async () => {
      const response = await request(app)
        .post(`/api/v1/profiles/${testUserId}/projects`)
        .send(sampleProject)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(sampleProject.title);
      expect(response.body.data.status).toBe(sampleProject.status);
      
      createdProjectId = response.body.data.id;
    });

    it('should get projects by status', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/projects?status=completed`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        expect(response.body.data[0].status).toBe('completed');
      }
    });

    it('should get project technologies', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/projects/technologies`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Node Aggregation', () => {
    it('should get all nodes aggregated', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/nodes`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('workExperiences');
      expect(response.body.data).toHaveProperty('education');
      expect(response.body.data).toHaveProperty('projects');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('lastUpdated');
    });

    it('should get node statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/nodes/stats`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalNodes');
      expect(response.body.data).toHaveProperty('nodesByType');
      expect(response.body.data).toHaveProperty('activeCounts');
      expect(response.body.data).toHaveProperty('recentActivity');
    });

    it('should get filtered nodes', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/nodes/filtered?sortBy=startDate&sortOrder=desc&limit=5`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized access', async () => {
      // Disable dev mode to test auth
      process.env.DEV_MODE = 'false';
      
      const response = await request(app)
        .get('/api/v1/profiles/123/work-experiences')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
      
      // Re-enable dev mode
      process.env.DEV_MODE = 'true';
    });

    it('should handle validation errors', async () => {
      const invalidWorkExp = {
        title: '', // Empty title should fail validation
        company: 'TechCorp'
        // Missing required fields
      };

      const response = await request(app)
        .post(`/api/v1/profiles/${testUserId}/work-experiences`)
        .send(invalidWorkExp)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle not found errors', async () => {
      const response = await request(app)
        .get(`/api/v1/profiles/${testUserId}/work-experiences/non-existent-id`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle forbidden access', async () => {
      // Try to access another user's data
      const response = await request(app)
        .get('/api/v1/profiles/999/work-experiences')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Forbidden');
    });
  });
});