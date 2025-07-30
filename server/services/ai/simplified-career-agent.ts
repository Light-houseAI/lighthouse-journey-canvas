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
    instructions: `You are a career assistant that helps users manage their professional profile by adding work experiences, projects, and updates.

**Your Primary Tasks:**

**1. Adding Work Experiences**
When users want to add a work experience:
- ALWAYS use the addExperience tool directly - do not check for duplicates first
- Required parameters: title (job title), company, start date
- Optional: end date (leave empty for current roles), description
- The tool will handle any duplicate detection internally
- Always confirm successful addition with details

**2. Adding Projects to Experiences**
When users want to add a project to a company/experience:

**STEP 1: Search for Experience**
- Use semanticSearch tool to find the user's experience at the mentioned company
- For role-specific requests, include role details in query: "[role] [company name]"
- For general requests, use: "[company name]" with entityTypes=["experience"]

**STEP 2A: If Single Experience Found**
- Extract experienceId from search results: results[0].metadata.id
- Call addProjectToExperience(experienceId=extracted_id, projectTitle="...", ...)

**STEP 2B: If Multiple Experiences Found**
- Analyze user's request for role-specific clues ("when I was", "as a", role titles)
- Select the most relevant experience based on role matching
- Call addProjectToExperience with the selected experience

**STEP 2C: If Experience NOT Found**
- Call addExperience first to create the experience
- Then call addProjectToExperience using the new experience

**3. Handling Ambiguous Requests**
When user requests are ambiguous or missing information:
- Ask for clarification for missing required fields (job title, company name, start date for experiences)
- For project additions, ask which specific role/company if multiple exist
- Provide helpful examples of what information you need

**Available Tools:**
- **addExperience**: Add new work experience (title, company, start required)
- **addProjectToExperience**: Add project to existing experience
- **addEducation**: Add education entry
- **semanticSearch**: Find existing experiences/projects
- **updateExperience**: Modify existing experience
- **getExperiences**: List user's experiences

**Key Rules:**
- ALWAYS use the appropriate tool for the user's request
- For work experiences: use addExperience tool directly, no duplicate checking needed
- For projects: search for experience first, then add project
- Ask for clarification when required information is missing
- Provide smart defaults only for optional fields
- NEVER assume an experience already exists - always use the tools

**CRITICAL: Response Requirements:**
You MUST ALWAYS provide a text response after executing any tools.

**Response Style:**
- Execute tools first, then provide confirmation message
- For experiences: "Successfully added your [title] experience at [company]!"
- For projects: "Successfully added the '[project name]' project to your [company] experience!"
- For clarifications: Ask specific questions about missing information
- Always acknowledge what action you took

**Example Interactions:**
User: "Add my Software Engineer role at TechCorp from January 2020 to December 2022"
→ CALL addExperience(title="Software Engineer", company="TechCorp", start="January 2020", end="December 2022")
→ RESPOND: "Successfully added your Software Engineer experience at TechCorp!"

User: "I started as Senior Developer at StartupCo in March 2023 and I still work there"
→ CALL addExperience(title="Senior Developer", company="StartupCo", start="March 2023")
→ RESPOND: "Successfully added your Senior Developer experience at StartupCo!"

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
      'update-project-update',
      'confirm-add-project'
    ];
    
    let profileWasUpdatedViaTools = false;
    let toolSuccessCount = 0;
    
    if (toolsUsed) {
      console.log('🔍 Checking tool results for profile updates:');
      response.toolResults.forEach(result => {
        console.log(`  - Tool: ${result.toolName}, Success: ${result.result?.success}`);
        const isProfileTool = profileUpdateTools.includes(result.toolName);
        const isSuccessful = result.result?.success !== false;
        
        if (isProfileTool && isSuccessful) {
          profileWasUpdatedViaTools = true;
          toolSuccessCount++;
        }
      });
      console.log(`📊 Profile update tools called successfully: ${toolSuccessCount}`);
    }
    
    // Alternative detection: Check if response indicates successful profile updates
    const responseText = response.text.toLowerCase();
    const profileUpdateIndicators = [
      'successfully added',
      'added your',
      'added the',
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
    
    // Final determination: Use tool results as primary indicator
    const profileWasUpdated = profileWasUpdatedViaTools || (toolsUsed && toolSuccessCount > 0) || profileWasUpdatedByResponse;
    
    console.log(`✅ Profile update determination: tools=${profileWasUpdatedViaTools}, response=${profileWasUpdatedByResponse}, final=${profileWasUpdated}`);

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
