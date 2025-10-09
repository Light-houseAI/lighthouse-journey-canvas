import type { SuccessResponse } from './common';
export interface ProfileMatch {
    userId: number;
    score: number;
    chunks: Array<{
        content: string;
        similarity: number;
    }>;
}
export interface GraphRAGStats {
    service: string;
    stats: {
        totalChunks: number;
        totalEdges: number;
        avgResponseTime: number;
    };
    timestamp: string;
}
export interface GraphRAGHealthData {
    status: string;
    service: string;
    timestamp: string;
}
export interface SearchProfilesDTO {
    query: string;
    limit?: number;
    tenantId?: string;
    excludeUserId?: number;
    similarityThreshold?: number;
}
export interface SearchProfilesData {
    results: ProfileMatch[];
    totalResults: number;
    query: string;
}
export type SearchProfilesSuccessResponse = SuccessResponse<SearchProfilesData>;
export type GraphRAGHealthSuccessResponse = SuccessResponse<GraphRAGHealthData>;
export type GetStatsSuccessResponse = SuccessResponse<GraphRAGStats>;
//# sourceMappingURL=pgvector-graphrag.d.ts.map