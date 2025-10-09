import type { Organization } from '../types';

// ============================================================================
// GET USER ORGANIZATIONS ENDPOINT
// ============================================================================

export interface GetUserOrganizationsSuccessResponse {
  success: true;
  data: Organization[];
}

// ============================================================================
// SEARCH ORGANIZATIONS ENDPOINT
// ============================================================================

export interface SearchOrganizationsSuccessResponse {
  success: true;
  data: {
    organizations: Organization[];
    total: number;
    page: number;
    limit: number;
  };
}
