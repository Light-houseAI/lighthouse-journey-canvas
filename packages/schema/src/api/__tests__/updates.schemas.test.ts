/**
 * Updates Schema Validation Tests
 * Tests validation rules for career transition update schemas
 *
 * Note: Networking data validation has been removed from this file because
 * networking activities are now stored in node.meta.networkingData (via hierarchy API),
 * not in update.meta. The networking validation schemas remain in updates.schemas.ts
 * for use by node metadata validation.
 */

import { describe, expect, it } from 'vitest';

import { createUpdateRequestSchema } from '../updates.schemas';

describe('Updates Schemas', () => {
  describe('createUpdateRequestSchema', () => {
    it('should accept valid update with activity flags', () => {
      const validData = {
        meta: {
          appliedToJobs: true,
          networked: true,
          developedSkills: false,
        },
        notes: 'Made good progress this week',
      };

      const result = createUpdateRequestSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should accept empty update', () => {
      const validData = {};

      const result = createUpdateRequestSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should accept update with only meta', () => {
      const validData = {
        meta: {
          appliedToJobs: true,
        },
      };

      const result = createUpdateRequestSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should accept update with only notes', () => {
      const validData = {
        notes: 'Some notes about my job search',
      };

      const result = createUpdateRequestSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should reject notes over 1000 characters', () => {
      const invalidData = {
        notes: 'a'.repeat(1001),
      };

      const result = createUpdateRequestSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });
});
