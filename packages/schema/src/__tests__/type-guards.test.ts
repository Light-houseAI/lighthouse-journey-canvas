/**
 * Type Guard Tests
 *
 * Tests for both compile-time and runtime type guards
 */

import { describe, expect, it } from 'vitest';

import { TimelineNodeType } from '../enums';
import {
  assertEducationNode,
  assertJobNode,
  isEducationNode,
  isEventNode,
  isJobNode,
  isProjectNode,
  isValidEducationNode,
  isValidEventNode,
  isValidJobNode,
  isValidProjectNode,
} from '../type-guards';
import type { TimelineNode } from '../types';

// Test data helpers
const createJobNode = (metaOverrides: any = {}): TimelineNode => ({
  id: 'test-id',
  type: TimelineNodeType.Job,
  userId: 1,
  parentId: null,
  meta: {
    orgId: 1,
    role: 'Software Engineer',
    startDate: '2024-01',
    ...metaOverrides,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createEducationNode = (metaOverrides: any = {}): TimelineNode => ({
  id: 'test-id',
  type: TimelineNodeType.Education,
  userId: 1,
  parentId: null,
  meta: {
    orgId: 1,
    degree: 'Bachelor of Science',
    field: 'Computer Science',
    startDate: '2020-09',
    ...metaOverrides,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createProjectNode = (metaOverrides: any = {}): TimelineNode => ({
  id: 'test-id',
  type: TimelineNodeType.Project,
  userId: 1,
  parentId: null,
  meta: {
    title: 'Test Project',
    description: 'A test project',
    startDate: '2024-01',
    ...metaOverrides,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createEventNode = (metaOverrides: any = {}): TimelineNode => ({
  id: 'test-id',
  type: TimelineNodeType.Event,
  userId: 1,
  parentId: null,
  meta: {
    eventType: 'interview',
    startDate: '2024-01', // Optional field in YYYY-MM format
    title: 'Technical Interview',
    ...metaOverrides,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('Compile-Time Type Guards', () => {
  describe('isJobNode', () => {
    it('should return true for job nodes', () => {
      const node = createJobNode();
      expect(isJobNode(node)).toBe(true);
    });

    it('should return false for non-job nodes', () => {
      const node = createEducationNode();
      expect(isJobNode(node)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const node = createJobNode();
      if (isJobNode(node)) {
        // TypeScript should know node.meta has JobMeta shape
        expect(node.meta.role).toBe('Software Engineer');
      }
    });
  });

  describe('isEducationNode', () => {
    it('should return true for education nodes', () => {
      const node = createEducationNode();
      expect(isEducationNode(node)).toBe(true);
    });

    it('should return false for non-education nodes', () => {
      const node = createJobNode();
      expect(isEducationNode(node)).toBe(false);
    });
  });

  describe('isProjectNode', () => {
    it('should return true for project nodes', () => {
      const node = createProjectNode();
      expect(isProjectNode(node)).toBe(true);
    });

    it('should return false for non-project nodes', () => {
      const node = createJobNode();
      expect(isProjectNode(node)).toBe(false);
    });
  });

  describe('isEventNode', () => {
    it('should return true for event nodes', () => {
      const node = createEventNode();
      expect(isEventNode(node)).toBe(true);
    });

    it('should return false for non-event nodes', () => {
      const node = createJobNode();
      expect(isEventNode(node)).toBe(false);
    });
  });
});

describe('Runtime Validation Type Guards', () => {
  describe('isValidJobNode', () => {
    it('should return true for valid job nodes', () => {
      const node = createJobNode();
      expect(isValidJobNode(node)).toBe(true);
    });

    it('should return false for wrong node type', () => {
      const node = createEducationNode();
      expect(isValidJobNode(node)).toBe(false);
    });

    it('should return false for invalid meta (missing required field)', () => {
      const node = createJobNode({ role: undefined });
      expect(isValidJobNode(node)).toBe(false);
    });

    it('should return false for invalid meta (wrong type)', () => {
      const node = createJobNode({ orgId: 'invalid' });
      expect(isValidJobNode(node)).toBe(false);
    });

    it('should handle null meta gracefully', () => {
      const node = createJobNode();
      (node as any).meta = null;
      expect(isValidJobNode(node)).toBe(false);
    });

    it('should handle undefined meta gracefully', () => {
      const node = createJobNode();
      (node as any).meta = undefined;
      expect(isValidJobNode(node)).toBe(false);
    });
  });

  describe('isValidEducationNode', () => {
    it('should return true for valid education nodes', () => {
      const node = createEducationNode();
      expect(isValidEducationNode(node)).toBe(true);
    });

    it('should return false for invalid meta', () => {
      const node = createEducationNode({ degree: undefined });
      expect(isValidEducationNode(node)).toBe(false);
    });

    it('should return false for wrong node type', () => {
      const node = createJobNode();
      expect(isValidEducationNode(node)).toBe(false);
    });
  });

  describe('isValidProjectNode', () => {
    it('should return true for valid project nodes', () => {
      const node = createProjectNode();
      expect(isValidProjectNode(node)).toBe(true);
    });

    it('should return false for invalid meta', () => {
      const node = createProjectNode({ title: undefined });
      expect(isValidProjectNode(node)).toBe(false);
    });
  });

  describe('isValidEventNode', () => {
    it('should return true for valid event nodes', () => {
      const node = createEventNode();
      expect(isValidEventNode(node)).toBe(true);
    });

    it('should return false for invalid meta', () => {
      const node = createEventNode({ eventType: undefined });
      expect(isValidEventNode(node)).toBe(false);
    });
  });
});

describe('Assertion Type Guards', () => {
  describe('assertJobNode', () => {
    it('should not throw for valid job nodes', () => {
      const node = createJobNode();
      expect(() => assertJobNode(node)).not.toThrow();
    });

    it('should throw for wrong node type', () => {
      const node = createEducationNode();
      expect(() => assertJobNode(node)).toThrow(/Expected Job node/);
    });

    it('should throw for invalid meta with descriptive error', () => {
      const node = createJobNode({ role: undefined });
      expect(() => assertJobNode(node)).toThrow();
    });

    it('should narrow type after successful assertion', () => {
      const node = createJobNode();
      assertJobNode(node);
      // TypeScript knows node.meta is JobMeta
      expect(node.meta.role).toBe('Software Engineer');
    });
  });

  describe('assertEducationNode', () => {
    it('should not throw for valid education nodes', () => {
      const node = createEducationNode();
      expect(() => assertEducationNode(node)).not.toThrow();
    });

    it('should throw for wrong node type', () => {
      const node = createJobNode();
      expect(() => assertEducationNode(node)).toThrow(
        /Expected Education node/
      );
    });

    it('should throw for invalid meta', () => {
      const node = createEducationNode({ degree: undefined });
      expect(() => assertEducationNode(node)).toThrow();
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty meta object', () => {
    const node = createJobNode();
    (node as any).meta = {};
    expect(isValidJobNode(node)).toBe(false);
  });

  it('should handle meta with extra fields (strict mode)', () => {
    const node = createJobNode({ extraField: 'unexpected' });
    // jobMetaSchema uses .strict() so extra fields should fail
    expect(isValidJobNode(node)).toBe(false);
  });

  it('should validate required vs optional fields', () => {
    // orgId and role are required, location is optional
    const nodeWithoutOptional = createJobNode({ location: undefined });
    expect(isValidJobNode(nodeWithoutOptional)).toBe(true);

    const nodeWithoutRequired = createJobNode({ orgId: undefined });
    expect(isValidJobNode(nodeWithoutRequired)).toBe(false);
  });
});
