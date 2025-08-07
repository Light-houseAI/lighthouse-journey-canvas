/**
 * Tests for IRepository<T> interface
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect } from 'vitest';
import { IRepository } from '../repository.interface';
import { BaseNode, NodeType } from '../base-node.interface';

// Test implementation for demonstration
class TestNode implements BaseNode {
  constructor(
    public id: string,
    public type: NodeType,
    public title: string,
    public createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
    public description?: string,
    public startDate?: string,
    public endDate?: string
  ) {}
}

// Mock repository implementation for testing
class MockRepository implements IRepository<TestNode> {
  private data: TestNode[] = [];
  private counter = 0;

  async findAll(profileId: number): Promise<TestNode[]> {
    return this.data.filter(item => item.id.startsWith(`profile-${profileId}`));
  }

  async findById(profileId: number, id: string): Promise<TestNode | null> {
    return this.data.find(item => item.id === id && item.id.startsWith(`profile-${profileId}`)) || null;
  }

  async create(profileId: number, data: Omit<TestNode, 'id'>): Promise<TestNode> {
    // Add a small delay to ensure different timestamps and use counter for uniqueness
    await new Promise(resolve => setTimeout(resolve, 1));
    this.counter++;
    
    const newItem = new TestNode(
      `profile-${profileId}-${Date.now()}-${this.counter}`,
      data.type,
      data.title,
      data.createdAt,
      data.updatedAt,
      data.description,
      data.startDate,
      data.endDate
    );
    this.data.push(newItem);
    return newItem;
  }

  async update(profileId: number, id: string, data: Partial<TestNode>): Promise<TestNode | null> {
    const index = this.data.findIndex(item => item.id === id && item.id.startsWith(`profile-${profileId}`));
    if (index === -1) return null;
    
    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
    
    this.data[index] = { ...this.data[index], ...data, updatedAt: new Date().toISOString() };
    return this.data[index];
  }

  async delete(profileId: number, id: string): Promise<boolean> {
    const index = this.data.findIndex(item => item.id === id && item.id.startsWith(`profile-${profileId}`));
    if (index === -1) return false;
    
    this.data.splice(index, 1);
    return true;
  }
}

describe('IRepository<T> Interface', () => {
  let repository: MockRepository;
  const testProfileId = 123;

  beforeEach(() => {
    repository = new MockRepository();
  });

  describe('create method', () => {
    it('should create a new item and return it', async () => {
      const itemData = {
        type: NodeType.WorkExperience,
        title: 'Software Engineer',
        description: 'Developing awesome apps',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const created = await repository.create(testProfileId, itemData);

      expect(created).toBeDefined();
      expect(created.id).toContain(`profile-${testProfileId}`);
      expect(created.type).toBe(NodeType.WorkExperience);
      expect(created.title).toBe('Software Engineer');
      expect(created.description).toBe('Developing awesome apps');
    });

    it('should generate unique IDs for multiple items', async () => {
      const itemData = {
        type: NodeType.Project,
        title: 'Test Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const item1 = await repository.create(testProfileId, itemData);
      const item2 = await repository.create(testProfileId, itemData);

      expect(item1.id).not.toBe(item2.id);
      expect(item1.id).toContain(`profile-${testProfileId}`);
      expect(item2.id).toContain(`profile-${testProfileId}`);
    });
  });

  describe('findAll method', () => {
    it('should return empty array when no items exist', async () => {
      const items = await repository.findAll(testProfileId);
      expect(items).toEqual([]);
    });

    it('should return all items for a profile', async () => {
      const itemData1 = {
        type: NodeType.WorkExperience,
        title: 'Job 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const itemData2 = {
        type: NodeType.Education,
        title: 'Degree 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await repository.create(testProfileId, itemData1);
      await repository.create(testProfileId, itemData2);

      const items = await repository.findAll(testProfileId);
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe('Job 1');
      expect(items[1].title).toBe('Degree 1');
    });

    it('should only return items for the specified profile', async () => {
      const otherProfileId = 456;
      
      await repository.create(testProfileId, {
        type: NodeType.Project,
        title: 'Project for Profile 123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      await repository.create(otherProfileId, {
        type: NodeType.Project,
        title: 'Project for Profile 456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const profile123Items = await repository.findAll(testProfileId);
      const profile456Items = await repository.findAll(otherProfileId);

      expect(profile123Items).toHaveLength(1);
      expect(profile456Items).toHaveLength(1);
      expect(profile123Items[0].title).toBe('Project for Profile 123');
      expect(profile456Items[0].title).toBe('Project for Profile 456');
    });
  });

  describe('findById method', () => {
    it('should return null when item not found', async () => {
      const item = await repository.findById(testProfileId, 'non-existent-id');
      expect(item).toBeNull();
    });

    it('should return the item when found', async () => {
      const created = await repository.create(testProfileId, {
        type: NodeType.Action,
        title: 'Test Action',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const found = await repository.findById(testProfileId, created.id);
      
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Test Action');
    });

    it('should not return items from different profiles', async () => {
      const otherProfileId = 789;
      const created = await repository.create(otherProfileId, {
        type: NodeType.Event,
        title: 'Other Profile Event',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const found = await repository.findById(testProfileId, created.id);
      expect(found).toBeNull();
    });
  });

  describe('update method', () => {
    it('should return null when item not found', async () => {
      const result = await repository.update(testProfileId, 'non-existent-id', { title: 'Updated' });
      expect(result).toBeNull();
    });

    it('should update and return the item when found', async () => {
      const created = await repository.create(testProfileId, {
        type: NodeType.CareerTransition,
        title: 'Original Title',
        description: 'Original description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const updated = await repository.update(testProfileId, created.id, {
        title: 'Updated Title',
        description: 'Updated description'
      });

      expect(updated).toBeDefined();
      expect(updated!.id).toBe(created.id);
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.description).toBe('Updated description');
      expect(updated!.updatedAt).not.toBe(created.updatedAt);
    });

    it('should not update items from different profiles', async () => {
      const otherProfileId = 999;
      const created = await repository.create(otherProfileId, {
        type: NodeType.Project,
        title: 'Other Profile Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await repository.update(testProfileId, created.id, { title: 'Attempted Update' });
      expect(result).toBeNull();
    });
  });

  describe('delete method', () => {
    it('should return false when item not found', async () => {
      const deleted = await repository.delete(testProfileId, 'non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should delete and return true when item found', async () => {
      const created = await repository.create(testProfileId, {
        type: NodeType.Education,
        title: 'Degree to Delete',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deleted = await repository.delete(testProfileId, created.id);
      expect(deleted).toBe(true);

      const found = await repository.findById(testProfileId, created.id);
      expect(found).toBeNull();
    });

    it('should not delete items from different profiles', async () => {
      const otherProfileId = 111;
      const created = await repository.create(otherProfileId, {
        type: NodeType.Action,
        title: 'Other Profile Action',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deleted = await repository.delete(testProfileId, created.id);
      expect(deleted).toBe(false);

      // Verify item still exists for correct profile
      const found = await repository.findById(otherProfileId, created.id);
      expect(found).toBeDefined();
    });
  });

  describe('type safety', () => {
    it('should enforce the correct generic type T', async () => {
      // This test ensures TypeScript compilation enforces type safety
      const repository = new MockRepository();
      
      const validData = {
        type: NodeType.WorkExperience,
        title: 'Valid Work Experience',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const created = await repository.create(testProfileId, validData);
      expect(created).toBeInstanceOf(TestNode);
      expect(created.type).toBe(NodeType.WorkExperience);
    });
  });
});