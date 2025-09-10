/**
 * AuthController
 * 
 * Handles JWT-based authentication endpoints including signup, signin,
 * token refresh, logout, and profile management with standardized responses.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { profileUpdateSchema, signInSchema, signUpSchema, type User } from '@shared/types';
import { JWTService } from '../services/jwt.service';
import { RefreshTokenService, hashToken } from '../services/refresh-token.service';
import { UserService } from '../services/user-service';
import { BaseController } from './base-controller';
import { ErrorCode } from '../../shared/types/api-responses';
import type { Logger } from '../core/logger';

// Validation schemas for JWT endpoints
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController extends BaseController {
  private readonly jwtService: JWTService;
  private readonly refreshTokenService: RefreshTokenService;
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    jwtService,
    refreshTokenService,
    userService,
    logger,
  }: {
    jwtService: JWTService;
    refreshTokenService: RefreshTokenService;
    userService: UserService;
    logger: Logger;
  }) {
    super();
    this.jwtService = jwtService;
    this.refreshTokenService = refreshTokenService;
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * POST /signup - Register new user with JWT tokens
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const signUpData = signUpSchema.parse(req.body);

      this.logger.info('User signup attempt', {
        email: signUpData.email,
        ip: req.ip,
      });

      // Check if user already exists
      const existingUser = await this.userService.getUserByEmail(signUpData.email);
      if (existingUser) {
        this.logger.warn('Signup failed - email already exists', {
          email: signUpData.email,
          ip: req.ip,
        });
        this.conflict(res, 'Email already registered', req);
        return;
      }

      // Create user
      const user = await this.userService.createUser(signUpData);

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = this.jwtService.decodeRefreshToken(tokenPair.refreshToken);
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

      this.logger.info('User signup successful', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      this.created(res, {
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
        },
      }, req);
    } catch (error) {
      this.logger.error('Signup error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      if (error instanceof z.ZodError) {
        this.validationError(res, 'Invalid signup data', error.errors, req);
      } else {
        this.error(res, error instanceof Error ? error : 'Failed to create account', req);
      }
    }
  }

  /**
   * POST /signin - Login user with JWT tokens
   */
  async signin(req: Request, res: Response): Promise<void> {
    try {
      const signInData = signInSchema.parse(req.body);

      this.logger.info('User signin attempt', {
        email: signInData.email,
        ip: req.ip,
      });

      // Find user
      const user = await this.userService.getUserByEmail(signInData.email);
      if (!user) {
        this.logger.warn('Signin failed - user not found', {
          email: signInData.email,
          ip: req.ip,
        });
        return this.unauthorized(res, 'Invalid email or password', req);
      }

      // Validate password
      const isValidPassword = await this.userService.validatePassword(
        signInData.password,
        user.password
      );
      if (!isValidPassword) {
        this.logger.warn('Signin failed - invalid password', {
          userId: user.id,
          email: signInData.email,
          ip: req.ip,
        });
        return this.unauthorized(res, 'Invalid email or password', req);
      }

      // Generate JWT tokens
      const tokenPair = this.jwtService.generateTokenPair(user);

      // Store refresh token
      const refreshTokenDecoded = this.jwtService.decodeRefreshToken(tokenPair.refreshToken);
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

      this.logger.info('User signin successful', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      this.success(res, {
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
        },
      }, req);
    } catch (error) {
      this.logger.error('Signin error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      if (error instanceof z.ZodError) {
        this.validationError(res, 'Invalid signin data', error.errors, req);
      } else {
        this.error(res, error instanceof Error ? error : 'Failed to sign in', req);
      }
    }
  }

  /**
   * POST /refresh - Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);

      this.logger.info('Token refresh attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Verify refresh token
      const refreshPayload = this.jwtService.verifyRefreshToken(refreshToken);

      // Validate refresh token in storage
      const storedToken = await this.refreshTokenService.validateRefreshToken(
        refreshPayload.tokenId,
        hashToken(refreshToken)
      );

      if (!storedToken) {
        this.logger.warn('Token refresh failed - invalid token', {
          tokenId: refreshPayload.tokenId,
          ip: req.ip,
        });
        return this.error(res, 'Invalid or expired refresh token', req, ErrorCode.AUTHENTICATION_REQUIRED);
      }

      // Get current user data
      const user = await this.userService.getUserById(refreshPayload.userId);
      if (!user) {
        this.logger.warn('Token refresh failed - user not found', {
          userId: refreshPayload.userId,
          tokenId: refreshPayload.tokenId,
          ip: req.ip,
        });
        return this.error(res, 'User not found', req, ErrorCode.NOT_FOUND);
      }

      // Generate new token pair (refresh token rotation)
      const newTokenPair = this.jwtService.generateTokenPair(user);

      // Revoke old refresh token
      await this.refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);

      // Store new refresh token
      const newRefreshTokenDecoded = this.jwtService.decodeRefreshToken(newTokenPair.refreshToken);
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

      this.logger.info('Token refresh successful', {
        userId: user.id,
        oldTokenId: refreshPayload.tokenId,
        newTokenId: newRefreshTokenDecoded?.tokenId,
        ip: req.ip,
      });

      this.success(res, {
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
      }, req);
    } catch (error: any) {
      this.logger.error('Token refresh error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });

      if (error.message.includes('expired')) {
        this.error(res, 'Refresh token has expired', req, ErrorCode.AUTHENTICATION_REQUIRED);
      } else if (error.message.includes('Invalid')) {
        this.error(res, 'Invalid refresh token', req, ErrorCode.AUTHENTICATION_REQUIRED);
      } else if (error instanceof z.ZodError) {
        this.validationError(res, 'Invalid refresh request', error.errors, req);
      } else {
        this.error(res, 'Token refresh failed', req);
      }
    }
  }

  /**
   * POST /logout - Logout user and revoke refresh token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      this.logger.info('User logout attempt', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Get refresh token from request body (optional)
      const refreshToken = req.body.refreshToken;

      if (refreshToken) {
        try {
          const refreshPayload = this.jwtService.verifyRefreshToken(refreshToken);
          await this.refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);
          this.logger.info('Refresh token revoked during logout', {
            tokenId: refreshPayload.tokenId,
            ip: req.ip,
          });
        } catch (error) {
          // Ignore errors for logout - token might already be invalid
          this.logger.warn('Error revoking refresh token during logout', {
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip,
          });
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
            const revokedCount = await this.refreshTokenService.revokeAllUserTokens(payload.userId);
            this.logger.info('All user tokens revoked during logout', {
              userId: payload.userId,
              revokedCount,
              ip: req.ip,
            });
          } catch (error) {
            this.logger.warn('Error revoking user tokens during logout', {
              userId: payload.userId,
              error: error instanceof Error ? error.message : 'Unknown error',
              ip: req.ip,
            });
          }
        }
      }

      this.success(res, {
        message: 'Logged out successfully'
      }, req);
    } catch (error) {
      this.logger.error('Logout error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      // Always return success for logout, even if there were errors
      this.success(res, {
        message: 'Logged out successfully'
      }, req);
    }
  }

  /**
   * POST /revoke-all - Revoke all refresh tokens for current user
   */
  async revokeAll(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as User;

      this.logger.info('Revoke all tokens request', {
        userId: user.id,
        ip: req.ip,
      });

      const revokedCount = await this.refreshTokenService.revokeAllUserTokens(user.id);

      this.logger.info('All tokens revoked', {
        userId: user.id,
        revokedCount,
        ip: req.ip,
      });

      this.success(res, {
        message: `Revoked ${revokedCount} refresh tokens`,
        revokedCount,
      }, req);
    } catch (error) {
      this.logger.error('Revoke all tokens error', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      this.error(res, 'Failed to revoke tokens', req);
    }
  }

  /**
   * GET /me - Get current user info
   */
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as User;

      this.logger.info('Get current user request', {
        userId: user.id,
        ip: req.ip,
      });

      this.success(res, {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          interest: user.interest,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
        },
      }, req);
    } catch (error) {
      this.logger.error('Get current user error', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      this.error(res, 'Failed to get user info', req);
    }
  }

  /**
   * PATCH /profile - Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user as User;
      const updateData = profileUpdateSchema.parse(req.body);

      this.logger.info('Profile update request', {
        userId: user.id,
        fields: Object.keys(updateData),
        ip: req.ip,
      });

      // Check if username is already taken (if provided)
      if (updateData.userName && updateData.userName !== user.userName) {
        const existingUser = await this.userService.getUserByUsername(updateData.userName);
        if (existingUser && existingUser.id !== user.id) {
          this.logger.warn('Profile update failed - username taken', {
            userId: user.id,
            attemptedUsername: updateData.userName,
            ip: req.ip,
          });
          return this.conflict(res, 'Username already taken', req);
        }
      }

      // Update user profile
      const updatedUser = await this.userService.updateUser(user.id, updateData);
      if (!updatedUser) {
        this.logger.error('Profile update failed - user not found', {
          userId: user.id,
          ip: req.ip,
        });
        return this.notFound(res, 'User', req);
      }

      this.logger.info('Profile update successful', {
        userId: user.id,
        updatedFields: Object.keys(updateData),
        ip: req.ip,
      });

      this.success(res, {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          userName: updatedUser.userName,
          interest: updatedUser.interest,
          hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
        },
      }, req);
    } catch (error) {
      this.logger.error('Profile update error', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      if (error instanceof z.ZodError) {
        this.validationError(res, 'Invalid profile data', error.errors, req);
      } else {
        this.error(res, error instanceof Error ? error : 'Failed to update profile', req);
      }
    }
  }

  /**
   * GET /debug/tokens - Debug endpoint to view user's active tokens (development only)
   */
  async debugTokens(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV !== 'development') {
      return this.notFound(res, 'Endpoint', req);
    }

    try {
      const user = (req as any).user as User;

      this.logger.info('Debug tokens request', {
        userId: user.id,
        ip: req.ip,
      });

      const tokens = await this.refreshTokenService.getUserTokens(user.id);
      const stats = this.refreshTokenService.getStats();

      this.success(res, {
        userTokens: tokens.map(token => ({
          tokenId: token.tokenId,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt,
          expiresAt: token.expiresAt,
          ipAddress: token.ipAddress,
          userAgent: token.userAgent?.substring(0, 50) + '...',
        })),
        stats,
      }, req);
    } catch (error) {
      this.logger.error('Debug tokens error', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
      });
      
      this.error(res, 'Failed to get token info', req);
    }
  }
}