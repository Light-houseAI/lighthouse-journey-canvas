import { Router } from 'express';
import { container } from 'tsyringe';
import { HierarchyController } from './hierarchy-controller';
import { hierarchyContextMiddleware } from '../di/container-setup';
import { HIERARCHY_TOKENS } from '../di/tokens';
import type { Request, Response, NextFunction } from 'express';

/**
 * Hierarchy API Routes - Version 2
 * Integrates with existing Lighthouse authentication and follows v2 API patterns
 */

// Middleware to ensure hierarchy controller is available
const ensureHierarchyController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(req as any).hierarchyController) {
      const controller = container.resolve<HierarchyController>(HIERARCHY_TOKENS.HIERARCHY_CONTROLLER);
      (req as any).hierarchyController = controller;
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Hierarchy service temporarily unavailable'
      }
    });
  }
};

// Request validation middleware
const validateRequestSize = (req: Request, res: Response, next: NextFunction) => {
  // Prevent extremely large payloads
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload too large'
      }
    });
  }
  next();
};

// Rate limiting placeholder (integrate with existing Lighthouse rate limiting)
const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Integrate with existing Lighthouse rate limiting
  next();
};

export function createHierarchyRoutes(): Router {
  const router = Router();

  // Apply middleware to all routes
  router.use(hierarchyContextMiddleware);
  router.use(ensureHierarchyController);
  router.use(validateRequestSize);
  router.use(rateLimitMiddleware);

  // Node CRUD Operations
  
  /**
   * POST /nodes - Create a new timeline node
   */
  router.post('/nodes', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.createNode(req, res);
  });

  /**
   * GET /nodes - List user's nodes with optional filtering
   * Query params: type, includeChildren, maxDepth
   */
  router.get('/nodes', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.listNodes(req, res);
  });

  /**
   * GET /nodes/:id - Get single node by ID
   */
  router.get('/nodes/:id', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.getNodeById(req, res);
  });

  /**
   * PATCH /nodes/:id - Update node
   */
  router.patch('/nodes/:id', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.updateNode(req, res);
  });

  /**
   * DELETE /nodes/:id - Delete node
   */
  router.delete('/nodes/:id', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.deleteNode(req, res);
  });

  // Insights Operations
  
  /**
   * GET /nodes/:nodeId/insights - Get insights for a node
   */
  router.get('/nodes/:nodeId/insights', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.getNodeInsights(req, res);
  });

  /**
   * POST /nodes/:nodeId/insights - Create insight for a node
   */
  router.post('/nodes/:nodeId/insights', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.createInsight(req, res);
  });

  /**
   * PUT /insights/:insightId - Update an insight
   */
  router.put('/insights/:insightId', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.updateInsight(req, res);
  });

  /**
   * DELETE /insights/:insightId - Delete an insight
   */
  router.delete('/insights/:insightId', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.deleteInsight(req, res);
  });

  // Utility and Admin Endpoints

  /**
   * GET /validate - Validate hierarchy integrity
   */
  router.get('/validate', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.validateHierarchy(req, res);
  });

  /**
   * GET /schema/:type - Get validation schema for node type
   */
  router.get('/schema/:type', async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.getNodeTypeSchema(req, res);
  });

  // Health check endpoint
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        service: 'timeline',
        status: 'healthy',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        features: {
          nodeTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
          validation: true,
          userIsolation: true
        }
      }
    });
  });

  // API documentation endpoint
  router.get('/docs', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        version: '2.0',
        description: 'Hierarchical Timeline API - Full hierarchy management with cycle detection',
        baseUrl: '/api/v2/timeline',
        authentication: {
          required: true,
          method: 'session-based',
          description: 'All endpoints require user authentication via existing Lighthouse auth'
        },
        nodeTypes: [
          {
            type: 'careerTransition',
            description: 'Major career transitions',
            allowedChildren: ['action', 'event', 'project'],
            isLeaf: false
          },
          {
            type: 'job', 
            description: 'Employment experiences',
            allowedChildren: ['project', 'event', 'action'],
            isLeaf: false
          },
          {
            type: 'education',
            description: 'Educational experiences', 
            allowedChildren: ['project', 'event', 'action'],
            isLeaf: false
          },
          {
            type: 'action',
            description: 'Specific actions or achievements',
            allowedChildren: ['project'],
            isLeaf: false
          },
          {
            type: 'event',
            description: 'Timeline events or milestones',
            allowedChildren: ['project', 'action'],
            isLeaf: false
          },
          {
            type: 'project',
            description: 'Individual projects or initiatives',
            allowedChildren: [],
            isLeaf: true
          }
        ],
        endpoints: {
          nodes: {
            'POST /nodes': {
              description: 'Create new timeline node',
              body: {
                type: 'Node type (required)',
                label: 'Human readable label (required)',
                parentId: 'Parent node UUID (optional)',
                meta: 'Type-specific metadata (optional)'
              }
            },
            'GET /nodes': {
              description: 'List user nodes with optional filtering',
              query: {
                type: 'Filter by node type (optional)',
                includeChildren: 'Include child nodes in response (optional)',
                maxDepth: 'Maximum depth for tree operations (optional)'
              }
            },
            'GET /nodes/:id': {
              description: 'Get single node with parent info'
            },
            'PATCH /nodes/:id': {
              description: 'Update node properties',
              body: {
                label: 'New label (optional)',
                meta: 'Updated metadata (optional)'
              }
            },
            'DELETE /nodes/:id': {
              description: 'Delete node (children become orphaned)'
            }
          },
          utility: {
            'GET /validate': 'Check hierarchy integrity and detect issues',
            'GET /schema/:type': 'Get validation schema for node type',
            'GET /health': 'Service health check',
            'GET /docs': 'This documentation'
          }
        },
        businessRules: {
          userIsolation: 'Users can only access their own nodes',
          validation: 'Type-specific metadata validation enforced'
        },
        errorCodes: {
          'AUTHENTICATION_REQUIRED': 'User must be authenticated',
          'ACCESS_DENIED': 'User cannot access requested resource',
          'NODE_NOT_FOUND': 'Requested node does not exist',
          'VALIDATION_ERROR': 'Input validation failed',
          'SERVICE_UNAVAILABLE': 'Timeline service temporarily unavailable'
        },
        responseFormat: {
          success: {
            success: true,
            data: '/* Response data */',
            meta: {
              timestamp: '/* ISO timestamp */',
              pagination: '/* When applicable */'
            }
          },
          error: {
            success: false,
            error: {
              code: '/* Error code */',
              message: '/* Human readable message */',
              details: '/* Additional info (development only) */'
            }
          }
        }
      }
    });
  });

  // Error handling middleware specific to hierarchy routes
  router.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Hierarchy API Error:', err);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred in the hierarchy service'
      }
    });
  });

  return router;
}

export default createHierarchyRoutes;