/**
 * JWT Service Tests
 *
 * Comprehensive tests for JWT token generation, verification, and management.
 */

import type { User } from '@journey/schema';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JWTService } from '../jwt.service.js';

// Mock user for testing
const mockUser: User = {
  id: 123,
  email: 'test@example.com',
  userName: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashedpassword',
  interest: 'find-job',
  hasCompletedOnboarding: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    // Reset environment variables for each test
    vi.restoreAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '30d';
    process.env.NODE_ENV = 'test';

    jwtService = new JWTService();
  });

  describe('constructor', () => {
    it('should use environment variables for configuration', () => {
      const tokenInfo = jwtService.getTokenInfo();
      expect(tokenInfo.accessExpiry).toBe('15m');
      expect(tokenInfo.refreshExpiry).toBe('30d');
      expect(tokenInfo.usingProductionSecrets).toBe(false);
    });

    it('should use default values when environment variables are not set', () => {
      delete process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_ACCESS_EXPIRY;
      delete process.env.JWT_REFRESH_EXPIRY;

      const service = new JWTService();
      const tokenInfo = service.getTokenInfo();

      expect(tokenInfo.accessExpiry).toBe('15m');
      expect(tokenInfo.refreshExpiry).toBe('30d');
    });

    it('should warn about default secrets in production', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      new JWTService();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Using default JWT secrets in production')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = jwtService.generateAccessToken(mockUser);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

      // Verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        userName: mockUser.userName,
        iss: 'lighthouse-app',
        aud: 'lighthouse-users',
      });

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp > decoded.iat).toBe(true);
    });

    it('should handle user without userName', () => {
      const userWithoutUsername = { ...mockUser, userName: null } as any;
      const token = jwtService.generateAccessToken(userWithoutUsername);

      const decoded = jwt.decode(token) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.userName).toBeUndefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = jwtService.generateRefreshToken(mockUser);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const decoded = jwt.decode(token) as any;
      expect(decoded).toMatchObject({
        userId: mockUser.id,
        iss: 'lighthouse-app',
        aud: 'lighthouse-refresh',
      });

      expect(decoded.tokenId).toBeDefined();
      expect(typeof decoded.tokenId).toBe('string');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should generate unique token IDs', () => {
      const token1 = jwtService.generateRefreshToken(mockUser);
      const token2 = jwtService.generateRefreshToken(mockUser);

      const decoded1 = jwt.decode(token1) as any;
      const decoded2 = jwt.decode(token2) as any;

      expect(decoded1.tokenId).not.toBe(decoded2.tokenId);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokenPair = jwtService.generateTokenPair(mockUser);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(typeof tokenPair.accessToken).toBe('string');
      expect(typeof tokenPair.refreshToken).toBe('string');

      // Verify both tokens are valid
      const accessDecoded = jwt.decode(tokenPair.accessToken) as any;
      const refreshDecoded = jwt.decode(tokenPair.refreshToken) as any;

      expect(accessDecoded.userId).toBe(mockUser.id);
      expect(refreshDecoded.userId).toBe(mockUser.id);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and decode a valid access token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.verifyAccessToken(token);

      expect(payload).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        userName: mockUser.userName,
      });
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyAccessToken('invalid.token.here');
      }).toThrow('Invalid access token');
    });

    it('should throw error for expired token', () => {
      // Create a token with immediate expiry
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email } as any,
        'test-access-secret',
        { expiresIn: '0s', issuer: 'lighthouse-app', audience: 'lighthouse-users' } as any
      );

      expect(() => {
        jwtService.verifyAccessToken(expiredToken);
      }).toThrow('Access token expired');
    });

    it('should throw error for token with wrong issuer', () => {
      const wrongIssuerToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email } as any,
        'test-access-secret',
        { expiresIn: '15m', issuer: 'wrong-issuer', audience: 'lighthouse-users' } as any
      );

      expect(() => {
        jwtService.verifyAccessToken(wrongIssuerToken);
      }).toThrow('Invalid access token');
    });

    it('should throw error for token with wrong audience', () => {
      const wrongAudienceToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email } as any,
        'test-access-secret',
        { expiresIn: '15m', issuer: 'lighthouse-app', audience: 'wrong-audience' } as any
      );

      expect(() => {
        jwtService.verifyAccessToken(wrongAudienceToken);
      }).toThrow('Invalid access token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify and decode a valid refresh token', () => {
      const token = jwtService.generateRefreshToken(mockUser);
      const payload = jwtService.verifyRefreshToken(token);

      expect(payload).toMatchObject({
        userId: mockUser.id,
      });
      expect(payload.tokenId).toBeDefined();
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        jwtService.verifyRefreshToken('invalid.token.here');
      }).toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, tokenId: 'test-id' } as any,
        'test-refresh-secret',
        { expiresIn: '0s', issuer: 'lighthouse-app', audience: 'lighthouse-refresh' } as any
      );

      expect(() => {
        jwtService.verifyRefreshToken(expiredToken);
      }).toThrow('Refresh token expired');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      expect(jwtService.isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id, exp: Math.floor(Date.now() / 1000) - 1 } as any, // 1 second ago
        'test-access-secret'
      );
      expect(jwtService.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should return true for invalid token', () => {
      expect(jwtService.isTokenExpired('invalid.token')).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const tokenWithoutExp = jwt.sign(
        { userId: mockUser.id } as any,
        'test-access-secret'
        // No expiresIn - no exp claim
      );

      expect(jwtService.isTokenExpired(tokenWithoutExp)).toBe(true);
    });
  });

  describe('decodeAccessToken', () => {
    it('should decode token without verification', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const decoded = jwtService.decodeAccessToken(token);

      expect(decoded).toMatchObject({
        userId: mockUser.id,
        email: mockUser.email,
        userName: mockUser.userName,
      });
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeAccessToken('invalid.token');
      expect(decoded).toBeNull();
    });
  });

  describe('decodeRefreshToken', () => {
    it('should decode refresh token without verification', () => {
      const token = jwtService.generateRefreshToken(mockUser);
      const decoded = jwtService.decodeRefreshToken(token);

      expect(decoded).toMatchObject({
        userId: mockUser.id,
      });
      expect(decoded?.tokenId).toBeDefined();
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeRefreshToken('invalid.token');
      expect(decoded).toBeNull();
    });
  });

  describe('getTokenInfo', () => {
    it('should return token configuration info', () => {
      const info = jwtService.getTokenInfo();

      expect(info).toEqual({
        accessExpiry: '15m',
        refreshExpiry: '30d',
        usingProductionSecrets: false,
      });
    });

    it('should detect production secrets correctly', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'production-secret';
      process.env.JWT_REFRESH_SECRET = 'production-refresh-secret';

      const service = new JWTService();
      const info = service.getTokenInfo();

      expect(info.usingProductionSecrets).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle malformed tokens gracefully', () => {
      expect(() => {
        jwtService.verifyAccessToken('not.a.token');
      }).toThrow();
    });

    it('should handle tokens signed with wrong secret', () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: mockUser.id, email: mockUser.email } as any,
        'wrong-secret',
        { expiresIn: '15m', issuer: 'lighthouse-app', audience: 'lighthouse-users' } as any
      );

      expect(() => {
        jwtService.verifyAccessToken(tokenWithWrongSecret);
      }).toThrow('Invalid access token');
    });
  });

  describe('integration scenarios', () => {
    it('should support full auth flow', async () => {
      // Generate token pair
      const tokenPair = jwtService.generateTokenPair(mockUser);

      // Verify access token
      const accessPayload = jwtService.verifyAccessToken(tokenPair.accessToken);
      expect(accessPayload.userId).toBe(mockUser.id);

      // Verify refresh token
      const refreshPayload = jwtService.verifyRefreshToken(tokenPair.refreshToken);
      expect(refreshPayload.userId).toBe(mockUser.id);

      // Generate new tokens using refresh (with small delay to ensure different iat)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newTokenPair = jwtService.generateTokenPair(mockUser);

      // New tokens should be different (different iat timestamps)
      expect(newTokenPair.accessToken).not.toBe(tokenPair.accessToken);
      expect(newTokenPair.refreshToken).not.toBe(tokenPair.refreshToken);

      // But should work for the same user
      const newAccessPayload = jwtService.verifyAccessToken(newTokenPair.accessToken);
      expect(newAccessPayload.userId).toBe(mockUser.id);
    });
  });
});
