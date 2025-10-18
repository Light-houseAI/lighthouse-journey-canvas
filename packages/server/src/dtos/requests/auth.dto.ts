/**
 * Request DTOs for Authentication API
 * Re-exports existing Zod schemas from @journey/schema
 */

import {
  type ProfileUpdateInput,
  profileUpdateSchema,
  type SignInInput,
  signInSchema,
  type SignUpInput,
  signUpSchema,
} from '@journey/schema';
import { z } from 'zod';

/**
 * POST /api/auth/signup
 */
export { signUpSchema };
export type SignUpRequestDto = SignUpInput;

/**
 * POST /api/auth/signin
 */
export { signInSchema };
export type SignInRequestDto = SignInInput;

/**
 * POST /api/auth/refresh
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenRequestDto = z.infer<typeof refreshTokenSchema>;

/**
 * POST /api/auth/logout
 */
export const logoutRequestSchema = z.object({
  refreshToken: z.string().optional(),
});
export type LogoutRequestDto = z.infer<typeof logoutRequestSchema>;

/**
 * PATCH /api/auth/profile
 */
export { profileUpdateSchema };
export type ProfileUpdateRequestDto = ProfileUpdateInput;
