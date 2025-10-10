/**
 * Mappers for Authentication API
 * Transform between service layer and controller DTOs
 */

import type { User } from '@journey/schema';
import type {
  AuthResponseDto,
  DebugTokensResponseDto,
  ProfileUpdateResponseDto,
  RevokeAllTokensResponseDto,
  TokenInfoDto,
  TokenPairDto,
  UserProfileDto,
} from '../responses/auth.dto';

export class AuthMapper {
  /**
   * Map User entity to UserProfileDto
   */
  static toUserProfileDto(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Map to AuthResponseDto (signup/signin)
   */
  static toAuthResponseDto(
    accessToken: string,
    refreshToken: string,
    user: User
  ): AuthResponseDto {
    return {
      accessToken,
      refreshToken,
      user: this.toUserProfileDto(user),
    };
  }

  /**
   * Map to TokenPairDto (refresh)
   */
  static toTokenPairDto(accessToken: string, refreshToken: string): TokenPairDto {
    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Map to ProfileUpdateResponseDto
   */
  static toProfileUpdateResponseDto(user: User): ProfileUpdateResponseDto {
    return {
      user: this.toUserProfileDto(user),
    };
  }

  /**
   * Map to RevokeAllTokensResponseDto
   */
  static toRevokeAllTokensResponseDto(revokedCount: number): RevokeAllTokensResponseDto {
    return {
      message: `Revoked ${revokedCount} refresh tokens`,
      revokedCount,
    };
  }

  /**
   * Map to DebugTokensResponseDto
   */
  static toDebugTokensResponseDto(tokens: any[], stats: any): DebugTokensResponseDto {
    return {
      userTokens: tokens.map((token): TokenInfoDto => ({
        tokenId: token.tokenId,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        expiresAt: token.expiresAt,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent?.substring(0, 50) + '...',
      })),
      stats,
    };
  }
}
