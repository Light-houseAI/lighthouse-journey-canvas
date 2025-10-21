/**
 * Organization API Schemas
 * Request and response schemas for organization endpoints
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const organizationSearchQuerySchema = z.object({
  q: z.string().min(0).max(200),
  page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(50))
    .default('20'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Organization Response Schema
 */
export const organizationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

/**
 * User Organizations Response Schema
 */
export const userOrganizationsResponseSchema = z.object({
  organizations: z.array(organizationResponseSchema),
  count: z.number().int().nonnegative(),
});

export type UserOrganizationsResponse = z.infer<
  typeof userOrganizationsResponseSchema
>;

/**
 * Organization Search Response Schema
 */
export const organizationSearchResponseSchema = z.object({
  organizations: z.array(organizationResponseSchema),
  total: z.number().int().nonnegative(),
});

export type OrganizationSearchResponse = z.infer<
  typeof organizationSearchResponseSchema
>;
