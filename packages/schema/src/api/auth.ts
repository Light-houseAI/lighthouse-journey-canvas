import type { SuccessResponse } from './common';
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
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export interface SignUpDTO {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    userName: string;
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
    hasCompletedOnboarding?: boolean;
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
export type SignUpSuccessResponse = SuccessResponse<AuthResponseData>;
export type SignInSuccessResponse = SuccessResponse<AuthResponseData>;
export type RefreshTokenSuccessResponse = SuccessResponse<TokenRefreshData>;
export type LogoutSuccessResponse = SuccessResponse<LogoutData>;
export type RevokeTokensSuccessResponse = SuccessResponse<RevokeTokensData>;
export type ProfileUpdateSuccessResponse = SuccessResponse<AuthProfileData>;
export type DebugTokenSuccessResponse = SuccessResponse<DebugTokenData>;
//# sourceMappingURL=auth.d.ts.map