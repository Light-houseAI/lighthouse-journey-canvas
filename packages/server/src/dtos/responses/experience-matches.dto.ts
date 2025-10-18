/**
 * Response DTOs for Experience Matches API
 */

/**
 * LIG-207: Career insight from matched candidate's job search journey
 */
export interface CareerInsightDto {
  text: string;
  relevance: 'high' | 'medium';
  category: 'transition' | 'skill-building' | 'networking' | 'preparation';
}

/**
 * Individual match result - full profile data for UI display
 */
export interface ExperienceMatchDto {
  id: string; // User ID as string
  name: string;
  email: string;
  username?: string;
  currentRole?: string;
  company?: string;
  location?: string;
  matchScore: string; // Match score percentage
  whyMatched: string[];
  skills: string[];
  matchedNodes: MatchedNode[];
  careerInsights?: CareerInsightDto[]; // LIG-207: Actionable insights from candidate's journey
}

/**
 * Matched timeline node with insights
 */
export interface MatchedNode {
  id: string;
  type: string;
  meta: Record<string, any>;
  score: number;
  insights?: NodeInsight[];
}

/**
 * Node insight from GraphRAG
 */
export interface NodeInsight {
  text: string;
  category: string;
}

/**
 * GraphRAG search response
 */
export interface GraphRAGSearchResponseDto {
  results: ExperienceMatchDto[];
  totalResults: number;
  query: string;
}

/**
 * API Response wrapper
 */
export interface GetExperienceMatchesResponseDto {
  success: boolean;
  data: GraphRAGSearchResponseDto;
}
