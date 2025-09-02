/**
 * JWT Authentication Routes
 *
 * JWT-based authentication endpoints for user signup, signin, token refresh,
 * and profile management. Replaces the previous session-based authentication.
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { profileUpdateSchema, signInSchema, signUpSchema, type User } from '@shared/types';
import { containerMiddleware } from '../middleware';
import { requireGuest, requireAuth } from '../middleware/auth.middleware';
import { JWTService } from '../services/jwt.service';
import { RefreshTokenService, hashToken } from '../services/refresh-token.service';
import { UserService } from '../services/user-service';

// Validation schemas for JWT endpoints
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const router = Router();

/**
 * POST /signup - Register new user with JWT tokens
 */
router.post('/signup', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const signUpData = signUpSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');
    const jwtService = req.scope.resolve<JWTService>('jwtService');
    const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(signUpData.email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Create user
    const user = await userService.createUser(signUpData);

    // Generate JWT tokens
    const tokenPair = jwtService.generateTokenPair(user);

    // Store refresh token
    const refreshTokenDecoded = jwtService.decodeRefreshToken(tokenPair.refreshToken);
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
    });
  } catch (error) {
    console.error('JWT sign up error:', error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create account'
      });
    }
  }
});

/**
 * POST /signin - Login user with JWT tokens
 */
router.post('/signin', requireGuest, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const signInData = signInSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');
    const jwtService = req.scope.resolve<JWTService>('jwtService');
    const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');

    // Find user
    const user = await userService.getUserByEmail(signInData.email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Validate password
    const isValidPassword = await userService.validatePassword(
      signInData.password,
      user.password
    );
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate JWT tokens
    const tokenPair = jwtService.generateTokenPair(user);

    // Store refresh token
    const refreshTokenDecoded = jwtService.decodeRefreshToken(tokenPair.refreshToken);
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
    });
  } catch (error) {
    console.error('JWT sign in error:', error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to sign in'
      });
    }
  }
});

/**
 * POST /refresh - Refresh access token using refresh token
 */
router.post('/refresh', containerMiddleware, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const jwtService = req.scope.resolve<JWTService>('jwtService');
    const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');
    const userService = req.scope.resolve<UserService>('userService');

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
          message: 'Invalid or expired refresh token'
        }
      });
    }

    // Get current user data
    const user = await userService.getUserById(refreshPayload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Generate new token pair (refresh token rotation)
    const newTokenPair = jwtService.generateTokenPair(user);

    // Revoke old refresh token
    await refreshTokenService.revokeRefreshToken(refreshPayload.tokenId);

    // Store new refresh token
    const newRefreshTokenDecoded = jwtService.decodeRefreshToken(newTokenPair.refreshToken);
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
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token has expired'
        }
      });
    }

    if (error.message.includes('Invalid')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_ERROR',
        message: 'Token refresh failed'
      }
    });
  }
});

/**
 * POST /logout - Logout user and revoke refresh token
 */
router.post('/logout', containerMiddleware, async (req: Request, res: Response) => {
  try {
    const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');
    const jwtService = req.scope.resolve<JWTService>('jwtService');

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
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('JWT logout error:', error);
    // Always return success for logout, even if there were errors
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

/**
 * POST /revoke-all - Revoke all refresh tokens for current user
 */
router.post('/revoke-all', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');
    const user = (req as any).user as User;

    const revokedCount = await refreshTokenService.revokeAllUserTokens(user.id);

    res.json({
      success: true,
      message: `Revoked ${revokedCount} refresh tokens`,
      revokedCount,
    });
  } catch (error) {
    console.error('Revoke all tokens error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke tokens'
    });
  }
});

/**
 * GET /me - Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user as User;
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    },
  });
});

/**
 * PATCH /profile - Update user profile
 */
router.patch('/profile', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as User;
    const updateData = profileUpdateSchema.parse(req.body);
    const userService = req.scope.resolve<UserService>('userService');

    // Check if username is already taken (if provided)
    if (updateData.userName && updateData.userName !== user.userName) {
      const existingUser = await userService.getUserByUsername(updateData.userName);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    // Update user profile
    const updatedUser = await userService.updateUser(user.id, updateData);
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        userName: updatedUser.userName,
        interest: updatedUser.interest,
        hasCompletedOnboarding: updatedUser.hasCompletedOnboarding,
      },
    });
  } catch (error) {
    console.error('JWT profile update error:', error);
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }
});

/**
 * GET /debug/tokens - Debug endpoint to view user's active tokens (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/tokens', requireAuth, containerMiddleware, async (req: Request, res: Response) => {
    try {
      const refreshTokenService = req.scope.resolve<RefreshTokenService>('refreshTokenService');
      const user = (req as any).user as User;

      const tokens = await refreshTokenService.getUserTokens(user.id);
      const stats = refreshTokenService.getStats();

      res.json({
        success: true,
        userTokens: tokens.map(token => ({
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
        error: 'Failed to get token info'
      });
    }
  });
}

export default router;
