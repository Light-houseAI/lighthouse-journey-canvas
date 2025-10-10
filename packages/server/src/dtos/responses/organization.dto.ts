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
 * Organization search response
 */
export interface OrganizationSearchResponseDto {
  organizations: OrganizationDto[];
  total: number;
}
