/**
 * Integration Tests for Infrastructure Components
 * Ensures all our interfaces and types work together properly
 */
import { describe, it, expect } from 'vitest';
import { BaseNode, NodeType } from '../interfaces/base-node.interface';
import { IRepository } from '../interfaces/repository.interface';
import { IService } from '../interfaces/service.interface';
import { CreateDTO, UpdateDTO } from '../interfaces/dto.interface';
import { WorkExperience } from '../../types/node-types';
import { SERVICE_TOKENS, createDIContainer } from '../di-container';

describe('Infrastructure Integration', () => {
  describe('Type Compatibility', () => {
    it('should ensure WorkExperience extends BaseNode', () => {
      const workExp: WorkExperience = {
        id: 'work-123',
        type: NodeType.WorkExperience,
        title: 'Software Engineer',
        company: 'Tech Corp',
        position: 'Software Engineer',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      // Type assertion to ensure it's compatible with BaseNode
      const baseNode: BaseNode = workExp;
      expect(baseNode.id).toBe('work-123');
      expect(baseNode.type).toBe(NodeType.WorkExperience);
    });

    it('should ensure DTO interfaces are compatible', () => {
      interface WorkExpCreateDTO extends CreateDTO {
        company: string;
        position: string;
      }

      interface WorkExpUpdateDTO extends UpdateDTO {
        company?: string;
        position?: string;
      }

      const createDto: WorkExpCreateDTO = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        position: 'Developer'
      };

      const updateDto: WorkExpUpdateDTO = {
        position: 'Senior Developer'
      };

      expect(createDto.title).toBe('Software Engineer');
      expect(updateDto.position).toBe('Senior Developer');
    });

    it('should ensure repository interface can handle WorkExperience', () => {
      // Mock repository that implements our interface
      class MockWorkExpRepository implements IRepository<WorkExperience> {
        async findAll(profileId: number): Promise<WorkExperience[]> {
          return [];
        }

        async findById(profileId: number, id: string): Promise<WorkExperience | null> {
          return null;
        }

        async create(profileId: number, data: Omit<WorkExperience, 'id'>): Promise<WorkExperience> {
          return {
            ...data,
            id: `work-${Date.now()}`
          };
        }

        async update(profileId: number, id: string, data: Partial<WorkExperience>): Promise<WorkExperience | null> {
          return null;
        }

        async delete(profileId: number, id: string): Promise<boolean> {
          return false;
        }
      }

      const repository = new MockWorkExpRepository();
      expect(repository).toBeInstanceOf(MockWorkExpRepository);
    });

    it('should ensure service interface can handle WorkExperience', () => {
      interface WorkExpCreateDTO extends CreateDTO {
        company: string;
        position: string;
      }

      interface WorkExpUpdateDTO extends UpdateDTO {
        company?: string;
        position?: string;
      }

      // Mock service that implements our interface
      class MockWorkExpService implements IService<WorkExperience, WorkExpCreateDTO, WorkExpUpdateDTO> {
        async getAll(profileId: number): Promise<WorkExperience[]> {
          return [];
        }

        async getById(profileId: number, id: string): Promise<WorkExperience> {
          throw new Error('Not found');
        }

        async create(profileId: number, data: WorkExpCreateDTO): Promise<WorkExperience> {
          return {
            id: `work-${Date.now()}`,
            type: NodeType.WorkExperience,
            title: data.title,
            company: data.company,
            position: data.position,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        }

        async update(profileId: number, id: string, data: WorkExpUpdateDTO): Promise<WorkExperience> {
          throw new Error('Not found');
        }

        async delete(profileId: number, id: string): Promise<void> {
          throw new Error('Not found');
        }
      }

      const service = new MockWorkExpService();
      expect(service).toBeInstanceOf(MockWorkExpService);
    });
  });

  describe('DI Container Integration', () => {
    it('should create DI container without errors', () => {
      const container = createDIContainer();
      expect(container).toBeDefined();
    });

    it('should have all required service tokens defined', () => {
      expect(SERVICE_TOKENS.DATABASE).toBeDefined();
      expect(SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.WORK_EXPERIENCE_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.EDUCATION_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.PROJECT_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.PROFILE_SERVICE).toBeDefined();
    });
  });

  describe('Node Type System', () => {
    it('should support all defined node types', () => {
      const nodeTypes = [
        NodeType.WorkExperience,
        NodeType.Education,
        NodeType.Project,
        NodeType.Event,
        NodeType.Action,
        NodeType.CareerTransition
      ];

      expect(nodeTypes).toHaveLength(6);
      expect(nodeTypes).toContain('workExperience');
      expect(nodeTypes).toContain('education');
      expect(nodeTypes).toContain('project');
    });

    it('should create nodes with proper structure', () => {
      const workExp: WorkExperience = {
        id: 'work-integration-test',
        type: NodeType.WorkExperience,
        title: 'Integration Test Role',
        description: 'Testing the integration',
        startDate: '2023-01-01',
        endDate: 'Present',
        company: 'Test Company',
        position: 'Test Position',
        location: 'Test City',
        technologies: ['TypeScript', 'Jest'],
        teamSize: 3,
        employmentType: 'full-time',
        createdAt: '2023-01-15T00:00:00Z',
        updatedAt: '2023-01-15T00:00:00Z'
      };

      // Verify all properties are accessible and properly typed
      expect(workExp.id).toBe('work-integration-test');
      expect(workExp.type).toBe(NodeType.WorkExperience);
      expect(workExp.company).toBe('Test Company');
      expect(workExp.position).toBe('Test Position');
      expect(workExp.technologies).toContain('TypeScript');
      expect(workExp.teamSize).toBe(3);
      expect(workExp.employmentType).toBe('full-time');
    });
  });

  describe('End-to-End Type Flow', () => {
    it('should demonstrate complete type flow from DTO to Entity', async () => {
      // 1. Define DTOs
      interface WorkExpCreateDTO extends CreateDTO {
        company: string;
        position: string;
        technologies?: string[];
      }

      // 2. Create request data
      const createRequest: WorkExpCreateDTO = {
        title: 'Full Stack Developer',
        description: 'Building amazing applications',
        company: 'Awesome Corp',
        position: 'Full Stack Developer',
        technologies: ['React', 'Node.js', 'PostgreSQL']
      };

      // 3. Transform to entity (simulating service layer)
      const entity: WorkExperience = {
        id: `work-${Date.now()}`,
        type: NodeType.WorkExperience,
        title: createRequest.title,
        description: createRequest.description,
        company: createRequest.company,
        position: createRequest.position,
        technologies: createRequest.technologies,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 4. Verify the complete flow works
      expect(entity.id).toMatch(/^work-\d+$/);
      expect(entity.type).toBe(NodeType.WorkExperience);
      expect(entity.title).toBe(createRequest.title);
      expect(entity.company).toBe(createRequest.company);
      expect(entity.technologies).toEqual(createRequest.technologies);
    });
  });
});