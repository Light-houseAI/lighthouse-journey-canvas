/**
 * Refresh Token Service
 *
 * Manages refresh token storage, validation, and revocation using database persistence.
 * Provides persistent storage that survives server restarts.
 */

import crypto from 'crypto';
import type { IRefreshTokenRepository } from '../repositories/interfaces/refresh-token.repository.interface.js';

import type { RefreshTokenRecord } from '@journey/schema';

export class RefreshTokenService {
  private refreshTokenRepository: IRefreshTokenRepository;

  constructor({
    refreshTokenRepository,
  }: {
    refreshTokenRepository: IRefreshTokenRepository;
  }) {
    this.refreshTokenRepository = refreshTokenRepository;
  }

  /**
   * Store a refresh token in the database
   */
  async storeRefreshToken(
    tokenId: string,
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.refreshTokenRepository.storeRefreshToken(
      tokenId,
      userId,
      tokenHash,
      expiresAt,
      metadata
    );
  }

  /**
   * Validate a refresh token against stored hash
   */
  async validateRefreshToken(
    tokenId: string,
    tokenHash: string
  ): Promise<RefreshTokenRecord | null> {
    return await this.refreshTokenRepository.validateRefreshToken(
      tokenId,
      tokenHash
    );
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(tokenId: string): Promise<boolean> {
    return await this.refreshTokenRepository.revokeRefreshToken(tokenId);
  }

  /**
   * Revoke all active refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<number> {
    return await this.refreshTokenRepository.revokeAllUserTokens(userId);
  }

  /**
   * Get all active tokens for a user (debugging/auditing)
   */
  async getUserTokens(userId: number): Promise<RefreshTokenRecord[]> {
    return await this.refreshTokenRepository.getUserTokens(userId);
  }

  /**
   * Clean up expired and old revoked tokens
   */
  async cleanup(): Promise<number> {
    return await this.refreshTokenRepository.cleanupExpiredTokens();
  }

  /**
   * Get token storage statistics
   */
  async getStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }> {
    return await this.refreshTokenRepository.getStats();
  }

  /**
   * Clear all tokens (for testing)
   */
}

/**
 * Hash a refresh token using SHA-256
 * This is used to store tokens securely in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
