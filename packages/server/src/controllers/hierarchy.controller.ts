import {
  careerInsightResponseSchema,
  createTimelineNodeRequestSchema,
  insightCreateSchema,
  insightUpdateSchema,
  NotFoundError,
  timelineNodeResponseSchema,
  timelineQuerySchema,
  updateTimelineNodeRequestSchema,
} from '@journey/schema';
import { formatDistanceToNow } from 'date-fns';
import { Request, Response } from 'express';
import { z } from 'zod';

import { HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import { HierarchyMapper } from '../mappers/hierarchy.mapper';
import {
  type CreateNodeDTO,
  HierarchyService,
} from '../services/hierarchy-service';
import { BaseController } from './base.controller.js';

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
    const user = this.getAuthenticatedUser(req);
    const validatedInput = createTimelineNodeRequestSchema.parse(req.body);

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

    const response = HierarchyMapper.toTimelineNodeResponse(created).withSchema(
      timelineNodeResponseSchema
    );
    res.status(HttpStatus.CREATED).json(response);
  }

  /**
   * GET /api/v2/timeline/nodes/:id - Get single node by ID
   */
  async getNodeById(req: Request, res: Response): Promise<void> {
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
  }

  /**
   * PATCH /api/v2/timeline/nodes/:id - Update node
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const user = this.getAuthenticatedUser(req);

    const validatedData = updateTimelineNodeRequestSchema.parse(req.body);

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
  }

  /**
   * DELETE /api/v2/timeline/nodes/:id - Delete node
   */
  async deleteNode(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const user = this.getAuthenticatedUser(req);

    this.logger.info('Deleting node', { nodeId: id, userId: user.id });

    const deleted = await this.hierarchyService.deleteNode(id, user.id);

    if (!deleted) {
      throw new NotFoundError('Node not found or access denied');
    }

    const response = HierarchyMapper.toNullResponse().withSchema(z.null());
    res.status(HttpStatus.OK).json(response);
  }

  /**
   * GET /api/v2/timeline/nodes - List user's nodes with optional filtering
   */
  async listNodes(req: Request, res: Response): Promise<void> {
    const user = this.getAuthenticatedUser(req);
    const queryData = timelineQuerySchema.parse(req.query);
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
  }

  // ============================================================================
  // INSIGHTS API METHODS
  // ============================================================================

  /**
   * GET /api/v2/timeline/nodes/:nodeId/insights - Get insights for a node
   */
  async getNodeInsights(req: Request, res: Response): Promise<void> {
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
  }

  /**
   * POST /api/v2/timeline/nodes/:nodeId/insights - Create insight for a node
   */
  async createInsight(req: Request, res: Response): Promise<void> {
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
  }

  /**
   * PUT /api/v2/timeline/insights/:insightId - Update an insight
   */
  async updateInsight(req: Request, res: Response): Promise<void> {
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
  }

  /**
   * DELETE /api/v2/timeline/insights/:insightId - Delete an insight
   */
  async deleteInsight(req: Request, res: Response): Promise<void> {
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
  }
}
