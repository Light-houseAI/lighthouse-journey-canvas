import type { SuccessResponse } from './common';

// Request interfaces
export interface SetPermissionsRequest {
    user?: { id: number };  // From authentication middleware
    params: { nodeId: string };
    body: SetPermissionsDTO;
    res?: any;  // Express response object
}

export interface GetPermissionsRequest {
    user?: { id: number };  // From authentication middleware
    params: { nodeId: string };
    res?: any;  // Express response object
}

export interface DeletePolicyRequest {
    user?: { id: number };  // From authentication middleware
    params: { nodeId: string; policyId: string };
    res?: any;  // Express response object
}

export interface UpdatePolicyRequest {
    user?: { id: number };  // From authentication middleware
    params: { policyId: string };
    body: PolicyUpdate;
    res?: any;  // Express response object
}

export interface BulkUpdatePoliciesRequest {
    user?: { id: number };  // From authentication middleware
    body: BulkUpdatePoliciesDTO;
    res?: any;  // Express response object
}

export interface BulkPermissionsRequest {
    user?: { id: number };  // From authentication middleware
    body: BulkPermissionsDTO;
    res?: any;  // Express response object
}

// DTOs and data types
export interface NodePolicyWithUser {
    id: string;
    nodeId: string;
    subjectType: 'user' | 'organization';
    subjectId: number | null;
    level: 'view' | 'edit';
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    userInfo?: {
        id: number;
        userName: string;
        firstName: string;
        lastName: string;
        email: string;
        experienceLine: string;
        avatarUrl: string | null;
    };
}

export interface PolicyUpdate {
    level?: 'view' | 'edit';
    expiresAt?: string | null;
}

export interface SetPermissionsDTO {
    policies: Array<{
        nodeId?: string;
        subjectType: 'user' | 'organization';
        subjectId?: number;
        level: 'view' | 'edit';
        expiresAt?: string | null;
    }>;
}

export interface BulkUpdatePoliciesDTO {
    updates: Array<{
        policyId: string;
        updates: PolicyUpdate;
    }>;
}

export interface BulkPermissionsDTO {
    nodeIds: string[];
}

// Type aliases for controller signatures
export type SetNodePermissionsInput = SetPermissionsDTO;
export type NodePolicyUpdateInput = PolicyUpdate;
export type BulkUpdatePoliciesInput = BulkUpdatePoliciesDTO;
export type BulkPermissionsInput = BulkPermissionsDTO;
export interface SetPermissionsData {
    meta: {
        timestamp: string;
        nodeCount: number;
        policyCount: number;
    };
}
export interface GetPermissionsData {
    policies: NodePolicyWithUser[];
    meta: {
        timestamp: string;
        count: number;
    };
}
export interface DeletePolicyData {
    meta: {
        timestamp: string;
        policyId: string;
    };
}
export interface UpdatePolicyData {
    meta: {
        timestamp: string;
        policyId: string;
    };
}
export interface BulkUpdatePoliciesData {
    meta: {
        timestamp: string;
        updatedPolicies: number;
    };
}
export interface BulkPermissionsData {
    data: Array<{
        nodeId: string;
        policies: NodePolicyWithUser[];
    }>;
    meta: {
        timestamp: string;
        nodeCount: number;
        totalPolicies: number;
    };
}
export type SetPermissionsSuccessResponse = SuccessResponse<SetPermissionsData>;
export type GetPermissionsSuccessResponse = SuccessResponse<GetPermissionsData>;
export type DeletePolicySuccessResponse = SuccessResponse<DeletePolicyData>;
export type UpdatePolicySuccessResponse = SuccessResponse<UpdatePolicyData>;
export type BulkUpdatePoliciesSuccessResponse = SuccessResponse<BulkUpdatePoliciesData>;
export type BulkPermissionsSuccessResponse = SuccessResponse<BulkPermissionsData>;
//# sourceMappingURL=node-permissions.d.ts.map