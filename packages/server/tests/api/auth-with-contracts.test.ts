import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import { withTestTransaction } from '../utils/db';
import { loadOpenAPISchema, createContractValidator } from '../utils/contract-validator';
import type { ContractValidator } from '../utils/contract-validator';
import {
  authenticateSeededUser,
  getSeededUserTokens,
  jwtTestHelper,
  type TestAuthSession,
  type TestTokenPair,
} from '../helpers/auth.helper';

let app: Application;
let contractValidator: ContractValidator;

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      userName: string;
      interest: string;
      hasCompletedOnboarding: boolean;
    };
  };
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

describe('Authentication API with Contract Validation', () => {
  let seededAuthSession: TestAuthSession;
  let testTokenPair: TestTokenPair;

  // Test user password for signup tests
  const testPassword = 'SignupTest123!';

  // Helper to generate unique test user email
  const generateTestUser = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return {
      email: `signup.test.${timestamp}.${random}@example.com`,
      password: testPassword,
    };
  };

  beforeAll(async () => {
    app = await createApp();

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

    // Setup seeded user authentication for auth routes (signin, refresh, logout, profile)
    seededAuthSession = await authenticateSeededUser(app, 1);

    // Generate tokens for seeded users for token validation tests
    testTokenPair = getSeededUserTokens(1);
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid data and pass contract validation', async () => {
      await withTestTransaction(async (tx) => {
        const testUser = generateTestUser();

        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201)
          .expect('Content-Type', /json/);

        const body: AuthResponse = response.body;

        // Standard assertions
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('meta');
        expect(body.meta).toHaveProperty('timestamp');

        expect(body.data.accessToken).toBeTruthy();
        expect(body.data.refreshToken).toBeTruthy();
        expect(typeof body.data.accessToken).toBe('string');
        expect(typeof body.data.refreshToken).toBe('string');

        expect(body.data.user).toMatchObject({
          email: testUser.email,
          hasCompletedOnboarding: false,
        });
        expect(body.data.user.firstName).toBeNull();
        expect(body.data.user.lastName).toBeNull();
        expect(body.data.user.userName).toBeNull();
        expect(body.data.user.interest).toBeNull();
        expect(body.data.user.id).toBeGreaterThan(0);

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

    it('should reject duplicate email registration with proper error format', async () => {
      await withTestTransaction(async (tx) => {
        const testUser = generateTestUser();

        // First signup should succeed
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        // Second signup with same email should fail
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email, // Same email as first signup
            password: testUser.password,
          })
          .expect(409)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
        expect(body.error.message).toContain('already');

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

    it('should reject invalid email format with validation error', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'not-an-email',
          password: testPassword,
        })
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('email');

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

    it('should reject weak passwords with proper error', async () => {
      const testUser = generateTestUser();
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: testUser.email,
          password: 'weak', // Too short
        })
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message.toLowerCase()).toContain('password');

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

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          // Missing email and password
        })
        .expect(400)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('VALIDATION_ERROR');

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

  describe('POST /auth/signin', () => {
    it('should authenticate existing user with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'user1@example.com', // Seeded user
          password: 'password123',
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body: AuthResponse = response.body;

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(body.data.user.email).toBe('user1@example.com');

      // JWT validation
      const accessPayload = jwtTestHelper.decode(body.data.accessToken);
      expect(accessPayload).toHaveProperty('sub');
      expect(accessPayload).toHaveProperty('type', 'access');

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

    it('should reject invalid credentials with proper error', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'user1@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toContain('Invalid');

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

    it('should reject non-existent user with same error as wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      // Same error as wrong password (security best practice)
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toContain('Invalid');

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

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testTokenPair.refreshToken,
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');

      // New tokens should be different from original
      expect(body.data.accessToken).not.toBe(testTokenPair.accessToken);
      expect(body.data.refreshToken).not.toBe(testTokenPair.refreshToken);

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

    it('should reject invalid refresh token with proper error', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid.refresh.token',
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');

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

    it('should reject expired refresh token', async () => {
      const expiredToken = jwtTestHelper.generateRefreshToken(
        { sub: '1', type: 'refresh' },
        { expiresIn: '-1h' } // Already expired
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: expiredToken,
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
      expect(body.error.message).toContain('expired');

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

  describe('POST /auth/signout', () => {
    it('should successfully sign out authenticated user', async () => {
      const response = await request(app)
        .post('/api/auth/signout')
        .set('Authorization', `Bearer ${seededAuthSession.accessToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('message');
      expect(body.data.message).toContain('signed out');

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

    it('should require authentication for signout', async () => {
      const response = await request(app)
        .post('/api/auth/signout')
        // No authorization header
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');

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

  describe('GET /auth/profile', () => {
    it('should return authenticated user profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${seededAuthSession.accessToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('user');
      expect(body.data.user.email).toBe(seededAuthSession.user.email);
      expect(body.data.user.id).toBe(seededAuthSession.user.id);

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

    it('should require authentication for profile access', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        // No authorization header
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');

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

    it('should reject invalid bearer token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');

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
});