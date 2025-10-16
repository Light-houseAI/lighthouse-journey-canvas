import {
  insightCreateSchema,
  insightUpdateSchema,
  TimelineNodeType,
  timelineNodeMetaSchema,
  validateNodeMeta,
  safeValidateNodeMeta,
  type TimelineNodeMetaType,
} from '@journey/schema';
import { formatDistanceToNow } from 'date-fns';
import { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger';
import {
  type CreateNodeDTO,
  HierarchyService
} from '../services/hierarchy-service';

/**
 * Controller-level validation schemas
 * These validate incoming requests before passing to service layer
 */

// Create node request with strongly typed metadata
const createNodeRequestSchema = z.object({
  type: z.nativeEnum(TimelineNodeType),
  parentId: z.string().uuid().optional().nullable(),
  meta: timelineNodeMetaSchema,
});

// Update node request with validated metadata
const updateNodeRequestSchema = z.object({
  meta: timelineNodeMetaSchema.optional(),
});

// Query parameters schema
const querySchema = z.object({
  maxDepth: z.coerce.number().int().min(1).max(20).default(10),
  includeChildren: z.coerce.boolean().default(false),
  type: z.nativeEnum(TimelineNodeType).optional(),
});


import { BaseController } from './base-controller.js';
import { ValidationError, NotFoundError, AuthenticationError } from '../core/errors';
import { ErrorCode } from '../core/api-responses.js';

export class HierarchyController extends BaseController {
  private hierarchyService: HierarchyService;
  private logger: Logger;

  /**
   * Maps internal node representation to API response
   * Adds additional fields needed by clients
   */
  private mapNodeToApiResponse(node: any): any {
    // Add any response mapping/transformation here
    // For now, return as-is since service already returns proper format
    return node;
  }

  constructor({
    hierarchyService,
    logger,
  }: {
    hierarchyService: HierarchyService;
    logger: Logger;
  }) {
    super();
    this.hierarchyService = hierarchyService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/timeline/nodes - Create a new timeline node
   * Controller validates request, service receives typed data
   */
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Controller-level validation with strongly typed schema
      const validationResult = createNodeRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        this.error(res, new ValidationError('Invalid input data', validationResult.error.errors), req);
        return;
      }

      const validatedInput = validationResult.data;

      this.logger.info('Creating timeline node', {
        userId: user.id,
        type: validatedInput.type,
        nodeType: validatedInput.meta.nodeType,
        hasParent: !!validatedInput.parentId,
      });

      // Pass validated, strongly typed data to service
      // Service doesn't need to validate again
      const dto: CreateNodeDTO = {
        type: validatedInput.type,
        parentId: validatedInput.parentId || null,
        meta: validatedInput.meta as TimelineNodeMetaType,
      };

      const created = await this.hierarchyService.createNode(dto, user.id);

      // Map service response to API response if needed
      const response = this.mapNodeToApiResponse(created);

      this.created(res, response, req);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        // Log service errors
        this.logger.error('Service error in createNode', error instanceof Error ? error : new Error('Unknown error'));
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req, ErrorCode.DATABASE_ERROR);
      }
    }
  }

  /**
   * GET /api/v2/timeline/nodes/:id - Get single node by ID
   */
  async getNodeById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = this.getAuthenticatedUser(req);

      this.logger.info('Getting node by ID', { nodeId: id, userId: user.id });

      const node = await this.hierarchyService.getNodeById(id, user.id);

      if (!node) {
        throw new NotFoundError('Node not found or access denied');
      }

      this.success(res, node, req);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        // Log controller errors
        this.logger.error('Controller error in getNodeById', error instanceof Error ? error : new Error('Unknown error'));
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * PATCH /api/v2/timeline/nodes/:id - Update node
   * Validates metadata matches node type before passing to service
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = this.getAuthenticatedUser(req);

      // Validate request with strongly typed schema
      const validationResult = updateNodeRequestSchema.safeParse(req.body);

      if (!validationResult.success) {
        this.error(res, new ValidationError('Invalid update data', validationResult.error.errors), req);
        return;
      }

      const validatedData = validationResult.data;

      this.logger.info('Updating node', {
        nodeId: id,
        userId: user.id,
        hasMetaUpdate: !!validatedData.meta,
      });

      const node = await this.hierarchyService.updateNode(
        id,
        validatedData,
        user.id
      );

      if (!node) {
        throw new NotFoundError('Node not found or access denied');
      }

      this.success(res, node, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid input data', error.errors), req);
      } else if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * DELETE /api/v2/timeline/nodes/:id - Delete node
   */
  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = this.getAuthenticatedUser(req);

      this.logger.info('Deleting node', { nodeId: id, userId: user.id });

      const deleted = await this.hierarchyService.deleteNode(id, user.id);

      if (!deleted) {
        throw new NotFoundError('Node not found or access denied');
      }

      this.success(res, null, req);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * GET /api/v2/timeline/nodes - List user's nodes with optional filtering
   */
  async listNodes(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const queryData = querySchema.parse(req.query);
      const username = req.query.username as string | undefined;

      this.logger.info('Listing nodes', {
        userId: user.id,
        username,
        filters: queryData,
        isViewingOtherUser: !!username,
      });

      // Use the enhanced getAllNodesWithPermissions method for server-driven permissions
      const nodes = await this.hierarchyService.getAllNodesWithPermissions(user.id, username as any);

      // Apply client-side filtering for now
      let filteredNodes = nodes;
      if (queryData.type) {
        filteredNodes = nodes.filter((node) => node.type === queryData.type);
      }

      this.success(res, filteredNodes, req, {
        total: filteredNodes.length,
        ...(username && { viewingUser: username }),
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  // ============================================================================
  // INSIGHTS API METHODS
  // ============================================================================

  /**
   * GET /api/v2/timeline/nodes/:nodeId/insights - Get insights for a node
   */
  async getNodeInsights(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const user = this.getAuthenticatedUser(req);

      this.logger.info('Getting node insights', { nodeId, userId: user.id });

      const insights = await this.hierarchyService.getNodeInsights(
        nodeId,
        user.id
      );

      const enrichedInsights = insights.map((insight) => ({
        ...insight,
        timeAgo: formatDistanceToNow(new Date(insight.createdAt), {
          addSuffix: true,
        }),
      }));

      this.success(res, enrichedInsights, req, { total: insights.length });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * POST /api/v2/timeline/nodes/:nodeId/insights - Create insight for a node
   */
  async createInsight(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const user = this.getAuthenticatedUser(req);

      const validatedData = insightCreateSchema.parse(req.body);

      this.logger.info('Creating insight', {
        nodeId,
        userId: user.id,
        descriptionLength: validatedData.description.length,
        resourceCount: validatedData.resources.length,
      });

      const insight = await this.hierarchyService.createInsight(
        nodeId,
        validatedData,
        user.id
      );

      const enrichedInsight = {
        ...insight,
        timeAgo: 'just now',
      };

      this.created(res, enrichedInsight, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid input data', error.errors), req);
      } else if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * PUT /api/v2/timeline/insights/:insightId - Update an insight
   */
  async updateInsight(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const user = this.getAuthenticatedUser(req);

      const validatedData = insightUpdateSchema.parse(req.body);

      this.logger.info('Updating insight', { insightId, userId: user.id });

      const insight = await this.hierarchyService.updateInsight(
        insightId,
        validatedData,
        user.id
      );

      if (!insight) {
        throw new NotFoundError('Insight not found');
      }

      const enrichedInsight = {
        ...insight,
        timeAgo: formatDistanceToNow(new Date(insight.updatedAt), {
          addSuffix: true,
        }),
      };

      this.success(res, enrichedInsight, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.error(res, new ValidationError('Invalid input data', error.errors), req);
      } else if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }

  /**
   * DELETE /api/v2/timeline/insights/:insightId - Delete an insight
   */
  async deleteInsight(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const user = this.getAuthenticatedUser(req);

      this.logger.info('Deleting insight', { insightId, userId: user.id });

      const deleted = await this.hierarchyService.deleteInsight(
        insightId,
        user.id
      );

      if (!deleted) {
        throw new NotFoundError('Insight not found');
      }

      this.success(res, null, req);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.error(res, error, req);
      } else {
        this.error(res, error instanceof Error ? error : new Error('Unknown error'), req);
      }
    }
  }
}
