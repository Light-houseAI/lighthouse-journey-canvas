/**
 * Request DTOs for Updates API
 * Re-exports existing Zod schemas from @journey/schema
 */

import {
  createUpdateRequestSchema,
  paginationQuerySchema,
  updateUpdateRequestSchema,
  type CreateUpdateInput,
  type PaginationQuery,
  type UpdateUpdateInput,
} from '@journey/schema';
import { z } from 'zod';

/**
 * POST /api/nodes/{nodeId}/updates
 */
export { createUpdateRequestSchema };
export type CreateUpdateRequestDto = CreateUpdateInput;

/**
 * GET /api/nodes/{nodeId}/updates - Query params
 */
export { paginationQuerySchema };
export type PaginationQueryDto = PaginationQuery;

/**
 * PUT /api/nodes/{nodeId}/updates/{updateId}
 */
export { updateUpdateRequestSchema };
export type UpdateUpdateRequestDto = UpdateUpdateInput;

/**
 * Path params for update endpoints
 */
export const updateParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format for nodeId'),
  updateId: z.string().uuid('Invalid UUID format for updateId'),
});

export type UpdateParamsDto = z.infer<typeof updateParamsSchema>;

export const nodeIdParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format for nodeId'),
});

export type NodeIdParamsDto = z.infer<typeof nodeIdParamsSchema>;
