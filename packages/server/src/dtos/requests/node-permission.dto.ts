/**
 * Request DTOs for Node Permission API
 */

import { z } from 'zod';

/**
 * POST /api/nodes/{nodeId}/permissions - Create permission
 */
export const createNodePermissionSchema = z.object({
  userId: z.number().int().positive(),
  permission: z.enum(['read', 'write', 'admin']),
});

export type CreateNodePermissionDto = z.infer<typeof createNodePermissionSchema>;

/**
 * PUT /api/nodes/{nodeId}/permissions/{userId} - Update permission
 */
export const updateNodePermissionSchema = z.object({
  permission: z.enum(['read', 'write', 'admin']),
});

export type UpdateNodePermissionDto = z.infer<typeof updateNodePermissionSchema>;

/**
 * Path params
 */
export const nodePermissionParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format for nodeId'),
  userId: z.string().regex(/^\d+$/, 'userId must be a valid number'),
});

export type NodePermissionParamsDto = z.infer<typeof nodePermissionParamsSchema>;
