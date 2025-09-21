/**
 * Example of Optimized Auth Testing Pattern
 *
 * This shows how to use the new auth helper methods:
 * 1. authenticateSeededUser() for auth routes (signin, refresh, logout, profile updates)
 * 2. createAuthenticatedUser() for signup/registration testing
 * 3. getSeededUserTokens() for token-based tests with real users
 */

import type { Application } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import {
  authenticateSeededUser,
  createAuthenticatedUser,
  getSeededUserTokens,
  type TestAuthSession,
} from '../helpers/auth.helper';

let app: Application;

describe('Optimized Auth Testing Pattern', () => {
  let seededAuthSession: TestAuthSession;

  beforeAll(async () => {
    app = await createApp();

    // Use seeded user for auth routes testing (fast, reliable)
    seededAuthSession = await authenticateSeededUser(app, 1);
  });

  describe('POST /auth/signin - Using Seeded Users', () => {
    it('should signin with seeded user credentials', async () => {
      const response = await request(app)
        .post('/api/auth/signin')
        .send({
          email: 'test-user-1@example.com',
          password: 'test123', // Known seeded password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test-user-1@example.com');
      expect(response.body.data.user.hasCompletedOnboarding).toBe(true);
    });
  });

  describe('POST /auth/refresh - Using Seeded User Tokens', () => {
    it('should refresh tokens using seeded user session', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: seededAuthSession.refreshToken,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeTruthy();
    });
  });

  describe('PATCH /auth/profile - Using Seeded User Auth', () => {
    it('should update profile with seeded user token', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${seededAuthSession.accessToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /auth/signup - Creating New Users', () => {
    it('should create new user for signup testing', async () => {
      // For signup/registration tests, create new users
      const newUserSession = await createAuthenticatedUser(app, {
        email: `new.user.${Date.now()}@example.com`,
        password: 'NewPassword123!',
      });

      expect(newUserSession.user.email).toContain('new.user');
      expect(newUserSession.accessToken).toBeTruthy();
      expect(newUserSession.user.hasCompletedOnboarding).toBe(false); // New users
    });
  });

  describe('Token Validation Tests - Using Factory Pattern', () => {
    it('should validate tokens for seeded users', () => {
      // Use tokens that match seeded users
      const tokens = getSeededUserTokens(1);

      expect(tokens.user.id).toBe(1);
      expect(tokens.user.email).toBe('test-user-1@example.com');
      expect(tokens.accessToken).toBeTruthy();
    });
  });
});

/**
 * MIGRATION GUIDELINES:
 *
 * 1. Auth Routes (signin, refresh, logout, profile):
 *    - Replace createAuthenticatedUser() with authenticateSeededUser()
 *    - Use seeded credentials: test-user-{1,2,3}@example.com / test123
 *    - Much faster as no database writes needed
 *
 * 2. Signup/Registration Routes:
 *    - Keep using createAuthenticatedUser() for actual signup testing
 *    - These tests validate the user creation flow
 *
 * 3. Token Validation Tests:
 *    - Use getSeededUserTokens() for real user tokens
 *    - Use getTestTokens() for factory-generated tokens
 *
 * 4. Benefits:
 *    - Faster test execution (less DB writes)
 *    - More reliable (stable seeded users)
 *    - Better separation of concerns
 *    - Clearer test intent
 */
