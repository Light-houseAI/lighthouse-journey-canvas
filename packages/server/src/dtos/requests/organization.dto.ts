/**
 * Request DTOs for Organization API
 * Re-exports existing Zod schemas from @journey/schema
 */

import {
  type OrganizationSearchQuery,
  organizationSearchQuerySchema,
} from '@journey/schema';

/**
 * GET /api/organizations/search - Query params
 */
export { organizationSearchQuerySchema };
export type OrganizationSearchQueryDto = OrganizationSearchQuery;
