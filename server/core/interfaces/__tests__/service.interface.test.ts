/**
 * Tests for IService<T> interface
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IService } from '../service.interface';
import { CreateDTO, UpdateDTO } from '../dto.interface';
import { BaseNode, NodeType } from '../base-node.interface';
import { IRepository } from '../repository.interface';

// Test node type for demonstration
interface TestWorkExperience extends BaseNode {
  company: string;
  position: string;
  location?: string;
}

// Test DTOs
interface CreateWorkExperienceDTO extends CreateDTO {
  company: string;
  position: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

interface UpdateWorkExperienceDTO extends UpdateDTO {
  company?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

// Mock repository for testing
class MockWorkExperienceRepository implements IRepository<TestWorkExperience> {
  private data: TestWorkExperience[] = [];
  private idCounter = 1;

  async findAll(profileId: number): Promise<TestWorkExperience[]> {
    return this.data.filter(item => item.id.startsWith(`profile-${profileId}`));
  }

  async findById(profileId: number, id: string): Promise<TestWorkExperience | null> {
    return this.data.find(item => item.id === id && item.id.startsWith(`profile-${profileId}`)) || null;
  }

  async create(profileId: number, data: Omit<TestWorkExperience, 'id'>): Promise<TestWorkExperience> {
    const now = new Date().toISOString();
    const newItem: TestWorkExperience = {
      id: `profile-${profileId}-work-${this.idCounter++}`,
      ...data,
      createdAt: now,
      updatedAt: now
    };
    this.data.push(newItem);
    return newItem;
  }

  async update(profileId: number, id: string, data: Partial<TestWorkExperience>): Promise<TestWorkExperience | null> {
    const index = this.data.findIndex(item => item.id === id && item.id.startsWith(`profile-${profileId}`));
    if (index === -1) return null;
    
    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    
    this.data[index] = { 
      ...this.data[index], 
      ...data, 
      updatedAt: new Date().toISOString() 
    };
    return this.data[index];
  }

  async delete(profileId: number, id: string): Promise<boolean> {
    const index = this.data.findIndex(item => item.id === id && item.id.startsWith(`profile-${profileId}`));
    if (index === -1) return false;
    
    this.data.splice(index, 1);
    return true;
  }
}

// Mock service implementation for testing
class MockWorkExperienceService implements IService<TestWorkExperience, CreateWorkExperienceDTO, UpdateWorkExperienceDTO> {
  constructor(private repository: IRepository<TestWorkExperience>) {}

  async getAll(profileId: number): Promise<TestWorkExperience[]> {
    return this.repository.findAll(profileId);
  }

  async getById(profileId: number, id: string): Promise<TestWorkExperience> {
    const item = await this.repository.findById(profileId, id);
    if (!item) {
      throw new Error(`Work experience with id ${id} not found for profile ${profileId}`);
    }
    return item;
  }

  async create(profileId: number, data: CreateWorkExperienceDTO): Promise<TestWorkExperience> {
    // Validate required fields
    if (!data.title) {
      throw new Error('Title is required');
    }
    if (!data.company) {
      throw new Error('Company is required');
    }
    if (!data.position) {
      throw new Error('Position is required');
    }

    const nodeData: Omit<TestWorkExperience, 'id'> = {
      type: NodeType.WorkExperience,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      company: data.company,
      position: data.position,
      location: data.location,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.repository.create(profileId, nodeData);
  }

  async update(profileId: number, id: string, data: UpdateWorkExperienceDTO): Promise<TestWorkExperience> {
    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const updated = await this.repository.update(profileId, id, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    
    if (!updated) {
      throw new Error(`Work experience with id ${id} not found for profile ${profileId}`);
    }
    return updated;
  }

  async delete(profileId: number, id: string): Promise<void> {
    const deleted = await this.repository.delete(profileId, id);
    if (!deleted) {
      throw new Error(`Work experience with id ${id} not found for profile ${profileId}`);
    }
  }
}

describe('IService<T> Interface', () => {
  let repository: MockWorkExperienceRepository;
  let service: MockWorkExperienceService;
  const testProfileId = 123;

  beforeEach(() => {
    repository = new MockWorkExperienceRepository();
    service = new MockWorkExperienceService(repository);
  });

  describe('create method', () => {
    it('should create a new work experience with valid data', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Senior Software Engineer',
        description: 'Leading development team',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2023-01-15',
        endDate: 'Present'
      };

      const created = await service.create(testProfileId, createData);

      expect(created).toBeDefined();
      expect(created.id).toContain(`profile-${testProfileId}`);
      expect(created.title).toBe('Senior Software Engineer');
      expect(created.company).toBe('Tech Corp');
      expect(created.position).toBe('Senior Software Engineer');
      expect(created.location).toBe('San Francisco, CA');
      expect(created.type).toBe(NodeType.WorkExperience);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should throw error when required title is missing', async () => {
      const createData = {
        company: 'Tech Corp',
        position: 'Software Engineer'
      } as CreateWorkExperienceDTO;

      await expect(service.create(testProfileId, createData))
        .rejects
        .toThrow('Title is required');
    });

    it('should throw error when required company is missing', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Software Engineer',
        position: 'Software Engineer'
      } as CreateWorkExperienceDTO;

      await expect(service.create(testProfileId, createData))
        .rejects
        .toThrow('Company is required');
    });

    it('should throw error when required position is missing', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Software Engineer',
        company: 'Tech Corp'
      } as CreateWorkExperienceDTO;

      await expect(service.create(testProfileId, createData))
        .rejects
        .toThrow('Position is required');
    });

    it('should create work experience with minimal required fields', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Developer',
        company: 'Startup Inc',
        position: 'Full Stack Developer'
      };

      const created = await service.create(testProfileId, createData);

      expect(created.title).toBe('Developer');
      expect(created.company).toBe('Startup Inc');
      expect(created.position).toBe('Full Stack Developer');
      expect(created.location).toBeUndefined();
      expect(created.description).toBeUndefined();
    });
  });

  describe('getAll method', () => {
    it('should return empty array when no items exist', async () => {
      const items = await service.getAll(testProfileId);
      expect(items).toEqual([]);
    });

    it('should return all work experiences for a profile', async () => {
      await service.create(testProfileId, {
        title: 'Job 1',
        company: 'Company 1',
        position: 'Position 1'
      });
      
      await service.create(testProfileId, {
        title: 'Job 2',
        company: 'Company 2',
        position: 'Position 2'
      });

      const items = await service.getAll(testProfileId);
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Job 1');
      expect(items[1].title).toBe('Job 2');
    });

    it('should only return items for the specified profile', async () => {
      const otherProfileId = 456;
      
      await service.create(testProfileId, {
        title: 'Job for Profile 123',
        company: 'Company',
        position: 'Position'
      });
      
      await service.create(otherProfileId, {
        title: 'Job for Profile 456',
        company: 'Company',
        position: 'Position'
      });

      const profile123Items = await service.getAll(testProfileId);
      const profile456Items = await service.getAll(otherProfileId);

      expect(profile123Items).toHaveLength(1);
      expect(profile456Items).toHaveLength(1);
      expect(profile123Items[0].title).toBe('Job for Profile 123');
      expect(profile456Items[0].title).toBe('Job for Profile 456');
    });
  });

  describe('getById method', () => {
    it('should return the work experience when found', async () => {
      const created = await service.create(testProfileId, {
        title: 'Software Architect',
        company: 'Big Tech',
        position: 'Principal Engineer',
        description: 'System design and architecture'
      });

      const found = await service.getById(testProfileId, created.id);
      
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Software Architect');
      expect(found.company).toBe('Big Tech');
    });

    it('should throw error when work experience not found', async () => {
      await expect(service.getById(testProfileId, 'non-existent-id'))
        .rejects
        .toThrow(`Work experience with id non-existent-id not found for profile ${testProfileId}`);
    });

    it('should not return items from different profiles', async () => {
      const otherProfileId = 789;
      const created = await service.create(otherProfileId, {
        title: 'Other Profile Job',
        company: 'Other Company',
        position: 'Other Position'
      });

      await expect(service.getById(testProfileId, created.id))
        .rejects
        .toThrow(`Work experience with id ${created.id} not found for profile ${testProfileId}`);
    });
  });

  describe('update method', () => {
    it('should update and return the work experience when found', async () => {
      const created = await service.create(testProfileId, {
        title: 'Junior Developer',
        company: 'Startup',
        position: 'Junior Developer',
        location: 'Remote'
      });

      const updateData: UpdateWorkExperienceDTO = {
        title: 'Senior Developer',
        position: 'Senior Developer',
        location: 'New York, NY'
      };

      const updated = await service.update(testProfileId, created.id, updateData);

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('Senior Developer');
      expect(updated.position).toBe('Senior Developer');
      expect(updated.location).toBe('New York, NY');
      expect(updated.company).toBe('Startup'); // Should remain unchanged
      expect(updated.updatedAt).not.toBe(created.updatedAt);
    });

    it('should allow partial updates', async () => {
      const created = await service.create(testProfileId, {
        title: 'Developer',
        company: 'Company',
        position: 'Developer',
        location: 'City A'
      });

      const updateData: UpdateWorkExperienceDTO = {
        location: 'City B'
      };

      const updated = await service.update(testProfileId, created.id, updateData);

      expect(updated.location).toBe('City B');
      expect(updated.title).toBe('Developer'); // Should remain unchanged
      expect(updated.company).toBe('Company'); // Should remain unchanged
    });

    it('should throw error when work experience not found', async () => {
      const updateData: UpdateWorkExperienceDTO = {
        title: 'Updated Title'
      };

      await expect(service.update(testProfileId, 'non-existent-id', updateData))
        .rejects
        .toThrow(`Work experience with id non-existent-id not found for profile ${testProfileId}`);
    });

    it('should not update items from different profiles', async () => {
      const otherProfileId = 999;
      const created = await service.create(otherProfileId, {
        title: 'Other Job',
        company: 'Other Company',
        position: 'Other Position'
      });

      const updateData: UpdateWorkExperienceDTO = {
        title: 'Attempted Update'
      };

      await expect(service.update(testProfileId, created.id, updateData))
        .rejects
        .toThrow(`Work experience with id ${created.id} not found for profile ${testProfileId}`);
    });
  });

  describe('delete method', () => {
    it('should delete work experience when found', async () => {
      const created = await service.create(testProfileId, {
        title: 'Job to Delete',
        company: 'Company',
        position: 'Position'
      });

      await expect(service.delete(testProfileId, created.id)).resolves.not.toThrow();

      // Verify it's deleted
      await expect(service.getById(testProfileId, created.id))
        .rejects
        .toThrow();
    });

    it('should throw error when work experience not found', async () => {
      await expect(service.delete(testProfileId, 'non-existent-id'))
        .rejects
        .toThrow(`Work experience with id non-existent-id not found for profile ${testProfileId}`);
    });

    it('should not delete items from different profiles', async () => {
      const otherProfileId = 111;
      const created = await service.create(otherProfileId, {
        title: 'Other Job',
        company: 'Other Company',
        position: 'Other Position'
      });

      await expect(service.delete(testProfileId, created.id))
        .rejects
        .toThrow(`Work experience with id ${created.id} not found for profile ${testProfileId}`);
    });
  });

  describe('business logic validation', () => {
    it('should handle "Present" as end date', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Current Job',
        company: 'Current Company',
        position: 'Current Position',
        startDate: '2023-01-01',
        endDate: 'Present'
      };

      const created = await service.create(testProfileId, createData);
      expect(created.endDate).toBe('Present');
    });

    it('should set node type correctly', async () => {
      const created = await service.create(testProfileId, {
        title: 'Test Job',
        company: 'Test Company',
        position: 'Test Position'
      });

      expect(created.type).toBe(NodeType.WorkExperience);
    });

    it('should handle empty optional fields', async () => {
      const createData: CreateWorkExperienceDTO = {
        title: 'Simple Job',
        company: 'Simple Company',
        position: 'Simple Position'
      };

      const created = await service.create(testProfileId, createData);
      
      expect(created.description).toBeUndefined();
      expect(created.location).toBeUndefined();
      expect(created.startDate).toBeUndefined();
      expect(created.endDate).toBeUndefined();
    });
  });
});