import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createCareerMemory, preloadUserWorkingMemory } from './memory-manager';
import { careerTools } from './career-tools';

interface ProcessingResult {
  response: string;
  actionTaken: string;
  nextAction: 'completed' | 'needs_followup' | 'error';
  updatedNodes?: string[];
}

// Step 1: Check onboarding status
export async function checkOnboardingStatus(userId: string): Promise<{
  isOnboarded: boolean;
  hasWorkingMemory: boolean;
}> {
  console.log('🔍 Checking onboarding status for user:', userId);

  try {
    // Import User model to check onboarding status
    const { users } = await import('../../../shared/schema');
    const { db } = await import('../../db');
    const { eq } = await import('drizzle-orm');

    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
    const isOnboarded = user[0]?.hasCompletedOnboarding || false;

    // For working memory, we assume it's initialized if user is onboarded
    // In practice, you'd check the actual memory content
    const hasWorkingMemory = isOnboarded;

    console.log(`✅ Status check - Onboarded: ${isOnboarded}, Working Memory: ${hasWorkingMemory}`);

    return { isOnboarded, hasWorkingMemory };
  } catch (error) {
    console.error('❌ Failed to check onboarding status:', error);
    return { isOnboarded: false, hasWorkingMemory: false };
  }
}

// Step 2: Handle onboarding
export async function handleOnboarding(
  userId: string,
  message: string,
  threadId?: string
): Promise<ProcessingResult> {
  console.log('🚀 Starting onboarding for user:', userId);

  const { memory } = await createCareerMemory();

  // Create onboarding agent
  const onboardingAgent = new Agent({
    name: 'Onboarding Specialist',
    instructions: `You are an expert onboarding specialist for a career guidance platform. Your job is to collect essential profile information from new users in a conversational way.

You need to collect:
1. **Name**: What should I call you?
2. **Current Role & Company**: What's your current job title and where do you work?
3. **Career Interest**: Are you looking to find-job, grow-career, change-careers, or start-startup?
4. **Current Projects/Journeys** (1-3 max): What are your main projects or initiatives you're working on?
5. **Project Goals**: For each project, get a one-sentence goal

Be conversational and ask follow-up questions to get complete information. Once you have all the required information, respond with "ONBOARDING_COMPLETE" followed by a summary.

Important: Don't overwhelm the user - ask 1-2 questions at a time and build on their responses.`,
    model: openai('gpt-4o-mini'),
    memory,
  });

  try {
    const response = await onboardingAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId || `onboarding-${Date.now()}`,
      }
    });

    // Check if onboarding is complete
    const isComplete = response.text.includes('ONBOARDING_COMPLETE');

    if (isComplete) {
      // Update user onboarding status
      const { users } = await import('../../../shared/schema');
      const { db } = await import('../../db');
      const { eq } = await import('drizzle-orm');

      await db.update(users)
        .set({ hasCompletedOnboarding: true })
        .where(eq(users.id, parseInt(userId)));

      console.log('✅ Onboarding completed for user:', userId);

      return {
        response: response.text,
        actionTaken: 'onboarding_completed',
        nextAction: 'completed',
      };
    }

    return {
      response: response.text,
      actionTaken: 'onboarding_in_progress',
      nextAction: 'needs_followup',
    };
  } catch (error) {
    console.error('❌ Onboarding failed:', error);
    return {
      response: 'I encountered an issue during onboarding. Please try again.',
      actionTaken: 'onboarding_error',
      nextAction: 'error',
    };
  }
}

// Step 3: Initialize working memory
export async function initializeWorkingMemory(userId: string): Promise<ProcessingResult> {
  console.log('💾 Initializing working memory for user:', userId);

  try {
    // Get profile data from database
    const { profiles } = await import('../../../shared/schema');
    const { db } = await import('../../db');
    const { eq } = await import('drizzle-orm');

    const userProfile = await db.select().from(profiles)
      .where(eq(profiles.userId, parseInt(userId)))
      .limit(1);

    if (!userProfile[0]) {
      return {
        response: 'I need to set up your profile first. Let me gather some basic information.',
        actionTaken: 'memory_init_skipped',
        nextAction: 'needs_followup',
      };
    }

    const profileData = userProfile[0].rawData;

    // Use the preloadUserWorkingMemory function
    await preloadUserWorkingMemory(
      userId,
      profileData,
      {
        careerInterest: 'find-job', // Default, should be updated from actual data
        careerGoals: {
          shortTerm: undefined,
          longTerm: undefined,
          keySkillsToDevelop: [],
        }
      }
    );

    console.log('✅ Working memory initialized for user:', userId);

    return {
      response: 'Perfect! I now have your profile information and I\'m ready to help with your career journey.',
      actionTaken: 'memory_initialized',
      nextAction: 'completed',
    };
  } catch (error) {
    console.error('❌ Failed to initialize working memory:', error);
    return {
      response: 'I had trouble setting up your profile. Let me help you manually.',
      actionTaken: 'memory_init_error',
      nextAction: 'error',
    };
  }
}

// Step 4: Analyze intent
export async function analyzeIntent(
  userId: string,
  message: string,
  threadId?: string
): Promise<'project_update' | 'new_information' | 'career_guidance'> {
  console.log('🧠 Analyzing intent for message:', message.substring(0, 100));

  const { memory } = await createCareerMemory();

  // Create intent analysis agent
  const intentAgent = new Agent({
    name: 'Intent Analyzer',
    instructions: `You are an expert at understanding user intent in career-related conversations.

Analyze the user's message and classify it into one of these categories:

1. **project_update**: User is providing updates on existing projects or work
   - Examples: "I finished the ML project", "Update on the API work", "We launched the feature"

2. **new_information**: User is sharing new experiences, education, or projects
   - Examples: "I started a new job", "I'm working on a new project", "I just graduated"

3. **career_guidance**: User is asking for advice or general career discussion
   - Examples: "What should I focus on?", "How do I improve?", "Career advice needed"

Respond with just the category name: project_update, new_information, or career_guidance`,
    model: openai('gpt-4o-mini'),
    memory,
  });

  try {
    const response = await intentAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId || `intent-${Date.now()}`,
      }
    });

    const intent = response.text.toLowerCase().trim();

    if (intent.includes('project_update')) return 'project_update';
    if (intent.includes('new_information')) return 'new_information';
    return 'career_guidance';
  } catch (error) {
    console.error('❌ Intent analysis failed:', error);
    return 'career_guidance'; // Default fallback
  }
}

// Step 5a: Handle project updates
export async function handleProjectUpdate(
  userId: string,
  message: string,
  threadId?: string
): Promise<ProcessingResult> {
  console.log('📝 Handling project updates for user:', userId);

  const { memory } = await createCareerMemory();

  // Create project update agent
  const updateAgent = new Agent({
    name: 'Project Update Specialist',
    instructions: `You are a project update specialist that helps users track their work progress over time.

Your responsibilities:
1. **Identify Projects**: Use get-projects to find existing projects mentioned in the user's message
2. **Collect Progress Details**: Ask for specific details about what was accomplished
3. **Timeline Tracking**: Note progress over weeks/months and track timelines
4. **Multiple Updates**: Support updating multiple projects from a single message
5. **Use Tools**: Always use add-update-to-project or add-project-work to save updates

When processing updates:
- First, use get-projects to see all existing projects
- Match the user's message to relevant projects
- Ask clarifying questions if the update is vague
- Capture specific accomplishments, challenges, skills used, and impact
- Update working memory with progress notes

For multiple updates in one message:
- Process each project update separately
- Confirm which projects are being updated
- Save updates for each project individually

Be conversational but systematic in collecting project progress information.`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools as any,
  });

  try {
    const response = await updateAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId || `update-${Date.now()}`,
      }
    });

    // Extract updated project information from tool calls
    const toolCalls = response.toolCalls || [];
    const updatedProjects = toolCalls
      .filter(call => call.toolName.includes('update') || call.toolName.includes('add-update'))
      .map(call => call.args.projectId || call.args.title || 'unknown');

    console.log('✅ Project updates processed:', updatedProjects.length);

    return {
      response: response.text,
      actionTaken: 'project_updates_processed',
      nextAction: 'completed',
      updatedNodes: updatedProjects,
    };
  } catch (error) {
    console.error('❌ Project update failed:', error);
    return {
      response: 'I had trouble updating your projects. Let me try a different approach.',
      actionTaken: 'project_update_error',
      nextAction: 'error',
    };
  }
}

// Step 5b: Handle new information
export async function handleNewInformation(
  userId: string,
  message: string,
  threadId?: string
): Promise<ProcessingResult> {
  console.log('🆕 Handling new information for user:', userId);

  const { memory } = await createCareerMemory();

  // Create new information handler agent
  const newInfoAgent = new Agent({
    name: 'New Information Specialist',
    instructions: `You are a specialist at processing new career information (experiences, education, projects).

Your key responsibilities:

**For New Projects:**
1. **Check Existing Experiences**: ALWAYS use get-experiences first to see existing work history
2. **Smart Association**: Automatically match new projects to relevant existing experiences based on:
   - Company names mentioned
   - Timeline context (current role, recent roles)
   - Role/technology alignment
3. **Confirm Association**: Ask user to confirm: "This sounds like it's part of your [Role] position at [Company]. Is that correct?"
4. **Handle Confirmation**:
   - If confirmed: Use add-project-to-experience with the existing experience
   - If not: Ask which experience it belongs to or create new experience first

**For New Experiences:**
- Collect: title (required), company (required), start date (required)
- Ask systematically but conversationally: "What's your job title?" "Which company?" "When did you start?"
- Use add-experience tool once you have required information

**For New Education:**
- Collect: school (required), degree (helpful), field (helpful), dates (helpful)
- Use add-education tool

**Multiple Node Creation:**
- Support creating multiple nodes from single user message
- Process each item systematically
- Example: "I started at Google as SWE and began working on ML project" → Create experience + Create project

**Tool Usage:**
- get-experiences: Check existing work history before creating projects
- add-experience: Create new work experiences
- add-education: Create new education entries
- add-project-to-experience: Associate projects with specific experiences
- add-project: Streamlined project creation (if experience is known)

Always confirm associations and collect complete information before using tools.`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools as any,
  });

  try {
    const response = await newInfoAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId || `new-info-${Date.now()}`,
      }
    });

    // Extract created nodes from tool calls
    const toolCalls = response.toolCalls || [];
    const createdNodes = toolCalls
      .filter(call => call.toolName.includes('add-'))
      .map(call => `${call.toolName}: ${call.args.title || call.args.company || call.args.school || 'unknown'}`);

    console.log('✅ New information processed. Created nodes:', createdNodes.length);

    return {
      response: response.text,
      actionTaken: 'new_information_processed',
      nextAction: 'completed',
      updatedNodes: createdNodes,
    };
  } catch (error) {
    console.error('❌ New information processing failed:', error);
    return {
      response: 'I had trouble processing that information. Could you provide more details?',
      actionTaken: 'new_info_error',
      nextAction: 'error',
    };
  }
}

// Step 5c: Handle career guidance
export async function handleCareerGuidance(
  userId: string,
  message: string,
  threadId?: string
): Promise<ProcessingResult> {
  console.log('💬 Handling career guidance for user:', userId);

  const { memory } = await createCareerMemory();

  // Create career guidance agent
  const guidanceAgent = new Agent({
    name: 'Career Guidance Expert',
    instructions: `You are a career guidance expert helping users with their professional development.

Provide thoughtful, actionable career advice based on:
- The user's working memory (profile, experiences, goals)
- Their specific question or concern
- Their career interest (find-job, grow-career, change-careers, start-startup)

Be supportive, specific, and provide concrete next steps when possible.`,
    model: openai('gpt-4o-mini'),
    memory,
  });

  try {
    const response = await guidanceAgent.generate(message, {
      memory: {
        resource: userId,
        thread: threadId || `guidance-${Date.now()}`,
      }
    });

    return {
      response: response.text,
      actionTaken: 'career_guidance_provided',
      nextAction: 'completed',
    };
  } catch (error) {
    console.error('❌ Career guidance failed:', error);
    return {
      response: 'I\'d love to help with your career question. Could you tell me more about what you\'re looking for?',
      actionTaken: 'guidance_error',
      nextAction: 'error',
    };
  }
}

// Main processing pipeline
export async function processCareerConversation(
  userId: string,
  message: string,
  threadId?: string
): Promise<ProcessingResult> {
  console.log(`🚀 Processing career conversation for user ${userId}`);

  try {
    // Step 1: Check onboarding status
    const { isOnboarded, hasWorkingMemory } = await checkOnboardingStatus(userId);

    // Step 2: Handle onboarding if needed
    if (!isOnboarded) {
      return await handleOnboarding(userId, message, threadId);
    }

    // Step 3: Initialize working memory if needed
    if (!hasWorkingMemory) {
      const memoryResult = await initializeWorkingMemory(userId);
      if (memoryResult.nextAction === 'error') {
        return memoryResult;
      }
      // Continue processing the original message
    }

    // Step 4: Analyze intent
    const intent = await analyzeIntent(userId, message, threadId);

    // Step 5: Handle based on intent
    switch (intent) {
      case 'project_update':
        return await handleProjectUpdate(userId, message, threadId);

      case 'new_information':
        return await handleNewInformation(userId, message, threadId);
    }

  } catch (error) {
    console.error('❌ Processing pipeline failed:', error);

    return {
      response: 'I encountered an issue processing your request. Please try again, and if the problem persists, let me know what you were trying to do.',
      actionTaken: 'pipeline_error',
      nextAction: 'error',
    };
  }
}
