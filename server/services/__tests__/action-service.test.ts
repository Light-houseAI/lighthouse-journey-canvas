/**
 * ActionService Tests
 * 
 * Comprehensive unit tests for ActionService business logic
 * with mocked repository dependencies.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ActionService } from '../action-service';
import type { Action, ActionCreateDTO, ActionUpdateDTO } from '@shared/schema';
import type { IRepository } from '../../core/interfaces/repository.interface';
import { ValidationError, NotFoundError } from '../base-service';

// Mock repository
const mockRepository: IRepository<Action> = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('ActionService', () => {
  let service: ActionService;
  const mockProfileId = 1;

  beforeEach(() => {
    service = new ActionService(mockRepository);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all actions for a profile', async () => {
      const mockActions: Action[] = [
        {
          id: 'action-1',
          type: 'action' as const,
          title: 'AWS Certification',
          actionType: 'certification',
          category: 'professional-development',
          status: 'completed',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (mockRepository.findAll as MockedFunction<any>).mockResolvedValue(mockActions);

      const result = await service.getAll(mockProfileId);

      expect(result).toEqual(mockActions);
      expect(mockRepository.findAll).toHaveBeenCalledWith(mockProfileId);
    });

    it('should throw validation error for invalid profile ID', async () => {
      await expect(service.getAll(-1)).rejects.toThrow(ValidationError);
      await expect(service.getAll(0)).rejects.toThrow(ValidationError);
      await expect(service.getAll(1.5)).rejects.toThrow(ValidationError);
    });
  });

  describe('getById', () => {
    it('should return action by ID', async () => {
      const mockAction: Action = {
        id: 'action-1',
        type: 'action' as const,
        title: 'AWS Certification',
        actionType: 'certification',
        category: 'professional-development',
        status: 'completed',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockAction);

      const result = await service.getById(mockProfileId, 'action-1');

      expect(result).toEqual(mockAction);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProfileId, 'action-1');
    });

    it('should throw NotFoundError when action does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.getById(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const validCreateData: ActionCreateDTO = {
      title: 'AWS Solutions Architect',
      actionType: 'certification',
      category: 'professional-development',
      status: 'completed',
      description: 'Passed AWS certification exam',
      startDate: '2024-01-01',
      endDate: '2024-01-15',
    };

    it('should create a new action successfully', async () => {
      const createdAction: Action = {
        id: 'action-new',
        type: 'action' as const,
        ...validCreateData,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdAction);

      const result = await service.create(mockProfileId, validCreateData);

      expect(result).toEqual(createdAction);
      expect(mockRepository.create).toHaveBeenCalledWith(
        mockProfileId,
        expect.objectContaining({
          type: 'action' as const,
          title: validCreateData.title,
          actionType: validCreateData.actionType,
          category: validCreateData.category,
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      const invalidData = { ...validCreateData, title: '' };
      await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);

      const invalidData2 = { ...validCreateData, actionType: undefined };
      await expect(service.create(mockProfileId, invalidData2 as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    const existingAction: Action = {
      id: 'action-1',
      type: 'action' as const,
      title: 'AWS Certification',
      actionType: 'certification',
      category: 'professional-development',
      status: 'completed',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const validUpdateData: ActionUpdateDTO = {
      title: 'AWS Solutions Architect Professional',
      description: 'Updated certification level',
    };

    beforeEach(() => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingAction);
    });

    it('should update action successfully', async () => {
      const updatedAction = {
        ...existingAction,
        ...validUpdateData,
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.update as MockedFunction<any>).mockResolvedValue(updatedAction);

      const result = await service.update(mockProfileId, 'action-1', validUpdateData);

      expect(result).toEqual(updatedAction);
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockProfileId,
        'action-1',
        expect.objectContaining({
          ...validUpdateData,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw NotFoundError when action does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.update(mockProfileId, 'nonexistent', validUpdateData))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    const existingAction: Action = {
      id: 'action-1',
      type: 'action' as const,
      title: 'AWS Certification',
      actionType: 'certification',
      category: 'professional-development',
      status: 'completed',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should delete action successfully', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingAction);
      (mockRepository.delete as MockedFunction<any>).mockResolvedValue(true);

      await service.delete(mockProfileId, 'action-1');

      expect(mockRepository.delete).toHaveBeenCalledWith(mockProfileId, 'action-1');
    });

    it('should throw NotFoundError when action does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.delete(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});