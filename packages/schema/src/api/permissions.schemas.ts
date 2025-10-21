/**
 * Permissions API Schemas
 * Request and response schemas for node permission endpoints
 */

import { z } from 'zod';

import { nodePolicyUpdateSchema } from '../types';

// ============================================================================
// Request Parameter Schemas
// ============================================================================

export const nodePermissionParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
});

export const policyParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  policyId: z.string().uuid('Invalid policy ID format'),
});

export const updatePolicyParamsSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID format'),
});

export const bulkUpdatePoliciesSchema = z.object({
  updates: z
    .array(
      z.object({
        policyId: z.string().uuid('Invalid policy ID format'),
        updates: nodePolicyUpdateSchema,
      })
    )
    .min(1, 'At least one policy update required')
    .max(100, 'Maximum 100 policy updates per request'),
});

// ============================================================================
// TypeScript Types
// ============================================================================

export type NodePermissionParams = z.infer<typeof nodePermissionParamsSchema>;
export type PolicyParams = z.infer<typeof policyParamsSchema>;
export type UpdatePolicyParams = z.infer<typeof updatePolicyParamsSchema>;
export type BulkUpdatePolicies = z.infer<typeof bulkUpdatePoliciesSchema>;
