/**
 * Auth Middleware Test Suite
 *
 * Tests JWT authentication middleware error handling,
 * specifically ensuring proper 401 responses for all auth failures.
 */

import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Container } from '../../core/container-setup';
import { ErrorCode } from '../../core/error-codes';
import type { JWTService } from '../../services/jwt.service';
import type { UserService } from '../../services/user-service';
import { requireAuth } from '../auth.middleware';

// Mock Container
vi.mock('../../core/container-setup', () => ({
  Container: {
    getContainer: vi.fn(),
  },
}));

describe('Auth Middleware - Error Handling', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockJwtService: Partial<JWTService>;
  let mockUserService: Partial<UserService>;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup response mocks
    jsonSpy = vi.fn().mockReturnThis();
    statusSpy = vi.fn().mockReturnThis();

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    mockNext = vi.fn();

    // Setup service mocks
    mockJwtService = {
      verifyAccessToken: vi.fn(),
    };

    mockUserService = {
      getUserById: vi.fn(),
    };

    // Setup container mock
    const mockContainer = {
      resolve: vi.fn((name: string) => {
        if (name === 'jwtService') return mockJwtService;
        if (name === 'userService') return mockUserService;
        return null;
      }),
    };

    vi.mocked(Container.getContainer).mockReturnValue(mockContainer as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Missing/Invalid Token Format', () => {
    it('should return 401 when no Authorization header', async () => {
      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authorization token required',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is malformed (no Bearer)', async () => {
      mockRequest.headers!.authorization = 'InvalidToken';

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authorization token required',
        },
      });
    });

    it('should return 401 when Authorization header has no token', async () => {
      mockRequest.headers!.authorization = 'Bearer';

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authorization token required',
        },
      });
    });
  });

  describe('JWT Verification Errors - All Return 401', () => {
    beforeEach(() => {
      mockRequest.headers!.authorization = 'Bearer valid-token-format';
    });

    it('should return 401 for expired token', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('Token expired');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.TOKEN_EXPIRED,
          message: 'Token has expired',
        },
      });
    });

    it('should return 401 for invalid token signature', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid authorization token',
        },
      });
    });

    it('should return 401 for malformed JWT', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid authorization token format',
        },
      });
    });

    it('should return 401 for JWT decode error', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('Failed to decode token');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid authorization token format',
        },
      });
    });

    it('should return 401 for invalid JWT structure', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('jwt signature is required');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.TOKEN_INVALID,
          message: 'Invalid authorization token format',
        },
      });
    });

    it('should return 401 for generic auth errors (not 500)', async () => {
      vi.mocked(mockJwtService.verifyAccessToken!).mockImplementation(() => {
        throw new Error('Unknown authentication error');
      });

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Authentication failed',
        },
      });
    });
  });

  describe('User Not Found', () => {
    beforeEach(() => {
      mockRequest.headers!.authorization = 'Bearer valid-token';
      vi.mocked(mockJwtService.verifyAccessToken!).mockReturnValue({
        userId: 123,
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: 'test',
        aud: 'test',
      });
    });

    it('should return 401 when user not found in database', async () => {
      vi.mocked(mockUserService.getUserById!).mockResolvedValue(null);

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: 'Invalid token - user not found',
        },
      });
    });
  });

  describe('Successful Authentication', () => {
    it('should call next() and attach user to request', async () => {
      mockRequest.headers!.authorization = 'Bearer valid-token';

      const mockUser = {
        id: 123,
        email: 'test@example.com',
        password: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        userName: 'testuser',
        interest: null,
        hasCompletedOnboarding: true,
        createdAt: new Date(),
      };

      vi.mocked(mockJwtService.verifyAccessToken!).mockReturnValue({
        userId: 123,
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        iss: 'test',
        aud: 'test',
      });

      vi.mocked(mockUserService.getUserById!).mockResolvedValue(mockUser);

      await requireAuth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).userId).toBe(123);
      expect((mockRequest as any).user).toMatchObject({
        id: 123,
        email: 'test@example.com',
      });
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });
});
