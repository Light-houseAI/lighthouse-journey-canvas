/**
 * Unit Tests for Experience Utility Functions (LIG-182)
 *
 * Tests career transition support in isCurrentExperience() and buildSearchQuery().
 * These tests MUST FAIL before implementation (TDD approach).
 */

import { describe, expect, it } from 'vitest';

import { TimelineNodeType } from '@journey/schema';
import type { TimelineNode } from '@journey/schema';

import { isCurrentExperience, buildSearchQuery } from '../experience-utils';

describe('isCurrentExperience', () => {
  describe('Career Transition Support (LIG-182)', () => {
    it('should return true for career transition with no end date', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Transitioning to Product Management',
          description: 'Moving from engineering to product',
          startDate: '2025-01'
          // No end date = current
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(true);
    });

    it('should return true for career transition with future end date', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);
      const futureYearMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Career Pivot to Data Science',
          startDate: '2025-01',
          endDate: futureYearMonth
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(true);
    });

    it('should return false for career transition with past end date', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Previous Career Change',
          startDate: '2024-01',
          endDate: '2024-06' // Past date
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(false);
    });

    it('should return false for career transition with invalid date format', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Career Change',
          endDate: '2025/01/15' // Invalid format (should be YYYY-MM)
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(false);
    });
  });

  describe('Existing Job/Education Support', () => {
    it('should still work for job nodes', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Job,
        parentId: null,
        meta: {
          role: 'Software Engineer',
          startDate: '2024-01'
          // No end date = current
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(true);
    });

    it('should still work for education nodes', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Education,
        parentId: null,
        meta: {
          degree: 'Computer Science',
          startDate: '2020-01',
          endDate: '2019-06' // Past date
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(false);
    });

    it('should return false for non-experience node types', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Project,
        parentId: null,
        meta: {
          title: 'Some Project'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isCurrentExperience(node)).toBe(false);
    });
  });
});

describe('buildSearchQuery', () => {
  describe('Career Transition Support (LIG-182)', () => {
    it('should use description when available for career transitions', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Career Change',
          description: 'Moving from engineering to product management'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('Moving from engineering to product management');
    });

    it('should fall back to title when no description for career transitions', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {
          title: 'Moving to Consulting'
          // No description provided
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('Moving to Consulting');
    });

    it('should return empty string when no metadata for career transitions', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.CareerTransition,
        parentId: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('');
    });
  });

  describe('Existing Job/Education Query Building', () => {
    it('should prioritize description over role for jobs', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Job,
        parentId: null,
        meta: {
          role: 'Software Engineer',
          description: 'Building scalable web applications'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('Building scalable web applications');
    });

    it('should fall back to role when no description for jobs', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Job,
        parentId: null,
        meta: {
          role: 'Senior Developer'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('Senior Developer');
    });

    it('should fall back to degree when no description for education', () => {
      const node: TimelineNode = {
        id: 'test-id',
        userId: 1,
        type: TimelineNodeType.Education,
        parentId: null,
        meta: {
          degree: 'Computer Science'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(buildSearchQuery(node)).toBe('Computer Science');
    });
  });
});