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

import { AuthController } from '../auth.controller';
import type { JWTService } from '../services/jwt.service';
import type { RefreshTokenService } from '../services/refresh-token.service';
import type { UserService } from '../services/user-service';

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
  let mockNext: any;

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

    mockNext = vi.fn();
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
      });
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.signup(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserService.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockUserService.createUser).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      // Success response is handled by BaseController
    });

    it('should return error if email already exists', async () => {
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
      });

      await authController.signup(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('should handle service errors', async () => {
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

      await authController.signup(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
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
      });
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.signin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserService.getUserByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should return error for invalid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserService.getUserByEmail.mockResolvedValue(null);

      await authController.signin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      // Error response handled by BaseController
    });

    it('should return error for incorrect password', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('CorrectPassword', 10),
      };

      mockRequest.body = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      mockUserService.getUserByEmail.mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockImplementation(() =>
        Promise.resolve(false)
      );

      await authController.signin(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      // Error response handled by BaseController
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
      };

      const mockStoredToken = {
        tokenId: 'token-123',
        userId: 1,
        hashedToken: 'hashed-token',
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
      });
      mockRefreshTokenService.revokeRefreshToken.mockResolvedValue(true);
      mockRefreshTokenService.storeRefreshToken.mockResolvedValue(undefined);

      await authController.refresh(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
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

    it('should return error for invalid refresh token', async () => {
      mockRequest.body = {
        refreshToken: 'invalid-token',
      };

      const error = new Error('Invalid token');
      mockJwtService.verifyRefreshToken.mockImplementation(() => {
        throw error;
      });

      await authController.refresh(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      // Error response handled by BaseController
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const mockRefreshPayload = {
        tokenId: 'token-123',
        userId: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.body = {
        refreshToken: 'refresh-token',
      };

      mockJwtService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
      mockRefreshTokenService.revokeRefreshToken.mockResolvedValue(true);

      await authController.logout(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
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
        mockResponse as Response,
        mockNext
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
        mockResponse as Response,
        mockNext
      );

      expect(mockUserService.updateUser).toHaveBeenCalledWith(1, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should return error when user is not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.body = {
        firstName: 'Jane',
      };

      await authController.updateProfile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      // Error response handled by BaseController
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
        mockResponse as Response,
        mockNext
      );

      expect(mockRefreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        1
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should return error when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await authController.revokeAllTokens(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      // Error response handled by BaseController
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
          tokenId: 'token-1',
          createdAt: new Date(),
          lastUsedAt: new Date(),
          expiresAt: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0...',
        },
      ];

      const mockStats = {
        totalTokens: 1,
        activeTokens: 1,
        expiredTokens: 0,
      };

      mockRequest.user = mockUser;
      mockRefreshTokenService.getUserTokens.mockResolvedValue(mockTokens);
      mockRefreshTokenService.getStats.mockReturnValue(mockStats);

      await authController.debugTokens(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRefreshTokenService.getUserTokens).toHaveBeenCalledWith(1);
      expect(mockRefreshTokenService.getStats).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      // Success response is handled by BaseController
    });

    it('should return error in production environment', async () => {
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

      await authController.debugTokens(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      // Error response handled by BaseController
    });
  });
});
