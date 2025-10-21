/**
 * PgVector GraphRAG Service Interface
 */

import type {
  ExperienceMatch as ProfileResult,
  GraphRAGSearchResponse,
  MatchedTimelineNode as MatchedNode,
  SearchProfilesRequest as GraphRAGSearchRequest,
} from '@journey/schema';

export interface IPgVectorGraphRAGService {
  searchProfiles(
    request: GraphRAGSearchRequest
  ): Promise<GraphRAGSearchResponse>;

  formatProfileResult(
    userId: number,
    matchedNodes: MatchedNode[],
    matchScore: number,
    whyMatched: string[],
    skills: string[],
    query: string
  ): Promise<ProfileResult>;

  generateWhyMatched(
    matchedNodes: MatchedNode[],
    query: string
  ): Promise<string[]>;

  extractSkillsFromNodes(nodes: MatchedNode[]): string[];
}
