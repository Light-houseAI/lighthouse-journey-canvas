/**
 * Response DTOs for Organization API
 */

/**
 * Organization item
 */
export interface OrganizationDto {
  id: string;
  name: string;
  domain?: string;
  logoUrl?: string;
}

/**
 * User organizations response
 */
export interface UserOrganizationsResponseDto {
  organizations: OrganizationDto[];
  count: number;
}

/**
 * Organization search response
 */
export interface OrganizationSearchResponseDto {
  organizations: OrganizationDto[];
  total: number;
}
