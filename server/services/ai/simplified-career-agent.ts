import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { createCareerMemory } from './memory-manager';
import { careerTools } from './career-tools';
import { profileVectorManager } from './profile-vector-manager';

// Agent input schema
export const agentInputSchema = z.object({
  message: z.string(),
  userId: z.string(),
  threadId: z.string().optional(),
});

// Agent output schema
export const agentOutputSchema = z.object({
  response: z.string(),
  actionTaken: z.string().optional(),
  updatedProfile: z.boolean().default(false),
  needsConfirmation: z.boolean().default(false),
  clarificationNeeded: z.array(z.string()).default([]),
});

// Type definitions for better type safety
export type AgentInput = z.infer<typeof agentInputSchema>;
export type AgentOutput = z.infer<typeof agentOutputSchema>;

// Create the simplified career agent
export async function createSimplifiedCareerAgent() {
  const { memory } = await createCareerMemory();

  const agent = new Agent({
    name: 'Career Assistant',
    instructions: `You are a career assistant that helps users add projects to their existing work experiences.

**Your Primary Task:**
When users want to add a project to a company/experience, follow this process:

**STEP 1: Search for Experience**
- Use semanticSearch tool to find the user's experience at the mentioned company
- For role-specific requests, include role details in query: "[role] [company name]"
- For general requests, use: "[company name]" with entityTypes=["experience"]
- Check if results are found and relevant

**STEP 2A: If Single Experience Found**
- Extract experienceId from search results: results[0].metadata.id
- Call addProjectToExperience(experienceId=extracted_id, projectTitle="...", ...)

**STEP 2B: If Multiple Experiences Found (Same Company, Different Roles)**
- Analyze user's request for role-specific clues ("when I was", "as a", role titles)
- Select the most relevant experience based on role matching
- Extract experienceId from the chosen result
- Call addProjectToExperience with the selected experience

**STEP 2C: If Experience NOT Found**
- Call addExperience first to create the experience
- Then call addProjectToExperience using the new experience

**Example Flows:**
1. User: "Add a Mobile App project to my TechCorp experience"
   → semanticSearch("TechCorp") → Use first result

2. User: "Add project to ABCO when I was principal software engineer"
   → semanticSearch("principal software engineer ABCO") → Pick principal role

3. User: "Add project to my Google backend engineer role"  
   → semanticSearch("backend engineer Google") → Target specific role

**Available Tools:**
- **semanticSearch**: Find existing experiences
- **addProjectToExperience**: Add project using experienceId
- **addExperience**: Create new experience if needed

**Key Rules:**
- ALWAYS search first to check if experience exists
- If experience exists: use its ID for addProjectToExperience
- If experience doesn't exist: create it first, then add project
- Use smart defaults for missing fields (description="", start dates, etc.)

**CRITICAL: Response Requirements:**
You MUST ALWAYS provide a text response after executing any tools. Never return an empty response.

**Response Style:**
- Execute tools first, then provide confirmation message
- For project additions: "Successfully added the '[project name]' project to your [company] experience!"
- For new experiences: "Successfully added your [title] experience at [company]!"
- Be conversational and helpful
- Always acknowledge what action you took

**Example Response Flow:**
1. User: "add ML project to Netflix"
2. You execute: addExperience + addProjectToExperience tools
3. You respond: "Successfully added the 'ML project' to your Netflix experience!"

**NEVER send empty responses - always confirm your actions with text.**`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools as any,
  });

  return agent;
}


// Removed automatic semantic search - agent now uses semanticSearch tool directly when needed

// Main processing function with Zod validation
export async function processCareerConversation(
  input: AgentInput,
  sseResponse?: any
): Promise<AgentOutput> {
  console.log(`🚀 Processing career conversation for user ${input.userId}`);

  try {
    // Validate input
    const validatedInput = agentInputSchema.parse(input);

    // Create the agent
    const agent = await createSimplifiedCareerAgent();

    // Create runtime context for SSE events and semantic search results
    const { RuntimeContext } = await import('@mastra/core/di');
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', validatedInput.userId);

    // Semantic search is now handled by the agent using the semanticSearch tool
    // No need to automatically provide context - let the agent decide when to search

    if (sseResponse) {
      // Store SSE response for milestone events
      runtimeContext.set('sseResponse', sseResponse);
      console.log('✅ Added SSE response to runtime context');
    }

    // Generate response using the agent (original message, context in runtimeContext)
    const response = await agent.generate(validatedInput.message, {
      memory: {
        resource: validatedInput.userId,
        thread: validatedInput.threadId || `conversation-${Date.now()}`,
      },
      runtimeContext,
      maxSteps: 5, // Allow multiple tool calls if needed
    });

    // Store conversation in vector database for future context
    try {
      console.log('💾 Storing conversation in vector database');
      await profileVectorManager.storeEntity(validatedInput.userId, {
        id: `conversation_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        title: `Conversation: ${validatedInput.message.substring(0, 50)}...`,
        description: `User: ${validatedInput.message}\n\nAssistant: ${response.text}`,
        userMessage: validatedInput.message,
        assistantResponse: response.text,
        timestamp: new Date().toISOString(),
        threadId: validatedInput.threadId,
        contextUsed: {
          toolsAvailable: true,
          semanticSearchTool: true,
        },
      }, 'conversation_summary');
      console.log('✅ Conversation stored in vector database');
    } catch (error) {
      console.log('⚠️ Failed to store conversation in vector database:', error);
    }

    // Check if any tools were called and profile was updated
    const toolsUsed = response.toolResults && response.toolResults.length > 0;
    const profileUpdateTools = [
      'add-project-to-experience', 
      'add-experience', 
      'update-experience', 
      'add-education',
      'update-education',
      'add-project-work',
      'add-project',
      'update-project',
      'add-update-to-project',
      'update-project-update'
    ];
    const profileWasUpdatedViaTools = toolsUsed && response.toolResults.some(result => 
      profileUpdateTools.some(toolName => result.toolName === toolName)
    );
    
    // Alternative detection: Check if response indicates successful profile updates
    const responseText = response.text.toLowerCase();
    const profileUpdateIndicators = [
      'added the',
      'successfully added',
      'updated the',  
      'created the',
      'added project',
      'added experience',
      'updated experience', 
      'added education'
    ];
    const profileWasUpdatedByResponse = profileUpdateIndicators.some(indicator => 
      responseText.includes(indicator)
    );
    
    // Final fallback: If tools were executed but formal detection failed,
    // be more aggressive about detecting profile updates since our tools
    // primarily perform profile update operations
    const profileWasUpdatedByFallback = toolsUsed && !profileWasUpdatedViaTools;
    
    const profileWasUpdated = profileWasUpdatedViaTools || profileWasUpdatedByResponse || profileWasUpdatedByFallback;

    const result: AgentOutput = {
      response: response.text,
      actionTaken: profileWasUpdated ? 'profile_updated' : toolsUsed ? 'tool_executed' : 'conversation',
      updatedProfile: profileWasUpdated,
      needsConfirmation: false,
      clarificationNeeded: [],
    };

    // Validate output
    return agentOutputSchema.parse(result);

  } catch (error) {
    console.error('❌ Error processing career conversation:', error);

    const errorResult: AgentOutput = {
      response: 'I encountered an issue processing your request. Please try again, and if the problem persists, let me know what you were trying to do.',
      actionTaken: 'error',
      updatedProfile: false,
      needsConfirmation: false,
      clarificationNeeded: [],
    };

    return agentOutputSchema.parse(errorResult);
  }
}

// Legacy export for backward compatibility
export { processCareerConversation as executeCareerWorkflow };
