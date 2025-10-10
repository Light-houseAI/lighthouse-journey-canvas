/**
 * Request DTOs for User API
 * Re-exports existing Zod schemas from @journey/schema
 */

import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from '@journey/schema';
import { z } from 'zod';

/**
 * PATCH /api/users/{userId}
 */
export { profileUpdateSchema };
export type UserUpdateRequestDto = ProfileUpdateInput;

/**
 * Path params
 */
export const userIdParamsSchema = z.object({
  userId: z.string().regex(/^\d+$/, 'userId must be a valid number'),
});

export type UserIdParamsDto = z.infer<typeof userIdParamsSchema>;
