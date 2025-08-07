/**
 * Tests for API Types
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect } from 'vitest';
import {
  ApiRequest,
  ApiResponse,
  ApiError,
  WorkExperienceCreateRequest,
  WorkExperienceUpdateRequest,
  WorkExperienceResponse,
  EducationCreateRequest,
  EducationUpdateRequest,
  EducationResponse,
  ProjectCreateRequest,
  ProjectUpdateRequest,
  ProjectResponse,
  NodeListResponse,
  PaginatedResponse,
  ApiErrorCode,
  HttpStatusCode,
} from '../api-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

describe('API Types', () => {
  describe('Base API Types', () => {
    it('should define ApiRequest structure', () => {
      const request: ApiRequest<{ name: string }> = {
        body: { name: 'Test' },
        params: { id: '123' },
        query: { limit: '10' },
        user: { id: 1, email: 'test@example.com' },
        headers: { 'content-type': 'application/json' }
      };

      expect(request.body.name).toBe('Test');
      expect(request.params.id).toBe('123');
      expect(request.query.limit).toBe('10');
      expect(request.user?.id).toBe(1);
    });

    it('should define ApiResponse structure with success data', () => {
      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Operation successful' },
        meta: {
          timestamp: '2023-01-15T00:00:00Z',
          requestId: 'req-123'
        }
      };

      expect(response.success).toBe(true);
      expect(response.data?.message).toBe('Operation successful');
      expect(response.error).toBeUndefined();
      expect(response.meta?.timestamp).toBe('2023-01-15T00:00:00Z');
    });

    it('should define ApiResponse structure with error', () => {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: { field: 'title', message: 'Title is required' }
        },
        meta: {
          timestamp: '2023-01-15T00:00:00Z',
          requestId: 'req-124'
        }
      };

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error?.code).toBe(ApiErrorCode.VALIDATION_ERROR);
      expect(response.error?.message).toBe('Validation failed');
    });

    it('should define ApiError structure', () => {
      const error: ApiError = {
        code: ApiErrorCode.NOT_FOUND,
        message: 'Resource not found',
        statusCode: HttpStatusCode.NOT_FOUND,
        details: { resourceId: '123', resourceType: 'WorkExperience' },
        stack: 'Error stack trace...'
      };

      expect(error.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(HttpStatusCode.NOT_FOUND);
      expect(error.details?.resourceId).toBe('123');
    });
  });

  describe('Work Experience API Types', () => {
    it('should define WorkExperienceCreateRequest', () => {
      const createRequest: WorkExperienceCreateRequest = {
        title: 'Senior Software Engineer',
        description: 'Leading development team',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        location: 'San Francisco, CA',
        startDate: '2023-01-15',
        endDate: 'Present',
        responsibilities: ['Lead development', 'Mentor juniors'],
        achievements: ['Improved performance by 50%'],
        technologies: ['React', 'Node.js', 'PostgreSQL'],
        teamSize: 5,
        employmentType: 'full-time'
      };

      expect(createRequest.title).toBe('Senior Software Engineer');
      expect(createRequest.company).toBe('Tech Corp');
      expect(createRequest.position).toBe('Senior Software Engineer');
      expect(createRequest.employmentType).toBe('full-time');
      expect(createRequest.technologies).toContain('React');
    });

    it('should define WorkExperienceUpdateRequest with partial fields', () => {
      const updateRequest: WorkExperienceUpdateRequest = {
        endDate: '2024-03-15',
        reasonForLeaving: 'Career growth opportunity'
      };

      expect(updateRequest.endDate).toBe('2024-03-15');
      expect(updateRequest.reasonForLeaving).toBe('Career growth opportunity');
      expect(updateRequest.title).toBeUndefined();
      expect(updateRequest.company).toBeUndefined();
    });

    it('should define WorkExperienceResponse', () => {
      const response: WorkExperienceResponse = {
        success: true,
        data: {
          id: 'work-123',
          type: NodeType.WorkExperience,
          title: 'Software Engineer',
          company: 'Tech Corp',
          position: 'Software Engineer',
          createdAt: '2023-01-15T00:00:00Z',
          updatedAt: '2023-01-15T00:00:00Z'
        }
      };

      expect(response.success).toBe(true);
      expect(response.data?.type).toBe(NodeType.WorkExperience);
      expect(response.data?.company).toBe('Tech Corp');
    });
  });

  describe('Education API Types', () => {
    it('should define EducationCreateRequest', () => {
      const createRequest: EducationCreateRequest = {
        title: 'Bachelor of Science in Computer Science',
        description: 'Comprehensive CS program',
        institution: 'University of Technology',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2018-09-01',
        endDate: '2022-05-15',
        gpa: 3.8,
        honors: ['Magna Cum Laude'],
        relevantCourses: ['Data Structures', 'Algorithms']
      };

      expect(createRequest.institution).toBe('University of Technology');
      expect(createRequest.degree).toBe('Bachelor of Science');
      expect(createRequest.field).toBe('Computer Science');
      expect(createRequest.gpa).toBe(3.8);
    });

    it('should define EducationUpdateRequest with partial fields', () => {
      const updateRequest: EducationUpdateRequest = {
        gpa: 3.9,
        honors: ['Magna Cum Laude', 'Dean\'s List']
      };

      expect(updateRequest.gpa).toBe(3.9);
      expect(updateRequest.honors).toHaveLength(2);
      expect(updateRequest.institution).toBeUndefined();
    });

    it('should define EducationResponse', () => {
      const response: EducationResponse = {
        success: true,
        data: {
          id: 'edu-123',
          type: NodeType.Education,
          title: 'Computer Science Degree',
          institution: 'University',
          createdAt: '2023-01-15T00:00:00Z',
          updatedAt: '2023-01-15T00:00:00Z'
        }
      };

      expect(response.success).toBe(true);
      expect(response.data?.type).toBe(NodeType.Education);
      expect(response.data?.institution).toBe('University');
    });
  });

  describe('Project API Types', () => {
    it('should define ProjectCreateRequest', () => {
      const createRequest: ProjectCreateRequest = {
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce solution',
        status: 'in-progress',
        startDate: '2023-03-01',
        technologies: ['React', 'Node.js', 'MongoDB'],
        repositoryUrl: 'https://github.com/user/ecommerce',
        role: 'Lead Developer',
        teamSize: 3
      };

      expect(createRequest.title).toBe('E-commerce Platform');
      expect(createRequest.status).toBe('in-progress');
      expect(createRequest.technologies).toContain('React');
      expect(createRequest.teamSize).toBe(3);
    });

    it('should define ProjectUpdateRequest with partial fields', () => {
      const updateRequest: ProjectUpdateRequest = {
        status: 'completed',
        endDate: '2023-08-15',
        liveUrl: 'https://myecommerce.com'
      };

      expect(updateRequest.status).toBe('completed');
      expect(updateRequest.endDate).toBe('2023-08-15');
      expect(updateRequest.liveUrl).toBe('https://myecommerce.com');
    });

    it('should define ProjectResponse', () => {
      const response: ProjectResponse = {
        success: true,
        data: {
          id: 'proj-123',
          type: NodeType.Project,
          title: 'My Project',
          status: 'completed',
          createdAt: '2023-01-15T00:00:00Z',
          updatedAt: '2023-01-15T00:00:00Z'
        }
      };

      expect(response.success).toBe(true);
      expect(response.data?.type).toBe(NodeType.Project);
      expect(response.data?.status).toBe('completed');
    });
  });

  describe('List and Pagination Types', () => {
    it('should define NodeListResponse', () => {
      const listResponse: NodeListResponse = {
        success: true,
        data: [
          {
            id: 'work-1',
            type: NodeType.WorkExperience,
            title: 'Job 1',
            company: 'Company 1',
            position: 'Developer',
            createdAt: '2023-01-15T00:00:00Z',
            updatedAt: '2023-01-15T00:00:00Z'
          },
          {
            id: 'edu-1',
            type: NodeType.Education,
            title: 'Degree 1',
            institution: 'University 1',
            createdAt: '2023-01-15T00:00:00Z',
            updatedAt: '2023-01-15T00:00:00Z'
          }
        ]
      };

      expect(listResponse.success).toBe(true);
      expect(listResponse.data).toHaveLength(2);
      expect(listResponse.data[0].type).toBe(NodeType.WorkExperience);
      expect(listResponse.data[1].type).toBe(NodeType.Education);
    });

    it('should define PaginatedResponse with metadata', () => {
      const paginatedResponse: PaginatedResponse<{ id: string; title: string }> = {
        success: true,
        data: [
          { id: '1', title: 'Item 1' },
          { id: '2', title: 'Item 2' }
        ],
        meta: {
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            pages: 3,
            hasNext: true,
            hasPrevious: false
          },
          timestamp: '2023-01-15T00:00:00Z'
        }
      };

      expect(paginatedResponse.data).toHaveLength(2);
      expect(paginatedResponse.meta?.pagination?.page).toBe(1);
      expect(paginatedResponse.meta?.pagination?.total).toBe(25);
      expect(paginatedResponse.meta?.pagination?.hasNext).toBe(true);
    });
  });

  describe('Error Codes and HTTP Status Codes', () => {
    it('should define ApiErrorCode enum', () => {
      expect(ApiErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ApiErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ApiErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ApiErrorCode.FORBIDDEN).toBe('FORBIDDEN');
      expect(ApiErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should define HttpStatusCode enum', () => {
      expect(HttpStatusCode.OK).toBe(200);
      expect(HttpStatusCode.CREATED).toBe(201);
      expect(HttpStatusCode.BAD_REQUEST).toBe(400);
      expect(HttpStatusCode.UNAUTHORIZED).toBe(401);
      expect(HttpStatusCode.FORBIDDEN).toBe(403);
      expect(HttpStatusCode.NOT_FOUND).toBe(404);
      expect(HttpStatusCode.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('Type Safety', () => {
    it('should enforce required fields in create requests', () => {
      // This test ensures TypeScript compilation enforces required fields
      expect(() => {
        const validRequest: WorkExperienceCreateRequest = {
          title: 'Required Title',
          company: 'Required Company',
          position: 'Required Position'
        };
        return validRequest;
      }).not.toThrow();
    });

    it('should allow all optional fields in update requests', () => {
      // This test ensures TypeScript allows completely optional update requests
      expect(() => {
        const validRequest: WorkExperienceUpdateRequest = {};
        return validRequest;
      }).not.toThrow();
    });

    it('should enforce proper response structure', () => {
      expect(() => {
        const validResponse: WorkExperienceResponse = {
          success: true,
          data: {
            id: 'test',
            type: NodeType.WorkExperience,
            title: 'Test',
            company: 'Test Co',
            position: 'Test Role',
            createdAt: '2023-01-15T00:00:00Z',
            updatedAt: '2023-01-15T00:00:00Z'
          }
        };
        return validResponse;
      }).not.toThrow();
    });
  });
});