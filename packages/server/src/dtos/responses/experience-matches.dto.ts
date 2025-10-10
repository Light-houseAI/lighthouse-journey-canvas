/**
 * Response DTOs for Experience Matches API
 */

/**
 * Individual match result
 */
export interface ExperienceMatchDto {
  userId: number;
  score: number;
  name: string;
  experienceLine: string;
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
