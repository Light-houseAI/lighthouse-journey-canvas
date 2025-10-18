import { beforeEach, describe, expect, it } from 'vitest';

import { TrajectoryScorer } from '../../job-application-trajectory-matcher/trajectory-scorer';
import { CareerStep } from '../../job-application-trajectory-matcher/types';

describe('TrajectoryScorer', () => {
  let scorer: TrajectoryScorer;

  beforeEach(() => {
    scorer = new TrajectoryScorer();
  });

  describe('Job/Project Similarity', () => {
    it('should score exact role and company match highly', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Should have high score for exact matches
      expect(score).toBeGreaterThan(4.0);
    });

    it('should score similar roles moderately', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Backend Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Similar roles (both engineers) should score moderately
      expect(score).toBeGreaterThan(1.0);
      expect(score).toBeLessThan(4.0);
    });

    it('should score different companies as 0 for company match', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Meta',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Same role but different company - should still have decent score
      expect(score).toBeGreaterThan(2.0);
      expect(score).toBeLessThan(4.0);
    });

    it('should penalize completely different roles', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Sales Manager',
        company: 'Meta',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Completely different roles should score low
      expect(score).toBeLessThan(1.0);
    });
  });

  describe('Type Mismatch', () => {
    it('should give low score for different types', () => {
      const job: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const education: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Computer Science',
        duration: 48,
        startDate: new Date('2016-01-01'),
      };

      const score = scorer.computeSimilarity(job, education);

      // Different types should have minimal similarity
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('Education Similarity', () => {
    it('should score matching degree and field highly', () => {
      const step1: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Computer Science',
        duration: 48,
        startDate: new Date('2016-01-01'),
      };

      const step2: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Computer Science',
        duration: 48,
        startDate: new Date('2015-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Exact education match should score well
      expect(score).toBeGreaterThan(1.0);
    });

    it('should score different fields lower', () => {
      const step1: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Computer Science',
        duration: 48,
        startDate: new Date('2016-01-01'),
      };

      const step2: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Art History',
        duration: 48,
        startDate: new Date('2015-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Same degree but different field
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(2.0);
    });
  });

  describe('Duration Similarity', () => {
    it('should reward similar durations', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Company A',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2a: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Company A',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const step2b: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Company A',
        duration: 48,
        startDate: new Date('2019-01-01'),
      };

      const scoreSameDuration = scorer.computeSimilarity(step1, step2a);
      const scoreDiffDuration = scorer.computeSimilarity(step1, step2b);

      // Same duration should score slightly higher
      expect(scoreSameDuration).toBeGreaterThan(scoreDiffDuration);
    });
  });

  describe('Recency Weighting', () => {
    it('should compute recency weight with exponential decay', () => {
      const weight0 = scorer.computeRecencyWeight(0); // Current
      const weight1 = scorer.computeRecencyWeight(1); // 1 year ago
      const weight5 = scorer.computeRecencyWeight(5); // 5 years ago
      const weight10 = scorer.computeRecencyWeight(10); // 10 years ago

      // Current should be 1.0
      expect(weight0).toBe(1.0);

      // Should decay over time
      expect(weight1).toBeLessThan(1.0);
      expect(weight1).toBeGreaterThan(weight5);
      expect(weight5).toBeGreaterThan(weight10);

      // Very old experience should have low weight
      expect(weight10).toBeLessThan(0.3);
    });

    it('should apply recency weight to similarity score', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const scoreNoRecency = scorer.computeSimilarity(step1, step2, false, 1.0);
      const scoreWithRecency = scorer.computeSimilarity(
        step1,
        step2,
        false,
        0.5
      );

      // Recency weight should reduce score
      expect(scoreWithRecency).toBeLessThan(scoreNoRecency);
      expect(scoreWithRecency).toBeCloseTo(scoreNoRecency * 0.5, 1);
    });
  });

  describe('Entry Level Adjustments', () => {
    it('should weight education higher for entry level', () => {
      const education: CareerStep = {
        type: 'education',
        degree: 'Bachelor',
        field: 'Computer Science',
        duration: 48,
        startDate: new Date('2016-01-01'),
      };

      const scoreNormal = scorer.computeSimilarity(education, education, false);
      const scoreEntryLevel = scorer.computeSimilarity(
        education,
        education,
        true
      );

      // Entry level should weight education higher
      expect(scoreEntryLevel).toBeGreaterThan(scoreNormal);
    });
  });

  describe('Role Family Detection', () => {
    it('should recognize engineer family', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Software Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Backend Developer',
        company: 'Meta',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Engineer and Developer are related
      expect(score).toBeGreaterThan(1.0);
    });

    it('should recognize manager family', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Engineering Manager',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Director of Engineering',
        company: 'Meta',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Manager and Director are related
      expect(score).toBeGreaterThan(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing role gracefully', () => {
      const step1: CareerStep = {
        type: 'job',
        company: 'Google',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Should not crash, but score low
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing company gracefully', () => {
      const step1: CareerStep = {
        type: 'job',
        role: 'Engineer',
        duration: 24,
        startDate: new Date('2020-01-01'),
      };

      const step2: CareerStep = {
        type: 'job',
        role: 'Engineer',
        company: 'Google',
        duration: 24,
        startDate: new Date('2019-01-01'),
      };

      const score = scorer.computeSimilarity(step1, step2);

      // Should still score based on role
      expect(score).toBeGreaterThan(1.0);
    });
  });
});
