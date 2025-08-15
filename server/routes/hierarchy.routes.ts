import { Router } from 'express';
import { HierarchyController } from '../controllers/hierarchy-controller';
import { requireAuth, validateRequestSize, containerMiddleware } from '../middleware';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Node CRUD Operations
router.post('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.createNode(req, res);
});

router.get('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.listNodes(req, res);
});

router.get('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.getNodeById(req, res);
});

router.patch('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.updateNode(req, res);
});

router.delete('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.deleteNode(req, res);
});

// Node Insights Operations
router.get('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.getNodeInsights(req, res);
});

router.post('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.createInsight(req, res);
});

router.put('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.updateInsight(req, res);
});

router.delete('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.deleteInsight(req, res);
});

// API documentation endpoint
router.get('/docs', (req, res) => {
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

export default router;