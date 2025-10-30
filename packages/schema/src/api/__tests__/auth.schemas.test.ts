/**
 * Authentication Schema Tests
 * Tests for authentication API request and response schemas
 */

import { describe, expect, it } from 'vitest';

import {
  authResponseSchema,
  debugTokensResponseSchema,
  logoutRequestSchema,
  logoutResponseSchema,
  profileUpdateRequestSchema,
  refreshTokenRequestSchema,
  revokeAllTokensResponseSchema,
  signInRequestSchema,
  signUpRequestSchema,
  tokenInfoSchema,
  tokenPairSchema,
  userProfileSchema,
} from '../auth.schemas';

// Password constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128; // Reasonable limit to prevent DoS

// Test data factories
const createValidSignupData = (
  overrides: Partial<{
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
  }> = {}
) => ({
  email: 'test@example.com',
  password: 'password123',
  ...overrides,
});

const createValidSigninData = (
  overrides: Partial<{ email: string; password: string }> = {}
) => ({
  email: 'test@example.com',
  password: 'password123',
  ...overrides,
});

const createValidUserProfile = (
  overrides: Partial<{
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    userName: string | null;
    interest: string | null;
    hasCompletedOnboarding: boolean | null;
    createdAt: Date | string;
  }> = {}
) => ({
  id: 1,
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  userName: 'johndoe',
  interest: 'Technology',
  hasCompletedOnboarding: true,
  createdAt: new Date(),
  ...overrides,
});

describe('Auth Request Schemas', () => {
  describe('signUpRequestSchema', () => {
    it('should validate valid signup request', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({
          firstName: 'John',
          lastName: 'Doe',
          userName: 'johndoe',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate signup with only required fields', () => {
      const result = signUpRequestSchema.safeParse(createValidSignupData());
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ email: 'not-an-email' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ password: 'short' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = signUpRequestSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });

    // Security-focused tests
    it('should accept password at minimum length', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ password: 'a'.repeat(MIN_PASSWORD_LENGTH) })
      );
      expect(result.success).toBe(true);
    });

    it('should reject password below minimum length', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) })
      );
      expect(result.success).toBe(false);
    });

    it('should handle special characters in email', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ email: 'test+filter@example.com' })
      );
      expect(result.success).toBe(true);
    });

    it('should handle special characters in password', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ password: 'P@ssw0rd!#$%' })
      );
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in name fields', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({
          firstName: 'José',
          lastName: 'François',
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject SQL injection patterns in email', () => {
      const result = signUpRequestSchema.safeParse(
        createValidSignupData({ email: "test' OR '1'='1" })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('signInRequestSchema', () => {
    it('should validate valid signin request', () => {
      const result = signInRequestSchema.safeParse(createValidSigninData());
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = signInRequestSchema.safeParse(
        createValidSigninData({ email: 'invalid' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = signInRequestSchema.safeParse(
        createValidSigninData({ password: '' })
      );
      expect(result.success).toBe(false);
    });
  });

  describe('profileUpdateRequestSchema', () => {
    it('should validate valid profile update', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'Software Engineering',
      };

      const result = profileUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const validData = {
        firstName: 'John',
      };

      const result = profileUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow empty object (no updates)', () => {
      const result = profileUpdateRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty strings for name fields', () => {
      const invalidData = {
        firstName: '',
      };

      const result = profileUpdateRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenRequestSchema', () => {
    it('should validate valid refresh token request', () => {
      const validData = {
        refreshToken: 'valid-refresh-token-string',
      };

      const result = refreshTokenRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty refresh token', () => {
      const invalidData = {
        refreshToken: '',
      };

      const result = refreshTokenRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing refresh token', () => {
      const result = refreshTokenRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('logoutRequestSchema', () => {
    it('should validate with refresh token', () => {
      const validData = {
        refreshToken: 'token-to-invalidate',
      };

      const result = logoutRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate without refresh token (optional)', () => {
      const result = logoutRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe('Auth Response Schemas', () => {
  describe('userProfileSchema', () => {
    it('should validate complete user profile', () => {
      const validData = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'Technology',
        hasCompletedOnboarding: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = userProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for nullable fields', () => {
      const validData = {
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: null,
        interest: null,
        hasCompletedOnboarding: null,
        createdAt: new Date(),
      };

      const result = userProfileSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept both string and Date for createdAt', () => {
      const withString = userProfileSchema.safeParse({
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: null,
        interest: null,
        hasCompletedOnboarding: null,
        createdAt: '2024-01-01T00:00:00Z',
      });

      const withDate = userProfileSchema.safeParse({
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: null,
        interest: null,
        hasCompletedOnboarding: null,
        createdAt: new Date(),
      });

      expect(withString.success).toBe(true);
      expect(withDate.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        id: 1,
        email: 'not-an-email',
        firstName: null,
        lastName: null,
        userName: null,
        interest: null,
        hasCompletedOnboarding: null,
        createdAt: new Date(),
      };

      const result = userProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const invalidData = {
        id: 1,
        email: 'test@example.com',
        firstName: null,
        lastName: null,
        userName: null,
        interest: null,
        hasCompletedOnboarding: null,
        createdAt: new Date(),
        extraField: 'not allowed',
      };

      const result = userProfileSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('tokenPairSchema', () => {
    it('should validate valid token pair', () => {
      const validData = {
        accessToken: 'access-token-string',
        refreshToken: 'refresh-token-string',
      };

      const result = tokenPairSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty tokens', () => {
      const invalidData = {
        accessToken: '',
        refreshToken: 'refresh-token',
      };

      const result = tokenPairSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const invalidData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        extraField: 'not allowed',
      };

      const result = tokenPairSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('authResponseSchema', () => {
    it('should validate complete auth response', () => {
      const validData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userName: 'johndoe',
          interest: 'Tech',
          hasCompletedOnboarding: false,
          createdAt: new Date(),
        },
      };

      const result = authResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing user object', () => {
      const invalidData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const result = authResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('tokenInfoSchema', () => {
    it('should validate complete token info', () => {
      const validData = {
        tokenId: 'token-123',
        createdAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = tokenInfoSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for nullable fields', () => {
      const validData = {
        tokenId: 'token-123',
        createdAt: new Date(),
        lastUsedAt: null,
        expiresAt: new Date(),
        ipAddress: null,
        userAgent: null,
      };

      const result = tokenInfoSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('logoutResponseSchema', () => {
    it('should validate logout response', () => {
      const validData = {
        message: 'Logged out successfully',
      };

      const result = logoutResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('revokeAllTokensResponseSchema', () => {
    it('should validate revoke all tokens response', () => {
      const validData = {
        message: 'All tokens revoked',
        revokedCount: 5,
      };

      const result = revokeAllTokensResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept zero revoked count', () => {
      const validData = {
        message: 'No tokens to revoke',
        revokedCount: 0,
      };

      const result = revokeAllTokensResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('debugTokensResponseSchema', () => {
    it('should validate debug tokens response', () => {
      const validData = {
        userTokens: [
          {
            tokenId: 'token-1',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            expiresAt: new Date(),
            ipAddress: '192.168.1.1',
            userAgent: 'Chrome',
          },
        ],
        stats: {
          total: 1,
          active: 1,
          expired: 0,
        },
      };

      const result = debugTokensResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty tokens array', () => {
      const validData = {
        userTokens: [],
        stats: {},
      };

      const result = debugTokensResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
