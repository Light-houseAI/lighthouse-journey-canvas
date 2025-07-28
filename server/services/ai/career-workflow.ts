import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createCareerMemory, preloadUserWorkingMemory } from './memory-manager';
import { careerTools } from './career-tools';

// Unified workflow context schema that accumulates data across steps
const WorkflowContextSchema = z.object({
  // Original input (always present)
  userId: z.string(),
  message: z.string(),
  threadId: z.string().optional(),

  // Step 1: Onboarding status (added by onboardingStatusCheck)
  isOnboarded: z.boolean().optional(),
  hasWorkingMemory: z.boolean().optional(),

  // Step 2: Profile data (added by userOnboarding)
  profileData: z.object({
    name: z.string().optional(),
    currentRole: z.string().optional(),
    company: z.string().optional(),
    careerInterest: z.enum(['find-job', 'grow-career', 'change-careers', 'start-startup']).optional(),
    currentProjects: z.array(z.object({
      title: z.string(),
      goal: z.string(),
    })).default([]),
  }).optional(),
  onboardingCompleted: z.boolean().optional(),

  // Step 3: Working memory status (added by workingMemoryInit)
  workingMemoryInitialized: z.boolean().optional(),

  // Step 4: Intent analysis (added by intentAnalysis) - now supports multiple intents
  intentData: z.object({
    intents: z.array(z.object({
      type: z.enum([
        'get_projects', 'add_project', 'update_project', 'add_project_to_experience',
        'get_experiences', 'add_experience', 'update_experience',
        'get_education', 'add_education', 'update_education'
      ]),
      confidence: z.number(),
      details: z.record(z.any()).optional(), // Tool-specific parameters
    })),
    processedIntents: z.array(z.string()).default([]), // Track completed intents
    remainingIntents: z.array(z.string()).default([]), // Track pending intents
  }).optional(),

  // Final response data (added by handlers)
  response: z.string().optional(),
  actionTaken: z.string().optional(),
  nextAction: z.enum(['completed', 'needs_followup', 'error']).optional(),
  updatedNodes: z.array(z.string()).optional(),
});

// Workflow input schema (initial input only)
const WorkflowInputSchema = z.object({
  userId: z.string(),
  message: z.string(),
  threadId: z.string().optional(),
});

// Workflow output schema (final result)
const WorkflowOutputSchema = z.object({
  response: z.string(),
  actionTaken: z.string().optional(),
  nextAction: z.enum(['completed', 'needs_followup', 'error', 'suspended']).optional(),
  updatedNodes: z.array(z.string()).optional(),
  suspendResult: z.object({
    isSuspended: z.boolean(),
    suspensionId: z.string(),
    message: z.string(),
    expectedInputType: z.enum(['text', 'confirmation', 'selection', 'structured_data']).optional(),
    possibleResponses: z.array(z.string()).optional(),
  }).optional(),
});

// Step 1: User Onboarding Status Check
const onboardingStatusCheck = createStep({
  id: 'onboarding-status-check',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }) => {
    console.log('🔍 Checking onboarding status for user:', inputData.userId);

    // Import User model to check onboarding status
    const { users } = await import('../../../shared/schema');
    const { db } = await import('../../db');
    const { eq } = await import('drizzle-orm');
    const user = await db.select().from(users).where(eq(users.id, parseInt(inputData.userId))).limit(1);
    console.log(`User onboarding status: ${user}`);
    const isOnboarded = user[0]?.hasCompletedOnboarding || false;

    // Check working memory status
    const { memory } = await createCareerMemory();
    let hasWorkingMemory = false;

    try {
      // Try to get working memory - if it has meaningful data, consider it initialized
      // This is a simplified check - in practice, you'd query the memory system
      hasWorkingMemory = isOnboarded; // Simplified assumption for now
    } catch (error) {
      console.log('Working memory check failed:', error);
      hasWorkingMemory = false;
    }

    console.log(`✅ Status check complete - Onboarded: ${isOnboarded}, Working Memory: ${hasWorkingMemory}`);

    // Return accumulated context with status information
    return {
      ...inputData, // Pass through original input
      isOnboarded,
      hasWorkingMemory,
    };
  },
});

// Step 2: User Onboarding
const userOnboarding = createStep({
  id: 'user-onboarding',
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }) => {
    console.log('🚀 Checking if onboarding is needed for user:', inputData.userId);

    // If user is already onboarded, skip this step
    if (inputData.isOnboarded) {
      console.log('✅ User already onboarded, skipping onboarding step');
      return {
        ...inputData, // Pass through existing context
        response: inputData.response || '', // Preserve any existing response
      };
    }

    console.log('🚀 Starting onboarding for new user:', inputData.userId);

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

    // Process the onboarding conversation
    const response = await onboardingAgent.generate(inputData.message, {
      memory: {
        resource: inputData.userId,
        thread: inputData.threadId || `onboarding-${Date.now()}`,
      }
    });

    // Check if onboarding is complete
    const isComplete = response.text.includes('ONBOARDING_COMPLETE');

    if (isComplete) {
      // Extract profile data from the conversation
      // This is a simplified version - in practice, you'd use more sophisticated extraction
      const profileData = {
        name: extractName(response.text),
        currentRole: extractRole(response.text),
        company: extractCompany(response.text),
        careerInterest: extractCareerInterest(response.text) as any,
        currentProjects: extractProjects(response.text),
      };

      // Update user onboarding status
      const { users } = await import('../../../shared/schema');
      const { db } = await import('../../db');
      const { eq } = await import('drizzle-orm');

      await db.update(users)
        .set({ hasCompletedOnboarding: true })
        .where(eq(users.id, parseInt(inputData.userId)));

      console.log('✅ Onboarding completed for user:', inputData.userId);

      // Return accumulated context with profile data
      return {
        ...inputData, // Pass through existing context
        profileData,
        onboardingCompleted: true,
        isOnboarded: true, // Update the status
        response: response.text,
      };
    }

    // Return context with onboarding in progress
    return {
      ...inputData, // Pass through existing context
      onboardingCompleted: false,
      response: response.text,
    };
  },
});

// Step 3: Working Memory Initialization
const workingMemoryInit = createStep({
  id: 'working-memory-init',
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  execute: async ({ inputData }) => {
    console.log('💾 Checking if working memory initialization is needed for user:', inputData.userId);

    // If working memory is already initialized, skip this step
    if (inputData.hasWorkingMemory) {
      console.log('✅ Working memory already initialized, skipping memory init step');
      return {
        ...inputData, // Pass through existing context
        response: inputData.response || '', // Preserve any existing response
      };
    }

    console.log('💾 Initializing working memory for user:', inputData.userId);

    try {
      // Get existing profile data from database if not provided
      let profileData = inputData.profileData;

      if (!profileData) {
        // Fetch from database
        const { profiles } = await import('../../../shared/schema');
        const { db } = await import('../../db');
        const { eq } = await import('drizzle-orm');

        const userProfile = await db.select().from(profiles)
          .where(eq(profiles.userId, parseInt(inputData.userId)))
          .limit(1);

        if (userProfile[0]) {
          const rawData = userProfile[0].rawData;
          profileData = {
            name: rawData.name,
            currentRole: undefined, // Will be extracted from experiences
            company: undefined, // Will be extracted from experiences
            careerInterest: 'find-job' as const, // Default, should be updated
            currentProjects: [], // Will be populated from existing data
          };
        }
      }

      // Use the preloadUserWorkingMemory function
      await preloadUserWorkingMemory(
        inputData.userId,
        profileData || {}
      );

      console.log('✅ Working memory initialized for user:', inputData.userId);

      // Return accumulated context with memory status
      return {
        ...inputData, // Pass through existing context
        workingMemoryInitialized: true,
        hasWorkingMemory: true, // Update the status
        response: 'Working memory has been initialized with your profile data.',
      };
    } catch (error) {
      console.error('❌ Failed to initialize working memory:', error);
      return {
        ...inputData, // Pass through existing context
        workingMemoryInitialized: false,
        response: 'Failed to initialize working memory. Please try again.',
      };
    }
  },
});

// Step 4: Intent Understanding & Classification
const intentAnalysis = createStep({
  id: 'intent-analysis',
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowContextSchema,
  suspendSchema: z.object({
    reason: z.string(),
    message: z.string(),
    originalMessage: z.string(),
    userId: z.string(),
    stepId: z.string(),
  }),
  resumeSchema: z.object({
    clarification: z.string(),
  }),
  execute: async ({ inputData, suspend, resumeData }) => {
    console.log('🧠 Analyzing intent for message:', inputData.message.substring(0, 100));

    const { memory } = await createCareerMemory();

    // Determine the message to analyze and instructions based on whether we have clarification
    let messageToAnalyze: string;
    let instructions: string;

    if (resumeData?.clarification) {
      console.log('📝 Received clarification:', resumeData.clarification);
      messageToAnalyze = `${inputData.message} ${resumeData.clarification}`;
      instructions = `You are analyzing a user message that has been clarified. The user originally said: "${inputData.message}" and then clarified: "${resumeData.clarification}". Now identify the specific tools needed based on the complete context.

**Available Tools and When to Use Them:**

**Project Tools:**
- get_projects: When user mentions existing projects or needs to reference current projects
- add_project: When user mentions starting/creating a new project
- update_project: When user provides updates on existing project progress/status
- add_project_to_experience: When user associates a project with a specific job/experience

**Experience Tools:**
- get_experiences: When user references work history or needs to check existing jobs
- add_experience: When user mentions starting a new job/role
- update_experience: When user updates job details (promotion, role change, etc.)

**Education Tools:**
- get_education: When user references their educational background
- add_education: When user mentions new degree, course, certification
- update_education: When user updates educational information

**Response Format:**
INTENTS:
- TOOL: [tool_name]
  CONFIDENCE: [0.0-1.0]
  ENTITIES: {entities relevant to this tool}
  DETAILS: {tool-specific parameters}

Be comprehensive - identify ALL tools needed to fully process the user's message.`;
    } else {
      messageToAnalyze = inputData.message;
      instructions = `You are an expert at analyzing user messages and breaking them down into specific tool-based actions. Your job is to identify ALL the tools that need to be called to fully process the user's request.

**Available Tools and When to Use Them:**

**Project Tools:**
- get_projects: When user mentions existing projects or needs to reference current projects
- add_project: When user mentions starting/creating a new project
- update_project: When user provides updates on existing project progress/status
- add_project_to_experience: When user associates a project with a specific job/experience

**Experience Tools:**
- get_experiences: When user references work history or needs to check existing jobs
- add_experience: When user mentions starting a new job/role
- update_experience: When user updates job details (promotion, role change, etc.)

**Education Tools:**
- get_education: When user references their educational background
- add_education: When user mentions new degree, course, certification
- update_education: When user updates educational information

**Your Analysis Should:**
1. Identify ALL tools needed to process the request completely
2. Determine the optimal execution order (some tools depend on others)
3. Extract specific entities for each tool call
4. Provide confidence levels for each intent

**If the message is unclear or ambiguous AND missing REQUIRED information, respond with "NEEDS_CLARIFICATION:" followed by specific questions for REQUIRED fields only.**

**Required Information by Tool:**
- add_experience: Job title + Company name + Start date
- add_education: School/University name
- add_project_to_experience: Project name
- add_project: Project name

**Don't ask for clarification on optional fields like descriptions, end dates, technologies, team sizes, etc. Use smart defaults instead.**

**Response Format:**
INTENTS:
- TOOL: [tool_name]
  CONFIDENCE: [0.0-1.0]
  ENTITIES: {entities relevant to this tool}
  DETAILS: {tool-specific parameters}

OR

NEEDS_CLARIFICATION: [specific questions to ask the user]

**Examples:**
- "I started a new job at Google as SWE and I'm working on an ML project" needs:
  1. add_experience (for Google job)
  2. add_project_to_experience (for ML project at Google)

- "I finished my AWS certification and completed the API project at work" needs:
  1. add_education (for AWS cert)
  2. update_project (for API project completion)

Be comprehensive - identify ALL tools needed to fully process the user's message.`;
    }

    // Create single multi-intent analysis agent
    const intentAgent = new Agent({
      name: 'Multi-Intent Tool Analyzer',
      instructions,
      model: openai('gpt-4o-mini'),
      memory,
    });

    const response = await intentAgent.generate(messageToAnalyze, {
      memory: {
        resource: `user_${inputData.userId}`,
        thread: inputData.threadId || `intent-${Date.now()}`,
      }
    });

    // Check if clarification is needed (only for initial analysis, not after clarification)
    if (!resumeData?.clarification && response.text.includes('NEEDS_CLARIFICATION:')) {
      const clarificationMessage = response.text.replace('NEEDS_CLARIFICATION:', '').trim();

      // Use native suspend function with only serializable data
      console.log('🔄 Intent analysis needs clarification, suspending workflow');
      console.log('Suspending with message:', clarificationMessage);

      await suspend({
        reason: 'intent_clarification_needed',
        message: clarificationMessage,
        originalMessage: inputData.message,
        userId: inputData.userId,
        stepId: 'intent-analysis'
      });

      // Execution is paused here - this code will not run until resumed
    }

    // Parse the structured response from the LLM
    const responseText = response.text;
    console.log('🔍 Raw LLM response for intent analysis:', responseText);

    const intentData = parseIntentResponse(responseText);
    console.log('📊 Parsed intent data:', JSON.stringify(intentData, null, 2));

    console.log('✅ Intent analysis complete:', intentData.intents.length, 'intents identified');

    // Return accumulated context with intent data
    return {
      ...inputData, // Pass through existing context
      intentData,
    };
  },
});

// Helper function to parse multi-intent LLM response
function parseIntentResponse(responseText: string) {
  console.log('🔧 Parsing response text:', responseText);

  const lines = responseText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const intents: Array<{
    type: 'get_projects' | 'add_project' | 'update_project' | 'add_project_to_experience' |
          'get_experiences' | 'add_experience' | 'update_experience' |
          'get_education' | 'add_education' | 'update_education';
    confidence: number;
    entities?: any;
    details?: any;
  }> = [];

  let currentIntent: any = null;
  let inEntities = false;
  let inDetails = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`🔧 Processing line ${i}: "${line}"`);

    // Start of a new intent - be more flexible with patterns
    if (line.match(/^-?\s*TOOL:\s*/i) || line.match(/^-?\s*tool:\s*/i)) {
      // Save previous intent if exists
      if (currentIntent) {
        console.log('🎯 Saving current intent:', currentIntent);
        intents.push(currentIntent);
      }

      const toolName = line.replace(/^-?\s*TOOL:\s*/i, '').trim();
      console.log('🎯 Found tool:', toolName);

      // Validate tool name
      const validTools = [
        'get_projects', 'add_project', 'update_project', 'add_project_to_experience',
        'get_experiences', 'add_experience', 'update_experience',
        'get_education', 'add_education', 'update_education'
      ];

      if (validTools.includes(toolName)) {
        currentIntent = {
          type: toolName as any,
          confidence: 0.7,
          entities: {},
          details: {}
        };
        inEntities = false;
        inDetails = false;
      } else {
        console.log('⚠️ Invalid tool name:', toolName, 'Valid tools:', validTools);
      }
    }

    // Parse confidence
    if (line.includes('CONFIDENCE:') && currentIntent) {
      const conf = parseFloat(line.replace(/.*CONFIDENCE:\s*/, '').trim());
      if (!isNaN(conf)) currentIntent.confidence = conf;
    }

    // Parse entities section
    if (line.includes('ENTITIES:') && currentIntent) {
      inEntities = true;
      inDetails = false;
      // Try to parse inline entities
      const entitiesStr = line.replace(/.*ENTITIES:\s*/, '').trim();
      if (entitiesStr && entitiesStr !== '{}') {
        try {
          currentIntent.entities = JSON.parse(entitiesStr);
        } catch {
          // Will parse from following lines
        }
      }
    }

    // Parse details section
    if (line.includes('DETAILS:') && currentIntent) {
      inDetails = true;
      inEntities = false;
      // Try to parse inline details
      const detailsStr = line.replace(/.*DETAILS:\s*/, '').trim();
      if (detailsStr && detailsStr !== '{}') {
        try {
          currentIntent.details = JSON.parse(detailsStr);
        } catch {
          // Will parse from following lines
        }
      }
    }

    // Parse entity/detail lines
    if (currentIntent && (inEntities || inDetails) && line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.replace(/^-?\s*/, '').toLowerCase();

      if (inEntities) {
        currentIntent.entities[cleanKey] = extractListFromLine(value);
      } else if (inDetails) {
        currentIntent.details[cleanKey] = value;
      }
    }
  }

  // Save last intent
  if (currentIntent) {
    console.log('🎯 Saving final intent:', currentIntent);
    intents.push(currentIntent);
  }

  console.log('📊 Total intents parsed:', intents.length);

  return {
    intents,
    processedIntents: [],
    remainingIntents: intents.map((_, index) => index.toString()),
  };
}

// Helper function to extract lists from text
function extractListFromLine(text: string): string[] {
  if (!text || text.trim() === '' || text.trim() === '[]') return [];

  return text
    .replace(/[\[\]]/g, '') // Remove brackets
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

// Tool nodes removed - using direct agent approach in multiIntentProcessor

// Multi-Intent Processor: Processes all intents until complete
const multiIntentProcessor = createStep({
  id: 'multi-intent-processor',
  inputSchema: WorkflowContextSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({ inputData, suspend, runtimeContext }) => {
    console.log('🔄 Processing multiple intents for user:', inputData.userId);

    if (!inputData.intentData?.intents || inputData.intentData.intents.length === 0) {
      return {
        response: 'No specific actions identified in your message.',
        actionTaken: 'no_intents_found',
        nextAction: 'completed' as const,
      };
    }

    const { memory } = await createCareerMemory();

    let accumulatedResponse = '';
    const processedIntents: string[] = [];
    const actionsTaken: string[] = [];

    // Process each intent sequentially using agents with tools
    for (let i = 0; i < inputData.intentData.intents.length; i++) {
      const intent = inputData.intentData.intents[i];

      console.log(`🎯 Processing intent ${i + 1}/${inputData.intentData.intents.length}: ${intent.type}`);

      try {
        // Create an agent with the appropriate tools for this intent
        const agent = new Agent({
          name: `${intent.type} Agent`,
          instructions: `You are an expert at using career tools. Use the appropriate tool(s) to process the user's request for ${intent.type}.

IMPORTANT: Only ask for REQUIRED fields when you need user input. Don't ask for optional fields unless absolutely necessary.

**Required Fields Only:**
- add_experience: title, company, start date (description and end date are optional)
- add_education: school (degree, field, dates are optional)
- add_project_to_experience: project title (role, team size, dates are optional)
- add_project: project title (description, technologies, dates are optional)

**Smart Defaults for Optional Fields:**
- Use "Present" for missing end dates if it's current role/education
- Leave optional descriptions empty if not provided
- Default empty arrays for technologies/skills if not mentioned

**When to Ask for Clarification (Required Fields Only):**
- Project/experience name is completely unclear
- Company name is ambiguous when required
- Dates are required but completely missing context

**Don't Ask For:**
- Optional descriptions unless they're critical
- Optional dates unless specifically needed
- Optional technical details like team size, role specifics`,
          model: openai('gpt-4o-mini'),
          memory,
          tools: careerTools as any,
        });

        // Pass runtimeContext to agent for SSE events, but don't persist it in workflow state
        const response = await agent.generate(inputData.message, {
          memory: {
            resource: inputData.userId,
            thread: inputData.threadId || `${intent.type}-${Date.now()}`,
          },
          runtimeContext
        });

        const responseText = response.text;

        // Check if this intent needs more information
        if (needsMoreInformation(responseText)) {
          // Use native suspend function - only include serializable data
          console.log(`🔄 Intent ${intent.type} needs more information, suspending workflow`);
          console.log('Suspending with message:', responseText);

          await suspend({
            reason: 'intent_needs_more_info',
            message: responseText,
            intentType: intent.type,
            currentIntent: i,
            accumulatedResponse,
            processedIntents,
            actionsTaken,
            originalMessage: inputData.message,
            userId: inputData.userId,
            stepId: 'multi-intent-processor'
          });

          // Execution is paused here - this code will not run until resumed
        }

        accumulatedResponse = accumulatedResponse ? `${accumulatedResponse}

${responseText}` : responseText;
        processedIntents.push(`${i}:${intent.type}`);
        actionsTaken.push(intent.type);

      } catch (error) {
        console.error(`❌ Error processing intent ${intent.type}:`, error);
        actionsTaken.push(`${intent.type}_error`);
      }
    }

    // Extract updated nodes from the accumulated response
    const updatedNodes = extractUpdatedNodesFromResponse(accumulatedResponse);

    console.log(`✅ Multi-intent processing complete. Processed: ${processedIntents.length} intents`);

    return {
      response: accumulatedResponse || 'All intents have been processed.',
      actionTaken: actionsTaken.join(', '),
      nextAction: 'completed' as const,
      updatedNodes,
    };
  },
});

// Helper function to detect if agent needs more information
function needsMoreInformation(responseText: string): boolean {
  const needsMorePatterns = [
    /could you.*more specific/i,
    /need more information/i,
    /can you clarify/i,
    /which.*do you mean/i,
    /tell me more about/i,
    /what.*company/i,
    /what.*project/i,
    /when did.*start/i,
    /what.*role/i,
    /I need to know/i,
    /please provide/i,
    /can you specify/i,
  ];

  return needsMorePatterns.some(pattern => pattern.test(responseText));
}

// Helper function to extract updated nodes from response text
function extractUpdatedNodesFromResponse(responseText: string): string[] {
  const nodes: string[] = [];

  // Simple extraction based on common patterns
  const patterns = [
    /added project[:\s]+"([^"]+)"/gi,
    /created project[:\s]+"([^"]+)"/gi,
    /updated project[:\s]+"([^"]+)"/gi,
    /added experience[:\s]+"([^"]+)"/gi,
    /updated experience[:\s]+"([^"]+)"/gi,
    /added education[:\s]+"([^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    const matches = responseText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        nodes.push(match[1]);
      }
    }
  }

  return [...new Set(nodes)]; // Remove duplicates
}

// Create workflow with simplified steps
const careerJourneyWorkflow = createWorkflow({
  id: 'career-journey-workflow',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  steps: [
    onboardingStatusCheck,
    userOnboarding,
    workingMemoryInit,
    intentAnalysis,
    multiIntentProcessor,
  ],
});

// Simplified workflow: process intents sequentially until all are complete
careerJourneyWorkflow
  .then(onboardingStatusCheck)
  .then(userOnboarding) // Checks if onboarding needed
  .then(workingMemoryInit) // Checks if memory init needed
  .then(intentAnalysis) // Analyzes multiple intents
  .then(multiIntentProcessor) // Processes all intents until complete
  .commit();

// Helper functions for data extraction (kept for compatibility)
function extractName(text: string): string {
  // Simple name extraction - in real implementation, use NLP
  const nameMatch = text.match(/(?:I'm|I am|My name is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  return nameMatch ? nameMatch[1] : 'User';
}

function extractRole(text: string): string | undefined {
  // Simple role extraction
  const roleMatch = text.match(/(?:I work as|I'm a|I am a|my job is|my role is)\s+([^.]+)/i);
  return roleMatch ? roleMatch[1].trim() : undefined;
}

function extractCompany(text: string): string | undefined {
  // Simple company extraction
  const companyMatch = text.match(/(?:at|for|with)\s+([A-Z][A-Za-z\s&]+)(?:\.|,|$)/);
  return companyMatch ? companyMatch[1].trim() : undefined;
}

function extractCareerInterest(text: string): string {
  // Simple interest extraction
  if (text.toLowerCase().includes('find') && text.toLowerCase().includes('job')) return 'find-job';
  if (text.toLowerCase().includes('grow') && text.toLowerCase().includes('career')) return 'grow-career';
  if (text.toLowerCase().includes('change') && text.toLowerCase().includes('career')) return 'change-careers';
  if (text.toLowerCase().includes('startup')) return 'start-startup';
  return 'grow-career'; // default
}

function extractProjects(text: string): Array<{title: string; goal: string}> {
  // Simple project extraction - in real implementation, use more sophisticated parsing
  const projects = [];
  const projectWords = ['project', 'working on', 'building', 'developing'];

  for (const word of projectWords) {
    if (text.toLowerCase().includes(word)) {
      projects.push({
        title: 'Project mentioned in conversation',
        goal: 'Goal to be clarified'
      });
      break;
    }
  }

  return projects;
}

// Create a non-serializable wrapper for SSE response to prevent circular reference errors
function createSSEWrapper(sseResponse: any) {
  return {
    write: sseResponse.write.bind(sseResponse),
    destroyed: sseResponse.destroyed,
    // Add toJSON method to return empty object during serialization
    toJSON: () => ({}),
  };
}

// Workflow execution function with suspend/resume support
export async function executeCareerWorkflow(
  userId: string,
  message: string,
  threadId?: string,
  sseResponse?: any
): Promise<{
  response: string;
  actionTaken?: string;
  nextAction: 'completed' | 'needs_followup' | 'error' | 'suspended';
  updatedNodes?: string[];
  suspensionId?: string;
  runId?: string;
  suspendedStep?: string;
}> {
  console.log(`🚀 Executing career workflow for user ${userId}`);

  try {
    // Get the workflow from Mastra instance
    const { getCareerWorkflow } = await import('./mastra');
    const workflow = getCareerWorkflow();

    // Create a workflow run using async API for proper state management
    console.log('🚀 Creating workflow run');
    const run = await workflow.createRunAsync();

    // Create runtime context - use a non-serializable wrapper for SSE response
    const { RuntimeContext } = await import('@mastra/core/di');
    const runtimeContext = new RuntimeContext();
    if (sseResponse) {
      // Store SSE response in a way that doesn't get serialized during workflow snapshots
      runtimeContext.set('sseResponse', createSSEWrapper(sseResponse));
      console.log('✅ Added SSE response wrapper to runtime context for milestone events');
    }

    // Execute the workflow with input data and runtime context
    console.log('📤 Starting workflow with inputData:', { userId, message, threadId });
    const result = await run.start({
      inputData: {
        userId,
        message,
        threadId,
      },
      runtimeContext
    });

    console.log('✅ Workflow execution result status:', result.status);

    if (result.status === 'success') {
      console.log('🎉 Workflow completed successfully');
      return {
        response: result.result.response,
        actionTaken: result.result.actionTaken,
        nextAction: result.result.nextAction || 'completed',
        updatedNodes: result.result.updatedNodes,
      };
    }

    if (result.status === 'failed') {
      console.error('❌ Workflow execution failed:', result.error);
      return {
        response: 'I encountered an issue processing your request. Please try again, and if the problem persists, let me know what you were trying to do.',
        actionTaken: 'workflow_error',
        nextAction: 'error',
      };
    }

    if (result.status === 'suspended') {
      console.log('⏸️ Workflow suspended, extracting suspend payload');
      console.log('Suspended steps:', result.suspended);

      // Extract suspension information from the result
      let suspendPayload: any = null;
      let suspendedStepId = '';

      if (result.suspended && result.suspended.length > 0) {
        // Get the suspended step ID (handle both string and array formats)
        suspendedStepId = Array.isArray(result.suspended[0]) ? result.suspended[0][0] : result.suspended[0];
        console.log('📍 Suspended at step:', suspendedStepId);

        // Extract payload from step results
        if (result.steps && (result.steps as any)[suspendedStepId]) {
          const stepResult = (result.steps as any)[suspendedStepId];
          console.log('📦 Step result:', JSON.stringify(stepResult, null, 2));

          // The suspend payload should be in the step result
          suspendPayload = stepResult.suspendPayload;
        }
      }

      // Extract the suspension message with fallbacks
      const suspensionMessage = suspendPayload?.message || 'Please provide additional information to continue.';
      const actionTaken = suspendPayload?.reason || 'workflow_suspended';

      console.log('💬 Suspension message:', suspensionMessage);

      return {
        response: suspensionMessage,
        actionTaken,
        nextAction: 'suspended',
        suspensionId: `${userId}-${suspendedStepId}-${Date.now()}`,
        runId: run.runId,
        suspendedStep: suspendedStepId,
      };
    }

    // Unexpected status - this should not happen with proper typing
    console.warn('⚠️ Unexpected workflow status');
    return {
      response: 'I processed your request but encountered an unexpected state. Please try again.',
      actionTaken: 'workflow_unknown_state',
      nextAction: 'error',
    };

  } catch (error) {
    console.error('❌ Workflow execution error:', error);
    return {
      response: 'I encountered an issue processing your request. Please try again, and if the problem persists, let me know what you were trying to do.',
      actionTaken: 'workflow_execution_error',
      nextAction: 'error',
    };
  }
}

// Resume a suspended workflow with user input
export async function resumeCareerWorkflow(
  runId: string,
  suspendedStep: string,
  userInput: string,
  sseResponse?: any
): Promise<{
  response: string;
  actionTaken?: string;
  nextAction: 'completed' | 'needs_followup' | 'error' | 'suspended';
  updatedNodes?: string[];
  suspensionId?: string;
  runId?: string;
  suspendedStep?: string;
}> {
  console.log(`🔄 Resuming career workflow: ${runId} at step: ${suspendedStep}`);

  try {
    // Get the workflow from Mastra instance
    const { getCareerWorkflow } = await import('./mastra');
    const workflow = getCareerWorkflow();

    // Create a run instance with the existing run ID
    const run = await workflow.createRunAsync({ runId });

    // Create runtime context with SSE response wrapper for career tools
    const { RuntimeContext } = await import('@mastra/core/di');
    const runtimeContext = new RuntimeContext();
    if (sseResponse) {
      runtimeContext.set('sseResponse', createSSEWrapper(sseResponse));
      console.log('✅ Added SSE response wrapper to runtime context for resume milestone events');
    }

    // Resume the workflow with the user input and runtime context
    console.log('📤 Resuming with input:', userInput);
    const result = await run.resume({
      step: suspendedStep,
      resumeData: {
        clarification: userInput, // For intent analysis step
        userInput: userInput,     // Generic fallback
      },
      runtimeContext
    });

    console.log('✅ Resume result status:', result.status);

    if (result.status === 'success') {
      console.log('🎉 Workflow resumed and completed successfully');
      return {
        response: result.result.response,
        actionTaken: result.result.actionTaken,
        nextAction: result.result.nextAction || 'completed',
        updatedNodes: result.result.updatedNodes,
      };
    }

    if (result.status === 'failed') {
      console.error('❌ Workflow resume failed:', result.error);
      return {
        response: 'I encountered an issue resuming your conversation. Please try again.',
        actionTaken: 'resume_error',
        nextAction: 'error',
      };
    }

    if (result.status === 'suspended') {
      console.log('⏸️ Workflow suspended again after resume');

      // Extract suspension information (same logic as initial execution)
      let suspendPayload: any = null;
      let suspendedStepId = '';

      if (result.suspended && result.suspended.length > 0) {
        suspendedStepId = Array.isArray(result.suspended[0]) ? result.suspended[0][0] : result.suspended[0];

        if (result.steps && (result.steps as any)[suspendedStepId]) {
          const stepResult = (result.steps as any)[suspendedStepId];
          suspendPayload = stepResult.payload || stepResult.suspendPayload || stepResult;
        }
      }

      const suspensionMessage = suspendPayload?.message || 'Please provide additional information to continue.';
      const actionTaken = suspendPayload?.reason || 'workflow_suspended_again';

      return {
        response: suspensionMessage,
        actionTaken,
        nextAction: 'suspended',
        suspensionId: `${runId}-${suspendedStepId}-${Date.now()}`,
        runId: runId,
        suspendedStep: suspendedStepId,
      };
    }

    // Unexpected status
    console.warn('⚠️ Unexpected workflow resume status');
    return {
      response: 'I processed your input but encountered an unexpected state. Please try again.',
      actionTaken: 'resume_unknown_state',
      nextAction: 'error',
    };

  } catch (error) {
    console.error('❌ Resume workflow error:', error);
    return {
      response: 'I encountered an error resuming your conversation. Please try again.',
      actionTaken: 'resume_error',
      nextAction: 'error',
    };
  }
}

export { careerJourneyWorkflow };
