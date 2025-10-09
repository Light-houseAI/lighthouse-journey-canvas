/**
 * HierarchyController
 * API endpoints for timeline node hierarchy operations including CRUD and insights
 */

import { HttpStatusCode,insightCreateSchema, insightUpdateSchema } from '@journey/schema';
import { formatDistanceToNow } from 'date-fns';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { AuthenticationError, NotFoundError, ValidationError } from '../core/errors';
import type { Logger } from '../core/logger';
import {
  type CreateNodeDTO,
  HierarchyService
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

export class HierarchyController {
  private hierarchyService: HierarchyService;
  private logger: Logger;

  constructor({
    hierarchyService,
    logger,
  }: {
    hierarchyService: HierarchyService;
    logger: Logger;
  }) {
    this.hierarchyService = hierarchyService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/timeline/nodes - Create a new timeline node
   * @summary Create a new timeline node
   * @tags Timeline
   * @description Creates a new timeline node of specified type (job, education, project, etc.) with metadata. Nodes can be hierarchical with optional parent relationships.
   * @security BearerAuth
   * @param {CreateNodeRequest} request.body.required - Node creation data including type, optional parentId, and metadata
   * @return {CreateNodeSuccessResponse} 201 - Node created successfully
   * @return {ValidationErrorResponse} 400 - Invalid request data
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async createNode(req: Request, res: Response) {
    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = createNodeRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid input data', validationResult.error.errors);
    }

    const validatedInput = validationResult.data;

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

    res.status(HttpStatusCode.CREATED).json({
      success: true,
      data: created,
    });
  }

  /**
   * GET /api/v2/timeline/nodes/:id - Get single node by ID
   * @summary Get a timeline node by ID
   * @tags Timeline
   * @description Retrieves a single timeline node by its ID. Returns 404 if node doesn't exist or user lacks access.
   * @security BearerAuth
   * @param {string} id.path.required - Node UUID
   * @return {GetNodeSuccessResponse} 200 - Node retrieved successfully
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {NotFoundErrorResponse} 404 - Node not found or access denied
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getNodeById(req: Request, res: Response) {
    const { id } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    this.logger.info('Getting node by ID', { nodeId: id, userId: user.id });

    const node = await this.hierarchyService.getNodeById(id, user.id);

    if (!node) {
      throw new NotFoundError('Node not found or access denied');
    }

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: node,
    });
  }

  /**
   * PATCH /api/v2/timeline/nodes/:id - Update node
   * @summary Update a timeline node
   * @tags Timeline
   * @description Updates a timeline node's metadata. Only the node owner can update it.
   * @security BearerAuth
   * @param {string} id.path.required - Node UUID
   * @param {UpdateNodeRequest} request.body.required - Updated node data
   * @return {UpdateNodeSuccessResponse} 200 - Node updated successfully
   * @return {ValidationErrorResponse} 400 - Invalid request data
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {NotFoundErrorResponse} 404 - Node not found or access denied
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updateNode(req: Request, res: Response) {
    const { id } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = updateNodeRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid input data', validationResult.error.errors);
    }

    const validatedData = validationResult.data;

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

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: node,
    });
  }

  /**
   * DELETE /api/v2/timeline/nodes/:id - Delete node
   * @summary Delete a timeline node
   * @tags Timeline
   * @description Deletes a timeline node and all its descendants. Only the node owner can delete it.
   * @security BearerAuth
   * @param {string} id.path.required - Node UUID
   * @return {DeleteNodeSuccessResponse} 200 - Node deleted successfully
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {NotFoundErrorResponse} 404 - Node not found or access denied
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async deleteNode(req: Request, res: Response) {
    const { id } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    this.logger.info('Deleting node', { nodeId: id, userId: user.id });

    const deleted = await this.hierarchyService.deleteNode(id, user.id);

    if (!deleted) {
      throw new NotFoundError('Node not found or access denied');
    }

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: null,
    });
  }

  /**
   * GET /api/v2/timeline/nodes - List user's nodes with optional filtering
   * @summary List timeline nodes
   * @tags Timeline
   * @description Lists all timeline nodes for the authenticated user or a specified username. Supports filtering by type and depth.
   * @security BearerAuth
   * @param {string} username.query - Optional username to view another user's timeline
   * @param {number} maxDepth.query - Maximum depth for hierarchical retrieval (1-20, default 10)
   * @param {boolean} includeChildren.query - Include child nodes (default false)
   * @param {string} type.query - Filter by node type (job, education, project, event, action, careerTransition)
   * @return {ListNodesSuccessResponse} 200 - Nodes retrieved successfully
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async listNodes(req: Request, res: Response) {
    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate query parameters - throws ValidationError on failure
    const validationResult = querySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', validationResult.error.errors);
    }

    const queryData = validationResult.data;
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

    const response = {
      success: true,
      data: filteredNodes,
      meta: {
        total: filteredNodes.length,
        ...(username && { viewingUser: username }),
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  // ============================================================================
  // INSIGHTS API METHODS
  // ============================================================================

  /**
   * GET /api/v2/timeline/nodes/:nodeId/insights - Get insights for a node
   * @summary Get node insights
   * @tags Timeline Insights
   * @description Retrieves all insights associated with a timeline node. Insights include descriptions, resources, and timestamps.
   * @security BearerAuth
   * @param {string} nodeId.path.required - Node UUID
   * @return {GetInsightsSuccessResponse} 200 - Insights retrieved successfully
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getNodeInsights(req: Request, res: Response) {
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

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

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: enrichedInsights,
      meta: { total: insights.length },
    });
  }

  /**
   * POST /api/v2/timeline/nodes/:nodeId/insights - Create insight for a node
   * @summary Create a new insight
   * @tags Timeline Insights
   * @description Creates a new insight for a timeline node. Insights capture learnings, reflections, and resources.
   * @security BearerAuth
   * @param {string} nodeId.path.required - Node UUID
   * @param {CreateInsightRequest} request.body.required - Insight data including description and resources
   * @return {CreateInsightSuccessResponse} 201 - Insight created successfully
   * @return {ValidationErrorResponse} 400 - Invalid request data
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async createInsight(req: Request, res: Response) {
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = insightCreateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid input data', validationResult.error.errors);
    }

    const validatedData = validationResult.data;

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

    res.status(HttpStatusCode.CREATED).json({
      success: true,
      data: enrichedInsight,
    });
  }

  /**
   * PUT /api/v2/timeline/insights/:insightId - Update an insight
   * @summary Update an existing insight
   * @tags Timeline Insights
   * @description Updates an existing insight's description or resources. Only the insight owner can update it.
   * @security BearerAuth
   * @param {string} insightId.path.required - Insight UUID
   * @param {UpdateInsightRequest} request.body.required - Updated insight data
   * @return {UpdateInsightSuccessResponse} 200 - Insight updated successfully
   * @return {ValidationErrorResponse} 400 - Invalid request data
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {NotFoundErrorResponse} 404 - Insight not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updateInsight(req: Request, res: Response) {
    const { insightId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = insightUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid input data', validationResult.error.errors);
    }

    const validatedData = validationResult.data;

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

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: enrichedInsight,
    });
  }

  /**
   * DELETE /api/v2/timeline/insights/:insightId - Delete an insight
   * @summary Delete an insight
   * @tags Timeline Insights
   * @description Deletes an insight. Only the insight owner can delete it.
   * @security BearerAuth
   * @param {string} insightId.path.required - Insight UUID
   * @return {DeleteInsightSuccessResponse} 200 - Insight deleted successfully
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {NotFoundErrorResponse} 404 - Insight not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async deleteInsight(req: Request, res: Response) {
    const { insightId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    this.logger.info('Deleting insight', { insightId, userId: user.id });

    const deleted = await this.hierarchyService.deleteInsight(
      insightId,
      user.id
    );

    if (!deleted) {
      throw new NotFoundError('Insight not found');
    }

    res.status(HttpStatusCode.OK).json({
      success: true,
      data: null,
    });
  }
}
