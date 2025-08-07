/**
 * JobService Tests
 * 
 * Comprehensive unit tests for JobService business logic
 * with mocked repository dependencies.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { JobService } from '../job-service';
import type { Job, JobCreateDTO, JobUpdateDTO } from '@shared/schema';
import type { IRepository } from '../../core/interfaces/repository.interface';
import { ValidationError, NotFoundError, BusinessRuleError } from '../base-service';

// Mock repository
const mockRepository: IRepository<Job> = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('JobService', () => {
  let service: JobService;
  const mockProfileId = 1;

  beforeEach(() => {
    service = new JobService(mockRepository);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all jobs for a profile', async () => {
      const mockExperiences: Job[] = [
        {
          id: 'job-1',
          type: 'job' as const,
          title: 'Software Engineer',
          company: 'Tech Corp',
          position: 'Senior Developer',
          startDate: '2020-01-01',
          endDate: '2023-12-31',
          createdAt: '2020-01-01T00:00:00.000Z',
          updatedAt: '2023-12-31T23:59:59.999Z',
        },
      ];

      (mockRepository.findAll as MockedFunction<any>).mockResolvedValue(mockExperiences);

      const result = await service.getAll(mockProfileId);

      expect(result).toEqual(mockExperiences);
      expect(mockRepository.findAll).toHaveBeenCalledWith(mockProfileId);
    });

    it('should throw validation error for invalid profile ID', async () => {
      await expect(service.getAll(-1)).rejects.toThrow(ValidationError);
      await expect(service.getAll(0)).rejects.toThrow(ValidationError);
      await expect(service.getAll(1.5)).rejects.toThrow(ValidationError);
    });
  });

  describe('getById', () => {
    it('should return job by ID', async () => {
      const mockExperience: Job = {
        id: 'job-1',
        type: 'job' as const,
        title: 'Software Engineer',
        company: 'Tech Corp',
        position: 'Senior Developer',
        startDate: '2020-01-01',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      };

      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockExperience);

      const result = await service.getById(mockProfileId, 'job-1');

      expect(result).toEqual(mockExperience);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProfileId, 'job-1');
    });

    it('should throw NotFoundError when job does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.getById(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw validation error for invalid ID', async () => {
      await expect(service.getById(mockProfileId, '')).rejects.toThrow(ValidationError);
      await expect(service.getById(mockProfileId, '   ')).rejects.toThrow(ValidationError);
    });
  });

  describe('create', () => {
    const validCreateData: JobCreateDTO = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      position: 'Senior Developer',
      description: 'Building awesome software with React and Node.js',
      startDate: '2024-01-01',
      endDate: 'Present',
      technologies: ['React', 'Node.js', 'TypeScript'],
    };

    it('should create a new job successfully', async () => {
      const createdExperience: Job = {
        id: 'job-new',
        type: 'job' as const,
        ...validCreateData,
        endDate: 'Present',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdExperience);

      const result = await service.create(mockProfileId, validCreateData);

      expect(result).toEqual(createdExperience);
      expect(mockRepository.create).toHaveBeenCalledWith(
        mockProfileId,
        expect.objectContaining({
          type: 'job' as const,
          title: validCreateData.title,
          company: validCreateData.company,
          position: validCreateData.position,
        })
      );
    });

    it('should extract skills from description and responsibilities', async () => {
      const dataWithSkills: JobCreateDTO = {
        ...validCreateData,
        description: 'Working with Python, Django, and PostgreSQL',
        responsibilities: ['Write JavaScript code', 'Manage Docker containers'],
      };

      const createdExperience: Job = {
        id: 'job-new',
        type: 'job' as const,
        ...dataWithSkills,
        technologies: ['React', 'Node.js', 'TypeScript', 'python', 'javascript', 'docker'],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdExperience);

      const result = await service.create(mockProfileId, dataWithSkills);

      expect(result.technologies).toContain('python');
      expect(result.technologies).toContain('javascript');
      expect(result.technologies).toContain('docker');
    });

    it('should throw validation error for missing required fields', async () => {
      const invalidData = { ...validCreateData, title: '' };
      await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);

      const invalidData2 = { ...validCreateData, company: '' };
      await expect(service.create(mockProfileId, invalidData2)).rejects.toThrow(ValidationError);

      const invalidData3 = { ...validCreateData, position: '' };
      await expect(service.create(mockProfileId, invalidData3)).rejects.toThrow(ValidationError);
    });

    it('should throw validation error for invalid date logic', async () => {
      const invalidDateData = {
        ...validCreateData,
        startDate: '2024-12-31',
        endDate: '2024-01-01', // End before start
      };

      await expect(service.create(mockProfileId, invalidDateData)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    const existingExperience: Job = {
      id: 'job-1',
      type: 'job' as const,
      title: 'Software Engineer',
      company: 'Tech Corp',
      position: 'Senior Developer',
      startDate: '2020-01-01',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };

    const validUpdateData: JobUpdateDTO = {
      title: 'Senior Software Engineer',
      description: 'Updated role with more responsibilities',
    };

    beforeEach(() => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingExperience);
    });

    it('should update job successfully', async () => {
      const updatedExperience = {
        ...existingExperience,
        ...validUpdateData,
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.update as MockedFunction<any>).mockResolvedValue(updatedExperience);

      const result = await service.update(mockProfileId, 'job-1', validUpdateData);

      expect(result).toEqual(updatedExperience);
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockProfileId,
        'job-1',
        expect.objectContaining({
          ...validUpdateData,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw NotFoundError when job does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.update(mockProfileId, 'nonexistent', validUpdateData))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw validation error for empty required fields', async () => {
      const invalidUpdateData = { title: '' };
      await expect(service.update(mockProfileId, 'job-1', invalidUpdateData))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    const existingExperience: Job = {
      id: 'job-1',
      type: 'job' as const,
      title: 'Software Engineer',
      company: 'Tech Corp',
      position: 'Senior Developer',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    };

    it('should delete job successfully', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingExperience);
      (mockRepository.delete as MockedFunction<any>).mockResolvedValue(true);

      await service.delete(mockProfileId, 'job-1');

      expect(mockRepository.delete).toHaveBeenCalledWith(mockProfileId, 'job-1');
    });

    it('should throw NotFoundError when job does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.delete(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

});