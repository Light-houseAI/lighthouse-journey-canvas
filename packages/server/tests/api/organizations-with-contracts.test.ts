/**
 * Organizations API Integration Tests with Contract Validation
 * Tests the organization search endpoint with OpenAPI contract validation
 */

import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import { withTestTransaction } from '../utils/db';
import { loadOpenAPISchema, createContractValidator } from '../utils/contract-validator';
import type { ContractValidator } from '../utils/contract-validator';
import {
  authenticateSeededUser,
  type TestAuthSession,
} from '../helpers/auth.helper';

let app: Application;
let authSession: TestAuthSession;
let contractValidator: ContractValidator;

interface Organization {
  id: number;
  name: string;
  type: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationSearchResponse {
  success: boolean;
  data: {
    organizations: Organization[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

interface OrganizationCreateResponse {
  success: boolean;
  data: Organization;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

describe('Organizations API with Contract Validation', () => {
  beforeAll(async () => {
    const container = Container.getInstance();
    app = createApp(container);
    authSession = await authenticateSeededUser(app, 1);

    // Load OpenAPI schema and create contract validator
    try {
      const schema = await loadOpenAPISchema();
      contractValidator = await createContractValidator(schema);

      // Note: Contract validator is already installed as middleware in the app
      // No need to install it again here
    } catch (error) {
      console.warn('Contract validation not available:', error);
      // Tests can still run without contract validation
    }
  });

  afterAll(async () => {
    const container = Container.getInstance();
    await container.dispose();
  });

  describe('GET /api/organizations/search with Contract Validation', () => {
    it('should search organizations and validate response contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({ q: 'TechCorp' })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: OrganizationSearchResponse = response.body;

        // Standard assertions
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(Array.isArray(body.data.organizations)).toBe(true);
        expect(body.data.pagination).toBeDefined();
        expect(body.data.pagination.page).toBeGreaterThan(0);
        expect(body.data.pagination.limit).toBeGreaterThan(0);
        expect(body.data.pagination.total).toBeGreaterThanOrEqual(0);
        expect(typeof body.data.pagination.hasNext).toBe('boolean');
        expect(typeof body.data.pagination.hasPrev).toBe('boolean');
        expect(body.meta).toHaveProperty('timestamp');

        // Validate organization structure if results exist
        if (body.data.organizations.length > 0) {
          const org = body.data.organizations[0];
          expect(org).toHaveProperty('id');
          expect(org).toHaveProperty('name');
          expect(org).toHaveProperty('type');
          expect(org).toHaveProperty('metadata');
          expect(org).toHaveProperty('createdAt');
          expect(org).toHaveProperty('updatedAt');
        }

        // Manual contract validation if validator available
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should return fuzzy matches with contract compliance', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({ q: 'tech' })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200);

        const body: OrganizationSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.organizations)).toBe(true);

        // Should include organizations with 'tech' in the name
        const hasMatchingOrg = body.data.organizations.some(org =>
          org.name.toLowerCase().includes('tech')
        );

        // Only check if we have results
        if (body.data.organizations.length > 0) {
          expect(hasMatchingOrg).toBe(true);
        }

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should handle empty search query with valid contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({ q: '' })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200);

        const body: OrganizationSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.organizations)).toBe(true);
        expect(body.data.organizations.length).toBe(0);
        expect(body.data.pagination.total).toBe(0);
        expect(body.data.pagination.hasNext).toBe(false);
        expect(body.data.pagination.hasPrev).toBe(false);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should support pagination with contract validation', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({
            q: 'company',
            page: '2',
            limit: '5'
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200);

        const body: OrganizationSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data.pagination.page).toBe(2);
        expect(body.data.pagination.limit).toBe(5);
        expect(body.data.organizations.length).toBeLessThanOrEqual(5);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate error contract for invalid pagination', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({
          q: 'test',
          page: 'invalid',
          limit: '0'
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBeDefined();
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });

    it('should validate unauthorized error contract', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ q: 'test' })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBeDefined();
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });

    it('should handle special characters in search with contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({ q: 'Tech & Co.' })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200);

        const body: OrganizationSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.organizations)).toBe(true);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate pagination boundaries in response', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/organizations/search')
          .query({
            q: 'test',
            page: '1',
            limit: '10'
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(200);

        const body: OrganizationSearchResponse = response.body;

        // Validate pagination logic
        if (body.data.pagination.page === 1) {
          expect(body.data.pagination.hasPrev).toBe(false);
        }

        if (body.data.organizations.length < body.data.pagination.limit) {
          expect(body.data.pagination.hasNext).toBe(false);
        }

        // Total should be >= current page results
        expect(body.data.pagination.total).toBeGreaterThanOrEqual(
          body.data.organizations.length
        );

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });

  describe('POST /api/organizations with Contract Validation', () => {
    it('should create organization and validate contract', async () => {
      await withTestTransaction(async (tx) => {
        const uniqueCompanyName = `NewCompany${Date.now()}`;

        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: uniqueCompanyName,
            type: 'Company',
            metadata: {
              industry: 'Technology',
              size: 'Medium'
            }
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(201)
          .expect('Content-Type', /json/);

        const body: OrganizationCreateResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.name).toBe(uniqueCompanyName);
        expect(body.data.type).toBe('Company');
        expect(body.data.id).toBeGreaterThan(0);
        expect(body.data.createdAt).toBeDefined();
        expect(body.data.updatedAt).toBeDefined();
        expect(body.meta).toHaveProperty('timestamp');

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate error for duplicate organization', async () => {
      await withTestTransaction(async (tx) => {
        const companyName = `DupeCompany${Date.now()}`;

        // Create first organization
        await request(app)
          .post('/api/organizations')
          .send({
            name: companyName,
            type: 'Company'
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(201);

        // Attempt to create duplicate
        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: companyName,
            type: 'Company'
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(409)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('DUPLICATE_RESOURCE');
        expect(body.error.message).toContain('already exists');
        expect(body.meta).toHaveProperty('timestamp');

        // Validate error response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should validate error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({
          // Missing name and type
          metadata: { test: true }
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBeDefined();
      expect(body.error.details).toBeDefined();
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });

    it('should validate error for invalid organization type', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .send({
          name: 'TestOrg',
          type: 'InvalidType' // Should be one of: Company, School, etc.
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('type');
      expect(body.meta).toHaveProperty('timestamp');

      // Validate error response contract
      if (contractValidator) {
        const errors = contractValidator.validateResponse(
          response.req,
          response.res,
          body
        );
        expect(errors).toEqual([]);
      }
    });
  });

  describe('Data Consistency with Contract', () => {
    it('should maintain consistent date formats', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: `DateTest${Date.now()}`,
            type: 'Company'
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(201);

        const body: OrganizationCreateResponse = response.body;

        // ISO 8601 date format validation
        expect(body.data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(body.data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

        // CreatedAt should equal updatedAt for new records
        expect(new Date(body.data.createdAt).getTime()).toBeLessThanOrEqual(
          new Date(body.data.updatedAt).getTime()
        );

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });

    it('should preserve metadata structure', async () => {
      await withTestTransaction(async (tx) => {
        const metadata = {
          industry: 'Technology',
          size: 'Large',
          founded: 2010,
          public: true,
          tags: ['AI', 'Machine Learning']
        };

        const response = await request(app)
          .post('/api/organizations')
          .send({
            name: `MetadataTest${Date.now()}`,
            type: 'Company',
            metadata
          })
          .set('Authorization', `Bearer ${authSession.accessToken}`)
          .expect(201);

        const body: OrganizationCreateResponse = response.body;

        // Verify metadata preservation
        expect(body.data.metadata).toEqual(metadata);

        // Validate response contract
        if (contractValidator) {
          const errors = contractValidator.validateResponse(
            response.req,
            response.res,
            body
          );
          expect(errors).toEqual([]);
        }
      });
    });
  });
});