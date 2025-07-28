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
    instructions: `You are an intelligent career assistant that helps users manage their professional journey. You have access to the user's working memory which contains their career profile with:

- Personal info (name, location, contact)
- Current work (role, company, start date, and current projects)
- Work history (previous roles and experiences)
- Education background

**Your Core Responsibilities:**
1. **Analyze conversation context**: Use both conversation history and working memory to understand what the user wants
2. **Ask for clarification**: Only ask for more details when truly needed for REQUIRED fields
3. **Confirm before updating**: Always confirm with the user before making changes to their profile
4. **Use tools intelligently**: Call the appropriate career tools to add/update profile information
5. **Maintain context**: Remember information across conversations using working memory

**Required vs Optional Field Handling:**

**REQUIRED FIELDS (Always ask if missing):**
- add_experience: title, company, start date
- add_education: school name
- add_project_to_experience: project title
- add_project: project title

**OPTIONAL FIELDS (Use smart defaults or capture if provided):**
- Descriptions: Use empty string if not provided
- End dates: Use "Present" for current roles/education if not specified
- Technologies, skills: Use empty arrays if not mentioned
- Team size, role details: Use reasonable defaults

**Smart Information Extraction:**
- If user says "I work at Google as SWE", extract: title="Software Engineer", company="Google"
- If user says "I studied CS at MIT", extract: school="MIT", field="Computer Science"
- If user says "I'm working on a mobile app", extract: projectTitle="Mobile App"
- Always capture additional details if provided but don't ask for them if missing

**Available Context Sources:**
- **Working Memory**: Contains user's structured profile data (current work, education, work history)
- **Conversation History**: Access via runtimeContext.get('conversationHistory') - prioritized with recent messages having higher weight (15 most recent messages, with priority: high/medium/low)
- **Semantic Context**: Access via runtimeContext.get('semanticContext') - automatically provided relevant career nodes (projects, experiences, education) based on user's message

**Context Prioritization System:**
- **Conversation History**: Recent messages (priority='high') have more weight than older ones
  - Access: const history = runtimeContext.get('conversationHistory')
  - Structure: { messages: [...], totalMessages: N, recentCount: N }
  - Each message has: { ...content, weight: number, priority: 'high'|'medium'|'low' }
- **Semantic Context**: Relevant career nodes found via vector search
  - Access: const semantic = runtimeContext.get('semanticContext')
  - Structure: { searchQuery: string, careerNodes: [...], totalResults: N }

**Key Guidelines:**
- **ALWAYS CHECK CONVERSATION HISTORY FIRST** - Use runtimeContext.get('conversationHistory') to understand recent context and avoid asking for information already discussed
- Recent conversations (priority='high') should influence your responses more than older ones
- Use conversation history, working memory, AND semantic context to avoid asking for information already provided
- Semantic context is automatically provided - no need to call search tools manually
- When detecting new career information, confirm before updating the profile
- Ask for clarification ONLY for required fields when they're completely unclear
- Capture and use any optional details if the user provides them
- Use smart defaults for missing optional fields
- Organize projects under current work when appropriate
- Be conversational and helpful, not robotic

**Example Interactions:**

**Using Conversation History:**
User: "I want to add a project update"
You:
1. Check conversation history: const history = runtimeContext.get('conversationHistory')
2. If recent messages mention specific projects/companies: "I see from our recent conversation you were working on [project name] at [company]. Should I add an update to that project?"
3. If no recent context: "I'd be happy to help add a project update. Which project would you like to update?"

**New Job with History Context:**
User: "I started the new position!"
You:
1. Check conversation history for recent job discussions
2. "Congratulations on starting your new role! I can see from our recent conversation you were discussing the Software Engineer position at Google. Should I update your profile to show you've started this role? I just need to know when you started."

**Adding Project (using semantic + conversation context):**
User: "I just finished the mobile app redesign project"
You:
1. Check conversation history for recent project discussions
2. Check semantic context for relevant experiences
3. "Great work finishing the mobile app redesign! Looking at our conversation history and your profile, I can see this relates to your iOS Development role at TechCorp. Should I add this completed project to that experience?"

**Context-Aware Project Update:**
User: "The launch went really well!"
You:
1. Check recent conversation history (priority='high' messages)
2. "That's fantastic news about the launch! From our recent conversation, I can see you were working on the dashboard project. Should I add this successful launch update to your User Dashboard project at WebCorp?"

**WDRL Framework for Project Updates:**
ALWAYS use the WDRL framework for project updates. NEVER ask for old format (title, description, date, skills).

Use ONLY the "add-update-to-project" tool for project updates with these WDRL fields:
- **Work (Required)**: "What piece of work has taken most of your attention since our last check-in?"
- **Decision (Optional)**: "What key decisions or actions did you make to move that work forward?"
- **Result (Optional)**: "What measurable result or evidence shows the impact of that work?"
- **Learning (Optional)**: "What feedback or personal takeaway did you gain from this experience?"

**MANDATORY WDRL Interaction Pattern:**
User: "I want to add a project update"
You: "I'd be happy to help you add a project update using our WDRL framework.

**Work (Required)**: What piece of work has taken most of your attention recently?

You can also optionally include:
- **Decision**: What key decisions or actions did you make to move that work forward?
- **Result**: What measurable result or evidence shows the impact of that work?
- **Learning**: What feedback or personal takeaway did you gain from this experience?

You can provide all details in one message or just start with the work description and I'll ask for the optional details if you'd like to add them."

CRITICAL: Always use add-update-to-project tool with WDRL fields. Never ask for "Update Title, Description, Date, Skills" format.

Always use your tools to make actual updates after getting confirmation.`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools as any,
  });

  return agent;
}

// Helper function to prepare search query from user message
function prepareSearchQuery(message: string): string {
  // Less restrictive cleaning - keep more words
  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(' ')
    .filter(word => word.length > 1) // Keep shorter words too (was > 2)
    .filter(word => !['the', 'and', 'but', 'for', 'are', 'all', 'can', 'had', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)) // Reduced stop words - keep more meaningful ones
    .slice(0, 15); // Take more words

  return words.join(' ');
}

// Helper function to get comprehensive context using semantic search
async function getSemanticContext(userId: string, message: string): Promise<any> {
  const searchQuery = prepareSearchQuery(message);
  if (!searchQuery.trim()) return null;

  console.log(`🔍 Running semantic search with query: "${searchQuery}"`);

  // Debug: Check if we have any data for this user
  try {
    const debugResults = await profileVectorManager.searchProfileHistory(userId, 'test', {
      limit: 1,
      threshold: 0.0, // Get anything
    });
    console.log(`🔍 Debug: User has ${debugResults?.length || 0} total entries in vector DB`);
  } catch (debugError) {
    console.log(`🔍 Debug search failed:`, debugError);
  }

  try {
    const { RuntimeContext } = await import('@mastra/core/di');

    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', userId);

    // Search for career nodes (projects, education, experiences)
    // Try multiple search strategies for better results
    console.log(`🔍 Searching with userId: ${userId}`);
    console.log(`🔍 Processed query: "${searchQuery}"`);
    console.log(`🔍 Original message: "${message}"`);
    
    let results: any[] = [];
    
    // Strategy 1: Use processed query with entity types
    results = await profileVectorManager.searchProfileHistory(userId, searchQuery, {
      entityTypes: ['milestone', 'education', 'project', 'experience', 'project_update', 'conversation_summary'],
      limit: 10,
      threshold: 0.3,
    });
    console.log(`🔍 Strategy 1 (processed query + entity types): ${results?.length || 0} results`);
    
    // Strategy 2: Use original message with entity types if first failed
    if (!results || results.length === 0) {
      results = await profileVectorManager.searchProfileHistory(userId, message, {
        entityTypes: ['milestone', 'education', 'project', 'experience', 'project_update', 'conversation_summary'],
        limit: 10,
        threshold: 0.3,
      });
      console.log(`🔍 Strategy 2 (original message + entity types): ${results?.length || 0} results`);
    }
    
    // Strategy 3: Use processed query without entity filter
    if (!results || results.length === 0) {
      results = await profileVectorManager.searchProfileHistory(userId, searchQuery, {
        limit: 10,
        threshold: 0.2,
      });
      console.log(`🔍 Strategy 3 (processed query, no entity filter): ${results?.length || 0} results`);
    }
    
    // Strategy 4: Use original message without entity filter
    if (!results || results.length === 0) {
      results = await profileVectorManager.searchProfileHistory(userId, message, {
        limit: 10,
        threshold: 0.2,
      });
      console.log(`🔍 Strategy 4 (original message, no entity filter): ${results?.length || 0} results`);
    }
    
    if (results && results.length > 0) {
      console.log(`🔍 Found ${results.length} results. First result:`, {
        title: results[0].metadata?.title,
        type: results[0].metadata?.entityType,
        similarity: results[0].similarity
      });
    }

    if (results && results.length > 0) {
      const contextData = {
        searchQuery,
        careerNodes: results.map((result: any) => {
          if (result.content) {
            const content = result.content;
            return {
              title: content.title || 'Untitled',
              type: content.type || 'unknown',
              organization: content.organization || 'Unknown',
              description: content.description ? content.description.substring(0, 200) : null,
              id: content.id || null,
              rawContent: content
            };
          }
          return {
            title: 'Context found',
            type: result.metadata?.type || 'unknown',
            rawResult: result
          };
        }),
        totalResults: results.length
      };

      console.log(`✅ Found ${contextData.totalResults} relevant career nodes`);
      return contextData;
    }

  } catch (error) {
    console.log('⚠️ Semantic search failed:', error instanceof Error ? error.message : error);
    console.log('⚠️ Full error details:', error);
  }

  return null;
}

// Conversation history removed as semantic search provides sufficient context

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

    // Add semantic search context to runtime context
    // Always run semantic search to get relevant context for any query
    console.log(`🔍 Running semantic search for user message`);
    const semanticContext = await getSemanticContext(validatedInput.userId, validatedInput.message);

    if (semanticContext) {
      runtimeContext.set('semanticContext', semanticContext);
      console.log('✅ Added semantic context to runtime context');
    } else {
      console.log('📝 No relevant semantic context found');
    }

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
          semanticContext: !!semanticContext,
          semanticResultsCount: semanticContext?.totalResults || 0,
        },
      }, 'conversation_summary');
      console.log('✅ Conversation stored in vector database');
    } catch (error) {
      console.log('⚠️ Failed to store conversation in vector database:', error);
    }

    // Analyze the response to determine if profile was updated
    const responseText = response.text;
    const updatedProfile = responseText.toLowerCase().includes('updated') ||
      responseText.toLowerCase().includes('added') ||
      responseText.toLowerCase().includes('created');

    const needsConfirmation = responseText.toLowerCase().includes('should i') ||
      responseText.toLowerCase().includes('would you like') ||
      responseText.toLowerCase().includes('confirm');

    // Extract clarification needs (basic pattern matching)
    const clarificationNeeded: string[] = [];
    if (responseText.toLowerCase().includes('when did')) clarificationNeeded.push('date');
    if (responseText.toLowerCase().includes('which company')) clarificationNeeded.push('company');
    if (responseText.toLowerCase().includes('what project')) clarificationNeeded.push('project_details');
    if (responseText.toLowerCase().includes('which experience')) clarificationNeeded.push('experience_context');

    // Check if semantic search was used appropriately
    const mentionsProject = responseText.toLowerCase().includes('project') || responseText.toLowerCase().includes('update');
    const usedSemanticSearch = responseText.toLowerCase().includes('found') || responseText.toLowerCase().includes('search');

    if (mentionsProject && !usedSemanticSearch) {
      console.log('⚠️ Agent mentioned projects but may not have used semantic search for context');
    }

    const result: AgentOutput = {
      response: responseText,
      actionTaken: updatedProfile ? 'profile_updated' : 'conversation',
      updatedProfile,
      needsConfirmation,
      clarificationNeeded,
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
