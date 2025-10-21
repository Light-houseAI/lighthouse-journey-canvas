/**
 * Mappers for Organization API
 * Transform between service layer and controller DTOs
 */

import type {
  OrganizationSearchResponse,
  UserOrganizationsResponse,
} from '@journey/schema';

import { MappedResponse } from '../../middleware/response-validation.middleware';
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
  static toSearchResponseDto(
    organizations: any[]
  ): OrganizationSearchResponseDto {
    return {
      organizations: organizations.map((org) => this.toOrganizationDto(org)),
      total: organizations.length,
    };
  }

  /**
   * Map user organizations to DTO
   */
  static toUserOrganizationsResponseDto(
    organizations: any[]
  ): UserOrganizationsResponseDto {
    return {
      organizations: organizations.map((org) => this.toOrganizationDto(org)),
      count: organizations.length,
    };
  }

  /**
   * Wrap organization list response for validation
   * Returns MappedResponse for fluent validation: .withSchema(userOrganizationsResponseSchema)
   */
  static toOrganizationListResponse(
    data: UserOrganizationsResponseDto
  ): MappedResponse<UserOrganizationsResponse> {
    return new MappedResponse(data);
  }

  /**
   * Wrap organization search response for validation
   * Returns MappedResponse for fluent validation: .withSchema(organizationSearchResponseSchema)
   */
  static toOrganizationSearchResponse(
    data: any
  ): MappedResponse<OrganizationSearchResponse> {
    return new MappedResponse(data);
  }
}
