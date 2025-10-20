import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CareerSequenceExtractor } from '../../job-application-trajectory-matcher/career-sequence-extractor';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

describe('CareerSequenceExtractor', () => {
  let extractor: CareerSequenceExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    // Pass default timeWindowYears (7) and logger
    extractor = new CareerSequenceExtractor(7, mockLogger as any);
  });

  describe('Basic Extraction', () => {
    it('should extract jobs from timeline nodes', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Software Engineer',
          company: 'Google',
          startDate: '2020-01-01',
          endDate: '2022-01-01',
        },
        {
          type: 'job',
          title: 'Senior Engineer',
          company: 'Meta',
          startDate: '2022-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(2);
      expect(trajectory.steps[0].type).toBe('job');
      expect(trajectory.steps[0].role).toBe('Software Engineer');
      expect(trajectory.steps[0].company).toBe('Google');
    });

    it('should extract education from timeline nodes', () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 3);

      const nodes = [
        {
          type: 'education',
          degree: 'Bachelor',
          field: 'Computer Science',
          institution: 'MIT',
          startDate: recentDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].type).toBe('education');
      expect(trajectory.steps[0].degree).toBe('Bachelor');
      expect(trajectory.steps[0].field).toBe('Computer Science');
    });

    it('should exclude projects but include career-transitions', () => {
      const nodes = [
        {
          type: 'project',
          title: 'Open Source Contribution',
          organization: 'GitHub',
          startDate: '2021-01-01',
          endDate: '2021-06-01',
        },
        {
          type: 'career-transition',
          title: 'Moving to Senior Engineer',
          description: 'Transition to senior level role at tech company',
          startDate: '2022-01-01',
          meta: {
            targetRole: 'Senior Software Engineer',
            targetCompany: 'Google',
          },
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      // Projects excluded, career-transitions included
      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].type).toBe('career-transition');
      expect(trajectory.steps[0].title).toBe('Moving to Senior Engineer');
      expect(trajectory.steps[0].role).toBe('Senior Software Engineer');
      expect(trajectory.steps[0].company).toBe('Google');
    });
  });

  describe('Date Handling', () => {
    it('should skip nodes without startDate', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Company',
          // No startDate
        },
        {
          type: 'job',
          title: 'Engineer 2',
          company: 'Company 2',
          startDate: '2020-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].role).toBe('Engineer 2');
    });

    it('should handle ongoing roles (no endDate)', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Current Role',
          company: 'Google',
          startDate: '2023-01-01',
          // No endDate - ongoing
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].endDate).toBeUndefined();
      expect(trajectory.steps[0].duration).toBeGreaterThan(0);
    });

    it('should calculate duration correctly', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Google',
          startDate: '2020-01-01',
          endDate: '2022-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      // 2 years = 24 months
      expect(trajectory.steps[0].duration).toBeCloseTo(24, 0);
    });
  });

  describe('Chronological Sorting', () => {
    it('should sort steps chronologically', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Job 3',
          company: 'C',
          startDate: '2022-01-01',
          endDate: '2023-01-01',
        },
        {
          type: 'job',
          title: 'Job 1',
          company: 'A',
          startDate: '2020-01-01',
          endDate: '2021-01-01',
        },
        {
          type: 'job',
          title: 'Job 2',
          company: 'B',
          startDate: '2021-01-01',
          endDate: '2022-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps[0].role).toBe('Job 1');
      expect(trajectory.steps[1].role).toBe('Job 2');
      expect(trajectory.steps[2].role).toBe('Job 3');
    });
  });

  describe('Time Window Filtering', () => {
    it('should filter to time window (7 years default)', () => {
      const now = new Date();
      const eightYearsAgo = new Date(now);
      eightYearsAgo.setFullYear(now.getFullYear() - 8);

      const fiveYearsAgo = new Date(now);
      fiveYearsAgo.setFullYear(now.getFullYear() - 5);

      const nodes = [
        {
          type: 'job',
          title: 'Old Job',
          company: 'Old Company',
          startDate: eightYearsAgo.toISOString(),
        },
        {
          type: 'job',
          title: 'Recent Job',
          company: 'Recent Company',
          startDate: fiveYearsAgo.toISOString(),
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      // Only recent job should be included
      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].role).toBe('Recent Job');
    });

    it('should allow custom time window', () => {
      const customExtractor = new CareerSequenceExtractor(3, mockLogger as any); // 3 years

      const now = new Date();
      const fourYearsAgo = new Date(now);
      fourYearsAgo.setFullYear(now.getFullYear() - 4);

      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(now.getFullYear() - 2);

      const nodes = [
        {
          type: 'job',
          title: 'Old Job',
          company: 'Old Company',
          startDate: fourYearsAgo.toISOString(),
        },
        {
          type: 'job',
          title: 'Recent Job',
          company: 'Recent Company',
          startDate: twoYearsAgo.toISOString(),
        },
      ];

      const trajectory = customExtractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].role).toBe('Recent Job');
    });
  });

  describe('Node Type Filtering', () => {
    it('should filter out irrelevant node types', () => {
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const nodes = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Google',
          startDate: twoYearsAgo.toISOString(),
          endDate: oneYearAgo.toISOString(),
        },
        {
          type: 'interview',
          title: 'Interview at Meta',
          startDate: twoYearsAgo.toISOString(),
        },
        {
          type: 'education',
          degree: 'Bachelor',
          field: 'CS',
          startDate: fourYearsAgo.toISOString(),
          endDate: threeYearsAgo.toISOString(),
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      // Only job and education should be included (interview filtered out)
      expect(trajectory.steps).toHaveLength(2);
      expect(
        trajectory.steps.every((s) => ['job', 'education'].includes(s.type))
      ).toBe(true);
    });
  });

  describe('Concurrent Role Resolution', () => {
    it('should select longest duration from concurrent roles', () => {
      const overlap = [
        {
          type: 'job',
          role: 'Short Job',
          company: 'A',
          duration: 6,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2020-06-01'),
        },
        {
          type: 'job',
          role: 'Long Job',
          company: 'B',
          duration: 12,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2021-01-01'),
        },
      ];

      const resolved = extractor.resolveConcurrentRoles(overlap);

      expect(resolved).toHaveLength(1);
      expect(resolved[0].role).toBe('Long Job');
    });

    it('should keep non-overlapping roles', () => {
      const steps = [
        {
          type: 'job' as const,
          role: 'Job 1',
          company: 'A',
          duration: 12,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2021-01-01'),
        },
        {
          type: 'job' as const,
          role: 'Job 2',
          company: 'B',
          duration: 12,
          startDate: new Date('2021-06-01'),
          endDate: new Date('2022-06-01'),
        },
      ];

      const resolved = extractor.resolveConcurrentRoles(steps);

      expect(resolved).toHaveLength(2);
    });
  });

  describe('Target Company and Role', () => {
    it('should set target company and role', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Engineer',
          company: 'Google',
          startDate: '2020-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(
        nodes,
        'Google',
        'Senior Engineer'
      );

      expect(trajectory.targetCompany).toBe('Google');
      expect(trajectory.targetRole).toBe('Senior Engineer');
    });
  });

  describe('Field Name Variations', () => {
    it('should handle "role" field in addition to "title"', () => {
      const nodes = [
        {
          type: 'job',
          role: 'Software Engineer',
          company: 'Google',
          startDate: '2020-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps[0].role).toBe('Software Engineer');
    });

    it('should handle "organization" field in addition to "company"', () => {
      const nodes = [
        {
          type: 'job',
          title: 'Engineer',
          organization: 'Google',
          startDate: '2020-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps[0].company).toBe('Google');
    });

    it('should handle "major" field in addition to "field" for education', () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const nodes = [
        {
          type: 'education',
          degree: 'Bachelor',
          major: 'Computer Science',
          institution: 'MIT',
          startDate: recentDate.toISOString(),
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].field).toBe('Computer Science');
    });

    it('should handle "school" field in addition to "institution"', () => {
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 2);

      const nodes = [
        {
          type: 'education',
          degree: 'Bachelor',
          field: 'CS',
          school: 'Stanford',
          startDate: recentDate.toISOString(),
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].institution).toBe('Stanford');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty node list', () => {
      const trajectory = extractor.extractTrajectory([]);

      expect(trajectory.steps).toHaveLength(0);
    });

    it('should handle nodes with minimal data', () => {
      const nodes = [
        {
          type: 'job',
          startDate: '2020-01-01',
        },
      ];

      const trajectory = extractor.extractTrajectory(nodes);

      expect(trajectory.steps).toHaveLength(1);
      expect(trajectory.steps[0].role).toBeUndefined();
    });
  });
});
