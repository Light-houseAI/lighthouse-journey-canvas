import type { SuccessResponse } from './common';
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