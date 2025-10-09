import { z } from 'zod';
import type { SuccessResponse } from './common';
export interface CreateUpdateDTO {
    notes?: string;
    meta?: {
        appliedToJobs?: boolean;
        updatedResumeOrPortfolio?: boolean;
        networked?: boolean;
        developedSkills?: boolean;
        pendingInterviews?: boolean;
        completedInterviews?: boolean;
        practicedMock?: boolean;
        receivedOffers?: boolean;
        receivedRejections?: boolean;
        possiblyGhosted?: boolean;
    };
}
export interface UpdateUpdateDTO {
    notes?: string;
    meta?: {
        appliedToJobs?: boolean;
        updatedResumeOrPortfolio?: boolean;
        networked?: boolean;
        developedSkills?: boolean;
        pendingInterviews?: boolean;
        completedInterviews?: boolean;
        practicedMock?: boolean;
        receivedOffers?: boolean;
        receivedRejections?: boolean;
        possiblyGhosted?: boolean;
    };
}
export interface UpdateData {
    id: string;
    nodeId: string;
    notes?: string;
    meta: {
        appliedToJobs?: boolean;
        updatedResumeOrPortfolio?: boolean;
        networked?: boolean;
        developedSkills?: boolean;
        pendingInterviews?: boolean;
        completedInterviews?: boolean;
        practicedMock?: boolean;
        receivedOffers?: boolean;
        receivedRejections?: boolean;
        possiblyGhosted?: boolean;
    };
    renderedText?: string;
    createdAt: string;
    updatedAt: string;
}
export interface UpdatesListData {
    updates: UpdateData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export type CreateUpdateSuccessResponse = SuccessResponse<UpdateData>;
export type GetUpdatesSuccessResponse = SuccessResponse<UpdatesListData>;
export type GetUpdateSuccessResponse = SuccessResponse<UpdateData>;
export type UpdateUpdateSuccessResponse = SuccessResponse<UpdateData>;
export type DeleteUpdateSuccessResponse = SuccessResponse<null>;

// Zod schemas for validation
const updateMetaSchema = z.object({
    appliedToJobs: z.boolean().optional(),
    updatedResumeOrPortfolio: z.boolean().optional(),
    networked: z.boolean().optional(),
    developedSkills: z.boolean().optional(),
    pendingInterviews: z.boolean().optional(),
    completedInterviews: z.boolean().optional(),
    practicedMock: z.boolean().optional(),
    receivedOffers: z.boolean().optional(),
    receivedRejections: z.boolean().optional(),
    possiblyGhosted: z.boolean().optional()
});

export const createUpdateRequestSchema = z.object({
    notes: z.string().optional(),
    meta: updateMetaSchema.optional()
});

export const updateUpdateRequestSchema = z.object({
    notes: z.string().optional().optional(),
    meta: updateMetaSchema.optional().optional()
});

export const paginationQuerySchema = z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20')
});