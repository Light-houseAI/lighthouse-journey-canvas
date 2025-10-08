/**
 * JWT Authentication Routes
 *
 * JWT-based authentication endpoints for user signup, signin, token refresh,
 * and profile management. Replaces the previous session-based authentication.
 */

import {
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  type User,
} from '@journey/schema';
import { AwilixContainer } from 'awilix';
import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireGuest } from '../middleware/auth.middleware.js';
import { containerMiddleware } from '../middleware/index.js';
import { hashToken } from '../services/refresh-token.service';

// Extend Express Request type to include our custom properties
declare module 'express' {
  interface Request {
    scope: AwilixContainer;
    user?: any;
    userId?: number;
  }
}

// Validation schemas for JWT endpoints
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const router: any = Router();

/**
 * POST /signup
 * @summary Register new user
 * @tags Authentication
 * @description Register a new user account and receive JWT access and refresh tokens
 * @param {object} request.body.required - Signup credentials - application/json
 * @return {object} 201 - User created with tokens
 * @return {object} 400 - Validation error
 * @return {object} 409 - Email already registered
 */
router.post(
  '/signup',
  requireGuest,
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Signup request body:', req.body);
      const signUpData = signUpSchema.parse(req.body);
      const userService = ((req as any).scope as any).resolve('userService');
      const jwtService = ((req as any).scope as any).resolve('jwtService');
      const refreshTokenService = ((req as any).scope as any).resolve(
        'refreshTokenService'
      );

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(signUpData.email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_EXISTS',
            message: 'Email already registered',
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Create user
      const user = await userService.createUser(signUpData);

      // Generate JWT tokens
      const tokenPair = jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = jwtService.decodeRefreshToken(
        tokenPair.refreshToken
      );
      if (refreshTokenDecoded) {
        const expiryDate = new Date(refreshTokenDecoded.exp * 1000);
        await refreshTokenService.storeRefreshToken(
          refreshTokenDecoded.tokenId,
          user.id,
          hashToken(tokenPair.refreshToken),
          expiryDate,
          {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
      }

      res.status(201).json({
        success: true,
        data: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            interest: user.interest,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            createdAt: user.createdAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      // Let the error handler middleware handle all errors
      next(error);
    }
  }
);

/**
 * POST /signin
 * @summary Authenticate user
 * @tags Authentication
 * @description Authenticate user and receive JWT access and refresh tokens
 * @param {object} request.body.required - Login credentials - application/json
 * @return {object} 200 - Authentication successful
 * @return {object} 400 - Validation error
 * @return {object} 401 - Invalid credentials
 */
router.post(
  '/signin',
  requireGuest,
  containerMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signInData = signInSchema.parse(req.body);
      const userService = ((req as any).scope as any).resolve('userService');
      const jwtService = ((req as any).scope as any).resolve('jwtService');
      const refreshTokenService = ((req as any).scope as any).resolve(
        'refreshTokenService'
      );

      // Find user
      const user = await userService.getUserByEmail(signInData.email);
      if (!user) {
        // Create a custom error that will be handled by the error handler middleware
        const error = new Error('Invalid email or password');
        (error as any).status = 401;
        (error as any).code = 'INVALID_CREDENTIALS';
        throw error;
      }

      // Validate password
      const isValidPassword = await userService.validatePassword(
        signInData.password,
        user.password
      );
      if (!isValidPassword) {
        // Create a custom error that will be handled by the error handler middleware
        const error = new Error('Invalid email or password');
        (error as any).status = 401;
        (error as any).code = 'INVALID_CREDENTIALS';
        throw error;
      }

      // Generate JWT tokens
      const tokenPair = jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = jwtService.decodeRefreshToken(
        tokenPair.refreshToken
      );
      if (refreshTokenDecoded) {
        const expiryDate = new Date(refreshTokenDecoded.exp * 1000);
        await refreshTokenService.storeRefreshToken(
          refreshTokenDecoded.tokenId,
          user.id,
          hashToken(tokenPair.refreshToken),
          expiryDate,
          {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
      }

      res.json({
        success: true,
        data: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            interest: user.interest,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            createdAt: user.createdAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      // Let the error handler middleware handle all errors
      next(error);
    }
  }
);

/**
 * POST /refresh
 * @summary Refresh access token
 * @tags Authentication
 * @description Exchange refresh token for new access and refresh tokens (token rotation)
 * @param {object} request.body.required - Refresh token - application/json
 * @return {object} 200 - New tokens issued
 * @return {object} 400 - Validation error
 * @return {object} 401 - Invalid or expired refresh token
 */
router.post(
  '/refresh',
  containerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const jwtService = ((req as any).scope as any).resolve('jwtService');
      const refreshTokenService = ((req as any).scope as any).resolve(
        'refreshTokenService'
      );
      const userService = ((req as any).scope as any).resolve('userService');

      // Verify refresh token
      const refreshPayload = jwtService.verifyRefreshToken(refreshToken);

      // Validate refresh token in storage
      const storedToken = await refreshTokenService.validateRefreshToken(
        refreshPayload.tokenId,
        hashToken(refreshToken)
      );

      if (!storedToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token',
          },
        });
      }

      // Get current user data
      const user = await userService.getUserById(refreshPayload.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Generate new token pair (refresh token rotation)
      const newTokenPair = jwtService.generateTokenPair(user);

      // Revoke old refresh token
      await refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);

      // Store new refresh token
      const newRefreshTokenDecoded = jwtService.decodeRefreshToken(
        newTokenPair.refreshToken
      );
      if (newRefreshTokenDecoded) {
        const expiryDate = new Date(newRefreshTokenDecoded.exp * 1000);
        await refreshTokenService.storeRefreshToken(
          newRefreshTokenDecoded.tokenId,
          user.id,
          hashToken(newTokenPair.refreshToken),
          expiryDate,
          {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
      }

      res.json({
        success: true,
        data: {
          accessToken: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Token refresh error:', error);

      if (error.message.includes('expired')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired',
          },
        });
      }

      if (error.message.includes('Invalid')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid refresh token',
          },
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Token refresh failed',
        },
      });
    }
  }
);

/**
 * POST /logout
 * @summary Logout user
 * @tags Authentication
 * @description Revoke refresh token and end user session
 * @param {object} request.body - Optional refresh token to revoke - application/json
 * @return {object} 200 - Logout successful
 */
router.post(
  '/logout',
  containerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const refreshTokenService = ((req as any).scope as any).resolve(
        'refreshTokenService'
      );
      const jwtService = ((req as any).scope as any).resolve('jwtService');

      // Get refresh token from request body (optional)
      const refreshToken = req.body.refreshToken;

      if (refreshToken) {
        try {
          const refreshPayload = jwtService.verifyRefreshToken(refreshToken);
          await refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);
        } catch (error) {
          // Ignore errors for logout - token might already be invalid
          console.warn('Error revoking refresh token during logout:', error);
        }
      }

      // Also try to revoke all tokens for the current user if available
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.split(' ')[1];
        // Decode token without verification since it might be expired during logout
        const payload = jwtService.decodeAccessToken(accessToken);

        if (payload && payload.userId) {
          try {
            await refreshTokenService.revokeAllUserTokens(payload.userId);
          } catch (error) {
            console.warn('Error revoking user tokens during logout:', error);
          }
        }
      }

      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('JWT logout error:', error);
      // Always return success for logout, even if there were errors
      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * POST /revoke-all
 * @summary Revoke all tokens
 * @tags Authentication
 * @description Revoke all refresh tokens for the authenticated user
 * @security BearerAuth
 * @return {object} 200 - All tokens revoked
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Server error
 */
router.post(
  '/revoke-all',
  requireAuth,
  containerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const refreshTokenService = ((req as any).scope as any).resolve(
        'refreshTokenService'
      );
      const user = (req as any).user as User;

      const revokedCount = await refreshTokenService.revokeAllUserTokens(
        user.id
      );

      res.json({
        success: true,
        message: `Revoked ${revokedCount} refresh tokens`,
        revokedCount,
      });
    } catch (error) {
      console.error('Revoke all tokens error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke tokens',
      });
    }
  }
);

/**
 * PATCH /profile
 * @summary Update user profile
 * @tags Authentication
 * @description Update authenticated user's profile information
 * @security BearerAuth
 * @param {object} request.body.required - Profile update data - application/json
 * @return {object} 200 - Profile updated successfully
 * @return {object} 400 - Validation error or username taken
 * @return {object} 401 - Unauthorized
 * @return {object} 404 - User not found
 */
router.patch(
  '/profile',
  requireAuth,
  containerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const updateData = profileUpdateSchema.parse(req.body);
      const userService = ((req as any).scope as any).resolve('userService');

      // Check if username is already taken (if provided)
      if (updateData.userName && updateData.userName !== user.userName) {
        const existingUser = await userService.getUserByUsername(
          updateData.userName
        );
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken',
          });
        }
      }

      // Update user profile
      const updatedUser = await userService.updateUser(user.id, updateData);
      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            userName: updatedUser.userName,
            interest: updatedUser.interest,
            hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
            createdAt: updatedUser.createdAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('JWT profile update error:', error);
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update profile',
        });
      }
    }
  }
);

/**
 * GET /me
 * @summary Get current user
 * @tags Authentication
 * @description Get authenticated user's information
 * @security BearerAuth
 * @return {object} 200 - User information retrieved
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Server error
 */
router.get(
  '/me',
  requireAuth,
  containerMiddleware,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            interest: user.interest,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            createdAt: user.createdAt.toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user information',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

/**
 * GET /debug/tokens
 * @summary Debug user tokens
 * @tags Authentication
 * @description View active tokens for authenticated user (development only)
 * @security BearerAuth
 * @return {object} 200 - Token information retrieved
 * @return {object} 401 - Unauthorized
 * @return {object} 500 - Server error
 */
if (process.env.NODE_ENV === 'development') {
  router.get(
    '/debug/tokens',
    requireAuth,
    containerMiddleware,
    async (req: Request, res: Response) => {
      try {
        const refreshTokenService = ((req as any).scope as any).resolve(
          'refreshTokenService'
        );
        const user = (req as any).user as User;

        const tokens = await refreshTokenService.getUserTokens(user.id);
        const stats = refreshTokenService.getStats();

        res.json({
          success: true,
          userTokens: tokens.map((token) => ({
            tokenId: token.tokenId,
            createdAt: token.createdAt,
            lastUsedAt: token.lastUsedAt,
            expiresAt: token.expiresAt,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent?.substring(0, 50) + '...',
          })),
          stats,
        });
      } catch (error) {
        console.error('Debug tokens error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get token info',
        });
      }
    }
  );
}

export default router;
