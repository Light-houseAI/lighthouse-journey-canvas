/**
 * JobController Integration Tests
 * 
 * Tests the JobController REST API endpoints with full request/response cycle,
 * authentication, validation, and error handling.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import request from 'supertest';
import express from 'express';
import { JobController } from '../job-controller';
import type { JobService } from '../../services/job-service';
import type { Job } from '@shared/schema';
import { ValidationError, NotFoundError, BusinessRuleError } from '../../services/base-service';

// Mock service
const mockJobService: jest.Mocked<JobService> = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

// Mock authentication middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 1, profileId: 1 };
  next();
};

describe('JobController', () => {
  let app: express.Application;
  let controller: JobController;

  const sampleJob: Job = {
    id: 'job-1',
    type: 'job' as const,
    title: 'Software Engineer',
    company: 'Tech Corp',
    position: 'Senior Developer',
    startDate: '2022-01-01',
    endDate: '2024-01-01',
    employmentType: 'full-time',
    location: 'San Francisco, CA',
    description: 'Developed scalable web applications',
    technologies: ['React', 'Node.js', 'PostgreSQL'],
    responsibilities: ['Led development team', 'Architected solutions'],
    achievements: ['Increased performance by 40%', 'Reduced bugs by 60%'],
    createdAt: '2022-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks();
    
    controller = new JobController(mockJobService);
    app = express();
    app.use(express.json());
    app.use(mockAuth); // Apply mock authentication
    
    // Mount routes
    app.get('/jobs', controller.getAll.bind(controller));
    app.get('/jobs/:id', controller.getById.bind(controller));
    app.post('/jobs', controller.create.bind(controller));
    app.put('/jobs/:id', controller.update.bind(controller));
    app.delete('/jobs/:id', controller.delete.bind(controller));

  });

  describe('GET /jobs', () => {
    it('should return all jobs for authenticated user', async () => {
      const jobs = [sampleJob];
      (mockJobService.getAll as MockedFunction<any>).mockResolvedValue(jobs);

      const response = await request(app)
        .get('/jobs')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: jobs,
        count: 1,
      });
      expect(mockJobService.getAll).toHaveBeenCalledWith(1);
    });

    it('should handle service errors gracefully', async () => {
      (mockJobService.getAll as MockedFunction<any>).mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app)
        .get('/jobs')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve jobs',
      });
    });

    it('should return empty array when no jobs found', async () => {
      (mockJobService.getAll as MockedFunction<any>).mockResolvedValue([]);

      const response = await request(app)
        .get('/jobs')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: [],
        count: 0,
      });
    });
  });

  describe('GET /jobs/:id', () => {
    it('should return specific jobs', async () => {
      (mockJobService.getById as MockedFunction<any>).mockResolvedValue(sampleJob);

      const response = await request(app)
        .get('/jobs/work-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: sampleJob,
      });
      expect(mockJobService.getById).toHaveBeenCalledWith(1, 'job-1');
    });

    it('should return 404 when jobs not found', async () => {
      (mockJobService.getById as MockedFunction<any>).mockRejectedValue(
        new NotFoundError('Work experience not found')
      );

      const response = await request(app)
        .get('/jobs/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not found',
        message: 'Work experience not found',
      });
    });

    it('should validate ID parameter', async () => {
      const response = await request(app)
        .get('/jobs/')
        .expect(404); // Route not matched

      expect(mockJobService.getById).not.toHaveBeenCalled();
    });
  });

  describe('POST /jobs', () => {
    const validCreateData = {
      title: 'Senior Software Engineer',
      company: 'New Tech Inc',
      position: 'Senior Software Engineer',
      startDate: '2024-01-01',
      endDate: 'Present',
      employmentType: 'full-time',
      location: 'Remote',
      description: 'Leading development of cutting-edge applications',
      technologies: ['TypeScript', 'React', 'AWS'],
      responsibilities: ['Team leadership', 'Architecture design'],
    }

    it('should create new jobs with valid data', async () => {
      const createdExperience = { ...sampleJob, ...validCreateData };
      (mockJobService.create as MockedFunction<any>).mockResolvedValue(createdExperience);

      const response = await request(app)
        .post('/jobs')
        .send(validCreateData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: createdExperience,
        message: 'Work experience created successfully',
      });
      expect(mockJobService.create).toHaveBeenCalledWith(1, validCreateData);
    });

    it('should return 400 for validation errors', async () => {
      (mockJobService.create as MockedFunction<any>).mockRejectedValue(
        new ValidationError('Title is required')
      );

      const invalidData = { ...validCreateData, title: '' };

      const response = await request(app)
        .post('/jobs')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Validation error',
        message: 'Title is required',
      });
    });

    it('should return 422 for business rule violations', async () => {
      (mockJobService.create as MockedFunction<any>).mockRejectedValue(
        new BusinessRuleError('End date cannot be before start date')
      );

      const invalidDateData = {
        ...validCreateData,
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      }

      const response = await request(app)
        .post('/jobs')
        .send(invalidDateData)
        .expect(422);

      expect(response.body).toEqual({
        success: false,
        error: 'Business rule violation',
        message: 'End date cannot be before start date',
      });
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/jobs')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });

    it('should validate employment type enum', async () => {
      const invalidTypeData = {
        ...validCreateData,
        employmentType: 'invalid-type',
      }

      const response = await request(app)
        .post('/jobs')
        .send(invalidTypeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /jobs/:id', () => {
    const validUpdateData = {
      title: 'Principal Software Engineer',
      description: 'Updated role with expanded responsibilities',
      achievements: ['Led successful product launch'],
    }

    it('should update existing jobs', async () => {
      const updatedExperience = { ...sampleJob, ...validUpdateData };
      (mockJobService.update as MockedFunction<any>).mockResolvedValue(updatedExperience);

      const response = await request(app)
        .put('/jobs/work-1')
        .send(validUpdateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: updatedExperience,
        message: 'Work experience updated successfully',
      });
      expect(mockJobService.update).toHaveBeenCalledWith(1, 'job-1', validUpdateData);
    });

    it('should return 404 when updating non-existent jobs', async () => {
      (mockJobService.update as MockedFunction<any>).mockRejectedValue(
        new NotFoundError('Work experience not found')
      );

      const response = await request(app)
        .put('/jobs/nonexistent')
        .send(validUpdateData)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not found',
        message: 'Work experience not found',
      });
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { title: 'Updated Title Only' };
      const updatedExperience = { ...sampleJob, ...partialUpdate };
      (mockJobService.update as MockedFunction<any>).mockResolvedValue(updatedExperience);

      const response = await request(app)
        .put('/jobs/work-1')
        .send(partialUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title Only');
    });
  });

  describe('DELETE /jobs/:id', () => {
    it('should delete existing jobs', async () => {
      (mockJobService.delete as MockedFunction<any>).mockResolvedValue(true);

      const response = await request(app)
        .delete('/jobs/work-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work experience deleted successfully',
      });
      expect(mockJobService.delete).toHaveBeenCalledWith(1, 'job-1');
    });

    it('should return 404 when deleting non-existent jobs', async () => {
      (mockJobService.delete as MockedFunction<any>).mockRejectedValue(
        new NotFoundError('Work experience not found')
      );

      const response = await request(app)
        .delete('/jobs/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Not found',
        message: 'Work experience not found',
      });
    });
  });

});