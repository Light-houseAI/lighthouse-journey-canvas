import { RefreshTokenRecord } from "@shared/types";

export interface IRefreshTokenRepository {
  storeRefreshToken(
    tokenId: string,
    userId: number,
    tokenHash: string,
    expiresAt: Date,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void>;

  validateRefreshToken(
    tokenId: string,
    tokenHash: string
  ): Promise<RefreshTokenRecord | null>;

  updateLastUsedAt(tokenId: string): Promise<void>;

  revokeRefreshToken(tokenId: string): Promise<boolean>;

  revokeAllUserTokens(userId: number): Promise<number>;

  getUserTokens(userId: number): Promise<RefreshTokenRecord[]>;

  cleanupExpiredTokens(): Promise<number>;

  getStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
  }>;
}
