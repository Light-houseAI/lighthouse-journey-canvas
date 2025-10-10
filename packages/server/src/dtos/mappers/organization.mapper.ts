/**
 * Mappers for Organization API
 * Transform between service layer and controller DTOs
 */

import type {
  OrganizationDto,
  OrganizationSearchResponseDto,
} from '../responses/organization.dto';

export class OrganizationMapper {
  /**
   * Map organization to DTO
   */
  static toOrganizationDto(org: any): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      domain: org.domain,
      logoUrl: org.logoUrl,
    };
  }

  /**
   * Map search results to DTO
   */
  static toSearchResponseDto(organizations: any[]): OrganizationSearchResponseDto {
    return {
      organizations: organizations.map((org) => this.toOrganizationDto(org)),
      total: organizations.length,
    };
  }
}
