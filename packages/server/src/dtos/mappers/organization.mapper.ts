/**
 * Mappers for Organization API
 * Transform between service layer and controller DTOs
 */

import type {
  OrganizationDto,
  OrganizationSearchResponseDto,
  UserOrganizationsResponseDto,
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

  /**
   * Map user organizations to DTO
   */
  static toUserOrganizationsResponseDto(organizations: any[]): UserOrganizationsResponseDto {
    return {
      organizations: organizations.map((org) => this.toOrganizationDto(org)),
      count: organizations.length,
    };
  }
}
