/**
 * JWT Service
 *
 * Handles JWT token generation, verification, and management for user authentication.
 * Provides both access and refresh token functionality with secure rotation.
 */

import { User } from '@shared/types';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: number;
  email: string;
  userName?: string;
  jti?: string; // JWT ID for uniqueness (optional for backward compatibility)
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: number;
  tokenId: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiry: string;

  constructor() {
    // Environment variables for JWT configuration
    this.accessSecret = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
    this.accessExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '30d';

    // Warn if using default secrets in production
    if (process.env.NODE_ENV === 'production') {
      if (this.accessSecret.includes('dev-') || this.refreshSecret.includes('dev-')) {
        console.warn('⚠️  WARNING: Using default JWT secrets in production! Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
      }
    }
  }

  /**
   * Generate an access token for a user
   */
  generateAccessToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      userName: user.userName || undefined,
      jti: this.generateTokenId(), // Add unique JWT ID
    };

    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiry,
      issuer: 'lighthouse-app',
      audience: 'lighthouse-users',
    });
  }

  /**
   * Generate a refresh token for a user
   * Uses a unique token ID for revocation tracking
   */
  generateRefreshToken(user: User): string {
    const tokenId = this.generateTokenId();

    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      tokenId,
    };

    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiry,
      issuer: 'lighthouse-app',
      audience: 'lighthouse-refresh',
    });
  }

  /**
   * Generate both access and refresh tokens for a user
   */
  generateTokenPair(user: User): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessSecret, {
        issuer: 'lighthouse-app',
        audience: 'lighthouse-users',
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw new Error('Access token verification failed');
    }
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: 'lighthouse-app',
        audience: 'lighthouse-refresh',
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Check if a token is expired without verifying signature
   * Useful for client-side expiry checks
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (!decoded || !decoded.exp) {
        return true;
      }

      // JWT exp is in seconds, Date.now() is in milliseconds
      return decoded.exp < Math.floor(Date.now() / 1000);
    } catch {
      return true;
    }
  }

  /**
   * Extract user information from access token without verification
   * Useful for debugging and logging
   */
  decodeAccessToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }

  /**
   * Extract token ID from refresh token without verification
   */
  decodeRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      return jwt.decode(token) as RefreshTokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique token ID for refresh token tracking
   */
  private generateTokenId(): string {
    // Generate a random token ID (could be UUID, but timestamp + random is sufficient)
    return randomUUID();
  }

  /**
   * Get token expiry information
   */
  getTokenInfo() {
    return {
      accessExpiry: this.accessExpiry,
      refreshExpiry: this.refreshExpiry,
      usingProductionSecrets: process.env.NODE_ENV === 'production' &&
        !this.accessSecret.includes('dev-') &&
        !this.refreshSecret.includes('dev-'),
    };
  }
}
