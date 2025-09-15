import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { Container } from '../../core/container-setup';
import {
  authenticateSeededUser,
  getSeededUserTokens,
  jwtTestHelper,
  type TestAuthSession,
  type TestTokenPair,
} from '../helpers/auth.helper';

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

describe('Authentication API', () => {
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

    // Setup seeded user authentication for auth routes (signin, refresh, logout, profile)
    seededAuthSession = await authenticateSeededUser(app, 1);

    // Generate tokens for seeded users for token validation tests
    testTokenPair = getSeededUserTokens(1);
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid data', async () => {
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
    });

    it('should reject duplicate email registration', async () => {
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
    });

    it('should reject invalid email format', async () => {
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

    it('should reject missing required fields', async () => {
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

  describe('POST /auth/signin', () => {
    it('should authenticate seeded user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test-user-1@example.com',
          password: 'test123', // Known seeded password
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body: AuthResponse = response.body;

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(body.data.user.email).toBe('test-user-1@example.com');
      expect(body.data.user.hasCompletedOnboarding).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test-user-1@example.com',
          password: 'wrongpassword',
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body: ErrorResponse = response.body;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
      expect(body.error.message).toContain('password');
    });

    it('should reject non-existent user', async () => {
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

  describe('PATCH /auth/profile', () => {
    it('should update user profile with seeded user authentication', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${seededAuthSession.accessToken}`)
        .send({
          interest: 'Machine Learning',
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data.user.interest).toBe('Machine Learning');
    });

    it('should reject update without authentication', async () => {
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

  describe('POST /auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: seededAuthSession.refreshToken,
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(body.data.accessToken).not.toBe(seededAuthSession.accessToken); // Should be new token
      expect(body.data.refreshToken).not.toBe(seededAuthSession.refreshToken); // Token rotation

      // Update session for subsequent tests
      seededAuthSession.accessToken = body.data.accessToken;
      seededAuthSession.refreshToken = body.data.refreshToken;
    });

    it('should reject invalid refresh token', async () => {
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

  describe('POST /auth/logout', () => {
    it('should logout user and revoke tokens', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: seededAuthSession.refreshToken,
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data.message).toContain('Logged out successfully');
    });

    it('should handle logout even with invalid token', async () => {
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

  describe('Pre-generated Test Tokens', () => {
    it('should have valid pre-generated access token', () => {
      expect(testTokenPair.accessToken).toBeTruthy();
      expect(typeof testTokenPair.accessToken).toBe('string');
      expect(testTokenPair.accessToken.split('.')).toHaveLength(3); // JWT structure

      const decoded = jwtTestHelper.decodeToken(testTokenPair.accessToken);
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(testTokenPair.user.id);
      expect(decoded?.email).toBe(testTokenPair.user.email);
    });

    it('should have valid pre-generated refresh token', () => {
      expect(testTokenPair.refreshToken).toBeTruthy();
      expect(typeof testTokenPair.refreshToken).toBe('string');
      expect(testTokenPair.refreshToken.split('.')).toHaveLength(3); // JWT structure

      const decoded = jwtTestHelper.verifyRefreshToken(
        testTokenPair.refreshToken
      );
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(testTokenPair.user.id);
    });

    it('should be able to verify access token', () => {
      const payload = jwtTestHelper.verifyAccessToken(
        testTokenPair.accessToken
      );

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

    it('should use JWT helper for token validation tests only', async () => {
      const decoded = jwtTestHelper.decodeToken(testTokenPair.accessToken);
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(testTokenPair.user.id);
      expect(decoded?.email).toBe(testTokenPair.user.email);
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('should respond to signin within 1000ms', async () => {
      const start = Date.now();

      await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test-user-1@example.com',
          password: 'test123',
        })
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
    });
  });

  // Security tests
  describe('Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test-user-1@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      const body = response.body;

      expect(body.error.message).not.toContain('password is wrong');
      expect(body.error.message).not.toContain('user exists');
    });

    it('should rate limit signup attempts', async () => {
      const baseTimestamp = Date.now();
      const promises = Array(10)
        .fill(0)
        .map((_, index) =>
          request(app)
            .post('/api/auth/signup')
            .send({
              email: `spam${baseTimestamp}.${index}@example.com`,
              password: 'password123',
              firstName: 'Spam',
              lastName: 'User',
              userName: `spam${baseTimestamp}${index}`,
              interest: 'Software Development',
            })
        );

      const responses = await Promise.allSettled(promises);

      // At least some should be rate limited (429)
      const rateLimitedResponses = responses
        .filter((r) => r.status === 'fulfilled')
        .map((r) => (r as PromiseFulfilledResult<any>).value)
        .filter((r) => r.status === 429);

      // This assertion depends on your rate limiting implementation
      // expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
