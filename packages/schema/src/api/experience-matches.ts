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
export const matchSummarySchema = z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    company: z.string().optional(),
    score: z.number(),
    matchType: z.enum(['profile', 'opportunity']),
    previewText: z.string().optional()
});

export const experienceMatchDataSchema = z.object({
    nodeId: z.string(),
    userId: z.number(),
    matchCount: z.number(),
    matches: z.array(matchSummarySchema),
    searchQuery: z.string(),
    similarityThreshold: z.number(),
    lastUpdated: z.string(),
    cacheTTL: z.number()
});

export type IsCurrentExperienceFunction = (node: TimelineNode) => boolean;