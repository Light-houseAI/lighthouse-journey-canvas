import type { Express, Request, Response } from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./services/storage.service";
import { requireAuth, requireGuest } from "./middleware/auth.middleware";
import {
  usernameInputSchema,
  insertProfileSchema,
  signUpSchema,
  signInSchema,
  interestSchema,
  type User
} from "@shared/schema";
import { MultiSourceExtractor } from "./services/multi-source-extractor";
import OpenAI from "openai";
import multer from "multer";
import aiRoutes from "./routes/api/ai.routes";

import { container } from 'tsyringe';
import { HIERARCHY_TOKENS } from './core/hierarchy-tokens';
import { HierarchyService, type CreateNodeDTO } from './services/hierarchy-service';
import { HierarchyController } from './controllers/hierarchy-controller';
import { HierarchyContainerSetup, hierarchyContextMiddleware } from './core/hierarchy-container-setup';
import { db } from './config/database.config';

// Helper function to transform milestone to hierarchical node format
async function transformMilestoneToHierarchicalNode(milestone: any, userId: number): Promise<CreateNodeDTO> {
  // Map milestone types to hierarchical node types
  const typeMapping: Record<string, 'job' | 'education' | 'project' | 'event' | 'action' | 'careerTransition'> = {
    'job': 'job',
    'experience': 'job',
    'workExperience': 'job',
    'education': 'education',
    'project': 'project',
    'event': 'event',
    'action': 'action',
    'careerTransition': 'careerTransition',
    'jobTransition': 'careerTransition'
  };

  const nodeType = typeMapping[milestone.type] || 'project'; // Default to project

  // Transform milestone data to hierarchical meta format
  const meta: Record<string, unknown> = {
    title: milestone.title,
    description: milestone.description,
    userId: userId
  };

  // Add type-specific fields
  if (nodeType === 'job') {
    meta.company = milestone.organization || milestone.company;
    meta.position = milestone.title;
    meta.location = milestone.location;
    meta.employmentType = milestone.employmentType || 'full-time';
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end || (milestone.ongoing || milestone.isOngoing ? 'Present' : undefined);
    meta.responsibilities = milestone.responsibilities || [];
    meta.achievements = milestone.achievements || [];
    meta.technologies = milestone.technologies || milestone.skills || [];
  } else if (nodeType === 'education') {
    meta.institution = milestone.organization || milestone.school;
    meta.degree = milestone.degree || milestone.title;
    meta.field = milestone.field || milestone.description;
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end || (milestone.ongoing || milestone.isOngoing ? 'Present' : undefined);
    meta.location = milestone.location;
    meta.gpa = milestone.gpa;
    meta.honors = milestone.honors || [];
  } else if (nodeType === 'project') {
    meta.status = milestone.status || 'completed';
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end;
    meta.technologies = milestone.technologies || milestone.skills || [];
    meta.repositoryUrl = milestone.repositoryUrl;
    meta.liveUrl = milestone.liveUrl;
    meta.role = milestone.role;
    meta.keyFeatures = milestone.keyFeatures || [];
    meta.outcomes = milestone.outcomes || [];
  } else if (nodeType === 'event') {
    meta.eventType = milestone.eventType || 'conference';
    meta.location = milestone.location;
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end;
    meta.organizer = milestone.organizer;
    meta.role = milestone.role || 'attendee';
    meta.topics = milestone.topics || [];
    meta.outcomes = milestone.outcomes || [];
  } else if (nodeType === 'action') {
    meta.category = milestone.category || 'other';
    meta.priority = milestone.priority || 'medium';
    meta.status = milestone.status || 'completed';
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end;
    meta.outcomes = milestone.outcomes || [];
    meta.skills = milestone.skills || [];
    meta.effort = milestone.effort || {};
  } else if (nodeType === 'careerTransition') {
    meta.transitionType = milestone.transitionType || 'role-change';
    meta.category = milestone.category || 'promotion';
    meta.startDate = milestone.startDate || milestone.start || milestone.date;
    meta.endDate = milestone.endDate || milestone.end;
    meta.fromRole = milestone.fromRole || {};
    meta.toRole = milestone.toRole || {};
    meta.motivation = milestone.motivation || [];
    meta.outcomes = milestone.outcomes || [];
  }

  return {
    type: nodeType,
    parentId: milestone.parentId || null,
    meta
  };
}

// Helper function to create hierarchical node
async function createHierarchicalNode(nodeDTO: CreateNodeDTO, userId: number) {
  try {
    // Ensure hierarchy container is configured
    const mockLogger = {
      info: console.log,
      error: console.error,
      debug: console.debug,
      warn: console.warn
    };
    
    await HierarchyContainerSetup.configure(db, mockLogger);
    
    // Get hierarchy service
    const hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
    
    // Create the node
    const createdNode = await hierarchyService.createNode(nodeDTO, userId);
    
    return createdNode;
  } catch (error) {
    console.error('Failed to create hierarchical node:', error);
    throw error;
  }
}

// Helper function to update hierarchical node
async function updateHierarchicalNode(nodeId: string, updateData: any, userId: number) {
  try {
    const mockLogger = {
      info: console.log,
      error: console.error,
      debug: console.debug,
      warn: console.warn
    };
    
    await HierarchyContainerSetup.configure(db, mockLogger);
    const hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
    
    // Update the node meta with new data
    const updateDTO = {
      meta: updateData
    };
    
    const updatedNode = await hierarchyService.updateNode(nodeId, updateDTO, userId);
    return updatedNode;
  } catch (error) {
    console.error('Failed to update hierarchical node:', error);
    throw error;
  }
}

// Helper function to delete hierarchical node
async function deleteHierarchicalNode(nodeId: string, userId: number) {
  try {
    const mockLogger = {
      info: console.log,
      error: console.error,
      debug: console.debug,
      warn: console.warn
    };
    
    await HierarchyContainerSetup.configure(db, mockLogger);
    const hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
    
    await hierarchyService.deleteNode(nodeId, userId);
  } catch (error) {
    console.error('Failed to delete hierarchical node:', error);
    throw error;
  }
}

// Helper function to get nodes from hierarchical system
async function getHierarchicalNodes(userId: number, nodeType?: string) {
  try {
    const mockLogger = {
      info: console.log,
      error: console.error,
      debug: console.debug,
      warn: console.warn
    };
    
    await HierarchyContainerSetup.configure(db, mockLogger);
    const hierarchyService = container.resolve<HierarchyService>(HIERARCHY_TOKENS.HIERARCHY_SERVICE);
    
    // Get all nodes for user, optionally filtered by type
    const nodes = await hierarchyService.getAllNodes(userId);
    
    if (nodeType) {
      return nodes.filter(node => node.type === nodeType);
    }
    
    return nodes;
  } catch (error) {
    console.error('Failed to get hierarchical nodes:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const multiSourceExtractor = new MultiSourceExtractor();
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
  });

  // Register AI routes
  app.use(aiRoutes);

  // API v2 routes integrated directly below
  
  // API v2 Health check endpoint
  app.get('/api/v2/health', requireAuth, (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        version: '2.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        features: {
          timeline: true,
          nodeTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
          authentication: 'session-based'
        }
      }
    });
  });

  // Hierarchy API Routes (integrated directly)
  // Middleware to ensure hierarchy controller is available
  const ensureHierarchyController = async (req: Request, res: Response, next: any) => {
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
  const validateRequestSize = (req: Request, res: Response, next: any) => {
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

  // Apply hierarchy middleware to all /api/v2/timeline routes
  app.use('/api/v2/timeline', hierarchyContextMiddleware);
  app.use('/api/v2/timeline', ensureHierarchyController);
  app.use('/api/v2/timeline', validateRequestSize);

  // Node CRUD Operations
  app.post('/api/v2/timeline/nodes', requireAuth, async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.createNode(req, res);
  });

  app.get('/api/v2/timeline/nodes', requireAuth, async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.listNodes(req, res);
  });

  app.get('/api/v2/timeline/nodes/:id', requireAuth, async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.getNodeById(req, res);
  });

  app.patch('/api/v2/timeline/nodes/:id', requireAuth, async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.updateNode(req, res);
  });

  app.delete('/api/v2/timeline/nodes/:id', requireAuth, async (req: Request, res: Response) => {
    const controller = (req as any).hierarchyController as HierarchyController;
    await controller.deleteNode(req, res);
  });

  // Note: Insights and schema endpoints removed - not implemented in controller

  // Health check endpoint
  app.get('/api/v2/timeline/health', (req: Request, res: Response) => {
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
  app.get('/api/v2/timeline/docs', (req: Request, res: Response) => {
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

  // Auth routes
  app.post("/api/signup", requireGuest, async (req: Request, res: Response) => {
    try {
      const signUpData = signUpSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(signUpData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Create user
      const user = await storage.createUser(signUpData);
      req.session.userId = user.id;

      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("Sign up error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to create account" });
      }
    }
  });

  app.post("/api/signin", requireGuest, async (req: Request, res: Response) => {
    try {
      const signInData = signInSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(signInData.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Validate password
      const isValidPassword = await storage.validatePassword(signInData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({ success: true, user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("Sign in error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to sign in" });
      }
    }
  });

  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/me", requireAuth, async (req: Request, res: Response) => {
    const user = (req as any).user as User;
    res.json({
      id: user.id,
      email: user.email,
      interest: user.interest,
      hasCompletedOnboarding: user.hasCompletedOnboarding
    });
  });

  // Onboarding routes
  app.post("/api/onboarding/interest", requireAuth, async (req: Request, res: Response) => {
    try {
      const { interest } = interestSchema.parse(req.body);
      const user = (req as any).user as User;

      await storage.updateUserInterest(user.id, interest);
      res.json({ success: true });
    } catch (error) {
      console.error("Update interest error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to update interest" });
      }
    }
  });

  app.post("/api/onboarding/complete", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      console.log('Completing onboarding for user:', user.id);
      await storage.completeOnboarding(user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Complete onboarding error:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Profile extraction routes (protected)
  app.post("/api/extract-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { username } = usernameInputSchema.parse(req.body);
      const user = (req as any).user as User;

      // Check if profile already exists for this user
      const existingProfile = await storage.getProfileByUsername(user.id, username);
      if (existingProfile) {
        return res.json({
          success: true,
          profile: existingProfile.rawData
        });
      }

      // Extract comprehensive profile data from multiple sources
      const profileData = await multiSourceExtractor.extractComprehensiveProfile(username);

      res.json({
        success: true,
        profile: profileData
      });
    } catch (error) {
      console.error("Profile extraction error:", error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to extract profile data"
      });
    }
  });

  // Save selected profile data (protected)
  // Get user's saved profile
  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const profile = await storage.getProfileByUserId(user.id);

      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Include user data in profile response
      const profileWithUser = {
        ...profile,
        user: user
      };

      res.json(profileWithUser);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/save-profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as User;
      const profileData = insertProfileSchema.parse(req.body);

      // Add user ID to the profile data
      const profileWithUser = {
        ...profileData,
        userId: user.id,
      };

      // Check if profile already exists
      const existingProfile = await storage.getProfileByUsername(user.id, profileData.username);
      if (existingProfile) {
        return res.status(409).json({
          success: false,
          message: "Profile already exists for this username"
        });
      }

      const savedProfile = await storage.createProfile(profileWithUser);

      await storage.completeOnboarding(user.id);

      res.json({
        success: true,
        profile: savedProfile
      });

    } catch (error) {
      console.error("Save profile error:", error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to save profile data"
      });
    }
  });

  // Get all profiles for authenticated user
  app.get("/api/profiles", requireAuth, async (req: Request, res: Response) => {
    try {
      const profiles = await storage.getAllProfiles();
      res.json({ success: true, profiles });
    } catch (error) {
      console.error("Get profiles error:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  // Route to save project milestones during onboarding - Updated to use hierarchical timeline
  app.post("/api/save-projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const { projects } = req.body;
      const userId = req.session.userId!;

      // Create multiple projects using hierarchical system
      const createdProjects = [];
      for (const project of projects) {
        const hierarchicalNode = await transformMilestoneToHierarchicalNode(project, userId);
        const createdNode = await createHierarchicalNode(hierarchicalNode, userId);
        createdProjects.push(createdNode);
      }

      res.json({ success: true, projects: createdProjects });
    } catch (error) {
      console.error("Save projects error:", error);
      res.status(500).json({ error: "Failed to save projects" });
    }
  });

  // Duplicate route removed - already defined above

  // Route to get project milestones - Updated to use hierarchical timeline
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Get all nodes from hierarchical system (could filter by type if needed)
      const allNodes = await getHierarchicalNodes(userId);
      
      // Transform to legacy format for backward compatibility
      const projects = allNodes.map(node => ({
        id: node.id,
        title: node.meta.title,
        description: node.meta.description,
        type: node.type,
        date: node.meta.date || node.meta.startDate,
        startDate: node.meta.startDate,
        endDate: node.meta.endDate,
        organization: node.meta.organization || node.meta.company || node.meta.institution,
        skills: node.meta.skills || node.meta.technologies || [],
        parentId: node.parentId
      }));
      
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  // Route to save voice updates/milestones - Updated to use hierarchical timeline
  app.post("/api/save-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestone } = req.body;
      const userId = req.session.userId!;

      console.log('Saving milestone for userId:', userId, 'milestone:', milestone);

      // Transform milestone to hierarchical node format
      const hierarchicalNode = await transformMilestoneToHierarchicalNode(milestone, userId);
      
      // Create node using hierarchical timeline API
      const createdNode = await createHierarchicalNode(hierarchicalNode, userId);

      // Create the node data for the frontend (compatible with existing format)
      const nodeData = {
        id: createdNode.id,
        type: createdNode.type,
        title: createdNode.meta.title || milestone.title,
        description: createdNode.meta.description || milestone.description,
        organization: createdNode.meta.organization || milestone.organization,
        date: createdNode.meta.date || milestone.date,
        startDate: createdNode.meta.startDate || milestone.startDate,
        endDate: createdNode.meta.endDate || milestone.endDate,
        skills: createdNode.meta.skills || milestone.skills || [],
        technologies: createdNode.meta.technologies || milestone.technologies || [],
        isSubMilestone: !!createdNode.parentId,
        parentId: createdNode.parentId
      };

      res.json({
        success: true,
        milestone: nodeData,
        shouldCreateNode: true,
        shouldFocus: true
      });
    } catch (error) {
      console.error("Save milestone error:", error);
      res.status(500).json({ error: "Failed to save milestone" });
    }
  });

  // Route to update a milestone - Updated to use hierarchical timeline
  app.put("/api/update-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestoneId, title, description } = req.body;
      const userId = req.session.userId!;

      // Update node using hierarchical timeline API
      await updateHierarchicalNode(milestoneId, { title, description }, userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Update milestone error:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  });

  // Route to delete a milestone - Updated to use hierarchical timeline
  app.delete("/api/delete-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { milestoneId } = req.body;
      const userId = req.session.userId!;

      // Delete node using hierarchical timeline API
      await deleteHierarchicalNode(milestoneId, userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete milestone error:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  });

  // Route to process AI chat messages
  app.post("/api/process-chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, conversationContext, conversationState } = req.body;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional career development assistant helping users build STAR (Situation, Task, Action, Result) stories for their career milestones.

            Context: ${JSON.stringify(conversationContext)}
            Current state: ${conversationState}

            Be conversational, encouraging, and help users articulate their professional achievements clearly.
            Keep responses concise (under 150 words) and actionable.

            Focus on helping users:
            - Articulate their impact and achievements
            - Structure their experiences using STAR format when appropriate
            - Identify key skills and accomplishments
            - Progress their career development goals`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'd be happy to help you with that. Could you tell me more?";

      res.json({
        response: aiResponse,
        conversationState: conversationState
      });

    } catch (error) {
      console.error("AI chat processing error:", error);
      res.status(500).json({
        error: "Failed to process message",
        fallbackResponse: "I'm having trouble processing that right now. Could you try rephrasing?"
      });
    }
  });

  // Route to transcribe audio using OpenAI Whisper
  app.post("/api/transcribe", requireAuth, upload.single('audio'), async (req: Request, res: Response) => {
    try {
      const audioFile = req.file;
      if (!audioFile) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      // Convert buffer to file-like object for OpenAI
      const audioFileForAI = new File([audioFile.buffer], audioFile.originalname || 'audio.wav', {
        type: audioFile.mimetype || 'audio/wav'
      });

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const transcription = await openai.audio.transcriptions.create({
        file: audioFileForAI,
        model: "whisper-1",
      });

      res.json({ text: transcription.text });
    } catch (error) {
      console.error("Transcription error:", error);
      res.status(500).json({
        error: "Failed to transcribe audio",
        fallbackText: "Sorry, I couldn't process that audio. Could you try again or type your message?"
      });
    }
  });

  // Create milestone with AI assistance
  app.post("/api/create-milestone", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userInput, parentContext } = req.body;
      const userId = req.session.userId!;

      // Create a structured milestone from user input
      const milestone = {
        id: `milestone-${Date.now()}`,
        title: userInput.split(' ').slice(0, 4).join(' ').replace(/[^a-zA-Z0-9\s]/g, '') || 'New Project',
        description: userInput.length > 50 ? userInput.substring(0, 100) + '...' : userInput,
        type: 'project',
        date: new Date().getFullYear().toString(),
        skills: [],
        organization: parentContext?.parentOrganization,
        parentId: parentContext?.parentId
      };

      // Transform and create in hierarchical system
      const hierarchicalNode = await transformMilestoneToHierarchicalNode(milestone, userId);
      const createdNode = await createHierarchicalNode(hierarchicalNode, userId);

      // Return in expected format
      const responseData = {
        id: createdNode.id,
        title: createdNode.meta.title,
        description: createdNode.meta.description,
        type: createdNode.type,
        date: createdNode.meta.date,
        skills: createdNode.meta.skills || [],
        organization: createdNode.meta.organization,
        parentId: createdNode.parentId
      };

      res.json({ milestone: responseData });
    } catch (error) {
      console.error('Error creating milestone:', error);
      res.status(500).json({ error: 'Failed to create milestone' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
