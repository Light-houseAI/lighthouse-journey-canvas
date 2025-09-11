import { Request, Response } from 'express';
import { z } from 'zod';
import {
  HierarchyService,
  type CreateNodeDTO,
  type NodeWithParentAndPermissions,
} from '../services/hierarchy-service';

import type { Logger } from '../core/logger';
import { insightCreateSchema, insightUpdateSchema } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';

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

// Standard Lighthouse API response format
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
    timestamp: string;
    count?: number;
    viewingUser?: string;
    [key: string]: any; // Allow additional meta fields
  };
}

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  HierarchyService,
  type CreateNodeDTO,
  type NodeWithParentAndPermissions,
} from '../services/hierarchy-service';

import type { Logger } from '../core/logger';
import { insightCreateSchema, insightUpdateSchema } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';
import { BaseController } from './base-controller';
import { ValidationError, NotFoundError } from '../core/errors';

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

      this.handleSuccess(res, created, 201);
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, node);
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, node);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid input data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, null);
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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
      const nodes = await this.hierarchyService.getAllNodesWithPermissions(user.id, username);

      // Apply client-side filtering for now
      let filteredNodes = nodes;
      if (queryData.type) {
        filteredNodes = nodes.filter((node) => node.type === queryData.type);
      }

      this.handleSuccess(res, filteredNodes, 200, { 
        total: filteredNodes.length,
        ...(username && { viewingUser: username }),
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, enrichedInsights, 200, { total: insights.length });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, enrichedInsight, 201);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid input data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, enrichedInsight);
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid input data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
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

      this.handleSuccess(res, null);
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
