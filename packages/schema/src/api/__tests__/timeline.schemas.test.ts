/**
 * Timeline Schema Tests
 * Tests for timeline/hierarchy API request and response schemas
 */

import { describe, expect, it } from 'vitest';

import {
  createTimelineNodeRequestSchema,
  hierarchyResponseSchema,
  timelineNodeResponseSchema,
  timelineQuerySchema,
  updateTimelineNodeRequestSchema,
} from '../timeline.schemas';

// Constants
const MIN_MAX_DEPTH = 1;
const MAX_MAX_DEPTH = 20;
const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_INCLUDE_CHILDREN = false;

// Valid UUID for testing
const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// Test data factories
const createValidCreateRequest = (
  overrides: Partial<{
    type:
      | 'job'
      | 'education'
      | 'project'
      | 'event'
      | 'action'
      | 'careerTransition';
    parentId?: string | null;
    meta: Record<string, unknown>;
  }> = {}
) => ({
  type: 'job' as const,
  meta: { role: 'Software Engineer', company: 'TechCorp' },
  ...overrides,
});

const createValidUpdateRequest = (
  overrides: Partial<{
    meta?: Record<string, unknown>;
    parentId?: string | null;
  }> = {}
) => ({
  ...overrides,
});

const createValidTimelineNode = (
  overrides: Partial<{
    id: string;
    userId: number;
    type: string;
    parentId: string | null;
    meta: Record<string, unknown>;
    createdAt: string | Date;
    updatedAt: string | Date;
    parent?: { id: string; type: string; title?: string } | null;
    owner?: {
      id: number;
      userName?: string;
      firstName?: string;
      lastName?: string;
      email: string;
    } | null;
    permissions?: {
      canView: boolean;
      canEdit: boolean;
      canShare: boolean;
      canDelete: boolean;
      accessLevel: string;
      shouldShowMatches: boolean;
    } | null;
  }> = {}
) => ({
  id: VALID_UUID,
  userId: 1,
  type: 'job',
  parentId: null,
  meta: { role: 'Software Engineer' },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Timeline Request Schemas', () => {
  describe('createTimelineNodeRequestSchema', () => {
    it('should validate valid create request', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest()
      );
      expect(result.success).toBe(true);
    });

    it('should validate all node types', () => {
      const types: Array<
        | 'job'
        | 'education'
        | 'project'
        | 'event'
        | 'action'
        | 'careerTransition'
      > = [
        'job',
        'education',
        'project',
        'event',
        'action',
        'careerTransition',
      ];

      types.forEach((type) => {
        const result = createTimelineNodeRequestSchema.safeParse(
          createValidCreateRequest({ type })
        );
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid type', () => {
      const result = createTimelineNodeRequestSchema.safeParse({
        type: 'invalid-type',
        meta: { key: 'value' },
      });
      expect(result.success).toBe(false);
    });

    it('should validate with parentId', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest({ parentId: VALID_UUID })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with null parentId', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest({ parentId: null })
      );
      expect(result.success).toBe(true);
    });

    it('should validate without parentId', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest({ parentId: undefined })
      );
      expect(result.success).toBe(true);
    });

    it('should reject invalid parentId UUID', () => {
      const result = createTimelineNodeRequestSchema.safeParse({
        type: 'job',
        parentId: 'not-a-uuid',
        meta: { key: 'value' },
      });
      expect(result.success).toBe(false);
    });

    it('should validate complex meta object', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest({
          meta: {
            role: 'Senior Engineer',
            company: 'TechCorp',
            location: 'San Francisco',
            startDate: '2020-01-01',
            skills: ['React', 'TypeScript'],
            nested: { deep: { value: 123 } },
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject empty meta object', () => {
      const result = createTimelineNodeRequestSchema.safeParse(
        createValidCreateRequest({ meta: {} })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing meta', () => {
      const result = createTimelineNodeRequestSchema.safeParse({
        type: 'job',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = createTimelineNodeRequestSchema.safeParse({
        meta: { key: 'value' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTimelineNodeRequestSchema', () => {
    it('should validate empty update request', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest()
      );
      expect(result.success).toBe(true);
    });

    it('should validate with meta only', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          meta: { role: 'Updated Role' },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with parentId only', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          parentId: VALID_UUID,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with null parentId', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          parentId: null,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with both meta and parentId', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          meta: { role: 'Updated Role' },
          parentId: VALID_UUID,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate empty meta object in update', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          meta: {},
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject invalid parentId UUID', () => {
      const result = updateTimelineNodeRequestSchema.safeParse(
        createValidUpdateRequest({
          parentId: 'not-a-uuid',
        })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('timelineQuerySchema', () => {
    it('should apply default values', () => {
      const result = timelineQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxDepth).toBe(DEFAULT_MAX_DEPTH);
        expect(result.data.includeChildren).toBe(DEFAULT_INCLUDE_CHILDREN);
      }
    });

    it('should coerce string maxDepth to number', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxDepth).toBe(5);
        expect(typeof result.data.maxDepth).toBe('number');
      }
    });

    it('should coerce string includeChildren to boolean', () => {
      const resultTrue = timelineQuerySchema.safeParse({
        includeChildren: 'true',
      });
      expect(resultTrue.success).toBe(true);
      if (resultTrue.success) {
        expect(resultTrue.data.includeChildren).toBe(true);
      }

      // Note: z.coerce.boolean() converts string "0" to boolean using Boolean("0")
      // which is actually true (non-empty string). To get false, omit the field.
      const resultDefault = timelineQuerySchema.safeParse({});
      expect(resultDefault.success).toBe(true);
      if (resultDefault.success) {
        expect(resultDefault.data.includeChildren).toBe(
          DEFAULT_INCLUDE_CHILDREN
        );
      }
    });

    it('should validate maxDepth at minimum boundary', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: MIN_MAX_DEPTH,
      });
      expect(result.success).toBe(true);
    });

    it('should validate maxDepth at maximum boundary', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: MAX_MAX_DEPTH,
      });
      expect(result.success).toBe(true);
    });

    it('should reject maxDepth below minimum', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: MIN_MAX_DEPTH - 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject maxDepth above maximum', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: MAX_MAX_DEPTH + 1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer maxDepth', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: 5.5,
      });
      expect(result.success).toBe(false);
    });

    it('should validate with type filter', () => {
      const types: Array<
        | 'job'
        | 'education'
        | 'project'
        | 'event'
        | 'action'
        | 'careerTransition'
      > = [
        'job',
        'education',
        'project',
        'event',
        'action',
        'careerTransition',
      ];

      types.forEach((type) => {
        const result = timelineQuerySchema.safeParse({ type });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid type', () => {
      const result = timelineQuerySchema.safeParse({
        type: 'invalid-type',
      });
      expect(result.success).toBe(false);
    });

    it('should validate with all parameters', () => {
      const result = timelineQuerySchema.safeParse({
        maxDepth: '15',
        includeChildren: 'true',
        type: 'job',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxDepth).toBe(15);
        expect(result.data.includeChildren).toBe(true);
        expect(result.data.type).toBe('job');
      }
    });
  });
});

describe('Timeline Response Schemas', () => {
  describe('timelineNodeResponseSchema', () => {
    it('should validate valid timeline node response', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode()
      );
      expect(result.success).toBe(true);
    });

    it('should validate with string createdAt and updatedAt', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with Date createdAt and updatedAt', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with parent information', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          parent: {
            id: VALID_UUID,
            type: 'education',
            title: 'Computer Science Degree',
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate parent without title (job nodes use role)', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          parent: {
            id: VALID_UUID,
            type: 'job',
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with null parent', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          parent: null,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate without parent field', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          parent: undefined,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with owner information', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          owner: {
            id: 1,
            userName: 'johndoe',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate owner with only required email', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          owner: {
            id: 1,
            email: 'john@example.com',
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with null owner', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          owner: null,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with permissions metadata', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          permissions: {
            canView: true,
            canEdit: true,
            canShare: false,
            canDelete: false,
            accessLevel: 'private',
            shouldShowMatches: true,
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with all permission flags false', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          permissions: {
            canView: false,
            canEdit: false,
            canShare: false,
            canDelete: false,
            accessLevel: 'restricted',
            shouldShowMatches: false,
          },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate with null permissions', () => {
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          permissions: null,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate complex complete response', () => {
      const result = timelineNodeResponseSchema.safeParse({
        id: VALID_UUID,
        userId: 1,
        type: 'job',
        parentId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
        meta: {
          role: 'Senior Engineer',
          company: 'TechCorp',
          location: 'San Francisco',
          skills: ['React', 'Node.js'],
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: new Date(),
        parent: {
          id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
          type: 'education',
          title: 'Computer Science',
        },
        owner: {
          id: 1,
          userName: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        permissions: {
          canView: true,
          canEdit: true,
          canShare: true,
          canDelete: false,
          accessLevel: 'private',
          shouldShowMatches: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = timelineNodeResponseSchema.safeParse({
        ...createValidTimelineNode(),
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = timelineNodeResponseSchema.safeParse({
        id: VALID_UUID,
        type: 'job',
        // Missing other required fields
      });
      expect(result.success).toBe(false);
    });

    it('should validate with various date string formats', () => {
      // Note: The schema uses z.union([z.string(), z.date()])
      // which accepts ANY string, not just valid ISO dates
      // This is intentional for flexibility
      const result = timelineNodeResponseSchema.safeParse(
        createValidTimelineNode({
          createdAt: '2024-01-01',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('hierarchyResponseSchema', () => {
    it('should validate valid hierarchy response', () => {
      const validData = {
        nodes: [createValidTimelineNode()],
        totalCount: 1,
      };
      const result = hierarchyResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty nodes array', () => {
      const validData = {
        nodes: [],
        totalCount: 0,
      };
      const result = hierarchyResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate multiple nodes', () => {
      const validData = {
        nodes: [
          createValidTimelineNode({
            id: '123e4567-e89b-12d3-a456-426614174000',
          }),
          createValidTimelineNode({
            id: '987fcdeb-51a2-43d7-8f9e-123456789abc',
          }),
          createValidTimelineNode({
            id: '456e7890-ab12-34cd-56ef-789012345678',
          }),
        ],
        totalCount: 3,
      };
      const result = hierarchyResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative totalCount', () => {
      const invalidData = {
        nodes: [],
        totalCount: -1,
      };
      const result = hierarchyResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer totalCount', () => {
      const invalidData = {
        nodes: [],
        totalCount: 1.5,
      };
      const result = hierarchyResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = hierarchyResponseSchema.safeParse({
        nodes: [createValidTimelineNode()],
        totalCount: 1,
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing nodes', () => {
      const result = hierarchyResponseSchema.safeParse({
        totalCount: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing totalCount', () => {
      const result = hierarchyResponseSchema.safeParse({
        nodes: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-array nodes', () => {
      const result = hierarchyResponseSchema.safeParse({
        nodes: 'not-an-array',
        totalCount: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
