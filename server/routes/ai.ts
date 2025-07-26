import { Router } from 'express';
import {
  createCareerAgent,
  generateContextualQuestions,
  generateContextualCheckIn,
  processCheckInConversation,
  extractMilestoneWithContext,
  generateProjectFollowUpQuestions,
  findBestParentNode
} from '../services/ai/career-agent';
import { OnboardingStateManager } from '../services/ai/memory-manager';
import { milestoneExtractor } from '../services/ai/milestone-extractor';
import { contextManager } from '../services/ai/context-manager';
import { threadManager } from '../services/ai/thread-manager';
import { profileVectorManager } from '../services/ai/profile-vector-manager';
import { ConversationSummarizer } from '../services/ai/conversation-summarizer';
import { SkillExtractor } from '../services/ai/skill-extractor';
import { memoryHierarchy } from '../services/ai/memory-hierarchy';
import { getSkillService, getSkillExtractor } from '../core/bootstrap';
import { storage } from '../storage';
import { RedisAdapter } from '../adapters/redis-adapter';
import { nanoid } from 'nanoid';
import { RuntimeContext } from '@mastra/core/runtime-context';

const router = Router();

// Initialize Redis adapter for onboarding state
const redisClient = new RedisAdapter();

const onboardingManager = new OnboardingStateManager(redisClient);

// Initialize the career agent
let careerAgent: any;
(async () => {
  careerAgent = await createCareerAgent();
})();



// Main chat endpoint with streaming support
router.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!careerAgent) {
      return res.status(503).json({ error: 'AI service is initializing' });
    }

    // Fetch user data and profile data from database
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = await storage.getProfileByUserId(userId);
    // Note: profile is optional as user might not have completed profile setup

    // Get active thread (with automatic rotation)
    const conversationThreadId = await threadManager.getActiveThread(userId);
    const resourceId = `user_${userId}`;

    // Validate thread ID before proceeding
    if (!conversationThreadId) {
      throw new Error(`Failed to create or retrieve thread for user ${userId}`);
    }

    // Increment message count for thread management
    await threadManager.incrementMessageCount(userId);

    // Add user message to short-term memory
    await memoryHierarchy.addMessageToShortTerm(userId, conversationThreadId, 'user', message);

    // Set up SSE for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Get memory context for the conversation
    const memoryContext = await memoryHierarchy.getContextForPrompt(userId, conversationThreadId, message);

    // Get additional relevant context from vectors (with fallback)
    let profileHistory: any[] = [];

    try {
      profileHistory = await profileVectorManager.searchProfileHistory(userId, message, { limit: 5 });
    } catch (error) {
      console.log('Vector search failed in chat endpoint, continuing without context:', error instanceof Error ? error.message : error);
    }

    // Create runtime context with enriched data
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', userId);
    runtimeContext.set('userInterest', user.interest);
    runtimeContext.set('profileData', profile?.filteredData || null);
    runtimeContext.set('profileHistory', profileHistory);
    runtimeContext.set('conversationHistory', memoryContext.relevantHistory);
    runtimeContext.set('shortTermMemory', memoryContext.shortTerm);
    runtimeContext.set('longTermMemory', memoryContext.longTerm);
    // Add SSE response for real-time UI updates
    runtimeContext.set('sseResponse', res);

    console.log(`🔍 Starting chat for user ${userId} in thread ${conversationThreadId} with context: ${runtimeContext}`);

    // The agent will now handle milestone extraction and node management through tools
    // Remove the manual milestone extraction logic as the agent will use tools for this

    // Stream the agent's response
    const streamResponse = await careerAgent.stream(message, {
      memory: {
        resource: resourceId,
        thread: conversationThreadId,
      },
      runtimeContext,
    });

    let fullResponse = '';

    // Handle text streaming
    if (streamResponse.textStream) {
      for await (const chunk of streamResponse.textStream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({
          type: 'text',
          content: chunk,
        })}\n\n`);
      }
    }

    // // Extract skills from the conversation
    // try {
    //   const skillExtractor = await getSkillExtractor();
    //   const skillService = await getSkillService();

    //   const skillResult = await skillExtractor.extractSkillsFromText(message, {
    //     source: 'conversation',
    //     userId,
    //     careerGoal: userInterest
    //   });

    //   if (skillResult.extractedSkills.length > 0) {
    //     await skillService.storeSkills(userId, skillResult.extractedSkills);

    //     // Send skills extraction event
    //     res.write(`data: ${JSON.stringify({
    //       type: 'skills',
    //       data: {
    //         skillsExtracted: skillResult.extractedSkills.length,
    //         newSkills: skillResult.extractedSkills.map(s => ({
    //           name: s.name,
    //           category: s.category,
    //           confidence: s.confidence
    //         }))
    //       },
    //     })}\n\n`);
    //   }
    // } catch (error) {
    //   console.error('Error extracting skills from conversation:', error);
    // }

    // Follow-up questions are now handled by the agent through its tools and conversation flow

    // Add assistant's response to short-term memory
    if (fullResponse) {
      await memoryHierarchy.addMessageToShortTerm(userId, conversationThreadId, 'assistant', fullResponse);
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'done',
      threadId: conversationThreadId,
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Onboarding endpoint
router.post('/api/ai/onboard', async (req, res) => {
  try {
    const { userId, step, message, profileData, userInterest } = req.body;

    if (!careerAgent) {
      return res.status(503).json({ error: 'AI service is initializing' });
    }

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
    const response = await careerAgent.generate(responseMessage, {
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
router.get('/api/ai/threads/:userId', async (req, res) => {
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
router.post('/api/ai/analyze-milestone', async (req, res) => {
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
router.post('/api/ai/generate-questions', async (req, res) => {
  try {
    const { userInterest, currentContext } = req.body;

    if (!careerAgent) {
      return res.status(503).json({ error: 'AI service is initializing' });
    }

    const questions = await generateContextualQuestions(
      careerAgent,
      userInterest,
      currentContext
    );

    res.json({ questions });
  } catch (error) {
    console.error('Generate questions error:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Generate contextual check-in questions
router.get('/api/ai/checkin/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const checkInTheme = await generateContextualCheckIn(userId);

    res.json({
      theme: checkInTheme?.primaryTheme || 'general',
      reasoning: checkInTheme?.reasoning || 'Starting with general check-in questions',
      suggestedQuestions: checkInTheme?.suggestedQuestions || [
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
router.post('/api/ai/process-checkin', async (req, res) => {
  try {
    const { userId, conversation } = req.body;

    if (!userId || !conversation) {
      return res.status(400).json({ error: 'userId and conversation are required' });
    }

    const result = await processCheckInConversation(userId, conversation);

    res.json({
      progressUpdate: result.progressUpdate,
      generatedTasks: result.generatedTasks,
      summary: {
        milestonesCompleted: result.progressUpdate?.completedMilestones?.length || 0,
        progressUpdates: result.progressUpdate?.progressUpdates?.length || 0,
        newGoals: result.progressUpdate?.newGoals?.length || 0,
        challengesIdentified: result.progressUpdate?.challengesIdentified?.length || 0,
      }
    });
  } catch (error) {
    console.error('Process check-in error:', error);
    res.status(500).json({ error: 'Failed to process check-in conversation' });
  }
});

// Get user's recent context and patterns
router.get('/api/ai/context/:userId', async (req, res) => {
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
router.post('/api/ai/import-profile', async (req, res) => {
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

// Search profile history endpoint
router.get('/api/ai/profile-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { query, types, limit } = req.query;

    const results = await profileVectorManager.searchProfileHistory(
      userId,
      query as string || 'career professional experience',
      {
        types: types ? (types as string).split(',') as any : undefined,
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
router.get('/api/ai/conversation-history/:userId', async (req, res) => {
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
router.post('/api/ai/rotate-thread', async (req, res) => {
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
router.post('/api/ai/extract-skills', async (req, res) => {
  try {
    const { text, userId, source = 'manual', careerGoal } = req.body;

    if (!text || !userId) {
      return res.status(400).json({ error: 'text and userId are required' });
    }

    const skillExtractor = await getSkillExtractor();
    const skillService = await getSkillService();

    // Get existing skills to avoid duplicates
    const existingSkills = await skillService.getUserSkills(userId);

    const result = await skillExtractor.extractSkillsFromText(text, {
      source,
      userId,
      existingSkills: existingSkills.map(s => ({ name: s.name, category: s.category })),
      careerGoal
    });

    // Store extracted skills
    if (result.extractedSkills.length > 0) {
      await skillService.storeSkills(userId, result.extractedSkills);
    }

    res.json({
      success: true,
      skillsExtracted: result.extractedSkills.length,
      categorizedSkills: result.categorizedSkills,
      skillSuggestions: result.skillSuggestions,
      reasoning: result.reasoning
    });
  } catch (error) {
    console.error('Skill extraction error:', error);
    res.status(500).json({ error: 'Failed to extract skills' });
  }
});

// Get user's skills
router.get('/api/ai/skills/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { category, minConfidence, limit } = req.query;

    const skillService = await getSkillService();

    const skills = await skillService.getUserSkills(userId, {
      category: category as string,
      minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive: true
    });

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
router.post('/api/ai/analyze-skills', async (req, res) => {
  res.status(501).json({ error: 'Skill analysis endpoint is being refactored' });
});

// Get skill suggestions for career path (temporarily disabled)
router.post('/api/ai/skill-suggestions', async (req, res) => {
  res.status(501).json({ error: 'Skill suggestions endpoint is being refactored' });
});

// Extract skills from all user milestones (temporarily disabled)
router.post('/api/ai/extract-milestone-skills', async (req, res) => {
  res.status(501).json({ error: 'Milestone skill extraction endpoint is being refactored' });
});

// Update skill activity status (temporarily disabled)
router.put('/api/ai/skills/:userId/:skillName/status', async (req, res) => {
  res.status(501).json({ error: 'Skill status update endpoint is being refactored' });
});

// Search skills (temporarily disabled)
router.get('/api/ai/skills/:userId/search', async (req, res) => {
  res.status(501).json({ error: 'Skill search endpoint is being refactored' });
});

export default router;
