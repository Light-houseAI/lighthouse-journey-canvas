import type { SuccessResponse } from './common';

// User data for auth responses
export interface AuthUser {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    interest: string | null;
    hasCompletedOnboarding: boolean;
    createdAt: string;
}

// Request DTOs
export interface SignUpDTO {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userName: string;
    interest?: string;
}

export interface SignInDTO {
    email: string;
    password: string;
}

export interface RefreshTokenDTO {
    refreshToken: string;
}

export interface LogoutDTO {
    refreshToken?: string;
}

export interface ProfileUpdateDTO {
    firstName?: string;
    lastName?: string;
    userName?: string;
    interest?: string;
    avatarUrl?: string;
}

// Request types (aliases for controller signatures)
export type SignUpInput = SignUpDTO;
export type SignInInput = SignInDTO;
export type RefreshTokenInput = RefreshTokenDTO;
export type LogoutInput = LogoutDTO;
export type ProfileUpdateInput = ProfileUpdateDTO;

// Response data types
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponseData extends TokenPair {
    user: AuthUser;
}

export interface TokenRefreshData {
    accessToken: string;
    refreshToken: string;
}

export interface LogoutData {
    message: string;
}

export interface RevokeTokensData {
    message: string;
    revokedCount: number;
}

export interface AuthProfileData {
    user: Omit<AuthUser, 'createdAt'>;
}

export interface DebugTokenData {
    userTokens: Array<{
        tokenId: string;
        createdAt: Date;
        lastUsedAt: Date | null;
        expiresAt: Date;
        ipAddress: string | null;
        userAgent: string;
    }>;
    stats: any;
}

// Response types
export type SignUpSuccessResponse = SuccessResponse<AuthResponseData>;
export type SignInSuccessResponse = SuccessResponse<AuthResponseData>;
export type RefreshTokenSuccessResponse = SuccessResponse<TokenRefreshData>;
export type LogoutSuccessResponse = SuccessResponse<LogoutData>;
export type RevokeAllTokensSuccessResponse = SuccessResponse<RevokeTokensData>;
export type UpdateProfileSuccessResponse = SuccessResponse<AuthProfileData>;
export type DebugTokensSuccessResponse = SuccessResponse<DebugTokenData>;