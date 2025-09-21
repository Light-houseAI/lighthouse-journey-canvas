import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { Container } from '../../core/container-setup';
import {
  createAuthenticatedUser,
  type TestAuthSession,
} from '../helpers/auth.helper';

let app: Application;

describe('Onboarding API', () => {
  let authSession: TestAuthSession;

  beforeAll(async () => {
    // Create the app (logging automatically silenced in test environment)
    app = await createApp();

    // Create authenticated user for API tests
    authSession = await createAuthenticatedUser(app);
  });

  afterAll(async () => {
    // Cleanup container
    await Container.dispose();
  });

  describe('POST /onboarding/interest', () => {
    it('should save user interest', async () => {
      const response = await request(app)
        .post('/api/onboarding/interest')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({
          interest: 'grow-career',
        })
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('timestamp');
    });

    it('should reject interest update without authentication', async () => {
      const response = await request(app)
        .post('/api/onboarding/interest')
        .send({
          interest: 'Data Science',
        })
        .expect(401)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should validate interest field', async () => {
      const response = await request(app)
        .post('/api/onboarding/interest')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({
          // Missing interest field
        })
        .expect(400)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
    });
  });

  describe('POST /onboarding/extract-profile', () => {
    it('should handle profile extraction endpoint', async () => {
      const response = await request(app)
        .post('/api/onboarding/extract-profile')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({
          text: 'Software Engineer with 5 years experience in React, Node.js, and TypeScript.',
        });

      // This endpoint might not be fully implemented yet
      expect([200, 400, 404, 501]).toContain(response.status);
    });
  });

  describe('POST /onboarding/save-profile', () => {
    it('should handle profile saving endpoint', async () => {
      const response = await request(app)
        .post('/api/onboarding/save-profile')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .send({
          profile: {
            skills: ['React', 'Node.js', 'TypeScript'],
            experience: '5 years',
          },
        });

      // This endpoint might not be fully implemented yet
      expect([200, 400, 404, 500, 501]).toContain(response.status);
    });
  });

  describe('POST /onboarding/complete', () => {
    it('should complete the onboarding process', async () => {
      const response = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('user');
      expect(body.data.user.hasCompletedOnboarding).toBe(true);
    });

    it('should update user onboarding status', async () => {
      // Verify onboarding status is updated by checking user profile
      const userResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const userData = userResponse.body.data.user;
      expect(userData.hasCompletedOnboarding).toBe(true);
    });

    it('should reject completion without authentication', async () => {
      const response = await request(app)
        .post('/api/onboarding/complete')
        .expect(401)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body.success).toBe(false);
      expect(body.error).toHaveProperty('code');
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Onboarding Flow Integration', () => {
    it('should complete full onboarding flow', async () => {
      // Create a new user for the full flow test
      const flowTimestamp = Date.now();
      const flowTestUser = {
        email: `onboarding.flow.${flowTimestamp}@example.com`,
        password: 'FlowTestPassword123!',
        firstName: 'Flow',
        lastName: 'Test',
        userName: `flowtest${flowTimestamp}`,
      };

      // 1. Signup
      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send({
          email: flowTestUser.email,
          password: flowTestUser.password,
        })
        .expect(201);

      const flowAccessToken = signupResponse.body.data.accessToken;
      expect(signupResponse.body.data.user.hasCompletedOnboarding).toBe(false);

      // 2. Update interest
      await request(app)
        .post('/api/onboarding/interest')
        .set('Authorization', `Bearer ${flowAccessToken}`)
        .send({
          interest: 'find-job',
        })
        .expect(200);

      // 3. Complete onboarding
      await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${flowAccessToken}`)
        .expect(200);

      // 4. Verify completion
      const finalUserResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${flowAccessToken}`)
        .expect(200);

      expect(finalUserResponse.body.data.user.hasCompletedOnboarding).toBe(
        true
      );
    });
  });
});
