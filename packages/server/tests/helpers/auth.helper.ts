/**
 * Authentication Test Helper
 *
 * Provides test utilities for:
 * 1. Using seeded test users for auth routes (signin, refresh, etc.)
 * 2. Creating new users via signup flow for non-auth routes
 * 3. Generating JWT tokens with factory patterns (validation tests)
 */

import type { Application } from 'express';
import request from 'supertest';

import { JWTService } from '../../src/services/jwt.service';

export interface TestAuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userName: string | null;
    interest: string | null;
    hasCompletedOnboarding: boolean;
  };
}

export interface TestUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  interest: string | null;
  hasCompletedOnboarding: boolean;
}

export interface TestTokenPair {
  accessToken: string;
  refreshToken: string;
  user: TestUser;
}

/**
 * Use seeded test user for auth routes (signin, refresh, logout, etc.)
 * Leverages existing users from database seeder with known credentials
 */
export async function authenticateSeededUser(
  app: Application,
  userNumber: 1 | 2 | 3 = 1
): Promise<TestAuthSession> {
  const userData = {
    email: `test-user-${userNumber}@example.com`,
    password: 'test123', // Known password from seeder
  };

  // Authenticate existing seeded user
  const signinResponse = await request(app)
    .post('/api/auth/signin')
    .send(userData)
    .expect(200);

  return {
    accessToken: signinResponse.body.data.accessToken,
    refreshToken: signinResponse.body.data.refreshToken,
    user: signinResponse.body.data.user,
  };
}

/**
 * Create new user via signup flow (for signup/registration testing)
 * This creates a real user in the database and returns valid tokens
 */
export async function createAuthenticatedUser(
  app: Application,
  userOverrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userName: string;
  }> = {}
): Promise<TestAuthSession> {
  // Generate unique user data
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const processId = process.pid;

  const userData = {
    email: `test.user.${timestamp}.${random}.${processId}@example.com`,
    password: 'TestPassword123!',
    ...userOverrides,
  };

  // Create user through signup
  const signupResponse = await request(app)
    .post('/api/auth/signup')
    .send(userData)
    .expect(201);

  return {
    accessToken: signupResponse.body.data.accessToken,
    refreshToken: signupResponse.body.data.refreshToken,
    user: signupResponse.body.data.user,
  };
}

/**
 * JWT Helper for token validation tests
 */
class JWTTestHelper {
  private jwtService: JWTService;

  constructor() {
    // Set consistent test environment variables for JWT
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-auth-tests';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-auth-tests';
    process.env.JWT_ACCESS_EXPIRY = '1h';
    process.env.JWT_REFRESH_EXPIRY = '7d';

    this.jwtService = new JWTService();
  }

  /**
   * Test User Factory - Creates deterministic test users with sensible defaults
   */
  createTestUser(
    scenario: 'basic' | 'onboarded' | 'admin' | 'custom' = 'basic',
    overrides: Partial<TestUser> = {}
  ): TestUser {
    const baseId = this.getScenarioId(scenario);
    const scenarioDefaults = this.getScenarioDefaults(scenario);

    return {
      id: baseId,
      email: `${scenario}.user.${baseId}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      userName: `${scenario}user${baseId}`,
      interest: 'Software Development',
      hasCompletedOnboarding: false,
      ...scenarioDefaults,
      ...overrides,
    };
  }

  /**
   * Token Pair Factory - Generates tokens for any test user
   */
  generateTokenPair(user: TestUser): TestTokenPair {
    const tokenPair = this.jwtService.generateTokenPair(user);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user,
    };
  }

  /**
   * Complete Auth Session Factory - Creates user + tokens in one call
   */
  createTestSession(
    scenario: 'basic' | 'onboarded' | 'admin' | 'custom' = 'basic',
    userOverrides: Partial<TestUser> = {}
  ): TestTokenPair {
    const user = this.createTestUser(scenario, userOverrides);
    return this.generateTokenPair(user);
  }

  /**
   * Batch Session Factory - Creates multiple authenticated sessions
   */
  createTestSessions(count: number = 3): TestTokenPair[] {
    return Array.from({ length: count }, (_, index) => {
      const scenario =
        index === 0 ? 'basic' : index === 1 ? 'onboarded' : 'admin';
      return this.createTestSession(scenario, { id: 10000 + index });
    });
  }

  verifyAccessToken(token: string) {
    return this.jwtService.verifyAccessToken(token);
  }

  verifyRefreshToken(token: string) {
    return this.jwtService.verifyRefreshToken(token);
  }

  decodeToken(token: string) {
    return this.jwtService.decodeAccessToken(token);
  }

  createInvalidToken(): string {
    return 'invalid.jwt.token.for.testing';
  }

  getTokenInfo() {
    return this.jwtService.getTokenInfo();
  }

  /**
   * Private helper methods
   */
  private getScenarioId(scenario: string): number {
    const scenarioIds = {
      basic: 20001,
      onboarded: 20002,
      admin: 20003,
      custom: 20004,
    };
    return scenarioIds[scenario as keyof typeof scenarioIds] || 20000;
  }

  private getScenarioDefaults(scenario: string): Partial<TestUser> {
    const defaults = {
      basic: {
        interest: 'grow-career',
        hasCompletedOnboarding: false,
      },
      onboarded: {
        interest: 'find-job',
        hasCompletedOnboarding: true,
      },
      admin: {
        interest: 'manage-team',
        hasCompletedOnboarding: true,
      },
      custom: {},
    };
    return defaults[scenario as keyof typeof defaults] || {};
  }
}

export const jwtTestHelper = new JWTTestHelper();

/**
 * Get test tokens for seeded users (matches database seeder users)
 */
export function getSeededUserTokens(userNumber: 1 | 2 | 3 = 1): TestTokenPair {
  const user = {
    id: userNumber, // Matches seeded user IDs
    email: `test-user-${userNumber}@example.com`,
    firstName: 'Test',
    lastName: `User${userNumber}`,
    userName: `user${userNumber}`,
    interest: 'grow-career',
    hasCompletedOnboarding: true,
  };

  return jwtTestHelper.generateTokenPair(user);
}

/**
 * Get consistent test tokens for token validation tests (factory pattern)
 */
export function getTestTokens(): TestTokenPair {
  // Use factory pattern for consistent test tokens
  return jwtTestHelper.createTestSession('onboarded', {
    id: 999999,
    email: 'consistent.test@example.com',
    userName: 'consistenttestuser',
  });
}
