import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { HierarchyService, type CreateNodeDTO, type UpdateNodeDTO } from '../services/hierarchy-service';
import { ValidationService } from '../services/validation-service';
import { CycleDetectionService } from '../services/cycle-detection-service';
import { HIERARCHY_TOKENS } from '../di/tokens';
import type { Logger } from '../../core/logger';
import { insightCreateSchema, insightUpdateSchema, NodeInsight } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';

// Request/Response schemas following Lighthouse patterns
const createNodeRequestSchema = z.object({
  type: z.enum(['job', 'education', 'project', 'event', 'action', 'careerTransition']),
  parentId: z.string().uuid().optional().nullable(),
  meta: z.record(z.unknown()).refine(
    (meta) => meta && Object.keys(meta).length > 0,
    { message: "Meta should not be empty object" }
  )
});

const updateNodeRequestSchema = z.object({
  meta: z.record(z.unknown()).optional()
});

const querySchema = z.object({
  maxDepth: z.coerce.number().int().min(1).max(20).default(10),
  includeChildren: z.coerce.boolean().default(false),
  type: z.enum(['job', 'education', 'project', 'event', 'action', 'careerTransition']).optional()
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
  };
}

@injectable()
export class HierarchyController {
  constructor(
    @inject(HIERARCHY_TOKENS.HIERARCHY_SERVICE) private hierarchyService: HierarchyService,
    @inject(HIERARCHY_TOKENS.VALIDATION_SERVICE) private validation: ValidationService,
    @inject(HIERARCHY_TOKENS.CYCLE_DETECTION_SERVICE) private cycleDetection: CycleDetectionService,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}

  /**
   * POST /api/v2/timeline/nodes - Create a new timeline node
   */
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const validatedInput = createNodeRequestSchema.parse(req.body);

      this.logger.info('Creating timeline node', {
        userId,
        type: validatedInput.type,
        title: validatedInput.meta.title,
        hasParent: !!validatedInput.parentId
      });

      const dto: CreateNodeDTO = {
        type: validatedInput.type,
        parentId: validatedInput.parentId || null,
        meta: validatedInput.meta
      };

      const created = await this.hierarchyService.createNode(dto, userId);

      const response: ApiResponse = {
        success: true,
        data: created,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(201).json(response);

    } catch (error) {
      this.handleError(error, res, 'CREATE_NODE_ERROR');
    }
  }

  /**
   * GET /api/v2/timeline/nodes/:id - Get node by ID
   */
  async getNodeById(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const nodeId = req.params.id;

      if (!nodeId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_NODE_ID',
            message: 'Node ID is required'
          }
        });
        return;
      }

      const node = await this.hierarchyService.getNodeById(nodeId, userId);

      if (!node) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NODE_NOT_FOUND',
            message: 'Timeline node not found'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: node,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'GET_NODE_ERROR');
    }
  }

  /**
   * PATCH /api/v2/timeline/nodes/:id - Update node
   */
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const nodeId = req.params.id;
      const validatedInput = updateNodeRequestSchema.parse(req.body);

      this.logger.info('Updating timeline node', { userId, nodeId, changes: validatedInput });

      const dto: UpdateNodeDTO = {
        ...(validatedInput.label && { label: validatedInput.label }),
        ...(validatedInput.meta && { meta: validatedInput.meta })
      };

      const updated = await this.hierarchyService.updateNode(nodeId, dto, userId);

      if (!updated) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NODE_NOT_FOUND',
            message: 'Timeline node not found'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: updated,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'UPDATE_NODE_ERROR');
    }
  }

  /**
   * DELETE /api/v2/timeline/nodes/:id - Delete node
   */
  async deleteNode(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const nodeId = req.params.id;

      this.logger.info('Deleting timeline node', { userId, nodeId });

      const deleted = await this.hierarchyService.deleteNode(nodeId, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NODE_NOT_FOUND',
            message: 'Timeline node not found'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { deleted: true, nodeId },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'DELETE_NODE_ERROR');
    }
  }

  /**
   * GET /api/v2/timeline/nodes - List user's nodes with optional filtering
   */
  async listNodes(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);
      const query = querySchema.parse(req.query);

      this.logger.debug('Listing timeline nodes', { userId, query });

      let nodes;

      if (query.type) {
        nodes = await this.hierarchyService.getNodesByType(query.type, userId);
      } else {
        // Return ALL nodes, not just roots - the UI needs the complete hierarchy
        nodes = await this.hierarchyService.getAllNodes(userId);
      }

      const response: ApiResponse = {
        success: true,
        data: nodes,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'LIST_NODES_ERROR');
    }
  }








  /**
   * GET /api/v2/timeline/validate - Validate hierarchy integrity
   */
  async validateHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.extractUserId(req);

      this.logger.info('Validating hierarchy integrity', { userId });

      const analysis = await this.cycleDetection.analyzeHierarchyForCycles(userId);
      const suggestions = await this.cycleDetection.getRecoverySuggestions(userId);

      const response: ApiResponse = {
        success: true,
        data: {
          integrity: analysis,
          suggestions
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'VALIDATE_HIERARCHY_ERROR');
    }
  }

  /**
   * GET /api/v2/timeline/schema/:type - Get validation schema for node type
   */
  async getNodeTypeSchema(req: Request, res: Response): Promise<void> {
    try {
      const nodeType = req.params.type;

      if (!['job', 'education', 'project', 'event', 'action', 'careerTransition'].includes(nodeType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NODE_TYPE',
            message: 'Invalid node type specified'
          }
        });
        return;
      }

      const schema = this.validation.getSchemaForNodeType(nodeType);
      const allowedChildren = this.validation.getAllowedChildren(nodeType);

      if (!schema) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SCHEMA_NOT_FOUND',
            message: 'Schema not found for node type'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          nodeType,
          allowedChildren,
          metaSchema: this.zodSchemaToJsonSchema(schema)
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      this.handleError(error, res, 'GET_SCHEMA_ERROR');
    }
  }

  /**
   * Extract user ID from request (integrates with existing Lighthouse auth)
   */
  private extractUserId(req: Request): number {
    // Integration with existing Lighthouse authentication
    const userId = (req as any).userId || req.user?.id || req.session?.userId;

    if (!userId) {
      throw new Error('User authentication required');
    }

    return userId;
  }

  /**
   * Centralized error handling following Lighthouse patterns
   */
  private handleError(error: any, res: Response, defaultCode: string): void {
    this.logger.error('Hierarchy API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      defaultCode
    });

    let statusCode = 500;
    let errorCode = defaultCode;
    let message = 'An unexpected error occurred';

    if (error instanceof Error) {
      message = error.message;

      // Map specific error types to status codes
      if (message.includes('not found') || message.includes('Not found')) {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      } else if (message.includes('validation') || message.includes('invalid')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (message.includes('cycle') || message.includes('circular')) {
        statusCode = 409;
        errorCode = 'BUSINESS_RULE_VIOLATION';
      } else if (message.includes('unauthorized') || message.includes('access denied')) {
        statusCode = 403;
        errorCode = 'ACCESS_DENIED';
      } else if (message.includes('authentication required')) {
        statusCode = 401;
        errorCode = 'AUTHENTICATION_REQUIRED';
      }
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.stack : error
        })
      }
    };

    res.status(statusCode).json(response);
  }

  /**
   * Convert Zod schema to JSON Schema for API documentation
   */
  private zodSchemaToJsonSchema(schema: z.ZodSchema): any {
    // Simplified conversion - in production, use a library like zod-to-json-schema
    try {
      const sample = schema.parse({});
      return {
        type: 'object',
        description: 'Node metadata schema',
        sample
      };
    } catch {
      return {
        type: 'object',
        description: 'Node metadata schema - see API documentation for details'
      };
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
      const userId = this.extractUserId(req);

      this.logger.info('Getting node insights', { nodeId, userId });

      const insights = await this.hierarchyService.getNodeInsights(nodeId, userId);

      const response: ApiResponse = {
        success: true,
        data: insights.map(insight => ({
          ...insight,
          timeAgo: formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })
        })),
        meta: {
          timestamp: new Date().toISOString(),
          count: insights.length
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res, 'GET_INSIGHTS_ERROR');
    }
  }

  /**
   * POST /api/v2/timeline/nodes/:nodeId/insights - Create insight for a node
   */
  async createInsight(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const userId = this.extractUserId(req);

      const validatedData = insightCreateSchema.parse(req.body);

      this.logger.info('Creating insight', { 
        nodeId, 
        userId, 
        descriptionLength: validatedData.description.length,
        resourceCount: validatedData.resources.length
      });

      const insight = await this.hierarchyService.createInsight(nodeId, validatedData, userId);

      const response: ApiResponse = {
        success: true,
        data: {
          ...insight,
          timeAgo: 'just now'
        },
        meta: { 
          timestamp: new Date().toISOString() 
        }
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors
          }
        });
      } else {
        this.handleError(error, res, 'CREATE_INSIGHT_ERROR');
      }
    }
  }

  /**
   * PUT /api/v2/timeline/insights/:insightId - Update an insight
   */
  async updateInsight(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const userId = this.extractUserId(req);

      const validatedData = insightUpdateSchema.parse(req.body);

      this.logger.info('Updating insight', { insightId, userId });

      const insight = await this.hierarchyService.updateInsight(insightId, validatedData, userId);

      if (!insight) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Insight not found'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          ...insight,
          timeAgo: formatDistanceToNow(new Date(insight.updatedAt), { addSuffix: true })
        },
        meta: { 
          timestamp: new Date().toISOString() 
        }
      };

      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.errors
          }
        });
      } else {
        this.handleError(error, res, 'UPDATE_INSIGHT_ERROR');
      }
    }
  }

  /**
   * DELETE /api/v2/timeline/insights/:insightId - Delete an insight
   */
  async deleteInsight(req: Request, res: Response): Promise<void> {
    try {
      const { insightId } = req.params;
      const userId = this.extractUserId(req);

      this.logger.info('Deleting insight', { insightId, userId });

      const deleted = await this.hierarchyService.deleteInsight(insightId, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Insight not found'
          }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: null,
        meta: { 
          timestamp: new Date().toISOString() 
        }
      };

      res.json(response);
    } catch (error) {
      this.handleError(error, res, 'DELETE_INSIGHT_ERROR');
    }
  }
}
