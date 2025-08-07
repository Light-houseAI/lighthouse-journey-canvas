/**
 * API v1 Router
 * 
 * Main router for version 1 of the API.
 * Registers all node management endpoints and handles controller initialization.
 */

import { Router } from 'express';
import { container, SERVICE_KEYS } from '../../../core/container';
import { JobController } from '../../../controllers/job-controller';
import { EducationController } from '../../../controllers/education-controller';
import { ProjectController } from '../../../controllers/project-controller';
import { ActionController } from '../../../controllers/action-controller';
import { EventController } from '../../../controllers/event-controller';
import { CareerTransitionController } from '../../../controllers/career-transition-controller';
import { ProfileController } from '../../../controllers/profile-controller';

// Route imports
import { initializeJobsRouter } from './jobs';
import { initializeEducationRouter } from './education';
import { initializeProjectsRouter } from './projects';
import { initializeActionsRouter } from './actions';
import { initializeEventsRouter } from './events';
import { initializeCareerTransitionsRouter } from './career-transitions';

const router = Router();

/**
 * Initialize all controllers and route handlers
 * This function must be called after the DI container is fully configured
 */
export async function initializeApiV1Router(): Promise<Router> {
  try {
    console.log('Initializing API v1 router...');
    
    // Initialize controllers with dependencies from the container
    const jobController = new JobController();
    await jobController.initialize();
    
    const educationController = new EducationController();
    await educationController.initialize();
    
    const projectController = new ProjectController();
    await projectController.initialize();
    
    const actionController = new ActionController();
    await actionController.initialize();
    
    const eventController = new EventController();
    await eventController.initialize();
    
    const careerTransitionController = new CareerTransitionController();
    await careerTransitionController.initialize();
    
    const profileController = new ProfileController();
    await profileController.initialize();
    
    console.log('Controllers initialized successfully');
    
    // Register route handlers with initialized controllers
    
    // Profile routes (basic profile management only)
    router.use('/profiles/:profileId', profileRoutes(profileController));
    
    // Node CRUD routes - all 6 node types
    router.use('/profiles/:profileId/jobs', initializeJobsRouter(jobController));
    router.use('/profiles/:profileId/education', initializeEducationRouter(educationController));
    router.use('/profiles/:profileId/projects', initializeProjectsRouter(projectController));
    router.use('/profiles/:profileId/actions', initializeActionsRouter(actionController));
    router.use('/profiles/:profileId/events', initializeEventsRouter(eventController));
    router.use('/profiles/:profileId/career-transitions', initializeCareerTransitionsRouter(careerTransitionController));
    
    // Health check endpoint
    router.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          version: 'v1',
          timestamp: new Date().toISOString(),
          services: {
            profiles: 'active',
            jobs: 'active',
            education: 'active',
            projects: 'active',
            actions: 'active',
            events: 'active',
            careerTransitions: 'active',
          },
        },
      });
    });
    
    console.log('API v1 router initialized successfully');
    return router;
    
  } catch (error) {
    console.error('Failed to initialize API v1 router:', error);
    throw error;
  }
}

/**
 * Profile-specific routes (not node-related)
 */
function profileRoutes(profileController: ProfileController): Router {
  const profileRouter = Router();
  
  // GET /api/v1/profiles/:profileId
  profileRouter.get('/', async (req, res) => {
    await profileController.getById(req, res);
  });
  
  // PUT /api/v1/profiles/:profileId
  profileRouter.put('/', async (req, res) => {
    await profileController.update(req, res);
  });
  
  return profileRouter;
}

/**
 * API Documentation endpoint
 */
router.get('/docs', (req, res) => {
  res.json({
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
        },
        education: {
          'GET /profiles/:profileId/education': 'List education records',
          'POST /profiles/:profileId/education': 'Create education record',
          'GET /profiles/:profileId/education/:id': 'Get education record by ID',
          'PUT /profiles/:profileId/education/:id': 'Update education record',
          'DELETE /profiles/:profileId/education/:id': 'Delete education record',
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
        middleware: 'requireAuth',
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
});

// Error handling middleware for this router
router.use((err: any, req: any, res: any, next: any) => {
  console.error('API v1 Router Error:', err);
  
  const response = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'development') {
    response.error.message = err.message || 'Internal server error';
  }
  
  res.status(500).json(response);
});

export default router;