/**
 * AI Controller
 * 
 * Handles all AI-related endpoints including:
 * - Career conversation and chat
 * - Onboarding workflows
 * - Milestone extraction and analysis
 * - Context management and check-ins
 * - Profile vector management
 * - Skills analysis (temporarily disabled)
 * - Thread management
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  createCareerAgent,
  processCareerConversation,
} from '../services/ai/career-agent';
import { OnboardingStateManager } from '../services/ai/memory-manager';
import { milestoneExtractor } from '../services/ai/milestone-extractor';
import { contextManager } from '../services/ai/context-manager';
import { threadManager } from '../services/ai/thread-manager';
import { profileVectorManager } from '../services/ai/profile-vector-manager';
import { ConversationSummarizer } from '../services/ai/conversation-summarizer';
import { memoryHierarchy } from '../services/ai/memory-hierarchy';
import { RedisAdapter } from '../adapters/redis-adapter';
import { randomUUID } from 'crypto';
import { RuntimeContext } from '@mastra/core/di';
import { BaseController } from './base-controller';
import { ValidationError, NotFoundError, BusinessRuleError } from '../core/errors';

// Request validation schemas
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  userId: z.number().int().positive(),
});

const resumeChatRequestSchema = z.object({
  userId: z.number().int().positive(),
  workflowId: z.string().min(1),
  userInput: z.string().min(1).max(2000),
});

const onboardRequestSchema = z.object({
  userId: z.number().int().positive(),
  step: z.number().int().min(1).optional(),
  message: z.string().optional(),
  profileData: z.object({}).optional(),
  userInterest: z.string().optional(),
});

const analyzeMilestoneRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  existingNodes: z.array(z.any()).optional(),
  userContext: z.object({}).optional(),
});

const generateQuestionsRequestSchema = z.object({
  userInterest: z.string().min(1),
  currentContext: z.object({}).optional(),
});

const processCheckinRequestSchema = z.object({
  userId: z.number().int().positive(),
  conversation: z.string().min(1).max(5000),
});

const importProfileRequestSchema = z.object({
  userId: z.number().int().positive(),
  profileData: z.object({}).refine(data => Object.keys(data).length > 0, {
    message: 'Profile data cannot be empty',
  }),
});

const chatMessageRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  threadId: z.string().optional(),
  userId: z.number().int().positive().optional(),
  context: z.object({}).optional(),
});

const rotateThreadRequestSchema = z.object({
  userId: z.number().int().positive(),
});

export class AIController extends BaseController {
  private redisClient: RedisAdapter;
  private onboardingManager: OnboardingStateManager;
  private careerAgent: any = null;

  constructor() {
    super();
    this.redisClient = new RedisAdapter();
    this.onboardingManager = new OnboardingStateManager(this.redisClient);
  }

  /**
   * GET /api/ai/threads/:userId - Get user's conversation threads
   */
  async getUserThreads(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');

      // In a real implementation, you would query your database for threads
      // For now, return a placeholder response
      const threads = [
        {
          id: `onboarding_${userId}`,
          title: 'Initial Setup',
          lastMessage: new Date(),
        },
      ];

      this.handleSuccess(res, { threads });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to retrieve threads'));
    }
  }

  /**
   * POST /api/ai/chat/resume - Resume workflow endpoint using simplified agent
   */
  async resumeChat(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = resumeChatRequestSchema.parse(req.body);
      const { userId, workflowId, userInput } = validatedData;

      // Use simplified career agent for continuation instead of workflow
      const { processCareerConversation } = await import('../services/ai/simplified-career-agent');

      const agentResult = await processCareerConversation({
        message: userInput,
        userId: userId.toString(),
        threadId: `resume-${workflowId}`,
      });

      this.handleSuccess(res, {
        type: 'completed',
        message: agentResult.response,
        actionTaken: agentResult.actionTaken,
        updatedProfile: agentResult.updatedProfile,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to resume conversation'));
      }
    }
  }

  /**
   * POST /api/ai/chat - Main chat endpoint with streaming support
   */
  async processChat(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = chatRequestSchema.parse(req.body);
      const { message, userId } = validatedData;

      const agent = await this.getCareerAgent();

      // Fetch user data from database
      const userService = (req as any).scope?.resolve('userService');
      if (!userService) {
        throw new ValidationError('User service not available');
      }

      const user = await userService.getUserById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const resourceId = `user_${userId}`;
      // Get active thread (with automatic rotation)
      const conversationThreadId = await threadManager.getActiveThread(resourceId);

      // Increment message count for thread management
      await threadManager.incrementMessageCount(resourceId);

      // Add user message to short-term memory
      await memoryHierarchy.addMessageToShortTerm(resourceId, conversationThreadId, 'user', message);

      // Set up SSE for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      console.log(`🔍 Starting chat for user ${userId} in thread ${conversationThreadId}`);

      // Use the simplified career agent instead of workflow
      const { processCareerConversation } = await import('../services/ai/simplified-career-agent');

      // Process with the simplified career agent
      const agentResult = await processCareerConversation({
        message,
        userId: userId.toString(),
        threadId: conversationThreadId,
      });

      // Handle normal completion - simulate streaming for compatibility
      const fullResponse = agentResult.response;
      const words = fullResponse.split(' ');

      for (const word of words) {
        res.write(`data: ${JSON.stringify({
          type: 'text',
          content: word + ' ',
        })}\n\n`);

        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Add assistant's response to short-term memory
      if (fullResponse) {
        await memoryHierarchy.addMessageToShortTerm(userId.toString(), conversationThreadId, 'assistant', fullResponse);
      }

      // Send completion event with action taken for better UX
      res.write(`data: ${JSON.stringify({
        type: 'done',
        threadId: conversationThreadId,
        actionTaken: agentResult.actionTaken,
        updatedProfile: agentResult.updatedProfile,
      })}\n\n`);

      res.end();
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to process chat message'));
      }
    }
  }

  /**
   * POST /api/ai/onboard - Onboarding endpoint
   */
  async processOnboarding(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = onboardRequestSchema.parse(req.body);
      const { userId, step, message, profileData, userInterest } = validatedData;

      const agent = await this.getCareerAgent();

      const resourceId = `user_${userId}`;
      const threadId = `onboarding_${userId}`;

      // Get or create onboarding state
      let state = await this.onboardingManager.getState(userId) || {
        step: 1,
        currentRole: '',
        projects: [],
        projectContexts: {},
      };

      // Create runtime context
      const runtimeContext = new RuntimeContext();
      runtimeContext.set('onboardingStep', step || state.step);
      runtimeContext.set('profileData', profileData);
      runtimeContext.set('userInterest', userInterest);

      // Process based on onboarding step
      let responseMessage = '';
      let nextStep = state.step;
      let isComplete = false;

      switch (state.step) {
        case 1: // Confirm current role
          if (!message) {
            // Initial conversation start - ask to confirm current role
            const currentRole = profileData?.experiences?.[0]?.title || profileData?.headline || 'your current role';
            const currentCompany = profileData?.experiences?.[0]?.company || 'your company';
            responseMessage = `Hi! I'm your Career AI Guide. I see from your profile that you're working as ${currentRole} at ${currentCompany}. Is this correct?`;
          } else if (message.toLowerCase().includes('yes') || message.toLowerCase().includes('correct')) {
            state.currentRole = profileData?.experiences?.[0]?.title || message;
            responseMessage = "Perfect. Now, to make our future check-ins fast and effective, it helps to know what you're working on. What are the 1-3 main projects or initiatives you're focused on right now? You can think of these as your major 'Journeys'.";
            nextStep = 2;
          } else {
            responseMessage = "No problem! Please tell me your current role and company so I can update your journey accordingly.";
            nextStep = 1.5;
          }
          break;

        case 1.5: // Get correct current role
          if (!message || typeof message !== 'string') {
            responseMessage = "Could you please tell me your current role and company?";
            break;
          }
          state.currentRole = message;
          responseMessage = "Got it! Now, to make our future check-ins fast and effective, it helps to know what you're working on. What are the 1-3 main projects or initiatives you're focused on right now? You can think of these as your major 'Journeys'.";
          nextStep = 2;
          break;

        case 2: // Get main projects
          if (!message || typeof message !== 'string') {
            responseMessage = "I didn't receive your message properly. Could you please tell me about your 1-3 main projects or initiatives again?";
            break;
          }

          const projects = message.split(/[,\n]|and\s+|\d+\./)
            .filter((p: string) => p.trim().length > 3)
            .map((p: string) => p.trim())
            .slice(0, 3);

          state.projects = projects;
          if (projects.length > 0) {
            responseMessage = `Excellent. This gives us the 'buckets' to track your progress against. To make sure I understand them, could you give me a one-sentence goal for each?\n\nLet's start with '${projects[0]}.' What's the main goal there?`;
            nextStep = 3;
          } else {
            responseMessage = "I'd love to hear about your specific projects. Could you list them more clearly? For example: 'Working on the new dashboard feature, preparing Q4 roadmap, and mentoring junior developers.'";
          }
          break;

        case 3: // Get context for each project
          if (!message || typeof message !== 'string') {
            const currentProjectIndex = Object.keys(state.projectContexts).length;
            const currentProject = state.projects[currentProjectIndex];
            responseMessage = `Could you please tell me about the goal for '${currentProject}'?`;
            break;
          }

          const currentProjectIndex = Object.keys(state.projectContexts).length;
          const currentProject = state.projects[currentProjectIndex];

          if (currentProject) {
            state.projectContexts[currentProject] = message;

            const nextProjectIndex = currentProjectIndex + 1;
            if (nextProjectIndex < state.projects.length) {
              const nextProject = state.projects[nextProjectIndex];
              responseMessage = `Got it. And for '${nextProject}'?`;
            } else {
              // Onboarding complete
              isComplete = true;
              const projectsList = state.projects.map((project: string) =>
                `• ${project}: ${state.projectContexts[project] || 'Working on this initiative'}`
              ).join('\n');

              responseMessage = `Thank you! I've got it all. Now I understand that you're ${state.currentRole}, focusing on:\n\n${projectsList}\n\nAll with the goal of ${userInterest === 'find-job' ? 'finding your next role' : userInterest === 'grow-career' ? 'advancing in your current career' : userInterest === 'change-careers' ? 'transitioning to a new career' : userInterest === 'start-startup' ? 'building your startup' : 'achieving your professional goals'}.\n\nWhen you tell me next week about your progress, I'll know exactly which project it relates to and can help track your journey toward your goals.\n\nI'm ready to start capturing your progress. Feel free to share updates anytime!`;
            }
          }
          break;
      }

      // Update state
      state.step = nextStep;
      await this.onboardingManager.setState(userId, state);

      // If onboarding is complete, clear the state
      if (isComplete) {
        await this.onboardingManager.clearState(userId);
      }

      // Use the agent to generate the response with memory
      const response = await agent.generate(responseMessage, {
        resourceId,
        threadId,
        runtimeContext,
      });

      this.handleSuccess(res, {
        message: response.text || responseMessage,
        step: nextStep,
        isComplete,
        state,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to process onboarding step'));
      }
    }
  }

  /**
   * POST /api/ai/analyze-milestone - Analyze message for milestone extraction
   */
  async analyzeMilestone(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = analyzeMilestoneRequestSchema.parse(req.body);
      const { message, existingNodes, userContext } = validatedData;

      const milestoneData = await milestoneExtractor.extractMilestone(
        message,
        existingNodes || [],
        userContext
      );

      // If milestone found, generate follow-up questions
      if (milestoneData.hasMilestone && milestoneData.milestone) {
        const followUpQuestions = await milestoneExtractor.generateFollowUpQuestions(
          milestoneData.milestone,
          userContext?.interest || 'general'
        );

        // Categorize skills if any were extracted
        let categorizedSkills = { technical: [], soft: [], domain: [] };
        if (milestoneData.extractedSkills && milestoneData.extractedSkills.length > 0) {
          categorizedSkills = await milestoneExtractor.categorizeSkills(
            milestoneData.extractedSkills
          );
        }

        this.handleSuccess(res, {
          ...milestoneData,
          suggestedQuestions: followUpQuestions,
          categorizedSkills,
        });
      } else {
        this.handleSuccess(res, milestoneData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to analyze milestone'));
      }
    }
  }

  /**
   * POST /api/ai/generate-questions - Generate contextual questions
   */
  async generateQuestions(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = generateQuestionsRequestSchema.parse(req.body);
      const { userInterest, currentContext } = validatedData;

      const questions = await this.generateSimpleContextualQuestions(userInterest, currentContext);

      this.handleSuccess(res, { questions });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to generate questions'));
      }
    }
  }

  /**
   * GET /api/ai/checkin/:userId - Generate contextual check-in questions
   */
  async generateCheckin(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');

      const checkInTheme = await contextManager.generateContextualCheckIn(userId.toString());

      this.handleSuccess(res, {
        theme: checkInTheme?.primaryTheme || checkInTheme?.theme || 'general',
        reasoning: checkInTheme?.reasoning || 'Starting with general check-in questions',
        suggestedQuestions: checkInTheme?.suggestedQuestions || checkInTheme?.questions || [
          "What was the most significant challenge you faced this week?",
          "What achievement are you most proud of recently?",
          "What would you like to focus on improving next week?"
        ],
        specificFocus: checkInTheme?.specificFocus || [],
        contextualReferences: checkInTheme?.contextualReferences || [],
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to generate contextual check-in'));
    }
  }

  /**
   * POST /api/ai/process-checkin - Process check-in conversation and extract progress
   */
  async processCheckin(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = processCheckinRequestSchema.parse(req.body);
      const { userId, conversation } = validatedData;

      const result = await contextManager.updateProgressFromCheckIn(userId.toString(), conversation);

      this.handleSuccess(res, {
        progressUpdate: result,
        generatedTasks: [], // Not implemented in contextManager yet
        summary: {
          milestonesCompleted: result?.completedMilestones?.length || 0,
          progressUpdates: result?.progressUpdates?.length || 0,
          newGoals: result?.newGoals?.length || 0,
          challengesIdentified: result?.challengesIdentified?.length || 0,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to process check-in conversation'));
      }
    }
  }

  /**
   * GET /api/ai/context/:userId - Get user's recent context and patterns
   */
  async getUserContext(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');
      const { days = '14' } = req.query;

      const context = await contextManager.extractContext(userId.toString(), parseInt(days as string));

      if (!context) {
        this.handleSuccess(res, {
          hasContext: false,
          message: 'No recent conversation history found'
        });
        return;
      }

      this.handleSuccess(res, {
        hasContext: true,
        context: {
          challengesSummary: {
            total: context.challenges.length,
            ongoing: context.challenges.filter(c => c.status === 'ongoing').length,
            high_severity: context.challenges.filter(c => c.severity === 'high').length,
          },
          achievementsSummary: {
            total: context.achievements.length,
            recent: context.achievements.filter(a =>
              new Date(a.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ).length,
          },
          goalsSummary: {
            total: context.goals.length,
            completed: context.goals.filter(g => g.status === 'completed').length,
            inProgress: context.goals.filter(g => g.status === 'in-progress').length,
            blocked: context.goals.filter(g => g.status === 'blocked').length,
          },
          patterns: context.patterns.map(p => ({
            type: p.type,
            description: p.description,
            frequency: p.frequency,
          })),
        }
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to retrieve user context'));
    }
  }

  /**
   * POST /api/ai/import-profile - Import profile data into vector database
   */
  async importProfile(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = importProfileRequestSchema.parse(req.body);
      const { userId, profileData } = validatedData;

      await profileVectorManager.importProfileData(userId.toString(), profileData);

      this.handleSuccess(res, {
        success: true,
        message: 'Profile data imported successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to import profile data'));
      }
    }
  }

  /**
   * POST /api/ai/reindex - Reindex profile data in vector database
   */
  async reindexProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      await profileVectorManager.clearProfileData(user.id.toString());

      this.handleSuccess(res, {
        success: true,
        message: 'Profile data reindexed successfully'
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to reindex profile data'));
    }
  }

  /**
   * GET /api/ai/profile-history/:userId - Search profile history endpoint
   */
  async searchProfileHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');
      const { query, types, limit } = req.query;

      const typesParam = (types as string);
      const entityTypes = types ? (typesParam.includes(",") ? typesParam.split(',') : [types]) : undefined;

      const results = await profileVectorManager.searchProfileHistory(
        userId.toString(),
        query as string,
        {
          entityTypes,
          limit: parseInt(limit as string) || 10,
        }
      );

      this.handleSuccess(res, { results });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to search profile history'));
    }
  }

  /**
   * GET /api/ai/conversation-history/:userId - Get conversation summaries endpoint
   */
  async getConversationHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');
      const { query, limit } = req.query;

      const conversationSummarizer = new ConversationSummarizer();
      const results = await conversationSummarizer.searchConversationHistory(
        userId.toString(),
        query as string || 'recent conversations',
        parseInt(limit as string) || 5
      );

      this.handleSuccess(res, { results });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to search conversation history'));
    }
  }

  /**
   * POST /api/ai/rotate-thread - Force thread rotation endpoint (for testing)
   */
  async rotateThread(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = rotateThreadRequestSchema.parse(req.body);
      const { userId } = validatedData;

      const newThreadId = await threadManager.forceRotateThread(userId.toString());

      this.handleSuccess(res, {
        success: true,
        newThreadId,
        message: 'Thread rotated successfully'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to rotate thread'));
      }
    }
  }

  /**
   * POST /api/ai/extract-skills - Extract skills from text (temporarily disabled)
   */
  async extractSkills(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Skill extraction temporarily disabled'));
  }

  /**
   * GET /api/ai/skills/:userId - Get user's skills (temporarily disabled)
   */
  async getUserSkills(req: Request, res: Response): Promise<void> {
    try {
      const userId = this.validateId(req.params.userId, 'userId');
      const skills = [];

      // For now, return simplified response - other methods need implementation
      this.handleSuccess(res, {
        skills,
        skillsByCategory: {},
        stats: { total: skills.length }
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to retrieve skills'));
    }
  }

  /**
   * POST /api/ai/analyze-skills - Analyze user skill profile (temporarily disabled)
   */
  async analyzeSkills(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Skill analysis endpoint is being refactored'));
  }

  /**
   * POST /api/ai/skill-suggestions - Get skill suggestions for career path (temporarily disabled)
   */
  async getSkillSuggestions(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Skill suggestions endpoint is being refactored'));
  }

  /**
   * POST /api/ai/extract-milestone-skills - Extract skills from all user milestones (temporarily disabled)
   */
  async extractMilestoneSkills(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Milestone skill extraction endpoint is being refactored'));
  }

  /**
   * PUT /api/ai/skills/:userId/:skillName/status - Update skill activity status (temporarily disabled)
   */
  async updateSkillStatus(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Skill status update endpoint is being refactored'));
  }

  /**
   * GET /api/ai/skills/:userId/search - Search skills (temporarily disabled)
   */
  async searchSkills(req: Request, res: Response): Promise<void> {
    this.handleError(res, new BusinessRuleError('Skill search endpoint is being refactored'));
  }

  /**
   * POST /api/ai/chat/initialize - Initialize chat session
   */
  async initializeChat(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Generate a unique thread ID for this chat session
      const threadId = `chat_${user.id}_${Date.now()}`;
      
      this.handleSuccess(res, {
        threadId,
        message: 'Chat initialized successfully'
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to initialize chat'));
    }
  }

  /**
   * POST /api/ai/chat/message - Process chat message with automatic milestone creation
   */
  async processChatMessage(req: Request, res: Response): Promise<void> {
    try {
      let validatedData;
      let userId: number;

      // Handle both authenticated sessions and direct userId parameter
      try {
        const user = this.getAuthenticatedUser(req);
        userId = user.id;
        validatedData = chatMessageRequestSchema.omit({ userId: true }).parse(req.body);
      } catch (authError) {
        // If authentication fails, try to get userId from request body
        validatedData = chatMessageRequestSchema.parse(req.body);
        if (!validatedData.userId) {
          throw new ValidationError('User not authenticated and no userId provided');
        }
        userId = validatedData.userId;
      }

      const { message, threadId, context } = validatedData;

      if (!message) {
        throw new ValidationError('Message is required');
      }

      console.log(`🗨️ Processing chat message from user ${userId}:`, message);
      console.log(`🔗 Context:`, context);

      // Use the simplified career agent
      const { processCareerConversation } = await import('../services/ai/simplified-career-agent');

      // Include context in the message if provided
      let contextualMessage = message;
      if (context) {
        const { insertionPoint, parentNode, targetNode } = context;
        let contextPrefix = 'Context: ';
        
        if (insertionPoint === 'between' && parentNode && targetNode) {
          contextPrefix += `Add between ${parentNode.title} and ${targetNode.title}. `;
        } else if (insertionPoint === 'after' && targetNode) {
          contextPrefix += `Add after ${targetNode.title}. `;
        } else if (insertionPoint === 'branch' && parentNode) {
          contextPrefix += `Add as a project/branch to ${parentNode.title}. `;
        }
        
        contextualMessage = contextPrefix + message;
      }

      // Process the conversation
      const agentResult = await processCareerConversation({
        message: contextualMessage,
        userId: userId.toString(),
        threadId: threadId || `chat_${userId}_${Date.now()}`,
      });

      // Check if the response indicates a milestone was created
      const responseText = agentResult.response.toLowerCase();
      const milestoneCreationIndicators = [
        'successfully added',
        'added your',
        'added the',
        'created the',
        'added project',
        'added experience',
        'added education'
      ];

      const milestoneWasCreated = milestoneCreationIndicators.some(indicator => 
        responseText.includes(indicator)
      );

      console.log(`✅ Chat processed. Profile updated: ${agentResult.updatedProfile}, Milestone created: ${milestoneWasCreated}`);

      // Return the response with milestone creation flag
      this.handleSuccess(res, {
        message: agentResult.response,
        actionTaken: agentResult.actionTaken,
        updatedProfile: agentResult.updatedProfile,
        milestoneCreated: milestoneWasCreated,
        needsRefresh: agentResult.updatedProfile || milestoneWasCreated,
        threadId: threadId || `chat_${userId}_${Date.now()}`
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.handleError(res, new ValidationError('Invalid request data', error.errors));
      } else {
        this.handleError(res, error instanceof Error ? error : new Error('Failed to process chat message'));
      }
    }
  }

  /**
   * Helper: Lazy career agent initialization
   */
  private async getCareerAgent() {
    if (!this.careerAgent) {
      this.careerAgent = await createCareerAgent();
    }
    return this.careerAgent;
  }

  /**
   * Helper: Generate simple contextual questions
   */
  private async generateSimpleContextualQuestions(userInterest: string, currentContext?: any) {
    const baseQuestions = {
      'find-job': [
        "What type of role are you most interested in?",
        "What skills would you like to highlight in your job search?",
        "What kind of company culture are you looking for?",
        "What's your target timeline for finding a new position?"
      ],
      'grow-career': [
        "What specific areas of your current role would you like to develop?",
        "What new responsibilities would you like to take on?",
        "What skills would most help your career advancement?",
        "Who in your organization could be a good mentor or sponsor?"
      ],
      'change-careers': [
        "What industry or field are you considering transitioning to?",
        "What transferable skills do you have from your current career?",
        "What additional training or education might you need?",
        "What's your timeline for making this career change?"
      ],
      'start-startup': [
        "What problem are you passionate about solving?",
        "What market or industry are you considering?",
        "What skills or experience do you bring to this venture?",
        "What resources do you need to get started?"
      ]
    };

    return baseQuestions[userInterest as keyof typeof baseQuestions] || baseQuestions['grow-career'];
  }
}