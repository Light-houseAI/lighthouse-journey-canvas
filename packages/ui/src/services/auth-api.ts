/**
 * Auth API Service
 * Handles communication with the authentication API endpoints
 */

import type {
  AuthResponse,
  LogoutResponse,
  RevokeAllTokensResponse,
  TokenPair,
  UserProfile,
} from '@journey/schema';
import type { ApiErrorResponse, ApiSuccessResponse } from '@journey/schema';
import {
  profileUpdateRequestSchema,
  refreshTokenRequestSchema,
  signInRequestSchema,
  signUpRequestSchema,
} from '@journey/schema';

import { httpClient } from './http-client';
import { tokenManager } from './token-manager';

// http-client now unwraps responses and throws errors, so services receive just the data
export type SignupResponse = AuthResponse;
export type SigninResponse = AuthResponse;
export type RefreshTokenResponse = TokenPair;
export type LogoutResponseType =
  | ApiSuccessResponse<LogoutResponse>
  | ApiErrorResponse;
export type RevokeAllTokensResponseType =
  | ApiSuccessResponse<RevokeAllTokensResponse>
  | ApiErrorResponse;
// http-client unwraps responses, returns just UserProfile
export type UpdateProfileResponse = UserProfile;

/**
 * Sign up a new user
 * Validates request using schema
 */
export async function signup(data: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
}): Promise<SignupResponse> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = signUpRequestSchema.parse(data);

  return httpClient.request<SignupResponse>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
    skipAuth: true,
  });
}

/**
 * Sign up a new user with an invite code
 * Used for waitlist users who received an invite code
 */
export async function signupWithCode(data: {
  code: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<SignupResponse> {
  return httpClient.request<SignupResponse>('/api/auth/signup-with-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    skipAuth: true,
  });
}

/**
 * Sign in an existing user
 * Validates request using schema
 */
export async function signin(data: {
  email: string;
  password: string;
}): Promise<SigninResponse> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = signInRequestSchema.parse(data);

  return httpClient.request<SigninResponse>('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
    skipAuth: true,
  });
}

/**
 * Refresh access token using refresh token
 * Validates request using schema
 */
export async function refreshToken(): Promise<TokenPair> {
  const refreshTokenValue = tokenManager.getRefreshToken();

  if (!refreshTokenValue) {
    throw new Error('No refresh token available');
  }

  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = refreshTokenRequestSchema.parse({
    refreshToken: refreshTokenValue,
  });

  return httpClient.request<RefreshTokenResponse>('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
    skipAuth: true,
  });
}

/**
 * Proactively refresh token if needed
 * Uses httpClient's built-in logic
 */
export async function refreshTokenIfNeeded(): Promise<boolean> {
  return httpClient.refreshTokenIfNeeded();
}

/**
 * Logout current user
 */
export async function logout(): Promise<LogoutResponseType> {
  const refreshTokenValue = tokenManager.getRefreshToken();

  return httpClient.request<LogoutResponseType>('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
    skipRefresh: true,
  });
}

/**
 * Revoke all tokens for the current user
 */
export async function revokeAllTokens(): Promise<RevokeAllTokensResponseType> {
  return httpClient.request<RevokeAllTokensResponseType>(
    '/api/auth/tokens/revoke-all',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Get current user profile
 * Returns unwrapped UserProfile directly
 */
export async function getCurrentUser(): Promise<UserProfile> {
  const response = await httpClient.request<{ user: UserProfile }>(
    '/api/auth/me',
    {
      method: 'GET',
    }
  );
  return response.user;
}

/**
 * Update user profile
 * Returns unwrapped UserProfile directly
 */
export async function updateProfile(data: {
  firstName?: string;
  lastName?: string;
  userName?: string;
  interest?: string;
}): Promise<UserProfile> {
  // Validate request (let Zod errors bubble to error boundary)
  const validatedData = profileUpdateRequestSchema.parse(data);

  const response = await httpClient.request<{ user: UserProfile }>(
    '/api/auth/profile',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedData),
    }
  );
  return response.user;
}
