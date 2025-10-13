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
      results: serviceResponse.profiles.map((profile: any) => ({
        userId: parseInt(profile.id, 10),
        score: parseFloat(profile.matchScore),
        name: profile.name,
        experienceLine: profile.currentRole || profile.company || '',
      })),
      totalResults: serviceResponse.totalResults,
      query: serviceResponse.query,
    };
  }
}
