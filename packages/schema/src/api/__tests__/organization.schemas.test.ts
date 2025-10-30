/**
 * Organization Schema Tests
 * Tests for organization API request and response schemas
 */

import { describe, expect, it } from 'vitest';

import {
  organizationResponseSchema,
  organizationSearchQuerySchema,
  organizationSearchResponseSchema,
  userOrganizationsResponseSchema,
} from '../organization.schemas';

describe('Organization Request Schemas', () => {
  describe('organizationSearchQuerySchema', () => {
    it('should validate valid search query with defaults', () => {
      const validData = {
        q: 'TechCorp',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe('TechCorp');
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate with custom page', () => {
      const validData = {
        q: 'TechCorp',
        page: '2',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
      }
    });

    it('should validate with custom limit', () => {
      const validData = {
        q: 'TechCorp',
        limit: '10',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it('should validate with custom page and limit', () => {
      const validData = {
        q: 'TechCorp',
        page: '3',
        limit: '25',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(25);
      }
    });

    it('should accept empty query string', () => {
      const validData = {
        q: '',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept query up to 200 characters', () => {
      const validData = {
        q: 'a'.repeat(200),
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject query longer than 200 characters', () => {
      const invalidData = {
        q: 'a'.repeat(201),
      };

      const result = organizationSearchQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject page 0', () => {
      const invalidData = {
        q: 'TechCorp',
        page: '0',
      };

      const result = organizationSearchQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const invalidData = {
        q: 'TechCorp',
        page: '-1',
      };

      const result = organizationSearchQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject limit 0', () => {
      const invalidData = {
        q: 'TechCorp',
        limit: '0',
      };

      const result = organizationSearchQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 50', () => {
      const invalidData = {
        q: 'TechCorp',
        limit: '51',
      };

      const result = organizationSearchQuerySchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept limit exactly 50', () => {
      const validData = {
        q: 'TechCorp',
        limit: '50',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should transform string page to number', () => {
      const validData = {
        q: 'TechCorp',
        page: '5',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page).toBe('number');
        expect(result.data.page).toBe(5);
      }
    });

    it('should transform string limit to number', () => {
      const validData = {
        q: 'TechCorp',
        limit: '30',
      };

      const result = organizationSearchQuerySchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.limit).toBe('number');
        expect(result.data.limit).toBe(30);
      }
    });
  });
});

describe('Organization Response Schemas', () => {
  describe('organizationResponseSchema', () => {
    it('should validate complete organization response', () => {
      const validData = {
        id: 1,
        name: 'TechCorp',
        domain: 'techcorp.com',
        logoUrl: 'https://example.com/logo.png',
      };

      const result = organizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate minimal organization response', () => {
      const validData = {
        id: 1,
        name: 'TechCorp',
      };

      const result = organizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for domain', () => {
      const validData = {
        id: 1,
        name: 'TechCorp',
        domain: null,
        logoUrl: 'https://example.com/logo.png',
      };

      const result = organizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for logoUrl', () => {
      const validData = {
        id: 1,
        name: 'TechCorp',
        domain: 'techcorp.com',
        logoUrl: null,
      };

      const result = organizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for both optional fields', () => {
      const validData = {
        id: 1,
        name: 'TechCorp',
        domain: null,
        logoUrl: null,
      };

      const result = organizationResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required id', () => {
      const invalidData = {
        name: 'TechCorp',
      };

      const result = organizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required name', () => {
      const invalidData = {
        id: 1,
      };

      const result = organizationResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userOrganizationsResponseSchema', () => {
    it('should validate response with organizations', () => {
      const validData = {
        organizations: [
          {
            id: 1,
            name: 'TechCorp',
            domain: 'techcorp.com',
            logoUrl: 'https://example.com/logo1.png',
          },
          {
            id: 2,
            name: 'StartupInc',
            domain: null,
            logoUrl: null,
          },
        ],
        count: 2,
      };

      const result = userOrganizationsResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty organizations list', () => {
      const validData = {
        organizations: [],
        count: 0,
      };

      const result = userOrganizationsResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative count', () => {
      const invalidData = {
        organizations: [],
        count: -1,
      };

      const result = userOrganizationsResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer count', () => {
      const invalidData = {
        organizations: [],
        count: 1.5,
      };

      const result = userOrganizationsResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate single organization', () => {
      const validData = {
        organizations: [
          {
            id: 1,
            name: 'TechCorp',
          },
        ],
        count: 1,
      };

      const result = userOrganizationsResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('organizationSearchResponseSchema', () => {
    it('should validate search response with results', () => {
      const validData = {
        organizations: [
          {
            id: 1,
            name: 'TechCorp',
            domain: 'techcorp.com',
            logoUrl: 'https://example.com/logo.png',
          },
          {
            id: 2,
            name: 'StartupInc',
          },
        ],
        total: 2,
      };

      const result = organizationSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty search results', () => {
      const validData = {
        organizations: [],
        total: 0,
      };

      const result = organizationSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative total', () => {
      const invalidData = {
        organizations: [],
        total: -1,
      };

      const result = organizationSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer total', () => {
      const invalidData = {
        organizations: [],
        total: 2.5,
      };

      const result = organizationSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate large number of organizations', () => {
      const organizations = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        name: `Organization ${i + 1}`,
      }));

      const validData = {
        organizations,
        total: 100,
      };

      const result = organizationSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid organization in array', () => {
      const invalidData = {
        organizations: [
          {
            id: 1,
            // missing required name field
          },
        ],
        total: 1,
      };

      const result = organizationSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle organization with all fields as null except required', () => {
    const validData = {
      id: 999,
      name: 'Mystery Corp',
      domain: null,
      logoUrl: null,
    };

    const result = organizationResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should handle very long organization name', () => {
    const validData = {
      id: 1,
      name: 'A'.repeat(1000),
    };

    const result = organizationResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should handle total greater than organizations array length', () => {
    const validData = {
      organizations: [
        { id: 1, name: 'Org 1' },
        { id: 2, name: 'Org 2' },
      ],
      total: 100, // More results exist but not returned in this page
    };

    const result = organizationSearchResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
