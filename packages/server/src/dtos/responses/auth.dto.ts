/**
 * Response DTOs for Authentication API
 */

/**
 * User profile data
 */
export interface UserProfileDto {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  userName: string | null;
  interest: string | null;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

/**
 * Token pair
 */
export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth response with tokens and user profile
 */
export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileDto;
}

/**
 * Token info for debugging
 */
export interface TokenInfoDto {
  tokenId: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Logout response
 */
export interface LogoutResponseDto {
  message: string;
}

/**
 * Revoke all tokens response
 */
export interface RevokeAllTokensResponseDto {
  message: string;
  revokedCount: number;
}

/**
 * Profile update response
 */
export interface ProfileUpdateResponseDto {
  user: UserProfileDto;
}

/**
 * Debug tokens response
 */
export interface DebugTokensResponseDto {
  userTokens: TokenInfoDto[];
  stats: any;
}
