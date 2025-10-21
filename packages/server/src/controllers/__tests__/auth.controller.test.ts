/**
 * Auth Controller Test Suite - TDD Implementation
 *
 * Tests authentication endpoints following Test-Driven Development:
 * - Using vitest-mock-extended for type-safe mocking
 * - Comprehensive coverage of all endpoints
 * - Error handling and edge cases
 */

import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { JWTService } from '../../services/jwt.service';
import type { RefreshTokenService } from '../../services/refresh-token.service';
import type { UserService } from '../../services/user-service';
import { AuthController } from '../auth.controller';

// Mock bcrypt for password tests
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock hashToken function
vi.mock('../services/refresh-token.service', async () => {
  const actual = await vi.importActual('../services/refresh-token.service');
  return {
    ...actual,
    hashToken: vi.fn().mockReturnValue('hashed-token'),
  };
});

import { RefreshTokenRecord } from '@journey/schema';
import bcrypt from 'bcryptjs';

// Mock factory functions removed - using direct mocking in tests

describe('AuthController', () => {
  let controller: AuthController;
  let authController: AuthController; // Alias for compatibility with old tests
  let mockJwtService: MockProxy<JWTService>;
  let mockRefreshTokenService: MockProxy<RefreshTokenService>;
  let mockUserService: MockProxy<UserService>;

  // Add missing variables that the old tests expect
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  // Removed unused mock constants - defined inline in tests as needed

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwtService = mock<JWTService>();
    mockRefreshTokenService = mock<RefreshTokenService>();
    mockUserService = mock<UserService>();

    controller = new AuthController({
      jwtService: mockJwtService,
      refreshTokenService: mockRefreshTokenService,
      userService: mockUserService,
    });

    authController = controller; // Alias for compatibility

    // Initialize missing variables for legacy tests
    mockRequest = {
      body: {},
      user: undefined,
      headers: {},
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signup', () => {
    it('should successfully create a new user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: false,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        password: 'hashedPassword',
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
      };

      mockUserService.getUserByEmail.mockResolvedValue(null);
      mockUserService.createUser.mockResolvedValue(mockUser);
      mockJwtService.generateTokenPair.mockReturnValue(mockTokens);
      mockJwtService.decodeRefreshToken.mockReturnValue({
        tokenId: 'token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.signup(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUserService.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockUserService.createUser).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      // Success response is handled by BaseController
    });

    it('should throw error if email already exists', async () => {
      mockRequest.body = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
      };

      mockUserService.getUserByEmail.mockResolvedValue({
        id: 1,
        email: 'existing@example.com',
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
      });

      await expect(
        authController.signup(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow();
    });

    it('should throw service errors', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
      };

      const error = new Error('Database error');
      mockUserService.getUserByEmail.mockRejectedValue(error);

      await expect(
        authController.signup(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Database error');
    });
  });

  describe('signin', () => {
    it('should successfully sign in a user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword123',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      mockUserService.getUserByEmail.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(true);
      mockJwtService.generateTokenPair.mockReturnValue(mockTokens);
      mockJwtService.decodeRefreshToken.mockReturnValue({
        tokenId: 'token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.signin(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUserService.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should throw error for invalid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserService.getUserByEmail.mockResolvedValue(null);

      await expect(
        authController.signin(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('CorrectPassword', 10),
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserService.getUserByEmail.mockResolvedValue(mockUser);
      mockUserService.validatePassword.mockResolvedValue(false);

      await expect(
        authController.signin(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        password: 'hashedPassword',
      };

      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      const mockRefreshPayload = {
        tokenId: 'token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const mockStoredToken: RefreshTokenRecord = {
        tokenId: 'token-123',
        tokenHash: 'hashed-token',
        userId: 1,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockRequest.body = {
        refreshToken: 'old-refresh-token',
      };

      mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
      mockRefreshTokenService.validateRefreshToken.mockResolvedValue(
        mockStoredToken
      );
      mockUserService.getUserById.mockResolvedValue(mockUser);
      mockJwtService.generateTokenPair.mockReturnValue(mockTokens);
      mockJwtService.decodeRefreshToken.mockReturnValue({
        tokenId: 'new-token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      });
      mockRefreshTokenService.revokeRefreshToken.mockResolvedValue(true);
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.refresh(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockJwtService.verifyRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token'
      );
      expect(mockRefreshTokenService.validateRefreshToken).toHaveBeenCalled();
      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
      expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(mockUser);
      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-123'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should throw error for invalid refresh token', async () => {
      mockRequest.body = {
        refreshToken: 'invalid-token',
      };

      const error = new Error('Invalid token');
      mockJwtService.verifyRefreshToken.mockImplementation(() => {
        throw error;
      });

      await expect(
        authController.refresh(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const mockRefreshPayload = {
        tokenId: 'token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      mockRequest.body = {
        refreshToken: 'refresh-token',
      };

      mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
      mockRefreshTokenService.revokeRefreshToken.mockResolvedValue(true);

      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockJwtService.verifyRefreshToken).toHaveBeenCalledWith(
        'refresh-token'
      );
      expect(mockRefreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        'token-123'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle logout even with invalid token', async () => {
      mockRequest.body = {
        refreshToken: 'invalid-token',
      };

      const error = new Error('Invalid token');
      mockJwtService.verifyRefreshToken.mockImplementation(() => {
        throw error;
      });

      await authController.logout(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Logout should always succeed even with invalid tokens
    });
  });

  describe('updateProfile', () => {
    it('should successfully update user profile', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'technology',
        hasCompletedOnboarding: false,
        password: 'hashedPassword',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        userName: 'janesmith',
        interest: 'AI',
      };

      mockRequest.user = mockUser;
      mockRequest.body = updateData;

      mockUserService.getUserByUsername.mockResolvedValue(null); // Username not taken
      mockUserService.updateUser.mockResolvedValue({
        ...mockUser,
        ...updateData,
        hasCompletedOnboarding: true,
      });

      await authController.updateProfile(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockUserService.updateUser).toHaveBeenCalledWith(1, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should throw error when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        firstName: 'Jane',
      };

      await expect(
        authController.updateProfile(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();
    });
  });

  describe('revokeAllTokens', () => {
    it('should successfully revoke all user tokens', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        password: 'hashedPassword',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      mockRequest.user = mockUser;
      mockRefreshTokenService.revokeAllUserTokens.mockResolvedValue(3);

      await authController.revokeAllTokens(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        1
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should throw error when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await expect(
        authController.revokeAllTokens(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow('User authentication required');
    });
  });

  describe('debugTokens', () => {
    beforeEach(() => {
      // Set NODE_ENV to development for debug tests
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      // Reset NODE_ENV
      delete process.env.NODE_ENV;
    });

    it('should return token debug info in development', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        password: 'hashedPassword',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      const mockTokens = [
        {
          userId: 1,
          tokenId: 'token-1',
          tokenHash: 'hash-1',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          expiresAt: new Date(),
          iat: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0...',
        },
      ];

      const mockStats = {
        totalTokens: 1,
        activeTokens: 1,
        expiredTokens: 0,
        revokedTokens: 0,
      };

      mockRequest.user = mockUser;
      mockRefreshTokenService.getUserTokens.mockResolvedValue(mockTokens);
      mockRefreshTokenService.getStats.mockReturnValue(mockStats);

      await authController.debugTokens(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockRefreshTokenService.getUserTokens).toHaveBeenCalledWith(1);
      expect(mockRefreshTokenService.getStats).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should throw error in production environment', async () => {
      process.env.NODE_ENV = 'production';

      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        password: 'hashedPassword',
        interest: 'technology',
        hasCompletedOnboarding: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };

      mockRequest.user = mockUser;

      await expect(
        authController.debugTokens(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow('Debug endpoint only available in development');
    });
  });
});
