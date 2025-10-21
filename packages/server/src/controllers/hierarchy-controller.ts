import { insightCreateSchema, insightUpdateSchema } from '@journey/schema';
import { formatDistanceToNow } from 'date-fns';
import { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger';
import {
  type CreateNodeDTO,
  HierarchyService,
} from '../services/hierarchy-service';

// Request/Response schemas following Lighthouse patterns
const createNodeRequestSchema = z.object({
  type: z.enum([
    'job',
    'education',
    'project',
    'event',
    'action',
    'careerTransition',
  ]),
  parentId: z.string().uuid().optional().nullable(),
  meta: z
    .record(z.unknown())
    .refine((meta) => meta && Object.keys(meta).length > 0, {
      message: 'Meta should not be empty object',
    }),
});

const updateNodeRequestSchema = z.object({
  meta: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  maxDepth: z.coerce.number().int().min(1).max(20).default(10),
  includeChildren: z.coerce.boolean().default(false),
  type: z
    .enum([
      'job',
      'education',
      'project',
      'event',
      'action',
      'careerTransition',
    ])
    .optional(),
});

import {
  careerInsightResponseSchema,
  timelineNodeResponseSchema,
} from '@journey/schema';
import { NotFoundError, UnauthorizedError } from '@journey/schema';

import { type ApiErrorResponse, ErrorCode, HttpStatus } from '../core';
import { HierarchyMapper } from '../dtos/mappers/hierarchy.mapper';
import { BaseController } from './base-controller.js';

export class HierarchyController extends BaseController {
  private hierarchyService: HierarchyService;
  private logger: Logger;

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
   */
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const validatedInput = createNodeRequestSchema.parse(req.body);

      this.logger.info('Creating timeline node', {
        userId: user.id,
        type: validatedInput.type,
        title: validatedInput.meta.title,
        hasParent: !!validatedInput.parentId,
      });

      const dto: CreateNodeDTO = {
        type: validatedInput.type,
        parentId: validatedInput.parentId || null,
        meta: validatedInput.meta,
      };

      const created = await this.hierarchyService.createNode(dto, user.id);

      const response = HierarchyMapper.toTimelineNodeResponse(
        created
      ).withSchema(timelineNodeResponseSchema);
      res.status(HttpStatus.CREATED).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input data',
            details: error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      // Log service errors
      this.logger.error(
        'Service error in createNode',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toTimelineNodeResponse(node).withSchema(
        timelineNodeResponseSchema
      );
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (error instanceof NotFoundError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        res.status(HttpStatus.NOT_FOUND).json(errorResponse);
        return;
      }

      // Log controller errors
      this.logger.error(
        'Controller error in getNodeById',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * PATCH /api/v2/timeline/nodes/:id - Update node
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = this.getAuthenticatedUser(req);

      const validatedData = updateNodeRequestSchema.parse(req.body);

      this.logger.info('Updating node', {
        nodeId: id,
        userId: user.id,
        changes: Object.keys(validatedData),
      });

      const node = await this.hierarchyService.updateNode(
        id,
        validatedData,
        user.id
      );

      if (!node) {
        throw new NotFoundError('Node not found or access denied');
      }

      const response = HierarchyMapper.toTimelineNodeResponse(node).withSchema(
        timelineNodeResponseSchema
      );
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input data',
            details: error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (error instanceof NotFoundError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        res.status(HttpStatus.NOT_FOUND).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in updateNode',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toNullResponse().withSchema(z.null());
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (error instanceof NotFoundError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        res.status(HttpStatus.NOT_FOUND).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in deleteNode',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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
      const nodes = await this.hierarchyService.getAllNodesWithPermissions(
        user.id,
        username as any
      );

      // Apply client-side filtering for now
      let filteredNodes = nodes;
      if (queryData.type) {
        filteredNodes = nodes.filter((node) => node.type === queryData.type);
      }

      const response = HierarchyMapper.toTimelineNodesResponse(
        filteredNodes
      ).withSchema(z.array(timelineNodeResponseSchema));
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid query parameters',
            details: error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in listNodes',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toInsightsResponse(
        enrichedInsights
      ).withSchema(z.array(careerInsightResponseSchema));
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in getNodeInsights',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toInsightResponse(
        enrichedInsight
      ).withSchema(careerInsightResponseSchema);
      res.status(HttpStatus.CREATED).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input data',
            details: error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in createInsight',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toInsightResponse(
        enrichedInsight
      ).withSchema(careerInsightResponseSchema);
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid input data',
            details: error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (error instanceof NotFoundError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        res.status(HttpStatus.NOT_FOUND).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in updateInsight',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
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

      const response = HierarchyMapper.toNullResponse().withSchema(z.null());
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.AUTHENTICATION_REQUIRED,
            message: 'Authentication required',
          },
        };
        res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (error instanceof NotFoundError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        res.status(HttpStatus.NOT_FOUND).json(errorResponse);
        return;
      }

      this.logger.error(
        'Error in deleteInsight',
        error instanceof Error ? error : new Error('Unknown error')
      );
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}
