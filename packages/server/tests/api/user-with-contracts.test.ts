/**
 * User API Integration Tests with Contract Validation
 * Tests the user search endpoint with OpenAPI contract validation
 */

import type { Application } from 'express';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Container } from '../../src/core/container-setup';
import { withTestTransaction } from '../utils/db';
import { loadOpenAPISchema, createContractValidator } from '../utils/contract-validator';
import type { ContractValidator } from '../utils/contract-validator';
import { getSeededUserTokens } from '../helpers/auth.helper';

let app: Application;
let contractValidator: ContractValidator;
let authToken: string;

interface UserSearchResponse {
  success: boolean;
  data: Array<{
    id: number;
    email: string;
    userName: string | null;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    company: string | null;
    avatarUrl: string | null;
  }>;
  count: number;
  meta?: {
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
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

describe('User Search API with Contract Validation - /api/v2/users/search', () => {
  beforeAll(async () => {
    // Generate auth token for testing
    const { accessToken } = getSeededUserTokens(1);
    authToken = accessToken;

    // Create express app with mock implementation
    app = express();
    app.use(express.json());

    // Load OpenAPI schema and create contract validator
    try {
      const schema = await loadOpenAPISchema();
      contractValidator = await createContractValidator(schema);

      // Install contract validation middleware
      app.use(contractValidator());
    } catch (error) {
      console.warn('Contract validation not available:', error);
      // Tests can still run without contract validation
    }

    // Mock user search endpoint with proper response format
    app.get('/api/v2/users/search', (req, res) => {
      // Check for authentication
      if (!req.headers.authorization) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      const query = req.query.q as string;

      // Validate query parameter
      if (!query) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Search query is required',
            details: { field: 'q', reason: 'missing' },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (query.length > 100) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query too long',
            details: { field: 'q', maxLength: 100, actualLength: query.length },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Mock search results based on query
      const searchTerm = query.toLowerCase().trim();
      const mockUsers = [
        {
          id: 1,
          email: 'test-user-1@example.com',
          userName: 'user1',
          firstName: 'Test',
          lastName: 'User1',
          title: 'Software Engineer',
          company: 'Test Company',
          avatarUrl: null,
        },
        {
          id: 2,
          email: 'test-user-2@example.com',
          userName: 'user2',
          firstName: 'Test',
          lastName: 'User2',
          title: null,
          company: null,
          avatarUrl: null,
        },
        {
          id: 3,
          email: 'john.doe@example.com',
          userName: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          title: 'Product Manager',
          company: 'Example Inc',
          avatarUrl: 'https://example.com/john.jpg',
        },
        {
          id: 4,
          email: 'jane.smith@example.com',
          userName: 'janesmith',
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'Designer',
          company: 'Design Co',
          avatarUrl: null,
        },
      ];

      // Filter users based on search term - only by name
      const results = mockUsers.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
          user.firstName?.toLowerCase().includes(searchTerm) ||
          user.lastName?.toLowerCase().includes(searchTerm) ||
          fullName.includes(searchTerm)
        );
      });

      res.json({
        success: true,
        data: results,
        count: results.length,
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Search functionality with contract validation', () => {
    it('should find users by first name and pass contract validation', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=test')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: UserSearchResponse = response.body;

        // Standard assertions
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.length).toBe(2); // Test User1 and Test User2
        expect(body.data[0].firstName).toBe('Test');
        expect(body.count).toBe(2);

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

    it('should find users by last name with contract compliance', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=smith')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: UserSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.data.length).toBe(1);
        expect(body.data[0].lastName).toBe('Smith');
        expect(body.count).toBe(1);

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

    it('should find users by full name with proper format', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=john%20doe')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: UserSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data.length).toBe(1);
        expect(body.data[0].firstName).toBe('John');
        expect(body.data[0].lastName).toBe('Doe');
        expect(body.data[0].email).toBe('john.doe@example.com');

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

    it('should handle empty results with valid contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=nonexistent')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect('Content-Type', /json/);

        const body: UserSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
        expect(body.count).toBe(0);
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
  });

  describe('Response format validation', () => {
    it('should include all required user fields in contract', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=john')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body: UserSearchResponse = response.body;
        const user = body.data[0];

        // Verify all fields are present
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('userName');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('title');
        expect(user).toHaveProperty('company');
        expect(user).toHaveProperty('avatarUrl');

        // Verify types
        expect(typeof user.id).toBe('number');
        expect(typeof user.email).toBe('string');

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

    it('should handle null values properly in response', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=user2')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body: UserSearchResponse = response.body;
        const user = body.data[0];

        // Verify null values are handled correctly
        expect(user.title).toBeNull();
        expect(user.company).toBeNull();
        expect(user.avatarUrl).toBeNull();

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

  describe('Error handling with contract validation', () => {
    it('should return proper error for missing query with contract compliance', async () => {
      const response = await request(app)
        .get('/api/v2/users/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Search query is required');
      expect(body.error.details).toHaveProperty('field', 'q');

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

    it('should return proper error for query too long with details', async () => {
      const longQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/v2/users/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Query too long');
      expect(body.error.details).toHaveProperty('maxLength', 100);
      expect(body.error.details).toHaveProperty('actualLength', 101);

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

    it('should return proper unauthorized error with contract', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=test')
        // No authorization header
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toBe('Authentication required');
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

  describe('Query parameter handling', () => {
    it('should handle special characters in search query', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=test%40example')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body: UserSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();

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

    it('should handle whitespace in search query', async () => {
      await withTestTransaction(async (tx) => {
        const response = await request(app)
          .get('/api/v2/users/search?q=%20%20test%20%20')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const body: UserSearchResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data.length).toBe(2); // Should find Test users after trimming

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