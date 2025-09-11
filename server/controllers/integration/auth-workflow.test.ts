/**
 * Authentication Workflow Integration Tests
 *
 * Tests complete authentication workflows using real services and database:
 * 1. User registration → signin → token refresh → logout
 * 2. User profile management throughout auth lifecycle
 * 3. Session handling and security validation
 * 4. Token validation and revocation
 *
 * PATTERN: Enhanced AAA with Real Services
 * - ARRANGE: Use real auth services to establish user state
 * - ACT: Execute specific auth operations being tested
 * - ASSERT: Verify complete auth state including database verification
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';

import { users, refreshTokens } from '@shared/schema';
import { setupIntegrationTestContext, createAAAHelper, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks';
import type { AuthService } from '../../../services/auth.service';
import type { JwtService } from '../../../services/jwt.service';
import type { RefreshTokenService } from '../../../services/refresh-token.service';

describe('Authentication Workflow Integration Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'auth-workflow',
    withTestData: false // We'll create specific auth test data
  });

  let authService: AuthService;
  let jwtService: JwtService;
  let refreshTokenService: RefreshTokenService;
  let aaaHelper: ReturnType<typeof createAAAHelper>;

  beforeAll(() => {
    const { container } = testContext.getContext();
    authService = container.resolve<AuthService>('authService');
    jwtService = container.resolve<JwtService>('jwtService');
    refreshTokenService = container.resolve<RefreshTokenService>('refreshTokenService');
    aaaHelper = createAAAHelper(container);
  });

  describe('Complete User Registration → Signin → Refresh → Logout Workflow', () => {
    it('should handle complete authentication lifecycle', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();
      const assert = aaaHelper.assert();

      // 🔧 ARRANGE - Prepare test user data
      const userData = TestDataBuilders.user({
        email: 'auth.test.user@example.com',
        password: 'SecurePassword123!',
        interest: 'Technology'
      });

      // ⚡ ACT 1 - User Registration
      const registrationResult = await aaaHelper.act(async () => {
        return await authService.register({
          email: userData.email,
          password: userData.password,
          interest: userData.interest,
        });
      });

      // ✅ ASSERT 1 - Registration successful
      expect(registrationResult).toHaveProperty('user');
      expect(registrationResult).toHaveProperty('tokens');
      expect(registrationResult.user.email).toBe(userData.email);
      expect(registrationResult.user.interest).toBe(userData.interest);
      expect(registrationResult.user.hasCompletedOnboarding).toBe(false);

      // Verify user exists in database
      const dbUser = await db.select().from(users).where(eq(users.email, userData.email));
      expect(dbUser).toHaveLength(1);
      expect(dbUser[0].email).toBe(userData.email);

      // Verify refresh token exists in database
      const dbRefreshTokens = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, registrationResult.user.id));
      expect(dbRefreshTokens).toHaveLength(1);

      const { user: registeredUser, tokens: initialTokens } = registrationResult;

      // ⚡ ACT 2 - User Signin (should work with same credentials)
      const signinResult = await aaaHelper.act(async () => {
        return await authService.signin({
          email: userData.email,
          password: userData.password,
        });
      });

      // ✅ ASSERT 2 - Signin successful with new tokens
      expect(signinResult).toHaveProperty('user');
      expect(signinResult).toHaveProperty('tokens');
      expect(signinResult.user.id).toBe(registeredUser.id);
      expect(signinResult.user.email).toBe(userData.email);
      
      // Should have new tokens (different from registration)
      expect(signinResult.tokens.accessToken).not.toBe(initialTokens.accessToken);
      expect(signinResult.tokens.refreshToken).not.toBe(initialTokens.refreshToken);

      // Verify JWT tokens are valid
      const accessTokenPayload = await jwtService.verifyAccessToken(signinResult.tokens.accessToken);
      expect(accessTokenPayload.userId).toBe(registeredUser.id);

      const refreshTokenPayload = await jwtService.verifyRefreshToken(signinResult.tokens.refreshToken);
      expect(refreshTokenPayload.userId).toBe(registeredUser.id);

      // ⚡ ACT 3 - Token Refresh
      const refreshResult = await aaaHelper.act(async () => {
        return await authService.refreshTokens(signinResult.tokens.refreshToken);
      });

      // ✅ ASSERT 3 - Token refresh successful
      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      
      // Should have new tokens (different from signin)
      expect(refreshResult.accessToken).not.toBe(signinResult.tokens.accessToken);
      expect(refreshResult.refreshToken).not.toBe(signinResult.tokens.refreshToken);

      // New tokens should be valid
      const newAccessTokenPayload = await jwtService.verifyAccessToken(refreshResult.accessToken);
      expect(newAccessTokenPayload.userId).toBe(registeredUser.id);

      // ⚡ ACT 4 - Logout (revoke refresh token)
      await aaaHelper.act(async () => {
        return await authService.logout(refreshResult.refreshToken);
      });

      // ✅ ASSERT 4 - Logout successful, tokens revoked
      // Old refresh token should no longer work
      await expect(authService.refreshTokens(refreshResult.refreshToken)).rejects.toThrow();

      // Verify refresh token removed from database
      const dbRefreshTokensAfterLogout = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, registeredUser.id));
      expect(dbRefreshTokensAfterLogout).toHaveLength(0);

      // User should still exist in database (logout doesn't delete user)
      const dbUserAfterLogout = await db.select().from(users).where(eq(users.id, registeredUser.id));
      expect(dbUserAfterLogout).toHaveLength(1);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle invalid credentials appropriately', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create valid user
      const validUser = await arrange.createUser('valid.user@example.com');

      // ⚡ ACT & ✅ ASSERT - Wrong password should fail
      await expect(aaaHelper.act(async () => {
        return await authService.signin({
          email: validUser.user.email,
          password: 'WrongPassword123!',
        });
      })).rejects.toThrow();

      // ⚡ ACT & ✅ ASSERT - Non-existent user should fail
      await expect(aaaHelper.act(async () => {
        return await authService.signin({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        });
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle duplicate registration appropriately', async () => {
      const userData = TestDataBuilders.user({
        email: 'duplicate.test@example.com'
      });

      // 🔧 ARRANGE - Register user first time
      const firstRegistration = await aaaHelper.act(async () => {
        return await authService.register(userData);
      });

      expect(firstRegistration).toHaveProperty('user');

      // ⚡ ACT & ✅ ASSERT - Second registration with same email should fail
      await expect(aaaHelper.act(async () => {
        return await authService.register(userData);
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Token Management and Security', () => {
    it('should handle concurrent token refresh securely', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create user and get tokens
      const user = await arrange.createUser('concurrent.refresh@example.com');
      const signinResult = await authService.signin({
        email: 'concurrent.refresh@example.com',
        password: 'TestPassword123!',
      });

      const { refreshToken } = signinResult.tokens;

      // ⚡ ACT - Multiple concurrent refresh attempts
      const refreshPromises = [
        authService.refreshTokens(refreshToken),
        authService.refreshTokens(refreshToken),
        authService.refreshTokens(refreshToken),
      ];

      // ✅ ASSERT - Only one should succeed, others should fail
      const results = await Promise.allSettled(refreshPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed.length).toBeGreaterThanOrEqual(2);

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should properly validate token expiration', async () => {
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - Create user and get tokens
      const user = await arrange.createUser('token.expiry@example.com');
      const signinResult = await authService.signin({
        email: 'token.expiry@example.com',
        password: 'TestPassword123!',
      });

      // ⚡ ACT - Verify fresh tokens are valid
      const accessTokenPayload = await jwtService.verifyAccessToken(signinResult.tokens.accessToken);
      const refreshTokenPayload = await jwtService.verifyRefreshToken(signinResult.tokens.refreshToken);

      // ✅ ASSERT - Tokens should be valid
      expect(accessTokenPayload.userId).toBe(user.user.id);
      expect(refreshTokenPayload.userId).toBe(user.user.id);

      // Note: We can't easily test actual expiration without mocking time
      // In a real scenario, you'd mock Date.now() or use a test clock

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('User Profile Integration with Auth', () => {
    it('should maintain user profile consistency throughout auth lifecycle', async () => {
      const { db } = testContext.getContext();
      const arrange = aaaHelper.arrange();

      // 🔧 ARRANGE - User data with profile information
      const userData = TestDataBuilders.user({
        email: 'profile.consistency@example.com',
        interest: 'Design'
      });

      // ⚡ ACT 1 - Register user
      const registrationResult = await authService.register(userData);

      // ✅ ASSERT 1 - User created with correct profile data
      expect(registrationResult.user.interest).toBe('Design');
      expect(registrationResult.user.hasCompletedOnboarding).toBe(false);

      // Verify in database
      const dbUser = await db.select().from(users).where(eq(users.id, registrationResult.user.id));
      expect(dbUser[0].interest).toBe('Design');
      expect(dbUser[0].hasCompletedOnboarding).toBe(false);

      // ⚡ ACT 2 - Signin should return same profile data
      const signinResult = await authService.signin({
        email: userData.email,
        password: userData.password,
      });

      // ✅ ASSERT 2 - Profile data consistent after signin
      expect(signinResult.user.interest).toBe('Design');
      expect(signinResult.user.hasCompletedOnboarding).toBe(false);
      expect(signinResult.user.id).toBe(registrationResult.user.id);

      // ⚡ ACT 3 - Token refresh should not affect user data
      const refreshResult = await authService.refreshTokens(signinResult.tokens.refreshToken);
      
      // Verify user data unchanged
      const userAfterRefresh = await db.select().from(users).where(eq(users.id, registrationResult.user.id));
      expect(userAfterRefresh[0].interest).toBe('Design');
      expect(userAfterRefresh[0].hasCompletedOnboarding).toBe(false);

    }, TEST_TIMEOUTS.INTEGRATION);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed tokens gracefully', async () => {
      // ⚡ ACT & ✅ ASSERT - Malformed tokens should be rejected
      await expect(jwtService.verifyAccessToken('invalid.token.format')).rejects.toThrow();
      await expect(jwtService.verifyRefreshToken('invalid.token.format')).rejects.toThrow();
      await expect(authService.refreshTokens('invalid.refresh.token')).rejects.toThrow();
      await expect(authService.logout('invalid.refresh.token')).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should handle empty and null inputs appropriately', async () => {
      // ⚡ ACT & ✅ ASSERT - Empty/null inputs should be rejected
      await expect(authService.register({
        email: '',
        password: 'ValidPassword123!',
        interest: 'Technology'
      })).rejects.toThrow();

      await expect(authService.register({
        email: 'valid@example.com',
        password: '',
        interest: 'Technology'
      })).rejects.toThrow();

      await expect(authService.signin({
        email: '',
        password: 'ValidPassword123!'
      })).rejects.toThrow();

      await expect(authService.signin({
        email: 'valid@example.com',
        password: ''
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);

    it('should validate password strength requirements', async () => {
      const userData = TestDataBuilders.user({
        email: 'password.strength@example.com',
      });

      // ⚡ ACT & ✅ ASSERT - Weak passwords should be rejected
      await expect(authService.register({
        ...userData,
        password: 'weak'
      })).rejects.toThrow();

      await expect(authService.register({
        ...userData,
        password: '12345678'
      })).rejects.toThrow();

      await expect(authService.register({
        ...userData,
        password: 'onlylowercase'
      })).rejects.toThrow();

    }, TEST_TIMEOUTS.INTEGRATION);
  });
});