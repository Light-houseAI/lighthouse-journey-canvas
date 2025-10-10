/**
 * Request DTOs for Experience Matches API
 * Uses existing Zod schemas from @journey/schema for validation
 */

import { z } from 'zod';

/**
 * GET /api/v2/experience/{nodeId}/matches - Params
 */
export const getExperienceMatchesParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format for nodeId'),
});

export type GetExperienceMatchesParamsDto = z.infer<typeof getExperienceMatchesParamsSchema>;

/**
 * GET /api/v2/experience/{nodeId}/matches - Query
 */
export const getExperienceMatchesQuerySchema = z.object({
  forceRefresh: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export type GetExperienceMatchesQueryDto = z.infer<typeof getExperienceMatchesQuerySchema>;
