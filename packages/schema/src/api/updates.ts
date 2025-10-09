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
export declare const createUpdateRequestSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodObject<{
        appliedToJobs: z.ZodOptional<z.ZodBoolean>;
        updatedResumeOrPortfolio: z.ZodOptional<z.ZodBoolean>;
        networked: z.ZodOptional<z.ZodBoolean>;
        developedSkills: z.ZodOptional<z.ZodBoolean>;
        pendingInterviews: z.ZodOptional<z.ZodBoolean>;
        completedInterviews: z.ZodOptional<z.ZodBoolean>;
        practicedMock: z.ZodOptional<z.ZodBoolean>;
        receivedOffers: z.ZodOptional<z.ZodBoolean>;
        receivedRejections: z.ZodOptional<z.ZodBoolean>;
        possiblyGhosted: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    }, {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    meta?: {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    } | undefined;
}, {
    notes?: string | undefined;
    meta?: {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    } | undefined;
}>;
export declare const updateUpdateRequestSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    meta: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        appliedToJobs: z.ZodOptional<z.ZodBoolean>;
        updatedResumeOrPortfolio: z.ZodOptional<z.ZodBoolean>;
        networked: z.ZodOptional<z.ZodBoolean>;
        developedSkills: z.ZodOptional<z.ZodBoolean>;
        pendingInterviews: z.ZodOptional<z.ZodBoolean>;
        completedInterviews: z.ZodOptional<z.ZodBoolean>;
        practicedMock: z.ZodOptional<z.ZodBoolean>;
        receivedOffers: z.ZodOptional<z.ZodBoolean>;
        receivedRejections: z.ZodOptional<z.ZodBoolean>;
        possiblyGhosted: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    }, {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    notes?: string | undefined;
    meta?: {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    } | undefined;
}, {
    notes?: string | undefined;
    meta?: {
        appliedToJobs?: boolean | undefined;
        updatedResumeOrPortfolio?: boolean | undefined;
        networked?: boolean | undefined;
        developedSkills?: boolean | undefined;
        pendingInterviews?: boolean | undefined;
        completedInterviews?: boolean | undefined;
        practicedMock?: boolean | undefined;
        receivedOffers?: boolean | undefined;
        receivedRejections?: boolean | undefined;
        possiblyGhosted?: boolean | undefined;
    } | undefined;
}>;
export declare const paginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: string | undefined;
    limit?: string | undefined;
}>;
//# sourceMappingURL=updates.d.ts.map