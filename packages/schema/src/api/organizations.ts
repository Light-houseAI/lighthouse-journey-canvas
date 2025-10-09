import { z } from 'zod';
import { OrganizationType } from '../enums';
import type { SuccessResponse } from './common';

// Request interfaces
export interface GetUserOrganizationsRequest {
    user?: { id: number };  // From authentication middleware
    res?: any;  // Express response object
}

export interface SearchOrganizationsRequest {
    user?: { id: number };  // From authentication middleware
    query?: {
        q: string;
        page?: string;
        limit?: string;
    };
    res?: any;  // Express response object
}

export interface SearchOrganizationsQuery {
    q: string;
    page?: number;
    limit?: number;
}

// Response data types matching actual database schema
export interface OrganizationData {
    id: number;
    name: string;
    type: OrganizationType;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface OrganizationSearchData {
    organizations: OrganizationData[];
    total: number;
    page: number;
    limit: number;
}

// Response types
export type GetUserOrganizationsSuccessResponse = SuccessResponse<OrganizationData[]>;
export type SearchOrganizationsSuccessResponse = SuccessResponse<OrganizationSearchData>;
export type GetOrganizationSuccessResponse = SuccessResponse<OrganizationData>;

// Query schemas
export const organizationSearchQuerySchema = z.object({
    q: z.string().min(1, 'Query is required'),
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1').optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('10').optional(),
});