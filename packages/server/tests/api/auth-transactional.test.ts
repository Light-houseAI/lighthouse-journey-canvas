/**
 * Authentication API Tests - Transactional Version
 *
 * This file demonstrates the migration from shared seeded users to transactional isolation.
 * All tests run in isolated database transactions that roll back automatically.
 *
 * Key Improvements:
 * - ✅ Complete test isolation via transaction rollback
 * - ✅ No shared state between tests
 * - ✅ Parallel execution safe
 * - ✅ No cleanup required
 * - ✅ Factory-based test data creation
 */

import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import { withTestTransaction, createTestApp } from '../utils/db';
import { jwtTestHelper } from '../helpers/auth.helper';

let app: Application;

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

describe('Authentication API - Transactional', () => {
  const testPassword = 'SignupTest123!';

  // Helper to generate unique test user email
  const generateTestUser = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return {
      email: `signup.test.${timestamp}.${random}@example.com`,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      userName: `testuser${timestamp}${random}`,
      interest: 'Testing',
    };
  };

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid data', async () => {
      await withTestTransaction(async () => {
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

        // Transaction rolls back automatically - user is not persisted
      });
    });

    it('should reject duplicate email registration', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // First signup should succeed
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        // Second signup with same email should fail (within same transaction)
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

        // Transaction rolls back - no users persisted
      });
    });

    it('should reject invalid email format', async () => {
      await withTestTransaction(async () => {
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: 'invalid-email-format',
            password: 'TestPassword123!',
          })
          .expect(400)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    it('should reject missing required fields', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();
        const response = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            // Missing password field
          })
          .expect(400)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('POST /auth/signin', () => {
    it('should authenticate user with valid credentials', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user first
        const signupResponse = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        // Now sign in with those credentials
        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200)
          .expect('Content-Type', /json/);

        const body: AuthResponse = response.body;

        expect(body.success).toBe(true);
        expect(body.data.accessToken).toBeTruthy();
        expect(body.data.refreshToken).toBeTruthy();
        expect(body.data.user.email).toBe(testUser.email);
        expect(body.data.user.hasCompletedOnboarding).toBe(false);

        // Transaction rolls back - user is not persisted
      });
    });

    it('should reject invalid credentials', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user first
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        // Try to sign in with wrong password
        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          })
          .expect(401)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
        expect(body.error.message).toContain('password');
      });
    });

    it('should reject non-existent user', async () => {
      await withTestTransaction(async () => {
        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email: 'nonexistent@example.com',
            password: 'anypassword',
          })
          .expect(401)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.message).toContain('Invalid email or password');
      });
    });
  });

  describe('PATCH /auth/profile', () => {
    it('should update user profile with authentication', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create and authenticate user
        const authResponse = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        const { accessToken } = authResponse.body.data;

        // Update profile
        const response = await request(app)
          .patch('/api/auth/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            interest: 'Machine Learning',
          })
          .expect(200)
          .expect('Content-Type', /json/);

        const body = response.body;

        expect(body.success).toBe(true);
        expect(body.data.user.interest).toBe('Machine Learning');

        // Transaction rolls back - changes not persisted
      });
    });

    it('should reject update without authentication', async () => {
      await withTestTransaction(async () => {
        const response = await request(app)
          .patch('/api/auth/profile')
          .send({
            interest: 'Data Science',
          })
          .expect(401)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;
        expect(body.success).toBe(false);
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user and get initial tokens
        const authResponse = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        const { accessToken, refreshToken } = authResponse.body.data;

        // Refresh tokens
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({
            refreshToken,
          })
          .expect(200)
          .expect('Content-Type', /json/);

        const body = response.body;

        expect(body.success).toBe(true);
        expect(body.data.accessToken).toBeTruthy();
        expect(body.data.refreshToken).toBeTruthy();
        expect(body.data.accessToken).not.toBe(accessToken); // Should be new token
        expect(body.data.refreshToken).not.toBe(refreshToken); // Token rotation

        // Transaction rolls back - tokens not persisted
      });
    });

    it('should reject invalid refresh token', async () => {
      await withTestTransaction(async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({
            refreshToken: 'invalid.refresh.token',
          })
          .expect(401)
          .expect('Content-Type', /json/);

        const body: ErrorResponse = response.body;

        expect(body.success).toBe(false);
        expect(body.error.message).toContain('token');
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user and revoke tokens', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user and get tokens
        const authResponse = await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        const { refreshToken } = authResponse.body.data;

        // Logout
        const response = await request(app)
          .post('/api/auth/logout')
          .send({
            refreshToken,
          })
          .expect(200)
          .expect('Content-Type', /json/);

        const body = response.body;

        expect(body.success).toBe(true);
        expect(body.data.message).toContain('Logged out successfully');

        // Transaction rolls back - logout not persisted
      });
    });

    it('should handle logout even with invalid token', async () => {
      await withTestTransaction(async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .send({
            refreshToken: 'invalid.token',
          })
          .expect(200)
          .expect('Content-Type', /json/);

        const body = response.body;

        expect(body.success).toBe(true);
        expect(body.data.message).toContain('Logged out successfully');
      });
    });
  });

  describe('Pre-generated Test Tokens', () => {
    it('should have valid pre-generated access token', () => {
      const testTokenPair = jwtTestHelper.createTestSession(1);

      expect(testTokenPair.accessToken).toBeTruthy();
      expect(typeof testTokenPair.accessToken).toBe('string');
      expect(testTokenPair.accessToken.split('.')).toHaveLength(3); // JWT structure

      const decoded = jwtTestHelper.decodeToken(testTokenPair.accessToken);
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(testTokenPair.user.id);
      expect(decoded?.email).toBe(testTokenPair.user.email);
    });

    it('should have valid pre-generated refresh token', () => {
      const testTokenPair = jwtTestHelper.createTestSession(1);

      expect(testTokenPair.refreshToken).toBeTruthy();
      expect(typeof testTokenPair.refreshToken).toBe('string');
      expect(testTokenPair.refreshToken.split('.')).toHaveLength(3); // JWT structure

      const decoded = jwtTestHelper.verifyRefreshToken(testTokenPair.refreshToken);
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(testTokenPair.user.id);
    });

    it('should be able to verify access token', () => {
      const testTokenPair = jwtTestHelper.createTestSession(1);
      const payload = jwtTestHelper.verifyAccessToken(testTokenPair.accessToken);

      expect(payload.userId).toBe(testTokenPair.user.id);
      expect(payload.email).toBe(testTokenPair.user.email);
      expect(payload.userName).toBe(testTokenPair.user.userName);
    });

    it('should generate multiple unique test tokens', () => {
      const tokenPairs = jwtTestHelper.createTestSessions(3);

      expect(tokenPairs).toHaveLength(3);

      const accessTokens = tokenPairs.map((tp) => tp.accessToken);
      const refreshTokens = tokenPairs.map((tp) => tp.refreshToken);

      expect(new Set(accessTokens).size).toBe(3); // All unique
      expect(new Set(refreshTokens).size).toBe(3); // All unique

      const userIds = tokenPairs.map((tp) => tp.user.id);
      expect(new Set(userIds).size).toBe(3);
    });

    it('should handle invalid token verification', () => {
      const invalidToken = jwtTestHelper.createInvalidToken();

      expect(() => {
        jwtTestHelper.verifyAccessToken(invalidToken);
      }).toThrow();
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should respond to signin within 1000ms', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user first
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        const start = Date.now();

        await request(app)
          .post('/api/auth/signin')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
      });
    });
  });

  // Security tests
  describe('Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      await withTestTransaction(async () => {
        const testUser = generateTestUser();

        // Create user first
        await request(app)
          .post('/api/auth/signup')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(201);

        const response = await request(app)
          .post('/api/auth/signin')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          })
          .expect(401);

        const body = response.body;

        expect(body.error.message).not.toContain('password is wrong');
        expect(body.error.message).not.toContain('user exists');
      });
    });

    it('should handle multiple signup attempts without state leak', async () => {
      await withTestTransaction(async () => {
        const baseTimestamp = Date.now();
        const promises = Array(5)
          .fill(0)
          .map((_, index) =>
            request(app)
              .post('/api/auth/signup')
              .send({
                email: `test${baseTimestamp}.${index}@example.com`,
                password: 'password123',
              })
          );

        const responses = await Promise.allSettled(promises);

        // All should succeed (within same transaction, no conflicts)
        const succeeded = responses.filter((r) => r.status === 'fulfilled');
        expect(succeeded.length).toBe(5);

        // Transaction rolls back - no users persisted
      });
    });
  });
});
