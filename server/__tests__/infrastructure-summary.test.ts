/**
 * Infrastructure Summary Test
 * 
 * Verifies that all infrastructure components are properly exported
 * and can be imported without issues.
 */
import { describe, it, expect } from 'vitest';

// Test core interfaces import
import {
  BaseNode,
  NodeType,
  IRepository,
  IService,
  CreateDTO,
  UpdateDTO,
  ResponseDTO
} from '../core/interfaces';

// Test node types import
import {
  WorkExperience,
  Education,
  Project,
  isWorkExperience,
  isEducation,
  AnyNode
} from '../types';

// Test API types import
import {
  WorkExperienceCreateRequest,
  WorkExperienceResponse,
  ApiResponse,
  HttpStatusCode
} from '../types/api-types';

// Test DI container import
import { SERVICE_TOKENS, createDIContainer } from '../core/di-container';

// Test shared schema import
import {
  workExperienceSchema,
  educationSchema,
  projectSchema,
  workExperienceCreateSchema
} from '../../shared/schema';

describe('Infrastructure Summary', () => {
  it('should import all core interfaces successfully', () => {
    expect(NodeType.WorkExperience).toBe('workExperience');
    expect(NodeType.Education).toBe('education');
    expect(NodeType.Project).toBe('project');
  });

  it('should import all node types successfully', () => {
    const workExp: WorkExperience = {
      id: 'test',
      type: NodeType.WorkExperience,
      title: 'Test Job',
      company: 'Test Co',
      position: 'Developer',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    expect(isWorkExperience(workExp)).toBe(true);
    expect(isEducation(workExp)).toBe(false);
  });

  it('should import all API types successfully', () => {
    const createRequest: WorkExperienceCreateRequest = {
      title: 'Developer',
      company: 'Tech Co',
      position: 'Developer'
    };

    const response: WorkExperienceResponse = {
      success: true,
      data: {
        id: 'test',
        type: NodeType.WorkExperience,
        title: 'Developer',
        company: 'Tech Co',
        position: 'Developer',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
    };

    expect(createRequest.title).toBe('Developer');
    expect(response.success).toBe(true);
    expect(HttpStatusCode.OK).toBe(200);
  });

  it('should import DI container successfully', () => {
    expect(SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY).toBeDefined();
    expect(SERVICE_TOKENS.WORK_EXPERIENCE_SERVICE).toBeDefined();
    expect(typeof createDIContainer).toBe('function');
  });

  it('should import shared schemas successfully', () => {
    const validWorkExp = {
      id: 'test',
      type: 'workExperience',
      title: 'Developer',
      company: 'Tech Co',
      position: 'Developer',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    const result = workExperienceSchema.safeParse(validWorkExp);
    expect(result.success).toBe(true);
  });

  it('should validate DTO schemas successfully', () => {
    const createData = {
      title: 'Software Engineer',
      company: 'Amazing Corp',
      position: 'Software Engineer'
    };

    const result = workExperienceCreateSchema.safeParse(createData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Software Engineer');
      expect(result.data.company).toBe('Amazing Corp');
    }
  });

  it('should demonstrate complete type compatibility', () => {
    // This test verifies that all our types work together
    interface MockRepository extends IRepository<WorkExperience> {}
    interface MockService extends IService<WorkExperience, WorkExperienceCreateRequest, Partial<WorkExperience>> {}

    // Type assertion to ensure compatibility
    const baseNode: BaseNode = {
      id: 'test',
      type: NodeType.WorkExperience,
      title: 'Test',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    };

    const workExp: WorkExperience = {
      ...baseNode,
      type: NodeType.WorkExperience,
      company: 'Test Co',
      position: 'Developer'
    };

    const anyNode: AnyNode = workExp;

    expect(baseNode.id).toBe('test');
    expect(workExp.company).toBe('Test Co');
    expect(anyNode.type).toBe(NodeType.WorkExperience);
  });

  it('should have consistent naming across all components', () => {
    // Verify that our naming is consistent
    expect(NodeType.WorkExperience).toBe('workExperience');
    expect(SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY).toBeDefined();
    expect(SERVICE_TOKENS.WORK_EXPERIENCE_SERVICE).toBeDefined();
    
    // Verify schemas exist for core types
    expect(workExperienceSchema).toBeDefined();
    expect(educationSchema).toBeDefined();
    expect(projectSchema).toBeDefined();
  });
});