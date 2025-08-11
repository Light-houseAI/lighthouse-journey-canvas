import { Router } from 'express';
import 'reflect-metadata';
import { createHierarchyRoutes } from '../../../hierarchy/api/routes';
import { HierarchyContainerSetup } from '../../../hierarchy/di/container-setup';
import { db } from '../../../db';
import { requireAuth } from '../../../auth';

// Mock logger for hierarchy system
const mockLogger = {
  info: console.log,
  error: console.error,
  debug: console.debug,
  warn: console.warn
};

/**
 * API v2 Router - Hierarchical Timeline System
 * 
 * Provides the new hierarchical timeline functionality while maintaining
 * backward compatibility with v1 APIs.
 */
export async function initializeApiV2Router(): Promise<Router> {
  const router = Router();
  
  // Apply authentication middleware to all v2 routes
  router.use(requireAuth);

  try {
    // Initialize the hierarchy DI container
    await HierarchyContainerSetup.configure(db, mockLogger);
    
    // Create hierarchy routes
    const hierarchyRouter = createHierarchyRoutes();
    
    // Mount hierarchy routes under /timeline
    router.use('/timeline', hierarchyRouter);

    // Health check endpoint for v2 API
    router.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          version: '2.0.0',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          features: {
            timeline: true,
            nodeTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
            apiEndpoints: [
              'GET /timeline/health',
              'GET /timeline/docs',
              'POST /timeline/nodes',
              'GET /timeline/nodes',
              'GET /timeline/nodes/:id',
              'PATCH /timeline/nodes/:id',
              'DELETE /timeline/nodes/:id',
              'GET /timeline/validate',
              'GET /timeline/schema/:type'
            ]
          }
        }
      });
    });

    // API documentation endpoint
    router.get('/docs', (req, res) => {
      res.json({
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
          }
        }
      });
    });

    mockLogger.info('API v2 router initialized successfully', {
      endpoints: ['/timeline', '/health', '/docs'],
      authentication: 'required'
    });

    return router;

  } catch (error) {
    mockLogger.error('Failed to initialize API v2 router:', error);
    
    // Return a minimal router with error endpoints
    router.get('/health', (req, res) => {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE', 
          message: 'API v2 initialization failed'
        }
      });
    });

    return router;
  }
}

export default initializeApiV2Router;