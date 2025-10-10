/**
 * Mappers for Experience Matches API
 * Transform between service layer and controller DTOs
 */

import type { GraphRAGSearchResponseDto } from '../responses/experience-matches.dto';

export class ExperienceMatchesMapper {
  /**
   * Map service response to DTO
   */
  static toResponseDto(serviceResponse: any): GraphRAGSearchResponseDto {
    return {
      results: serviceResponse.results.map((result: any) => ({
        userId: result.userId,
        score: result.score,
        name: result.name,
        experienceLine: result.experienceLine,
      })),
      totalResults: serviceResponse.totalResults,
      query: serviceResponse.query,
    };
  }
}
