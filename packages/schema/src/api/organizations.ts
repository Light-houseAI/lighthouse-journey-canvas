import { z } from 'zod';
import type { SuccessResponse } from './common';
export interface OrganizationData {
    id: number;
    name: string;
    slug: string;
    description?: string;
    website?: string;
    createdAt: string;
    updatedAt: string;
}
export interface OrganizationSearchData {
    organizations: OrganizationData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export type GetUserOrganizationsSuccessResponse = SuccessResponse<OrganizationData[]>;
export type SearchOrganizationsSuccessResponse = SuccessResponse<OrganizationSearchData>;
export type GetOrganizationSuccessResponse = SuccessResponse<OrganizationData>;
export declare const organizationSearchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    page: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    q: string;
}, {
    q: string;
    page?: string | undefined;
    limit?: string | undefined;
}>;
//# sourceMappingURL=organizations.d.ts.map