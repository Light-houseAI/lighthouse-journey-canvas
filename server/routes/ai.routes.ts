import { Router } from 'express';
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
// TODO: Skill services removed - these routes need to be updated or removed
import { requireAuth, containerMiddleware } from '../middleware';
import { RedisAdapter } from '../adapters/redis-adapter';
import { randomUUID } from 'crypto';
import { RuntimeContext } from '@mastra/core/di';

const router = Router();
router.use(requireAuth, containerMiddleware);

// Initialize Redis adapter for onboarding state
const redisClient = new RedisAdapter();

const onboardingManager = new OnboardingStateManager(redisClient);

// Helper function to generate simple contextual questions
async function generateSimpleContextualQuestions(userInterest: string, currentContext?: any) {
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

// Lazy career agent initialization
let careerAgent: any = null;
async function getCareerAgent() {
  if (!careerAgent) {
    careerAgent = await createCareerAgent();
  }
  return careerAgent;
}



// Resume workflow endpoint - now using simplified agent for continuation
router.post('/chat/resume', async (req, res) => {
  try {
    const { userId, workflowId, userInput } = req.body;

    if (!workflowId || !userInput) {
      return res.status(400).json({ error: 'workflowId and userInput are required' });
    }

    // Use simplified career agent for continuation instead of workflow
    const { processCareerConversation } = await import('../services/ai/simplified-career-agent');

    const agentResult = await processCareerConversation({
      message: userInput,
      userId: `${userId}`,
      threadId: `resume-${workflowId}`,
    });

    // Handle completion
    return res.json({
      type: 'completed',
      message: agentResult.response,
      actionTaken: agentResult.actionTaken,
      updatedProfile: agentResult.updatedProfile,
    });

  } catch (error) {
    console.error('Resume conversation error:', error);
    res.status(500).json({ error: 'Failed to resume conversation' });
  }
});

// Main chat endpoint with streaming support
router.post('/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    const agent = await getCareerAgent();

    // Fetch user data and profile data from database
    const userService = req.scope.resolve('userService');
    const user = await userService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Note: Legacy profile system removed - using timeline nodes instead

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
      userId: `${userId}`,
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
      await memoryHierarchy.addMessageToShortTerm(userId, conversationThreadId, 'assistant', fullResponse);
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
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Onboarding endpoint
router.post('/onboard', async (req, res) => {
  try {
    const { userId, step, message, profileData, userInterest } = req.body;

    const agent = await getCareerAgent();

    const resourceId = `user_${userId}`;
    const threadId = `onboarding_${userId}`;

    // Get or create onboarding state
    let state = await onboardingManager.getState(userId) || {
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
    await onboardingManager.setState(userId, state);

    // If onboarding is complete, clear the state
    if (isComplete) {
      await onboardingManager.clearState(userId);
    }

    // Use the agent to generate the response with memory
    const response = await agent.generate(responseMessage, {
      resourceId,
      threadId,
      runtimeContext,
    });

    res.json({
      message: response.text || responseMessage,
      step: nextStep,
      isComplete,
      state,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to process onboarding step' });
  }
});

// Get user's conversation threads
router.get('/threads/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // In a real implementation, you would query your database for threads
    // For now, return a placeholder response
    res.json({
      threads: [
        {
          id: `onboarding_${userId}`,
          title: 'Initial Setup',
          lastMessage: new Date(),
        },
      ],
    });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to retrieve threads' });
  }
});

// Analyze message for milestone extraction
router.post('/analyze-milestone', async (req, res) => {
  try {
    const { message, existingNodes, userContext } = req.body;

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

      res.json({
        ...milestoneData,
        suggestedQuestions: followUpQuestions,
        categorizedSkills,
      });
    } else {
      res.json(milestoneData);
    }
  } catch (error) {
    console.error('Milestone analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze milestone' });
  }
});

// Generate contextual questions
router.post('/generate-questions', async (req, res) => {
  try {
    const { userInterest, currentContext } = req.body;

    const agent = await getCareerAgent();

    // Generate simple contextual questions based on user interest
    const questions = await generateSimpleContextualQuestions(userInterest, currentContext);

    res.json({ questions });
  } catch (error) {
    console.error('Generate questions error:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Generate contextual check-in questions
router.get('/checkin/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const checkInTheme = await contextManager.generateContextualCheckIn(userId);

    res.json({
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
    console.error('Generate check-in error:', error);
    res.status(500).json({ error: 'Failed to generate contextual check-in' });
  }
});

// Process check-in conversation and extract progress
router.post('/process-checkin', async (req, res) => {
  try {
    const { userId, conversation } = req.body;

    if (!userId || !conversation) {
      return res.status(400).json({ error: 'userId and conversation are required' });
    }

    const result = await contextManager.updateProgressFromCheckIn(userId, conversation);

    res.json({
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
    console.error('Process check-in error:', error);
    res.status(500).json({ error: 'Failed to process check-in conversation' });
  }
});

// Get user's recent context and patterns
router.get('/context/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 14 } = req.query;

    const context = await contextManager.extractContext(userId, parseInt(days as string));

    if (!context) {
      return res.json({
        hasContext: false,
        message: 'No recent conversation history found'
      });
    }

    res.json({
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
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to retrieve user context' });
  }
});

// Import profile data into vector database
router.post('/import-profile', async (req, res) => {
  try {
    const { userId, profileData } = req.body;

    if (!userId || !profileData) {
      return res.status(400).json({ error: 'userId and profileData are required' });
    }

    await profileVectorManager.importProfileData(userId, profileData);

    res.json({
      success: true,
      message: 'Profile data imported successfully'
    });
  } catch (error) {
    console.error('Profile import error:', error);
    res.status(500).json({ error: 'Failed to import profile data' });
  }
});

// Import profile data into vector database
router.post('/reindex', async (req, res) => {
  try {
    const userId = parseInt(req.headers['x-user-id'] as string);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    // Legacy profile system removed - TODO: Update this to use timeline nodes
    await profileVectorManager.clearProfileData(userId.toString());

    res.json({
      success: true,
      message: 'Profile data imported successfully'
    });
  } catch (error) {
    console.error('Profile import error:', error);
    res.status(500).json({ error: 'Failed to import profile data' });
  }
});

// Search profile history endpoint
router.get('/profile-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { query, types, limit } = req.query;

    const typesParam = (types as string);

    const entityTypes = types ? (typesParam.includes(",") ? typesParam.split(',') : [types]) : undefined;

    const results = await profileVectorManager.searchProfileHistory(
      userId,
      query as string,
      {
        entityTypes,
        limit: parseInt(limit as string) || 10,
      }
    );

    res.json({ results });
  } catch (error) {
    console.error('Profile history search error:', error);
    res.status(500).json({ error: 'Failed to search profile history' });
  }
});

// Get conversation summaries endpoint
router.get('/conversation-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { query, limit } = req.query;

    const conversationSummarizer = new ConversationSummarizer();
    const results = await conversationSummarizer.searchConversationHistory(
      userId,
      query as string || 'recent conversations',
      parseInt(limit as string) || 5
    );

    res.json({ results });
  } catch (error) {
    console.error('Conversation history search error:', error);
    res.status(500).json({ error: 'Failed to search conversation history' });
  }
});

// Force thread rotation endpoint (for testing)
router.post('/rotate-thread', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const newThreadId = await threadManager.forceRotateThread(userId);

    res.json({
      success: true,
      newThreadId,
      message: 'Thread rotated successfully'
    });
  } catch (error) {
    console.error('Thread rotation error:', error);
    res.status(500).json({ error: 'Failed to rotate thread' });
  }
});

// Extract skills from text
// TODO: Re-implement skill extraction with hierarchical system
router.post('/extract-skills', async (req, res) => {
  // This route has been temporarily disabled - skill services removed
  res.status(503).json({ error: 'Skill extraction temporarily disabled' });
});

// Get user's skills
router.get('/skills/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, minConfidence, limit } = req.query;

    // TODO: Skill service removed - implement new skill extraction logic
    // const skillService = await getSkillService();
    // const skills = await skillService.getUserSkills(userId, {
    //   category: category as string,
    //   minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
    //   limit: limit ? parseInt(limit as string) : undefined,
    //   isActive: true
    // });
    const skills = [];

    // For now, return simplified response - other methods need implementation
    res.json({
      skills,
      skillsByCategory: {},
      stats: { total: skills.length }
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Failed to retrieve skills' });
  }
});

// Analyze user skill profile (temporarily disabled - needs refactoring)
router.post('/analyze-skills', async (req, res) => {
  res.status(501).json({ error: 'Skill analysis endpoint is being refactored' });
});

// Get skill suggestions for career path (temporarily disabled)
router.post('/skill-suggestions', async (req, res) => {
  res.status(501).json({ error: 'Skill suggestions endpoint is being refactored' });
});

// Extract skills from all user milestones (temporarily disabled)
router.post('/extract-milestone-skills', async (req, res) => {
  res.status(501).json({ error: 'Milestone skill extraction endpoint is being refactored' });
});

// Update skill activity status (temporarily disabled)
router.put('/skills/:userId/:skillName/status', async (req, res) => {
  res.status(501).json({ error: 'Skill status update endpoint is being refactored' });
});

// Search skills (temporarily disabled)
router.get('/skills/:userId/search', async (req, res) => {
  res.status(501).json({ error: 'Skill search endpoint is being refactored' });
});

// Initialize chat session
router.post('/chat/initialize', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Generate a unique thread ID for this chat session
    const threadId = `chat_${userId}_${Date.now()}`;
    
    res.json({
      threadId,
      message: 'Chat initialized successfully'
    });
  } catch (error) {
    console.error('Chat initialization error:', error);
    res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

// Process chat message with automatic milestone creation
router.post('/chat/message', async (req, res) => {
  try {
    const { message, threadId, userId: requestUserId, context } = req.body;
    const userId = req.session?.userId || requestUserId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
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
    res.json({
      message: agentResult.response,
      actionTaken: agentResult.actionTaken,
      updatedProfile: agentResult.updatedProfile,
      milestoneCreated: milestoneWasCreated,
      needsRefresh: agentResult.updatedProfile || milestoneWasCreated,
      threadId: threadId || `chat_${userId}_${Date.now()}`
    });

  } catch (error) {
    console.error('Chat message processing error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;