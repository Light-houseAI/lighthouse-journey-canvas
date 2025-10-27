/**
 * Organization Test Data Factory
 *
 * Provides consistent test data creation for Organization entities across all tests.
 * Supports partial overrides for test-specific scenarios.
 */

import type { Organization } from '@journey/schema';
import { OrganizationType } from '@journey/schema';

/**
 * Creates a test Organization with sensible defaults
 * @param overrides - Partial organization data to override defaults
 * @returns Complete Organization object for testing
 */
export const createTestOrganization = (
  overrides: Partial<Organization> = {}
): Organization => ({
  id: 1,
  name: 'Test Company',
  type: OrganizationType.Company,
  metadata: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Creates a company organization
 */
export const createTestCompany = (
  overrides: Partial<Organization> = {}
): Organization =>
  createTestOrganization({
    name: 'Test Tech Company',
    type: OrganizationType.Company,
    metadata: {
      website: 'https://example.com',
      industry: 'Technology',
      size: '51-200',
    },
    ...overrides,
  });

/**
 * Creates an educational institution organization
 */
export const createTestEducationalInstitution = (
  overrides: Partial<Organization> = {}
): Organization =>
  createTestOrganization({
    name: 'Test University',
    type: OrganizationType.EducationalInstitution,
    metadata: {
      website: 'https://university.edu',
      location: 'Test City',
    },
    ...overrides,
  });

/**
 * Creates multiple test organizations with unique IDs
 * @param count - Number of organizations to create
 * @param baseId - Starting ID (defaults to 1)
 * @returns Array of Organization objects
 */
export const createTestOrganizationBatch = (
  count: number,
  baseId: number = 1
): Organization[] =>
  Array.from({ length: count }, (_, i) =>
    createTestOrganization({
      id: baseId + i,
      name: `Test Company ${baseId + i}`,
    })
  );
