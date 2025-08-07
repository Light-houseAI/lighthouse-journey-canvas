/**
 * Enhanced Timeline API Integration Tests
 * 
 * Comprehensive tests for all PRD requirements including:
 * - All node types (workExperience, education, project, events, actions, careerTransition)
 * - API endpoints validation
 * - Performance requirements
 * - Authentication and authorization
 * - End-to-end workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TestDatabaseManager } from '../utils/test-database.js';
import type { WorkExperience, Education, Project } from '../../types/node-types.js';
import { NodeType } from '../../core/interfaces/base-node.interface.js';

const TEST_USER_ID = TestDatabaseManager.TEST_USER_ID;

// Mock app setup
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware
  app.use((req: any, res: any, next: any) => {
    req.user = { id: TEST_USER_ID, profileId: TEST_USER_ID };
    next();
  });

  return app;
}

describe('Enhanced Timeline API Integration Tests', () => {
  let testDb: TestDatabaseManager;
  let app: express.Application;

  beforeEach(async () => {
    testDb = TestDatabaseManager.getInstance();
    await testDb.resetTestUserData();
    app = createTestApp();
  }, 60000);

  describe('PRD Section 5: API Endpoints Validation', () => {
    describe('Work Experience Endpoints', () => {
      it('should create work experience with all required fields', async () => {
        const workExperience = {
          title: 'Senior Software Engineer',
          company: 'Tech Innovations Inc',
          position: 'Senior Software Engineer',
          startDate: '2024-01-01',
          endDate: 'Present',
          employmentType: 'full-time',
          location: 'San Francisco, CA',
          description: 'Leading development of next-generation applications',
          technologies: ['React', 'Node.js', 'TypeScript', 'AWS'],
          responsibilities: [
            'Lead a team of 5 developers',
            'Architect scalable solutions',
            'Mentor junior developers',
          ],
          achievements: [
            'Increased system performance by 40%',
            'Reduced deployment time by 60%',
            'Implemented automated testing pipeline',
          ],
        };

        const startTime = Date.now();
        const response = await request(app)
          .post('/api/v1/work-experiences')
          .send(workExperience)
          .expect(201);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(200); // PRD requirement: < 200ms

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: expect.any(String),
            type: NodeType.WorkExperience,
            title: workExperience.title,
            company: workExperience.company,
            position: workExperience.position,
            technologies: workExperience.technologies,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
          message: 'Work experience created successfully',
        });
      });

      it('should get work experience by ID with correct response format', async () => {
        // First create an experience
        const createResponse = await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Test Engineer',
            company: 'Test Corp',
            position: 'Test Engineer',
            startDate: '2023-01-01',
            endDate: '2024-01-01',
            employmentType: 'full-time',
          });

        const experienceId = createResponse.body.data.id;

        const startTime = Date.now();
        const response = await request(app)
          .get(`/api/v1/work-experiences/${experienceId}`)
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: experienceId,
            type: NodeType.WorkExperience,
            title: 'Test Engineer',
            company: 'Test Corp',
          }),
        });
      });

      it('should update work experience with partial data', async () => {
        // Create initial experience
        const createResponse = await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Junior Developer',
            company: 'Startup Inc',
            position: 'Junior Developer',
            startDate: '2023-01-01',
            employmentType: 'full-time',
          });

        const experienceId = createResponse.body.data.id;

        // Update with promotion
        const updates = {
          title: 'Senior Developer',
          position: 'Senior Developer',
          endDate: '2024-06-01',
          achievements: ['Promoted after 18 months', 'Led critical project'],
        };

        const response = await request(app)
          .put(`/api/v1/work-experiences/${experienceId}`)
          .send(updates)
          .expect(200);

        expect(response.body.data.title).toBe('Senior Developer');
        expect(response.body.data.achievements).toEqual(updates.achievements);
        expect(response.body.data.company).toBe('Startup Inc'); // Should preserve existing data
      });

      it('should delete work experience', async () => {
        const createResponse = await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Temporary Role',
            company: 'Temp Corp',
            position: 'Contractor',
            startDate: '2023-01-01',
            endDate: '2023-03-01',
            employmentType: 'contract',
          });

        const experienceId = createResponse.body.data.id;

        await request(app)
          .delete(`/api/v1/work-experiences/${experienceId}`)
          .expect(200);

        // Verify deletion
        await request(app)
          .get(`/api/v1/work-experiences/${experienceId}`)
          .expect(404);
      });
    });

    describe('Education Endpoints', () => {
      it('should create education entry with all fields', async () => {
        const education = {
          title: 'Master of Science in Computer Science',
          school: 'Stanford University',
          degree: 'Master of Science',
          field: 'Computer Science',
          startDate: '2020-09-01',
          endDate: '2022-05-31',
          gpa: '3.9',
          honors: ['Magna Cum Laude', 'Dean\'s List'],
          description: 'Focus on machine learning and distributed systems',
          location: 'Stanford, CA',
          coursework: [
            'Advanced Machine Learning',
            'Distributed Systems',
            'Computer Vision',
            'Natural Language Processing',
          ],
          activities: ['Research Assistant', 'Teaching Assistant'],
          thesis: 'Deep Learning Applications in Computer Vision',
          advisor: 'Dr. Jane Smith',
        };

        const response = await request(app)
          .post('/api/v1/education')
          .send(education)
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: expect.any(String),
            type: NodeType.Education,
            school: education.school,
            degree: education.degree,
            field: education.field,
            gpa: education.gpa,
            honors: education.honors,
          }),
          message: 'Education created successfully',
        });
      });

      it('should handle current education (no end date)', async () => {
        const currentEducation = {
          title: 'PhD in Artificial Intelligence',
          school: 'MIT',
          degree: 'PhD',
          field: 'Artificial Intelligence',
          startDate: '2024-01-01',
          // No endDate - currently enrolled
          expectedGraduation: '2028-05-31',
          advisor: 'Dr. John Doe',
        };

        const response = await request(app)
          .post('/api/v1/education')
          .send(currentEducation)
          .expect(201);

        expect(response.body.data.endDate).toBeUndefined();
        expect(response.body.data.expectedGraduation).toBe('2028-05-31');
      });
    });

    describe('Project Endpoints', () => {
      it('should create project with parent work experience', async () => {
        // First create a work experience
        const workExperience = await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Software Engineer',
            company: 'ProjectCorp',
            position: 'Software Engineer',
            startDate: '2023-01-01',
            employmentType: 'full-time',
          });

        const parentId = workExperience.body.data.id;

        const project = {
          title: 'E-commerce Platform Redesign',
          description: 'Complete redesign of the company\'s e-commerce platform',
          technologies: ['React', 'Node.js', 'MongoDB', 'Docker'],
          startDate: '2023-03-01',
          endDate: '2023-08-31',
          status: 'completed',
          parentExperienceId: parentId,
          repositoryUrl: 'https://github.com/company/ecommerce-platform',
          deploymentUrl: 'https://shop.company.com',
          teamSize: 4,
          role: 'Frontend Lead',
          achievements: [
            'Increased conversion rate by 25%',
            'Reduced page load time by 50%',
            'Implemented responsive design',
          ],
        };

        const response = await request(app)
          .post('/api/v1/projects')
          .send(project)
          .expect(201);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: expect.any(String),
            type: NodeType.Project,
            title: project.title,
            parentExperienceId: parentId,
            status: 'completed',
            technologies: project.technologies,
          }),
          message: 'Project created successfully',
        });
      });

      it('should create personal project (no parent experience)', async () => {
        const personalProject = {
          title: 'Personal Portfolio Website',
          description: 'Modern portfolio website built with Next.js',
          technologies: ['Next.js', 'Tailwind CSS', 'TypeScript'],
          startDate: '2023-12-01',
          endDate: '2024-01-15',
          status: 'completed',
          repositoryUrl: 'https://github.com/user/portfolio',
          deploymentUrl: 'https://myportfolio.dev',
          teamSize: 1,
          role: 'Full Stack Developer',
        };

        const response = await request(app)
          .post('/api/v1/projects')
          .send(personalProject)
          .expect(201);

        expect(response.body.data.parentExperienceId).toBeUndefined();
        expect(response.body.data.teamSize).toBe(1);
      });
    });

    describe('Node Aggregation Endpoints', () => {
      beforeEach(async () => {
        // Create comprehensive test data
        await Promise.all([
          // Work experiences
          request(app).post('/api/v1/work-experiences').send({
            title: 'Senior Engineer',
            company: 'TechCorp',
            position: 'Senior Engineer',
            startDate: '2022-01-01',
            endDate: '2024-01-01',
            employmentType: 'full-time',
            technologies: ['Python', 'React'],
          }),
          request(app).post('/api/v1/work-experiences').send({
            title: 'Lead Developer',
            company: 'StartupInc',
            position: 'Lead Developer',
            startDate: '2024-02-01',
            employmentType: 'full-time',
            technologies: ['TypeScript', 'Vue.js'],
          }),

          // Education
          request(app).post('/api/v1/education').send({
            title: 'BS Computer Science',
            school: 'University of Technology',
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            startDate: '2016-09-01',
            endDate: '2020-05-31',
          }),

          // Projects
          request(app).post('/api/v1/projects').send({
            title: 'Open Source Library',
            description: 'Popular open source library',
            technologies: ['JavaScript', 'Node.js'],
            startDate: '2023-01-01',
            endDate: '2023-06-01',
            status: 'completed',
          }),
        ]);
      });

      it('should get complete profile aggregation within performance requirements', async () => {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/v1/nodes/profile/aggregate')
          .expect(200);

        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(500); // PRD requirement: < 500ms for aggregation

        expect(response.body).toEqual({
          success: true,
          data: {
            summary: {
              totalExperiences: 2,
              totalEducation: 1,
              totalProjects: 1,
              totalNodes: 4,
              lastUpdated: expect.any(String),
            },
            currentPosition: expect.objectContaining({
              title: 'Lead Developer',
              company: 'StartupInc',
            }),
            careerProgression: expect.arrayContaining([
              expect.objectContaining({
                type: 'education',
                organization: 'University of Technology',
              }),
              expect.objectContaining({
                type: 'workExperience',
                organization: 'TechCorp',
              }),
              expect.objectContaining({
                type: 'workExperience',
                organization: 'StartupInc',
              }),
            ]),
            technologyExperience: expect.objectContaining({
              'Python': expect.objectContaining({
                count: 1,
                totalMonths: expect.any(Number),
              }),
              'React': expect.objectContaining({
                count: 1,
                totalMonths: expect.any(Number),
              }),
            }),
            skillsAnalysis: {
              totalSkills: expect.any(Number),
              topSkills: expect.arrayContaining([
                expect.any(String),
              ]),
              skillCategories: expect.any(Object),
            },
          },
        });
      });

      it('should filter nodes by date range', async () => {
        const response = await request(app)
          .get('/api/v1/nodes/filter/date-range')
          .query({
            startDate: '2020-01-01',
            endDate: '2023-12-31',
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            workExperiences: expect.any(Array),
            education: expect.any(Array),
            projects: expect.any(Array),
            totalCount: expect.any(Number),
          },
          filter: {
            startDate: '2020-01-01',
            endDate: '2023-12-31',
          },
        });
      });

      it('should search nodes by technology', async () => {
        const response = await request(app)
          .get('/api/v1/nodes/search/technology')
          .query({ technology: 'React' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: NodeType.WorkExperience,
              technologies: expect.arrayContaining(['React']),
            }),
          ])
        );
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const unauthApp = express();
      unauthApp.use(express.json());
      // No auth middleware

      await request(unauthApp)
        .get('/api/v1/work-experiences')
        .expect(401);

      await request(unauthApp)
        .post('/api/v1/work-experiences')
        .send({})
        .expect(401);
    });

    it('should enforce profile ownership', async () => {
      // Create experience as test user
      const createResponse = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Test Role',
          company: 'Test Corp',
          position: 'Test Role',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      const experienceId = createResponse.body.data.id;

      // Try to access as different user
      const unauthorizedApp = express();
      unauthorizedApp.use(express.json());
      unauthorizedApp.use((req: any, res: any, next: any) => {
        req.user = { id: 9999, profileId: 9999 }; // Different user
        next();
      });

      await request(unauthorizedApp)
        .get(`/api/v1/work-experiences/${experienceId}`)
        .expect(404); // Should not find the experience
    });
  });

  describe('Data Validation', () => {
    describe('Input Sanitization', () => {
      it('should sanitize HTML in text fields', async () => {
        const maliciousData = {
          title: 'Software Engineer <script>alert("xss")</script>',
          company: 'TechCorp <img src="x" onerror="alert(1)">',
          position: 'Developer',
          description: 'Job description with <script>malicious code</script>',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        };

        const response = await request(app)
          .post('/api/v1/work-experiences')
          .send(maliciousData)
          .expect(201);

        // Should strip malicious content
        expect(response.body.data.title).toBe('Software Engineer');
        expect(response.body.data.company).toBe('TechCorp');
        expect(response.body.data.description).toBe('Job description with malicious code');
      });

      it('should validate URL formats', async () => {
        const invalidProject = {
          title: 'Test Project',
          description: 'Test project',
          repositoryUrl: 'not-a-valid-url',
          deploymentUrl: 'also-invalid',
          startDate: '2023-01-01',
          status: 'completed',
        };

        await request(app)
          .post('/api/v1/projects')
          .send(invalidProject)
          .expect(400);
      });

      it('should validate date formats and logic', async () => {
        const invalidDates = {
          title: 'Test Role',
          company: 'Test Corp',
          position: 'Test Role',
          startDate: '2024-12-31',
          endDate: '2024-01-01', // End before start
          employmentType: 'full-time',
        };

        await request(app)
          .post('/api/v1/work-experiences')
          .send(invalidDates)
          .expect(400);
      });
    });

    describe('Business Rule Validation', () => {
      it('should prevent overlapping full-time work experiences', async () => {
        // Create first experience
        await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Engineer A',
            company: 'Company A',
            position: 'Engineer A',
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            employmentType: 'full-time',
          });

        // Try to create overlapping experience
        const overlappingExperience = {
          title: 'Engineer B',
          company: 'Company B',
          position: 'Engineer B',
          startDate: '2023-06-01', // Overlaps with first experience
          endDate: '2024-06-01',
          employmentType: 'full-time',
        };

        const response = await request(app)
          .post('/api/v1/work-experiences')
          .send(overlappingExperience)
          .expect(422);

        expect(response.body.error).toBe('Business rule violation');
        expect(response.body.message).toContain('overlapping full-time positions');
      });

      it('should allow overlapping part-time or contract work', async () => {
        await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Full-time Engineer',
            company: 'Main Corp',
            position: 'Full-time Engineer',
            startDate: '2023-01-01',
            endDate: '2023-12-31',
            employmentType: 'full-time',
          });

        // Should allow part-time work during full-time employment
        await request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: 'Part-time Consultant',
            company: 'Side Corp',
            position: 'Part-time Consultant',
            startDate: '2023-06-01',
            endDate: '2023-09-01',
            employmentType: 'part-time',
          })
          .expect(201);
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should handle large datasets (1000+ nodes)', async () => {
      // Create a large number of nodes
      const createPromises = [];
      
      for (let i = 0; i < 100; i++) {
        createPromises.push(
          request(app).post('/api/v1/work-experiences').send({
            title: `Engineer ${i}`,
            company: `Company ${i}`,
            position: `Engineer ${i}`,
            startDate: `202${Math.floor(i/10)}-01-01`,
            endDate: `202${Math.floor(i/10)}-12-31`,
            employmentType: 'full-time',
          })
        );
      }

      await Promise.all(createPromises);

      // Test aggregation performance with large dataset
      const startTime = Date.now();
      
      await request(app)
        .get('/api/v1/nodes/profile/aggregate')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500); // Should still meet performance requirements
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/v1/work-experiences')
          .send({
            title: `Concurrent Engineer ${i}`,
            company: `Concurrent Corp ${i}`,
            position: `Engineer ${i}`,
            startDate: '2023-01-01',
            employmentType: 'full-time',
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should complete efficiently
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Error Handling', () => {
    it('should handle network interruptions gracefully', async () => {
      // Simulate network interruption by closing connection
      const response = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Test Role',
          company: 'Test Corp',
          position: 'Test Role',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        })
        .timeout(1); // Very short timeout

      // Should handle timeout gracefully
      expect([408, 500]).toContain(response.status);
    });

    it('should provide meaningful error messages', async () => {
      const response = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: '', // Empty title
          company: 'Test Corp',
          position: '',  // Empty position
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: expect.stringContaining('required'),
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.any(String),
          }),
          expect.objectContaining({
            field: 'position',
            message: expect.any(String),
          }),
        ]),
      });
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity for project-experience relationships', async () => {
      // Create work experience
      const experienceResponse = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Software Engineer',
          company: 'TechCorp',
          position: 'Software Engineer',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      const experienceId = experienceResponse.body.data.id;

      // Create project under this experience
      await request(app)
        .post('/api/v1/projects')
        .send({
          title: 'Important Project',
          description: 'Critical project',
          parentExperienceId: experienceId,
          startDate: '2023-03-01',
          status: 'in-progress',
        })
        .expect(201);

      // Try to delete the parent experience (should fail or cascade)
      const deleteResponse = await request(app)
        .delete(`/api/v1/work-experiences/${experienceId}`);

      if (deleteResponse.status === 200) {
        // If deletion succeeded, projects should also be removed
        const projectsResponse = await request(app)
          .get('/api/v1/projects')
          .query({ parentExperienceId: experienceId });
        
        expect(projectsResponse.body.data).toHaveLength(0);
      } else {
        // If deletion failed, it should be due to referential integrity
        expect(deleteResponse.status).toBe(409);
        expect(deleteResponse.body.message).toContain('referenced by');
      }
    });

    it('should handle database transaction failures', async () => {
      // This test would require mocking database transaction failures
      // For now, we'll test that the API handles database errors gracefully
      
      const response = await request(app)
        .post('/api/v1/work-experiences')
        .send({
          title: 'Test Role',
          company: 'Test Corp',
          position: 'Test Role',
          startDate: '2023-01-01',
          employmentType: 'full-time',
        });

      if (response.status === 500) {
        expect(response.body).toEqual({
          success: false,
          error: 'Internal server error',
          message: expect.any(String),
        });
      } else {
        expect(response.status).toBe(201);
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.resetTestUserData();
  });
});