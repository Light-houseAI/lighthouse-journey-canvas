/**
 * BaseService Tests
 * 
 * Tests for the abstract BaseService class using a concrete implementation.
 * These tests verify common business logic patterns and validation.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { BaseService, ValidationError, NotFoundError, ServiceError } from '../base-service';
import type { IRepository } from '../../core/interfaces/repository.interface';
import type { BaseNode } from '../../core/interfaces/base-node.interface';
import type { CreateDTO, UpdateDTO } from '../../core/interfaces/dto.interface';
import { z } from 'zod';

// Test node type for testing BaseService
interface TestNode extends BaseNode {
  type: 'test';
  name: string;
  category?: string;
}

interface TestCreateDTO extends CreateDTO {
  name: string;
  category?: string;
}

interface TestUpdateDTO extends UpdateDTO {
  name?: string;
  category?: string;
}

// Concrete implementation of BaseService for testing
class TestService extends BaseService<TestNode, TestCreateDTO, TestUpdateDTO> {
  protected getCreateSchema() {
    return z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      name: z.string().min(1),
      category: z.string().optional(),
    });
  }

  protected getUpdateSchema() {
    return z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      name: z.string().min(1).optional(),
      category: z.string().optional(),
    });
  }

  protected async transformCreateData(data: TestCreateDTO): Promise<Omit<TestNode, 'id' | 'createdAt' | 'updatedAt'>> {
    const baseData = await super.transformCreateData(data);
    return {
      ...baseData,
      type: 'test' as const,
      name: data.name,
      category: data.category,
    };
  }
}

// Mock repository
const mockRepository: IRepository<TestNode> = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('BaseService', () => {
  let service: TestService;
  const mockProfileId = 1;

  beforeEach(() => {
    service = new TestService(mockRepository, 'Test Entity');
    vi.clearAllMocks();
  });

  describe('validation', () => {
    describe('validateProfileId', () => {
      it('should accept valid profile IDs', async () => {
        // These should not throw
        await expect(service.getAll(1)).resolves.toBeDefined();
        await expect(service.getAll(999)).resolves.toBeDefined();
      });

      it('should reject invalid profile IDs', async () => {
        await expect(service.getAll(0)).rejects.toThrow(ValidationError);
        await expect(service.getAll(-1)).rejects.toThrow(ValidationError);
        await expect(service.getAll(1.5)).rejects.toThrow(ValidationError);
      });
    });

    describe('validateId', () => {
      it('should reject invalid entity IDs', async () => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

        await expect(service.getById(mockProfileId, '')).rejects.toThrow(ValidationError);
        await expect(service.getById(mockProfileId, '   ')).rejects.toThrow(ValidationError);
      });
    });
  });

  describe('CRUD operations', () => {
    const mockNode: TestNode = {
      id: 'test-1',
      type: 'test',
      title: 'Test Node',
      name: 'Test Name',
      description: 'Test Description',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    describe('getAll', () => {
      it('should return all entities from repository', async () => {
        const mockNodes = [mockNode];
        (mockRepository.findAll as MockedFunction<any>).mockResolvedValue(mockNodes);

        const result = await service.getAll(mockProfileId);

        expect(result).toEqual(mockNodes);
        expect(mockRepository.findAll).toHaveBeenCalledWith(mockProfileId);
      });

      it('should handle repository errors', async () => {
        (mockRepository.findAll as MockedFunction<any>).mockRejectedValue(new Error('DB Error'));

        await expect(service.getAll(mockProfileId)).rejects.toThrow(ServiceError);
      });
    });

    describe('getById', () => {
      it('should return entity by ID', async () => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockNode);

        const result = await service.getById(mockProfileId, 'test-1');

        expect(result).toEqual(mockNode);
        expect(mockRepository.findById).toHaveBeenCalledWith(mockProfileId, 'test-1');
      });

      it('should throw NotFoundError when entity does not exist', async () => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

        await expect(service.getById(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
      });
    });

    describe('create', () => {
      const validCreateData: TestCreateDTO = {
        title: 'Test Node',
        name: 'Test Name',
        description: 'Test Description',
        category: 'test-category',
      };

      it('should create entity successfully', async () => {
        const createdNode = { ...mockNode, ...validCreateData };
        (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdNode);

        const result = await service.create(mockProfileId, validCreateData);

        expect(result).toEqual(createdNode);
        expect(mockRepository.create).toHaveBeenCalledWith(
          mockProfileId,
          expect.objectContaining({
            type: 'test',
            title: validCreateData.title,
            name: validCreateData.name,
          })
        );
      });

      it('should validate create data using Zod schema', async () => {
        const invalidData = { ...validCreateData, title: '' };

        await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);
      });

      it('should validate required fields', async () => {
        const invalidData = { ...validCreateData, name: '' };

        await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);
      });
    });

    describe('update', () => {
      const validUpdateData: TestUpdateDTO = {
        title: 'Updated Test Node',
        name: 'Updated Test Name',
      };

      beforeEach(() => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockNode);
      });

      it('should update entity successfully', async () => {
        const updatedNode = { ...mockNode, ...validUpdateData, updatedAt: '2024-01-02T00:00:00.000Z' };
        (mockRepository.update as MockedFunction<any>).mockResolvedValue(updatedNode);

        const result = await service.update(mockProfileId, 'test-1', validUpdateData);

        expect(result).toEqual(updatedNode);
        expect(mockRepository.update).toHaveBeenCalledWith(
          mockProfileId,
          'test-1',
          expect.objectContaining({
            ...validUpdateData,
            updatedAt: expect.any(String),
          })
        );
      });

      it('should throw NotFoundError when entity does not exist', async () => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

        await expect(service.update(mockProfileId, 'nonexistent', validUpdateData))
          .rejects.toThrow(NotFoundError);
      });

      it('should validate update data using Zod schema', async () => {
        const invalidData = { title: '' };

        await expect(service.update(mockProfileId, 'test-1', invalidData))
          .rejects.toThrow(ValidationError);
      });
    });

    describe('delete', () => {
      beforeEach(() => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockNode);
      });

      it('should delete entity successfully', async () => {
        (mockRepository.delete as MockedFunction<any>).mockResolvedValue(true);

        await service.delete(mockProfileId, 'test-1');

        expect(mockRepository.delete).toHaveBeenCalledWith(mockProfileId, 'test-1');
      });

      it('should throw NotFoundError when entity does not exist', async () => {
        (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

        await expect(service.delete(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
      });
    });
  });

  describe('utility methods', () => {
    describe('validateDateFormat', () => {
      it('should validate ISO date format', () => {
        expect(service['validateDateFormat']('2024-01-01')).toBe(true);
        expect(service['validateDateFormat']('2024-12-31T23:59:59.999Z')).toBe(true);
        expect(service['validateDateFormat']('Present')).toBe(true);
        expect(service['validateDateFormat']('present')).toBe(true);
        expect(service['validateDateFormat']('')).toBe(true); // Empty is allowed
      });

      it('should reject invalid date formats', () => {
        expect(service['validateDateFormat']('invalid-date')).toBe(false);
        expect(service['validateDateFormat']('2024/01/01')).toBe(false);
        expect(service['validateDateFormat']('January 1, 2024')).toBe(false);
      });
    });

    describe('validateDateLogic', () => {
      it('should validate correct date logic', () => {
        const result = service['validateDateLogic']('2020-01-01', '2023-12-31');
        expect(result.valid).toBe(true);
      });

      it('should allow Present as end date', () => {
        const result = service['validateDateLogic']('2020-01-01', 'Present');
        expect(result.valid).toBe(true);
      });

      it('should allow empty dates', () => {
        const result1 = service['validateDateLogic'](undefined, '2023-12-31');
        const result2 = service['validateDateLogic']('2020-01-01', undefined);
        const result3 = service['validateDateLogic'](undefined, undefined);
        
        expect(result1.valid).toBe(true);
        expect(result2.valid).toBe(true);
        expect(result3.valid).toBe(true);
      });

      it('should reject invalid date logic', () => {
        const result = service['validateDateLogic']('2023-12-31', '2020-01-01');
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('before end date');
      });

      it('should handle invalid date formats', () => {
        const result = service['validateDateLogic']('invalid-date', '2023-12-31');
        expect(result.valid).toBe(false);
        expect(result.errors?.[0]).toContain('Invalid date format');
      });
    });

    describe('extractSkillsFromText', () => {
      it('should extract common technology skills', () => {
        const text = 'Working with JavaScript, React, and Python. Using Docker and AWS.';
        const skills = service['extractSkillsFromText'](text, []);
        
        expect(skills).toContain('javascript');
        expect(skills).toContain('react');
        expect(skills).toContain('python');
        expect(skills).toContain('docker');
        expect(skills).toContain('aws');
      });

      it('should combine with existing skills', () => {
        const text = 'Working with TypeScript and Node.js';
        const existingSkills = ['javascript', 'react'];
        const skills = service['extractSkillsFromText'](text, existingSkills);
        
        expect(skills).toContain('javascript');
        expect(skills).toContain('react');
        expect(skills).toContain('typescript');
        expect(skills).toContain('node');
      });

      it('should handle empty text', () => {
        const skills = service['extractSkillsFromText']('', ['existing-skill']);
        expect(skills).toEqual(['existing-skill']);
      });
    });

    describe('calculateDuration', () => {
      it('should calculate duration between dates', () => {
        const duration = service['calculateDuration']('2020-01-01', '2024-01-01');
        expect(duration).toContain('4 year');
      });

      it('should handle Present as end date', () => {
        const duration = service['calculateDuration']('2023-01-01', 'Present');
        expect(duration).toBeDefined();
        expect(duration).not.toBeNull();
      });

      it('should handle missing start date', () => {
        const duration = service['calculateDuration'](undefined, '2024-01-01');
        expect(duration).toBeNull();
      });

      it('should handle invalid dates', () => {
        const duration = service['calculateDuration']('invalid-date', '2024-01-01');
        expect(duration).toBeNull();
      });
    });

    describe('generateId', () => {
      it('should generate valid UUID', () => {
        const id = service['generateId']();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('should generate unique IDs', () => {
        const id1 = service['generateId']();
        const id2 = service['generateId']();
        expect(id1).not.toBe(id2);
      });
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      (mockRepository.findAll as MockedFunction<any>).mockRejectedValue(new Error('Database error'));

      const error = await service.getAll(mockProfileId).catch(e => e);
      
      expect(error).toBeInstanceOf(ServiceError);
      expect(error.message).toContain('Failed to retrieve all test entity');
    });

    it('should preserve service errors from lower layers', async () => {
      const originalError = new NotFoundError('Test', 'test-1');
      (mockRepository.findById as MockedFunction<any>).mockRejectedValue(originalError);

      await expect(service.getById(mockProfileId, 'test-1')).rejects.toThrow(NotFoundError);
    });
  });
});