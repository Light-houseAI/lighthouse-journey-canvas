/**
 * Auth Controller
 *
 * Handles all JWT authentication endpoints including:
 * - User signup and signin
 * - Token refresh and logout
 * - Profile management
 * - Token management and debugging
 */

import {
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  type User,
} from '@journey/schema';
import { Request, Response } from 'express';
import { z } from 'zod';

import {
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '../core/errors';
import { JWTService } from '../services/jwt.service';
import {
  hashToken,
  RefreshTokenService,
} from '../services/refresh-token.service';
import { UserService } from '../services/user-service';
import { BaseController } from './base-controller.js';

// Request validation schemas
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutRequestSchema = z.object({
  refreshToken: z.string().optional(),
});

export class AuthController extends BaseController {
  private jwtService: JWTService;
  private refreshTokenService: RefreshTokenService;
  private userService: UserService;

  constructor({
    jwtService,
    refreshTokenService,
    userService,
  }: {
    jwtService: JWTService;
    refreshTokenService: RefreshTokenService;
    userService: UserService;
  }) {
    super();
    this.jwtService = jwtService;
    this.refreshTokenService = refreshTokenService;
    this.userService = userService;
  }

  /**
   * POST /signup - Register new user with JWT tokens
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const signUpData = signUpSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await this.userService.getUserByEmail(
        signUpData.email
      );
      if (existingUser) {
        throw new BusinessRuleError('Email already registered');
      }

      // Create user
      const user = await this.userService.createUser(signUpData);

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = this.jwtService.decodeRefreshToken(
        tokenPair.refreshToken
      );
      if (refreshTokenDecoded) {
        const expiryDate = new Date(refreshTokenDecoded.exp * 1000);
        await this.refreshTokenService.storeRefreshToken(
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

      this.created(
        res,
        {
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
        req
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(
          res,
          new ValidationError('Invalid signup data', error.errors),
          req
        );
      } else {
        this.error(
          res,
          error instanceof Error
            ? error
            : new Error('Failed to create account'),
          req
        );
      }
    }
  }

  /**
   * POST /signin - Login user with JWT tokens
   */
  async signin(req: Request, res: Response): Promise<void> {
    try {
      const signInData = signInSchema.parse(req.body);

      // Find user
      const user = await this.userService.getUserByEmail(signInData.email);
      if (!user) {
        throw new ValidationError('Invalid email or password');
      }

      // Validate password
      const isValidPassword = await this.userService.validatePassword(
        signInData.password,
        user.password
      );
      if (!isValidPassword) {
        throw new ValidationError('Invalid email or password');
      }

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = this.jwtService.decodeRefreshToken(
        tokenPair.refreshToken
      );
      if (refreshTokenDecoded) {
        const expiryDate = new Date(refreshTokenDecoded.exp * 1000);
        await this.refreshTokenService.storeRefreshToken(
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

      this.success(
        res,
        {
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
        req
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(
          res,
          new ValidationError('Invalid signin data', error.errors),
          req
        );
      } else {
        this.error(
          res,
          error instanceof Error ? error : new Error('Failed to sign in'),
          req
        );
      }
    }
  }

  /**
   * POST /refresh - Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);

      // Verify refresh token
      const refreshPayload = this.jwtService.verifyRefreshToken(refreshToken);

      // Validate refresh token in storage
      const storedToken = await this.refreshTokenService.validateRefreshToken(
        refreshPayload.tokenId,
        hashToken(refreshToken)
      );

      if (!storedToken) {
        throw new ValidationError('Invalid or expired refresh token');
      }

      // Get current user data
      const user = await this.userService.getUserById(refreshPayload.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Generate new token pair (refresh token rotation)
      const newTokenPair = this.jwtService.generateTokenPair(user);

      // Revoke old refresh token
      await this.refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);

      // Store new refresh token
      const newRefreshTokenDecoded = this.jwtService.decodeRefreshToken(
        newTokenPair.refreshToken
      );
      if (newRefreshTokenDecoded) {
        const expiryDate = new Date(newRefreshTokenDecoded.exp * 1000);
        await this.refreshTokenService.storeRefreshToken(
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

      this.success(
        res,
        {
          accessToken: newTokenPair.accessToken,
          refreshToken: newTokenPair.refreshToken,
        },
        req
      );
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        this.error(
          res,
          new ValidationError('Invalid request data', error.errors),
          req
        );
      } else if (error.message.includes('expired')) {
        this.error(res, new ValidationError('Refresh token has expired'), req);
      } else if (error.message.includes('Invalid')) {
        this.error(res, new ValidationError('Invalid refresh token'), req);
      } else {
        this.error(
          res,
          error instanceof Error ? error : new Error('Token refresh failed'),
          req
        );
      }
    }
  }

  /**
   * POST /logout - Logout user and revoke refresh token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const logoutData = logoutRequestSchema.parse(req.body);
      const { refreshToken } = logoutData;

      if (refreshToken) {
        try {
          const refreshPayload =
            this.jwtService.verifyRefreshToken(refreshToken);
          await this.refreshTokenService.revokeRefreshToken(
            refreshPayload.tokenId
          );
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
        const payload = this.jwtService.decodeAccessToken(accessToken);

        if (payload && payload.userId) {
          try {
            await this.refreshTokenService.revokeAllUserTokens(payload.userId);
          } catch (error) {
            console.warn('Error revoking user tokens during logout:', error);
          }
        }
      }

      this.success(
        res,
        {
          message: 'Logged out successfully',
        },
        req
      );
    } catch (error) {
      // Always return success for logout, even if there were errors
      console.warn('Error during logout:', error);
      this.success(
        res,
        {
          message: 'Logged out successfully',
        },
        req
      );
    }
  }

  /**
   * POST /revoke-all - Revoke all refresh tokens for current user
   */
  async revokeAllTokens(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      const revokedCount = await this.refreshTokenService.revokeAllUserTokens(
        user.id
      );

      this.success(
        res,
        {
          message: `Revoked ${revokedCount} refresh tokens`,
          revokedCount,
        },
        req
      );
    } catch (error) {
      this.error(
        res,
        error instanceof Error ? error : new Error('Failed to revoke tokens'),
        req
      );
    }
  }

  /**
   * PATCH /profile - Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as User;
      const updateData = profileUpdateSchema.parse(req.body);

      // Check if username is already taken (if provided)
      if (updateData.userName && updateData.userName !== user.userName) {
        const existingUser = await this.userService.getUserByUsername(
          updateData.userName
        );
        if (existingUser && existingUser.id !== user.id) {
          throw new BusinessRuleError('Username already taken');
        }
      }

      // Update user profile
      const updatedUser = await this.userService.updateUser(
        user.id,
        updateData
      );
      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      this.success(
        res,
        {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            userName: updatedUser.userName,
            interest: updatedUser.interest,
            hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
          },
        },
        req
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(
          res,
          new ValidationError('Invalid profile data', error.errors),
          req
        );
      } else {
        this.error(
          res,
          error instanceof Error
            ? error
            : new Error('Failed to update profile'),
          req
        );
      }
    }
  }

  /**
   * GET /debug/tokens - Debug endpoint to view user's active tokens (development only)
   */
  async debugTokens(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.NODE_ENV !== 'development') {
        throw new BusinessRuleError(
          'Debug endpoint only available in development'
        );
      }

      const user = this.getAuthenticatedUser(req);

      const tokens = await this.refreshTokenService.getUserTokens(user.id);
      const stats = this.refreshTokenService.getStats();

      this.success(
        res,
        {
          userTokens: tokens.map((token) => ({
            tokenId: token.tokenId,
            createdAt: token.createdAt,
            lastUsedAt: token.lastUsedAt,
            expiresAt: token.expiresAt,
            ipAddress: token.ipAddress,
            userAgent: token.userAgent?.substring(0, 50) + '...',
          })),
          stats,
        },
        req
      );
    } catch (error) {
      this.error(
        res,
        error instanceof Error ? error : new Error('Failed to get token info'),
        req
      );
    }
  }
}
