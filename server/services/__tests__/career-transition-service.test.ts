/**
 * CareerTransitionService Tests
 * 
 * Comprehensive unit tests for CareerTransitionService business logic
 * with mocked repository dependencies.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { CareerTransitionService } from '../career-transition-service';
import type { CareerTransition, CareerTransitionCreateDTO, CareerTransitionUpdateDTO } from '@shared/schema';
import type { IRepository } from '../../core/interfaces/repository.interface';
import { ValidationError, NotFoundError } from '../base-service';

// Mock repository
const mockRepository: IRepository<CareerTransition> = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('CareerTransitionService', () => {
  let service: CareerTransitionService;
  const mockProfileId = 1;

  beforeEach(() => {
    service = new CareerTransitionService(mockRepository);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all career transitions for a profile', async () => {
      const mockTransitions: CareerTransition[] = [
        {
          id: 'transition-1',
          type: 'careerTransition' as const,
          title: 'Software Engineer to Team Lead',
          transitionType: 'promotion',
          fromRole: 'Software Engineer',
          toRole: 'Team Lead',
          fromCompany: 'Tech Corp',
          toCompany: 'Tech Corp',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (mockRepository.findAll as MockedFunction<any>).mockResolvedValue(mockTransitions);

      const result = await service.getAll(mockProfileId);

      expect(result).toEqual(mockTransitions);
      expect(mockRepository.findAll).toHaveBeenCalledWith(mockProfileId);
    });

    it('should throw validation error for invalid profile ID', async () => {
      await expect(service.getAll(-1)).rejects.toThrow(ValidationError);
      await expect(service.getAll(0)).rejects.toThrow(ValidationError);
      await expect(service.getAll(1.5)).rejects.toThrow(ValidationError);
    });
  });

  describe('getById', () => {
    it('should return career transition by ID', async () => {
      const mockTransition: CareerTransition = {
        id: 'transition-1',
        type: 'careerTransition' as const,
        title: 'Software Engineer to Team Lead',
        transitionType: 'promotion',
        fromRole: 'Software Engineer',
        toRole: 'Team Lead',
        fromCompany: 'Tech Corp',
        toCompany: 'Tech Corp',
        motivations: ['Career growth', 'Leadership opportunity'],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockTransition);

      const result = await service.getById(mockProfileId, 'transition-1');

      expect(result).toEqual(mockTransition);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProfileId, 'transition-1');
    });

    it('should throw NotFoundError when career transition does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.getById(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const validCreateData: CareerTransitionCreateDTO = {
      title: 'Software Engineer to Team Lead',
      transitionType: 'promotion',
      description: 'Promoted to team leadership role',
      startDate: '2024-01-01',
      endDate: '2024-01-15',
      fromRole: 'Software Engineer',
      toRole: 'Team Lead',
      fromCompany: 'Tech Corp',
      toCompany: 'Tech Corp',
      motivations: ['Career growth', 'Leadership opportunity'],
    };

    it('should create a new career transition successfully', async () => {
      const createdTransition: CareerTransition = {
        id: 'transition-new',
        type: 'careerTransition' as const,
        ...validCreateData,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdTransition);

      const result = await service.create(mockProfileId, validCreateData);

      expect(result).toEqual(createdTransition);
      expect(mockRepository.create).toHaveBeenCalledWith(
        mockProfileId,
        expect.objectContaining({
          type: 'careerTransition' as const,
          title: validCreateData.title,
          transitionType: validCreateData.transitionType,
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      const invalidData = { ...validCreateData, title: '' };
      await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);

      const invalidData2 = { ...validCreateData, transitionType: undefined };
      await expect(service.create(mockProfileId, invalidData2 as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    const existingTransition: CareerTransition = {
      id: 'transition-1',
      type: 'careerTransition' as const,
      title: 'Software Engineer to Team Lead',
      transitionType: 'promotion',
      fromRole: 'Software Engineer',
      toRole: 'Team Lead',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const validUpdateData: CareerTransitionUpdateDTO = {
      title: 'Software Engineer to Senior Team Lead',
      description: 'Updated transition with additional responsibilities',
      outcomes: ['Increased team productivity', 'Improved code quality'],
    };

    beforeEach(() => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingTransition);
    });

    it('should update career transition successfully', async () => {
      const updatedTransition = {
        ...existingTransition,
        ...validUpdateData,
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.update as MockedFunction<any>).mockResolvedValue(updatedTransition);

      const result = await service.update(mockProfileId, 'transition-1', validUpdateData);

      expect(result).toEqual(updatedTransition);
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockProfileId,
        'transition-1',
        expect.objectContaining({
          ...validUpdateData,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw NotFoundError when career transition does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.update(mockProfileId, 'nonexistent', validUpdateData))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    const existingTransition: CareerTransition = {
      id: 'transition-1',
      type: 'careerTransition' as const,
      title: 'Software Engineer to Team Lead',
      transitionType: 'promotion',
      fromRole: 'Software Engineer',
      toRole: 'Team Lead',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should delete career transition successfully', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingTransition);
      (mockRepository.delete as MockedFunction<any>).mockResolvedValue(true);

      await service.delete(mockProfileId, 'transition-1');

      expect(mockRepository.delete).toHaveBeenCalledWith(mockProfileId, 'transition-1');
    });

    it('should throw NotFoundError when career transition does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.delete(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});