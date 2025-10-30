/**
 * Permissions Schema Tests
 * Tests for permissions API request parameter schemas
 */

import { describe, expect, it } from 'vitest';

import {
  bulkUpdatePoliciesSchema,
  nodePermissionParamsSchema,
  policyParamsSchema,
  updatePolicyParamsSchema,
} from '../permissions.schemas';

// Constants
const MAX_BULK_UPDATES = 100;

// Valid UUIDs for testing
const VALID_NODE_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_POLICY_UUID = '987fcdeb-51a2-43d7-8f9e-123456789abc';

// Test data factories
const createValidNodePermissionParams = (
  overrides: Partial<{ nodeId: string }> = {}
) => ({
  nodeId: VALID_NODE_UUID,
  ...overrides,
});

const createValidPolicyParams = (
  overrides: Partial<{ nodeId: string; policyId: string }> = {}
) => ({
  nodeId: VALID_NODE_UUID,
  policyId: VALID_POLICY_UUID,
  ...overrides,
});

const createValidUpdatePolicyParams = (
  overrides: Partial<{ policyId: string }> = {}
) => ({
  policyId: VALID_POLICY_UUID,
  ...overrides,
});

const createValidBulkUpdate = (
  overrides: Partial<{
    updates: Array<{ policyId: string; updates: any }>;
  }> = {}
) => ({
  updates: [
    {
      policyId: VALID_POLICY_UUID,
      updates: { visibilityLevel: 'public' },
    },
  ],
  ...overrides,
});

describe('Permissions Request Parameter Schemas', () => {
  describe('nodePermissionParamsSchema', () => {
    it('should validate valid node permission params', () => {
      const result = nodePermissionParamsSchema.safeParse(
        createValidNodePermissionParams()
      );
      expect(result.success).toBe(true);
    });

    it('should validate lowercase UUID', () => {
      const result = nodePermissionParamsSchema.safeParse({
        nodeId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should validate uppercase UUID', () => {
      const result = nodePermissionParamsSchema.safeParse({
        nodeId: '123E4567-E89B-12D3-A456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const result = nodePermissionParamsSchema.safeParse(
        createValidNodePermissionParams({ nodeId: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject UUID without hyphens', () => {
      const result = nodePermissionParamsSchema.safeParse(
        createValidNodePermissionParams({
          nodeId: '123e4567e89b12d3a456426614174000',
        })
      );
      expect(result.success).toBe(false);
    });

    it('should reject UUID with incorrect segment lengths', () => {
      const result = nodePermissionParamsSchema.safeParse(
        createValidNodePermissionParams({
          nodeId: '123e4567-e89b-12d3-a456-4266141740',
        })
      );
      expect(result.success).toBe(false);
    });

    it('should reject empty nodeId', () => {
      const result = nodePermissionParamsSchema.safeParse(
        createValidNodePermissionParams({ nodeId: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing nodeId', () => {
      const result = nodePermissionParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should provide custom error message for invalid UUID', () => {
      const result = nodePermissionParamsSchema.safeParse({
        nodeId: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid node ID format');
      }
    });
  });

  describe('policyParamsSchema', () => {
    it('should validate valid policy params', () => {
      const result = policyParamsSchema.safeParse(createValidPolicyParams());
      expect(result.success).toBe(true);
    });

    it('should validate with different UUIDs for node and policy', () => {
      const result = policyParamsSchema.safeParse({
        nodeId: '123e4567-e89b-12d3-a456-426614174000',
        policyId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid nodeId', () => {
      const result = policyParamsSchema.safeParse(
        createValidPolicyParams({ nodeId: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject invalid policyId', () => {
      const result = policyParamsSchema.safeParse(
        createValidPolicyParams({ policyId: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing nodeId', () => {
      const result = policyParamsSchema.safeParse({
        policyId: VALID_POLICY_UUID,
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing policyId', () => {
      const result = policyParamsSchema.safeParse({
        nodeId: VALID_NODE_UUID,
      });
      expect(result.success).toBe(false);
    });

    it('should provide custom error messages', () => {
      const result = policyParamsSchema.safeParse({
        nodeId: 'invalid-node',
        policyId: 'invalid-policy',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message);
        expect(messages).toContain('Invalid node ID format');
        expect(messages).toContain('Invalid policy ID format');
      }
    });
  });

  describe('updatePolicyParamsSchema', () => {
    it('should validate valid update policy params', () => {
      const result = updatePolicyParamsSchema.safeParse(
        createValidUpdatePolicyParams()
      );
      expect(result.success).toBe(true);
    });

    it('should reject invalid policyId', () => {
      const result = updatePolicyParamsSchema.safeParse(
        createValidUpdatePolicyParams({ policyId: 'not-a-uuid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject empty policyId', () => {
      const result = updatePolicyParamsSchema.safeParse(
        createValidUpdatePolicyParams({ policyId: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing policyId', () => {
      const result = updatePolicyParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should provide custom error message', () => {
      const result = updatePolicyParamsSchema.safeParse({
        policyId: 'invalid',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid policy ID format');
      }
    });
  });

  describe('bulkUpdatePoliciesSchema', () => {
    it('should validate valid bulk update request', () => {
      const result = bulkUpdatePoliciesSchema.safeParse(
        createValidBulkUpdate()
      );
      expect(result.success).toBe(true);
    });

    it('should validate minimum allowed updates', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            policyId: VALID_POLICY_UUID,
            updates: { visibilityLevel: 'public' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should validate maximum allowed updates', () => {
      const updates = Array.from({ length: MAX_BULK_UPDATES }, (_, i) => ({
        policyId: `123e4567-e89b-12d3-a456-${String(i).padStart(12, '0')}`,
        updates: { visibilityLevel: 'public' },
      }));

      const result = bulkUpdatePoliciesSchema.safeParse({ updates });
      expect(result.success).toBe(true);
    });

    it('should reject empty updates array', () => {
      const result = bulkUpdatePoliciesSchema.safeParse(
        createValidBulkUpdate({ updates: [] })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'At least one policy update required'
        );
      }
    });

    it('should reject updates exceeding maximum', () => {
      const updates = Array.from({ length: MAX_BULK_UPDATES + 1 }, (_, i) => ({
        policyId: `123e4567-e89b-12d3-a456-${String(i).padStart(12, '0')}`,
        updates: { visibilityLevel: 'public' },
      }));

      const result = bulkUpdatePoliciesSchema.safeParse({ updates });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'Maximum 100 policy updates per request'
        );
      }
    });

    it('should validate multiple different policy updates', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            policyId: '123e4567-e89b-12d3-a456-426614174000',
            updates: { visibilityLevel: 'public' },
          },
          {
            policyId: '987fcdeb-51a2-43d7-8f9e-123456789abc',
            updates: { visibilityLevel: 'private' },
          },
          {
            policyId: '456e7890-ab12-34cd-56ef-789012345678',
            updates: { allowedUserIds: [1, 2, 3] },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid policyId in updates array', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            policyId: 'not-a-uuid',
            updates: { visibilityLevel: 'public' },
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing policyId in updates', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            updates: { visibilityLevel: 'public' },
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing updates field in array item', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            policyId: VALID_POLICY_UUID,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should validate complex nested update objects', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: [
          {
            policyId: VALID_POLICY_UUID,
            updates: {
              visibilityLevel: 'restricted',
              allowedUserIds: [1, 2, 3],
              allowedGroupIds: ['group-1', 'group-2'],
              metadata: { reason: 'security update', timestamp: '2024-01-01' },
            },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing updates field', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject non-array updates', () => {
      const result = bulkUpdatePoliciesSchema.safeParse({
        updates: 'not-an-array',
      });
      expect(result.success).toBe(false);
    });
  });
});
