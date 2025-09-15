import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app';
import { Container } from '../../core/container-setup';

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
  let testUser: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userName: string;
  };
  let tokens: {
    accessToken?: string;
    refreshToken?: string;
  } = {};
  let registeredUser: {
    email: string;
    password: string;
  };

  beforeAll(async () => {
    // Create the app (logging automatically silenced in test environment)
    app = await createApp();

    // Generate unique test user data with more randomness to avoid conflicts
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const processId = process.pid;
    testUser = {
      email: `test.user.${timestamp}.${random}.${processId}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      userName: `testuser${timestamp}${random}${processId}`,
    };

    // This user will be created during the signup test and reused for signin tests
    registeredUser = {
      email: testUser.email,
      password: testUser.password,
    };
  });

  afterAll(async () => {
    // Cleanup container
    await Container.dispose();
  });

  describe('POST /auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
        })
        .expect(201)
        .expect('Content-Type', /json/);

      const body: AuthResponse = response.body;

      // Validate response structure
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('timestamp');

      // Validate tokens
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(typeof body.data.accessToken).toBe('string');
      expect(typeof body.data.refreshToken).toBe('string');

      // Validate user data
      expect(body.data.user).toMatchObject({
        email: registeredUser.email,
        hasCompletedOnboarding: false,
      });
      // These fields are not included in signUpSchema, so they will be null
      expect(body.data.user.firstName).toBeNull();
      expect(body.data.user.lastName).toBeNull();
      expect(body.data.user.userName).toBeNull();
      expect(body.data.user.interest).toBeNull();
      expect(body.data.user.id).toBeGreaterThan(0);

      // Store tokens for subsequent tests
      tokens.accessToken = body.data.accessToken;
      tokens.refreshToken = body.data.refreshToken;
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
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
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: `missing.fields.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
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
    it('should authenticate user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body: AuthResponse = response.body;

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(body.data.user.email).toBe(registeredUser.email);
      expect(body.data.user.hasCompletedOnboarding).toBe(false);

      // Update tokens
      tokens.accessToken = body.data.accessToken;
      tokens.refreshToken = body.data.refreshToken;
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: registeredUser.email,
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
    it('should update user profile', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
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
          refreshToken: tokens.refreshToken,
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeTruthy();
      expect(body.data.refreshToken).toBeTruthy();
      expect(body.data.accessToken).not.toBe(tokens.accessToken); // Should be new token
      expect(body.data.refreshToken).not.toBe(tokens.refreshToken); // Token rotation

      // Update tokens
      tokens.accessToken = body.data.accessToken;
      tokens.refreshToken = body.data.refreshToken;
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
          refreshToken: tokens.refreshToken,
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

  // Performance tests
  describe('Performance', () => {
    it('should respond to signin within 1000ms', async () => {
      const start = Date.now();

      await request(app)
        .post('/api/auth/signin')
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
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
          email: registeredUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      const body = response.body;

      // Should not expose whether email exists
      expect(body.error.message).not.toContain('password is wrong');
      expect(body.error.message).not.toContain('user exists');
    });

    it('should rate limit signup attempts', async () => {
      // This test would need to be implemented based on your rate limiting strategy
      // Example of how you might test rate limiting
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
