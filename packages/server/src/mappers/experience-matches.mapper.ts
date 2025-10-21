/**
 * Mappers for Experience Matches API
 * Transform between service layer and controller DTOs
 */

import type { GraphRAGSearchResponse } from '@journey/schema';

export class ExperienceMatchesMapper {
  /**
   * Map service response to DTO
   * Passes through all profile fields from GraphRAGSearchResponse
   */
  static toResponseDto(serviceResponse: any): GraphRAGSearchResponse {
    return {
      results: serviceResponse.profiles.map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        username: profile.username,
        currentRole: profile.currentRole,
        company: profile.company,
        location: profile.location,
        matchScore: profile.matchScore,
        whyMatched: profile.whyMatched || [],
        skills: profile.skills || [],
        matchedNodes: profile.matchedNodes || [],
        careerInsights: profile.careerInsights || [], // LIG-207: Career transition insights
      })),
      totalResults: serviceResponse.totalResults,
      query: serviceResponse.query,
    };
  }
}
