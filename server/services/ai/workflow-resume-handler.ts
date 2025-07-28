import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { createCareerMemory } from './memory-manager';
import { careerTools } from './career-tools';
import { ResumeResult, SuspendResult } from './workflow-state-manager';

// Resume workflow from any step with user input
export async function resumeWorkflowFromStep(
  userId: string,
  stepId: string,
  stepData: Record<string, any>,
  userInput: string,
  inputType: 'text' | 'confirmation' | 'selection' | 'structured_data'
): Promise<ResumeResult> {
  console.log(`🔄 Resuming workflow from step: ${stepId} for user: ${userId}`);

  try {
    switch (stepId) {
      case 'intent-analysis':
        return await resumeIntentAnalysis(userId, stepData, userInput, inputType);
      
      case 'multi-intent-processor':
        return await resumeMultiIntentProcessor(userId, stepData, userInput, inputType);
      
      case 'user-onboarding':
        return await resumeUserOnboarding(userId, stepData, userInput, inputType);
      
      case 'working-memory-init':
        return await resumeWorkingMemoryInit(userId, stepData, userInput, inputType);
      
      default:
        return {
          response: 'I encountered an issue resuming from that step. Please start a new conversation.',
          actionTaken: 'unknown_step_resume',
          nextAction: 'error',
        };
    }
  } catch (error) {
    console.error(`❌ Error resuming from step ${stepId}:`, error);
    return {
      response: 'I encountered an error resuming your conversation. Please try again.',
      actionTaken: 'resume_error',
      nextAction: 'error',
    };
  }
}

// Resume intent analysis with clarification
async function resumeIntentAnalysis(
  userId: string,
  stepData: Record<string, any>,
  userInput: string,
  inputType: 'text' | 'confirmation' | 'selection' | 'structured_data'
): Promise<ResumeResult> {
  console.log('🧠 Resuming intent analysis with user clarification');

  const { memory } = await createCareerMemory();

  // Create clarification agent
  const clarificationAgent = new Agent({
    name: 'Intent Clarification Agent',
    instructions: `You are an expert at clarifying user intent based on their follow-up responses. The user previously sent a message that needed clarification, and now they've provided additional information.

Original context: ${JSON.stringify(stepData, null, 2)}

Based on their clarification: "${userInput}", determine the specific tools and actions needed.

**Available Tools:**
- get_projects, add_project, update_project, add_project_to_experience
- get_experiences, add_experience, update_experience  
- get_education, add_education, update_education

**Response Format:**
CLARIFIED_INTENTS:
- TOOL: [tool_name]  
  CONFIDENCE: [0.0-1.0]
  ENTITIES: {relevant entities}
  DETAILS: {tool-specific parameters}

Be specific and actionable based on their clarification.`,
    model: openai('gpt-4o-mini'),
    memory,
  });

  const response = await clarificationAgent.generate(
    `Original message: "${stepData.originalMessage || ''}"
User clarification: "${userInput}"
Please identify the clarified intents.`,
    {
      memory: {
        resource: userId,
        thread: stepData.threadId || `clarification-${Date.now()}`,
      }
    }
  );

  // Parse the clarified intents
  const intentData = parseIntentResponse(response.text);

  if (intentData.intents.length === 0) {
    return {
      response: "I still need more information to help you. Could you be more specific about what you'd like to do?",
      actionTaken: 'intent_still_unclear',
      nextAction: 'needs_followup',
    };
  }

  // Continue to multi-intent processing
  return await processIntents(userId, {
    ...stepData,
    intentData,
  });
}

// Resume multi-intent processor with additional input
async function resumeMultiIntentProcessor(
  userId: string,
  stepData: Record<string, any>,
  userInput: string,
  inputType: 'text' | 'confirmation' | 'selection' | 'structured_data'
): Promise<ResumeResult> {
  console.log('🔄 Resuming multi-intent processor with user input');

  const { memory } = await createCareerMemory();
  const { getWorkflowStateManager } = await import('./workflow-state-manager');
  const stateManager = getWorkflowStateManager();

  // Get the current intent being processed
  const currentIntent = stepData.currentIntent || 0;
  const intents = stepData.intentData?.intents || [];

  if (currentIntent >= intents.length) {
    return {
      response: 'All your requests have been processed.',
      actionTaken: 'all_intents_completed',
      nextAction: 'completed',
    };
  }

  const intent = intents[currentIntent];
  console.log(`🎯 Resuming intent ${currentIntent + 1}/${intents.length}: ${intent.type}`);

  try {
    // Create agent with tools for the current intent
    const agent = new Agent({
      name: `${intent.type} Resume Agent`,
      instructions: `You are resuming processing for ${intent.type}. The user has provided additional information: "${userInput}". 

Use the appropriate tools to complete the action. If you still need more information, ask specific questions.

Context: ${JSON.stringify(stepData, null, 2)}`,
      model: openai('gpt-4o-mini'),
      memory,
      tools: careerTools as any,
    });

    const response = await agent.generate(userInput, {
      memory: {
        resource: userId,
        thread: stepData.threadId || `resume-${intent.type}-${Date.now()}`,
      }
    });

    // Check if this intent still needs more information
    if (needsMoreInformation(response.text)) {
      const suspendResult = await stateManager.suspendWorkflow(
        userId,
        'career-journey-workflow',
        stepData.runId || `run-${Date.now()}`,
        'multi-intent-processor',
        {
          ...stepData,
          currentIntent,
          lastResponse: response.text,
        },
        'awaiting_user_input',
        response.text,
        {
          expectedInputType: 'text',
        }
      );

      return {
        response: response.text,
        actionTaken: `${intent.type}_needs_more_info`,
        nextAction: 'suspended',
        suspendResult,
      };
    }

    // Intent completed, move to next
    const nextIntent = currentIntent + 1;
    
    if (nextIntent >= intents.length) {
      // All intents completed
      return {
        response: response.text,
        actionTaken: 'all_intents_completed',
        nextAction: 'completed',
        updatedNodes: extractUpdatedNodesFromResponse(response.text),
      };
    }

    // Continue with next intent
    return await processNextIntent(userId, {
      ...stepData,
      currentIntent: nextIntent,
      accumulatedResponse: (stepData.accumulatedResponse || '') + '\n\n' + response.text,
    });

  } catch (error) {
    console.error(`❌ Error resuming intent ${intent.type}:`, error);
    return {
      response: `I encountered an error processing your ${intent.type} request. Please try again.`,
      actionTaken: `${intent.type}_error`,
      nextAction: 'error',
    };
  }
}

// Resume user onboarding
async function resumeUserOnboarding(
  userId: string,
  stepData: Record<string, any>,
  userInput: string,
  inputType: 'text' | 'confirmation' | 'selection' | 'structured_data'
): Promise<ResumeResult> {
  console.log('🚀 Resuming user onboarding');

  const { memory } = await createCareerMemory();

  const onboardingAgent = new Agent({
    name: 'Onboarding Resume Agent',
    instructions: `You are resuming the onboarding process. Continue collecting the required information:

1. Name
2. Current Role & Company  
3. Career Interest (find-job, grow-career, change-careers, start-startup)
4. Current Projects/Journeys (1-3 max)
5. Project Goals

Previous context: ${JSON.stringify(stepData, null, 2)}
User's latest response: "${userInput}"

Continue the conversation and respond with "ONBOARDING_COMPLETE" when you have all required information.`,
    model: openai('gpt-4o-mini'),
    memory,
  });

  const response = await onboardingAgent.generate(userInput, {
    memory: {
      resource: userId,
      thread: stepData.threadId || `onboarding-resume-${Date.now()}`,
    }
  });

  const isComplete = response.text.includes('ONBOARDING_COMPLETE');

  if (isComplete) {
    // Extract profile data and mark as complete
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
      .where(eq(users.id, parseInt(userId)));

    return {
      response: response.text,
      actionTaken: 'onboarding_completed',
      nextAction: 'completed',
    };
  }

  // Still need more information
  const { getWorkflowStateManager } = await import('./workflow-state-manager');
  const stateManager = getWorkflowStateManager();
  
  const suspendResult = await stateManager.suspendWorkflow(
    userId,
    'career-journey-workflow',
    stepData.runId || `run-${Date.now()}`,
    'user-onboarding',
    {
      ...stepData,
      lastResponse: response.text,
    },
    'awaiting_user_input',
    response.text,
    {
      expectedInputType: 'text',
    }
  );

  return {
    response: response.text,
    actionTaken: 'onboarding_in_progress',
    nextAction: 'suspended',
    suspendResult,
  };
}

// Resume working memory initialization
async function resumeWorkingMemoryInit(
  userId: string,
  stepData: Record<string, any>,
  userInput: string,
  inputType: 'text' | 'confirmation' | 'selection' | 'structured_data'
): Promise<ResumeResult> {
  console.log('💾 Resuming working memory initialization');

  // This step typically doesn't need user input, but if we're here,
  // it means there was an issue and we need confirmation to retry
  if (inputType === 'confirmation' && userInput.toLowerCase().includes('yes')) {
    try {
      const { preloadUserWorkingMemory } = await import('./memory-manager');
      
      await preloadUserWorkingMemory(
        userId,
        stepData.profileData || {},
        {
          careerInterest: 'find-job',
        }
      );

      return {
        response: 'Great! I\'ve successfully initialized your profile data. I\'m ready to help with your career journey.',
        actionTaken: 'memory_initialized',
        nextAction: 'completed',
      };
    } catch (error) {
      return {
        response: 'I\'m still having trouble setting up your profile. Let\'s continue manually - what would you like to work on?',
        actionTaken: 'memory_init_failed',
        nextAction: 'needs_followup',
      };
    }
  }

  return {
    response: 'Let\'s continue without the full profile setup for now. What would you like to work on?',
    actionTaken: 'memory_init_skipped',
    nextAction: 'needs_followup',
  };
}

// Helper functions
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
  ];

  return needsMorePatterns.some(pattern => pattern.test(responseText));
}

async function processIntents(
  userId: string,
  stepData: Record<string, any>
): Promise<ResumeResult> {
  // Start processing intents from the beginning
  return await processNextIntent(userId, {
    ...stepData,
    currentIntent: 0,
    accumulatedResponse: '',
  });
}

async function processNextIntent(
  userId: string,
  stepData: Record<string, any>
): Promise<ResumeResult> {
  const currentIntent = stepData.currentIntent || 0;
  const intents = stepData.intentData?.intents || [];

  if (currentIntent >= intents.length) {
    return {
      response: stepData.accumulatedResponse || 'All requests have been processed.',
      actionTaken: 'all_intents_completed',
      nextAction: 'completed',
    };
  }

  const intent = intents[currentIntent];
  const { memory } = await createCareerMemory();

  try {
    const agent = new Agent({
      name: `${intent.type} Agent`,
      instructions: `Process the ${intent.type} request using the appropriate tools. Be concise and specific.`,
      model: openai('gpt-4o-mini'),
      memory,
      tools: careerTools as any,
    });

    const response = await agent.generate(stepData.originalMessage || '', {
      memory: {
        resource: userId,
        thread: stepData.threadId || `${intent.type}-${Date.now()}`,
      }
    });

    if (needsMoreInformation(response.text)) {
      const { getWorkflowStateManager } = await import('./workflow-state-manager');
      const stateManager = getWorkflowStateManager();
      
      const suspendResult = await stateManager.suspendWorkflow(
        userId,
        'career-journey-workflow',
        stepData.runId || `run-${Date.now()}`,
        'multi-intent-processor',
        {
          ...stepData,
          currentIntent,
        },
        'awaiting_user_input',
        response.text,
        {
          expectedInputType: 'text',
        }
      );

      return {
        response: response.text,
        actionTaken: `${intent.type}_needs_info`,
        nextAction: 'suspended',
        suspendResult,
      };
    }

    // Continue with next intent
    return await processNextIntent(userId, {
      ...stepData,
      currentIntent: currentIntent + 1,
      accumulatedResponse: (stepData.accumulatedResponse || '') + 
        (stepData.accumulatedResponse ? '\n\n' : '') + response.text,
    });

  } catch (error) {
    console.error(`❌ Error processing intent ${intent.type}:`, error);
    return {
      response: `I encountered an error processing your ${intent.type} request.`,
      actionTaken: `${intent.type}_error`,
      nextAction: 'error',
    };
  }
}

function extractUpdatedNodesFromResponse(responseText: string): string[] {
  const nodes: string[] = [];
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

  return [...new Set(nodes)];
}

// Import parsing functions from the main workflow
function parseIntentResponse(responseText: string) {
  // Copy the parsing logic from career-workflow.ts
  const lines = responseText.split('\n').map(line => line.trim());
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

    if (line.startsWith('- TOOL:') || line.startsWith('TOOL:')) {
      if (currentIntent) {
        intents.push(currentIntent);
      }

      const toolName = line.replace(/^-?\s*TOOL:\s*/, '').trim();
      currentIntent = {
        type: toolName,
        confidence: 0.7,
        entities: {},
        details: {}
      };
      inEntities = false;
      inDetails = false;
    }

    if (line.includes('CONFIDENCE:') && currentIntent) {
      const conf = parseFloat(line.replace(/.*CONFIDENCE:\s*/, '').trim());
      if (!isNaN(conf)) currentIntent.confidence = conf;
    }

    if (line.includes('ENTITIES:') && currentIntent) {
      inEntities = true;
      inDetails = false;
    }

    if (line.includes('DETAILS:') && currentIntent) {
      inDetails = true;
      inEntities = false;
    }
  }

  if (currentIntent) {
    intents.push(currentIntent);
  }

  return {
    intents,
    processedIntents: [],
    remainingIntents: intents.map((_, index) => index.toString()),
  };
}

function extractName(text: string): string {
  const nameMatch = text.match(/(?:I'm|I am|My name is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  return nameMatch ? nameMatch[1] : 'User';
}

function extractRole(text: string): string | undefined {
  const roleMatch = text.match(/(?:I work as|I'm a|I am a|my job is|my role is)\s+([^.]+)/i);
  return roleMatch ? roleMatch[1].trim() : undefined;
}

function extractCompany(text: string): string | undefined {
  const companyMatch = text.match(/(?:at|for|with)\s+([A-Z][A-Za-z\s&]+)(?:\.|,|$)/);
  return companyMatch ? companyMatch[1].trim() : undefined;
}

function extractCareerInterest(text: string): string {
  if (text.toLowerCase().includes('find') && text.toLowerCase().includes('job')) return 'find-job';
  if (text.toLowerCase().includes('grow') && text.toLowerCase().includes('career')) return 'grow-career';
  if (text.toLowerCase().includes('change') && text.toLowerCase().includes('career')) return 'change-careers';
  if (text.toLowerCase().includes('startup')) return 'start-startup';
  return 'grow-career';
}

function extractProjects(text: string): Array<{title: string; goal: string}> {
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