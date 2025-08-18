/**
 * API Documentation Controller
 * Provides API documentation endpoints for different versions
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';

/**
 * API Documentation Controller
 * Centralizes API documentation for all versions
 */
export class DocsController extends BaseController {

  /**
   * API v2 documentation endpoint
   * GET /api/v2/docs
   */
  async getV2Docs(_req: Request, res: Response): Promise<Response> {
    return res.json({
      success: true,
      data: {
        version: '2.0.0',
        title: 'Lighthouse Timeline API v2',
        description: 'Hierarchical timeline management with full CRUD operations, cycle detection, and user isolation',
        baseUrl: '/api/v2',
        authentication: {
          required: true,
          method: 'session-based',
          description: 'All endpoints require user authentication via existing Lighthouse auth system'
        },
        endpoints: {
          timeline: '/timeline/* - Complete hierarchical timeline management',
          health: '/health - API health check',
          docs: '/docs - This documentation'
        },
        migration: {
          fromV1: 'V2 API provides hierarchical functionality while V1 remains available for backward compatibility',
          newFeatures: [
            'Parent-child node relationships',
            'Hierarchy validation and cycle detection',  
            'Advanced tree querying operations',
            'Type-specific metadata validation',
            'Performance-optimized recursive queries'
          ]
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
        detailedEndpoints: {
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
          insights: {
            'GET /nodes/:nodeId/insights': {
              description: 'Get insights for a specific node'
            },
            'POST /nodes/:nodeId/insights': {
              description: 'Create new insight for a node',
              body: {
                content: 'Insight content (required)',
                type: 'Insight type (optional)'
              }
            },
            'PUT /insights/:insightId': {
              description: 'Update existing insight'
            },
            'DELETE /insights/:insightId': {
              description: 'Delete insight'
            }
          },
          utility: {
            'GET /health': 'Service health check',
            'GET /docs': 'This documentation'
          }
        },
        businessRules: {
          userIsolation: 'Users can only access their own nodes',
          validation: 'Type-specific metadata validation enforced',
          cycleDetection: 'Prevents creation of circular references in hierarchy'
        },
        errorCodes: {
          'AUTHENTICATION_REQUIRED': 'User must be authenticated',
          'ACCESS_DENIED': 'User cannot access requested resource',
          'NODE_NOT_FOUND': 'Requested node does not exist',
          'VALIDATION_ERROR': 'Input validation failed',
          'SERVICE_UNAVAILABLE': 'Timeline service temporarily unavailable'
        },
        authentication_system: {
          approach: 'Express middleware-based',
          route_groups: {
            protected: 'Automatic authentication required for all routes',
            public: 'No authentication required for health/docs'
          },
          resource_access: {
            ownership: 'Users can access resources they own',
            sharing: 'Users can access resources shared with them',
            permissions: ['read', 'write', 'delete', 'share']
          }
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
  }

  /**
   * API v1 documentation endpoint
   * GET /api/v1/docs
   */
  async getV1Docs(_req: Request, res: Response): Promise<Response> {
    return res.json({
      success: true,
      data: {
        version: 'v1',
        description: 'Career Node Management API - CRUD Operations Only',
        endpoints: {
          profiles: {
            'GET /profiles/:profileId': 'Get profile by ID',
            'PUT /profiles/:profileId': 'Update profile',
          },
          jobs: {
            'GET /profiles/:profileId/jobs': 'List jobs',
            'POST /profiles/:profileId/jobs': 'Create job',
            'GET /profiles/:profileId/jobs/:id': 'Get job by ID',
            'PUT /profiles/:profileId/jobs/:id': 'Update job',
            'DELETE /profiles/:profileId/jobs/:id': 'Delete job',
            'GET /profiles/:profileId/jobs/:id/projects': 'List projects under job',
            'POST /profiles/:profileId/jobs/:id/projects': 'Create project under job',
            'GET /profiles/:profileId/jobs/:id/events': 'List events under job',
            'POST /profiles/:profileId/jobs/:id/events': 'Create event under job',
            'GET /profiles/:profileId/jobs/:id/actions': 'List actions under job',
            'POST /profiles/:profileId/jobs/:id/actions': 'Create action under job',
          },
          education: {
            'GET /profiles/:profileId/education': 'List education records',
            'POST /profiles/:profileId/education': 'Create education record',
            'GET /profiles/:profileId/education/:id': 'Get education record by ID',
            'PUT /profiles/:profileId/education/:id': 'Update education record',
            'DELETE /profiles/:profileId/education/:id': 'Delete education record',
            'GET /profiles/:profileId/education/:id/projects': 'List projects under education',
            'POST /profiles/:profileId/education/:id/projects': 'Create project under education',
            'GET /profiles/:profileId/education/:id/events': 'List events under education',
            'POST /profiles/:profileId/education/:id/events': 'Create event under education',
            'GET /profiles/:profileId/education/:id/actions': 'List actions under education',
            'POST /profiles/:profileId/education/:id/actions': 'Create action under education',
          },
          projects: {
            'GET /profiles/:profileId/projects': 'List projects',
            'POST /profiles/:profileId/projects': 'Create project',
            'GET /profiles/:profileId/projects/:id': 'Get project by ID',
            'PUT /profiles/:profileId/projects/:id': 'Update project',
            'DELETE /profiles/:profileId/projects/:id': 'Delete project',
          },
          actions: {
            'GET /profiles/:profileId/actions': 'List actions',
            'POST /profiles/:profileId/actions': 'Create action',
            'GET /profiles/:profileId/actions/:id': 'Get action by ID',
            'PUT /profiles/:profileId/actions/:id': 'Update action',
            'DELETE /profiles/:profileId/actions/:id': 'Delete action',
          },
          events: {
            'GET /profiles/:profileId/events': 'List events',
            'POST /profiles/:profileId/events': 'Create event',
            'GET /profiles/:profileId/events/:id': 'Get event by ID',
            'PUT /profiles/:profileId/events/:id': 'Update event',
            'DELETE /profiles/:profileId/events/:id': 'Delete event',
          },
          careerTransitions: {
            'GET /profiles/:profileId/career-transitions': 'List career transitions',
            'POST /profiles/:profileId/career-transitions': 'Create career transition',
            'GET /profiles/:profileId/career-transitions/:id': 'Get career transition by ID',
            'PUT /profiles/:profileId/career-transitions/:id': 'Update career transition',
            'DELETE /profiles/:profileId/career-transitions/:id': 'Delete career transition',
          },
          meta: {
            'GET /health': 'Health check',
            'GET /docs': 'API documentation',
          },
        },
        nodeTypes: [
          'jobs',
          'education', 
          'projects',
          'actions',
          'events',
          'careerTransitions'
        ],
        authentication: {
          required: true,
          method: 'session-based',
          middleware: 'protected routes via createProtectedRoutes()',
        },
        authorization: {
          profileAccess: 'Users can only access their own profile data',
          validation: 'Profile ownership validated for all endpoints',
        },
        responseFormat: {
          success: {
            success: true,
            data: '...',
            meta: '... (optional pagination/metadata)',
          },
          error: {
            success: false,
            error: {
              code: 'ERROR_CODE',
              message: 'Error description',
              details: '... (optional)',
            },
          },
        },
        statusCodes: {
          200: 'Success',
          201: 'Created',
          400: 'Bad Request / Validation Error',
          401: 'Unauthorized',
          403: 'Forbidden',
          404: 'Not Found',
          409: 'Conflict / Business Rule Error',
          500: 'Internal Server Error',
        },
        features: {
          crud: 'Full Create, Read, Update, Delete operations for all node types',
          validation: 'Comprehensive input validation with Zod schemas',
          pagination: 'Pagination support with page/limit parameters',
          sorting: 'Flexible sorting by configurable fields',
          authentication: 'Session-based authentication required',
          authorization: 'Profile-level access control',
        },
      },
    });
  }
}