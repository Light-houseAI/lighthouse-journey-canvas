import { z } from 'zod';
import type { TimelineNode } from '../types';
import type { SuccessResponse } from './common';
export interface ExperienceMatchData {
    nodeId: string;
    userId: number;
    matchCount: number;
    matches: MatchSummary[];
    searchQuery: string;
    similarityThreshold: number;
    lastUpdated: string;
    cacheTTL: number;
}
export interface MatchSummary {
    id: string;
    name: string;
    title: string;
    company?: string;
    score: number;
    matchType: 'profile' | 'opportunity';
    previewText?: string;
}
export type ExperienceMatchesSuccessResponse = SuccessResponse<ExperienceMatchData>;
export interface ViewMatchesButtonProps {
    node: TimelineNode;
    variant?: 'default' | 'ghost' | 'outline';
    size?: 'sm' | 'default' | 'icon';
    className?: string;
    onNavigate?: (query: string) => void;
}
export interface ViewMatchesButtonState {
    isLoading: boolean;
    isVisible: boolean;
    matchCount: number;
    matches: MatchSummary[];
    error?: string;
    lastFetched?: number;
}
export declare const experienceMatchDataSchema: z.ZodObject<{
    nodeId: z.ZodString;
    userId: z.ZodNumber;
    matchCount: z.ZodNumber;
    matches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        title: z.ZodString;
        company: z.ZodOptional<z.ZodString>;
        score: z.ZodNumber;
        matchType: z.ZodEnum<["profile", "opportunity"]>;
        previewText: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        title: string;
        score: number;
        matchType: "profile" | "opportunity";
        company?: string | undefined;
        previewText?: string | undefined;
    }, {
        id: string;
        name: string;
        title: string;
        score: number;
        matchType: "profile" | "opportunity";
        company?: string | undefined;
        previewText?: string | undefined;
    }>, "many">;
    searchQuery: z.ZodString;
    similarityThreshold: z.ZodNumber;
    lastUpdated: z.ZodString;
    cacheTTL: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    userId: number;
    nodeId: string;
    matchCount: number;
    matches: {
        id: string;
        name: string;
        title: string;
        score: number;
        matchType: "profile" | "opportunity";
        company?: string | undefined;
        previewText?: string | undefined;
    }[];
    searchQuery: string;
    similarityThreshold: number;
    lastUpdated: string;
    cacheTTL: number;
}, {
    userId: number;
    nodeId: string;
    matchCount: number;
    matches: {
        id: string;
        name: string;
        title: string;
        score: number;
        matchType: "profile" | "opportunity";
        company?: string | undefined;
        previewText?: string | undefined;
    }[];
    searchQuery: string;
    similarityThreshold: number;
    lastUpdated: string;
    cacheTTL: number;
}>;
export declare const matchSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    title: z.ZodString;
    company: z.ZodOptional<z.ZodString>;
    score: z.ZodNumber;
    matchType: z.ZodEnum<["profile", "opportunity"]>;
    previewText: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    title: string;
    score: number;
    matchType: "profile" | "opportunity";
    company?: string | undefined;
    previewText?: string | undefined;
}, {
    id: string;
    name: string;
    title: string;
    score: number;
    matchType: "profile" | "opportunity";
    company?: string | undefined;
    previewText?: string | undefined;
}>;
export type IsCurrentExperienceFunction = (node: TimelineNode) => boolean;
//# sourceMappingURL=experience-matches.d.ts.map