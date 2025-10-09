import type { NodePolicy } from '../types';

// ============================================================================
// NODE PERMISSIONS TYPES
// ============================================================================

export interface SetPermissionsSuccessResponse {
  success: true;
  data: {
    policies: NodePolicy[];
    count: number;
    nodeId: string;
  };
}

export interface GetPermissionsSuccessResponse {
  success: true;
  data: {
    policies: NodePolicy[];
    count: number;
  };
}

export interface DeletePolicySuccessResponse {
  success: true;
  data: {
    message: string;
    policyId: string;
  };
}

export interface UpdatePolicySuccessResponse {
  success: true;
  data: {
    policy: NodePolicy;
  };
}

export interface BulkUpdatePoliciesSuccessResponse {
  success: true;
  data: {
    policies: NodePolicy[];
    count: number;
  };
}

export interface BulkPermissionsSuccessResponse {
  success: true;
  data: {
    permissions: Record<string, NodePolicy[]>;
    nodeCount: number;
    policyCount: number;
  };
}
