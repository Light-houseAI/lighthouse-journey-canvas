/**
 * AuthController
 * API endpoints for JWT authentication and user management
 */

import {
  AuthenticationError,
  BusinessRuleError,
  HttpStatusCode,
  NotFoundError,
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  type User,
  ValidationError,
} from '@journey/schema';
import { Request, Response } from 'express';

import { JWTService } from '../services/jwt.service';
import {
  hashToken,
  RefreshTokenService,
} from '../services/refresh-token.service';
import { UserService } from '../services/user-service';

export class AuthController {
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
    this.jwtService = jwtService;
    this.refreshTokenService = refreshTokenService;
    this.userService = userService;
  }

  /**
   * POST /api/auth/signup
   * @summary Register a new user account
   * @tags Authentication
   * @description Creates a new user account with the provided email and password. Generates JWT access and refresh tokens for immediate authentication. The refresh token is securely stored with client metadata (IP address, user agent) for security tracking. Returns both tokens and the created user profile including onboarding status.
   * @param {SignUpInput} request.body.required - User registration data - application/json
   * @return {SignUpSuccessResponse} 201 - Successfully created user account with tokens
   * @return {ValidationErrorResponse} 400 - Invalid registration data
   * @return {BusinessRuleErrorResponse} 409 - Email already registered
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async signup(req: Request, res: Response) {
    // Validate signup data - throws ValidationError on failure
    const validationResult = signUpSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid signup data', validationResult.error.errors);
    }

    const signUpData = validationResult.data;

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

    // Send success response
    const response = {
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
    };

    res.status(HttpStatusCode.CREATED).json(response);
  }

  /**
   * POST /api/auth/signin
   * @summary Authenticate user and get tokens
   * @tags Authentication
   * @description Authenticates a user with email and password credentials. Validates the credentials against stored user data and generates new JWT access and refresh tokens upon successful authentication. The refresh token is stored with client metadata for security tracking and session management. Returns authentication tokens and user profile data including onboarding status.
   * @param {SignInInput} request.body.required - User login credentials - application/json
   * @return {SignInSuccessResponse} 200 - Successfully authenticated with tokens
   * @return {ValidationErrorResponse} 400 - Invalid credentials or request data
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async signin(req: Request, res: Response) {
    // Validate signin data - throws ValidationError on failure
    const validationResult = signInSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid signin data', validationResult.error.errors);
    }

    const signInData = validationResult.data;

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

    // Send success response
    const response = {
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
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * POST /api/auth/refresh
   * @summary Refresh access token using refresh token
   * @tags Authentication
   * @description Refreshes an expired access token using a valid refresh token. Implements refresh token rotation for enhanced security - the old refresh token is revoked and a new token pair is generated. The new refresh token is stored with updated client metadata. This endpoint validates the refresh token against stored hashes and ensures the associated user still exists before issuing new tokens.
   * @param {RefreshTokenInput} request.body.required - Refresh token - application/json
   * @return {RefreshTokenSuccessResponse} 200 - Successfully refreshed tokens
   * @return {ValidationErrorResponse} 400 - Invalid or expired refresh token
   * @return {NotFoundErrorResponse} 404 - User not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async refresh(req: Request, res: Response) {
    // Validate request body - throws ValidationError on failure
    if (!req.body.refreshToken || typeof req.body.refreshToken !== 'string') {
      throw new ValidationError('Refresh token is required');
    }

    const { refreshToken } = req.body;

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

    // Send success response
    const response = {
      success: true,
      data: {
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * POST /api/auth/logout
   * @summary Logout user and revoke tokens
   * @tags Authentication
   * @description Logs out the current user by revoking their refresh token and optionally all active tokens for the user. Accepts an optional refresh token in the request body - if provided, that specific token is revoked. Additionally, if a valid access token is present in the Authorization header, all refresh tokens for that user are revoked to ensure complete logout across all sessions. This endpoint is designed to be fault-tolerant and always returns success, even if token revocation fails (e.g., tokens already expired or invalid).
   * @param {LogoutInput} request.body - Optional logout data with refresh token - application/json
   * @return {LogoutSuccessResponse} 200 - Successfully logged out
   * @return {InternalErrorResponse} 500 - Internal server error (rare, logout is fault-tolerant)
   */
  async logout(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (refreshToken) {
      try {
        const refreshPayload = this.jwtService.verifyRefreshToken(refreshToken);
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

    // Send success response (always succeeds, even with errors)
    const response = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * POST /api/auth/revoke-all
   * @summary Revoke all refresh tokens for authenticated user
   * @tags Authentication
   * @description Revokes all active refresh tokens for the currently authenticated user across all sessions and devices. This is useful for security purposes when a user wants to log out of all sessions simultaneously, or when suspicious activity is detected. The endpoint returns the count of revoked tokens. Requires valid authentication via Bearer token in the Authorization header.
   * @security BearerAuth
   * @return {RevokeAllTokensSuccessResponse} 200 - Successfully revoked all tokens
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async revokeAllTokens(req: Request, res: Response) {
    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    const revokedCount = await this.refreshTokenService.revokeAllUserTokens(
      user.id
    );

    // Send success response
    const response = {
      success: true,
      data: {
        message: `Revoked ${revokedCount} refresh tokens`,
        revokedCount,
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * PATCH /api/auth/profile
   * @summary Update authenticated user's profile
   * @tags Authentication
   * @description Updates the profile information for the currently authenticated user. Allows modification of first name, last name, username, interest, and avatar URL. Username uniqueness is enforced - if the new username is already taken by another user, the request will fail with a business rule error. All fields are optional; only provided fields will be updated. Requires valid authentication via Bearer token in the Authorization header.
   * @security BearerAuth
   * @param {ProfileUpdateInput} request.body.required - Profile update data - application/json
   * @return {UpdateProfileSuccessResponse} 200 - Successfully updated profile
   * @return {ValidationErrorResponse} 400 - Invalid profile data
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {NotFoundErrorResponse} 404 - User not found
   * @return {BusinessRuleErrorResponse} 409 - Username already taken
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updateProfile(req: Request, res: Response) {
    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user as User;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate profile update data - throws ValidationError on failure
    const validationResult = profileUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid profile data', validationResult.error.errors);
    }

    const updateData = validationResult.data;

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

    // Send success response
    const response = {
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
        },
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * GET /api/auth/debug/tokens
   * @summary Debug endpoint to view active tokens (development only)
   * @tags Authentication
   * @description Development-only endpoint that provides debugging information about the authenticated user's active refresh tokens and global token statistics. Returns token metadata including creation time, last used time, expiry time, IP address, and user agent (truncated). Also provides global statistics about the refresh token service. This endpoint is disabled in production environments for security reasons. Requires valid authentication via Bearer token in the Authorization header.
   * @security BearerAuth
   * @return {DebugTokensSuccessResponse} 200 - Token debug information
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {BusinessRuleErrorResponse} 403 - Only available in development
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async debugTokens(req: Request, res: Response) {
    if (process.env.NODE_ENV !== 'development') {
      throw new BusinessRuleError(
        'Debug endpoint only available in development'
      );
    }

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    const tokens = await this.refreshTokenService.getUserTokens(user.id);
    const stats = this.refreshTokenService.getStats();

    // Send success response
    const response = {
      success: true,
      data: {
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
    };

    res.status(HttpStatusCode.OK).json(response);
  }
}
