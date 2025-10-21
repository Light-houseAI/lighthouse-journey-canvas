/**
 * Mappers for Authentication API
 * Transform between service layer and controller DTOs
 */

import type {
  AuthResponse,
  TokenPair,
  User,
  UserProfile,
} from '@journey/schema';

import { MappedResponse } from '../../middleware/response-validation.middleware';
import type {
  DebugTokensResponseDto,
  RevokeAllTokensResponseDto,
  TokenInfoDto,
} from '../responses/auth.dto';

export class AuthMapper {
  /**
   * Map User entity to UserProfile (Zod-inferred type)
   */
  static toUserProfileDto(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
      createdAt: user.createdAt.toISOString(),
    };
  }

  /**
   * Map to AuthResponse (signup/signin)
   * Returns MappedResponse for fluent validation: .withSchema(authResponseSchema)
   */
  static toAuthResponseDto(
    accessToken: string,
    refreshToken: string,
    user: User
  ): MappedResponse<AuthResponse> {
    return new MappedResponse<AuthResponse>({
      accessToken,
      refreshToken,
      user: this.toUserProfileDto(user),
    });
  }

  /**
   * Map to TokenPair (refresh)
   * Returns MappedResponse for fluent validation: .withSchema(tokenPairSchema)
   */
  static toTokenPairDto(
    accessToken: string,
    refreshToken: string
  ): MappedResponse<TokenPair> {
    return new MappedResponse<TokenPair>({
      accessToken,
      refreshToken,
    });
  }

  /**
   * Map to UserProfile
   * Returns MappedResponse for fluent validation: .withSchema(userProfileSchema)
   */
  static toProfileUpdateResponseDto(user: User): MappedResponse<UserProfile> {
    return new MappedResponse<UserProfile>(this.toUserProfileDto(user));
  }

  /**
   * Map to RevokeAllTokensResponseDto
   */
  static toRevokeAllTokensResponseDto(
    revokedCount: number
  ): RevokeAllTokensResponseDto {
    return {
      message: `Revoked ${revokedCount} refresh tokens`,
      revokedCount,
    };
  }

  /**
   * Map to DebugTokensResponseDto
   */
  static toDebugTokensResponseDto(
    tokens: any[],
    stats: any
  ): DebugTokensResponseDto {
    return {
      userTokens: tokens.map(
        (token): TokenInfoDto => ({
          tokenId: token.tokenId,
          createdAt: token.createdAt,
          lastUsedAt: token.lastUsedAt ?? null,
          expiresAt: token.expiresAt,
          ipAddress: token.ipAddress ?? null,
          userAgent: token.userAgent?.substring(0, 50) + '...',
        })
      ),
      stats,
    };
  }

  /**
   * Map to LogoutResponseDto
   */
  static toLogoutResponseDto(message: string = 'Logged out successfully') {
    return {
      message,
    };
  }
}
