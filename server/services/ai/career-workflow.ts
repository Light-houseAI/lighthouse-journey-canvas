import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { careerTools } from './career-tools';
import { createSimplifiedCareerAgent, processCareerConversation } from './simplified-career-agent';
import { createCareerMemory } from './memory-manager';

// ========================================
// AGENT-BASED WORKFLOW SCHEMA
// ========================================

const WorkflowContextSchema = z.object({
  // Input data
  userId: z.string(),
  message: z.string(),
  threadId: z.string().optional(),
  
  // Step 1: Agent context understanding results
  agentResponse: z.string().optional(),
  toolsUsed: z.array(z.any()).optional(),
  actionTaken: z.string().optional(),
  updatedProfile: z.boolean().optional(),
  needsConfirmation: z.boolean().optional(),
  clarificationNeeded: z.array(z.string()).optional(),
  executionContext: z.record(z.any()).optional(), // Context for next step
  
  // Step 2: Execution results (if needed)
  finalResponse: z.string().optional(),
  finalSuccess: z.boolean().optional(),
  currentStep: z.string().optional(),
});

// ========================================
// CONTEXT UNDERSTANDING AGENT 
// ========================================

async function createContextUnderstandingAgent() {
  const { memory } = await createCareerMemory();
  
  return new Agent({
    name: 'Context Understanding Agent',
    instructions: `You are a context understanding agent that analyzes user intent and collects all necessary information for career actions.

Your responsibilities:
1. **Analyze user intent** - understand what the user wants to do
2. **Use READ-ONLY tools** to gather context and find existing entities
3. **Collect all required parameters** from the user message or by asking clarifying questions
4. **Prepare execution plan** with all the data needed for the next step

**IMPORTANT: You are NOT allowed to execute CREATE/UPDATE tools. You only gather information and prepare for execution.**

**Available Tools (READ-ONLY):**
- semanticSearch: Find existing entities in user's profile
- getExperiences: Get user's experiences for context

**Intent Categories:**
- add_experience: Adding new job/work experience
- update_experience: Updating existing work experience  
- add_education: Adding new education entry
- update_education: Updating existing education
- add_project_to_experience: Adding project to existing experience
- add_update_to_project: Adding update to existing project
- general_chat: General conversation

**Your Process:**
1. **Understand Intent**: What does the user want to do?
2. **Gather Context**: Use semanticSearch/getExperiences to find relevant existing data
3. **Extract Parameters**: Pull out all information from user message
4. **Identify Missing Info**: What additional info is needed?
5. **Prepare Execution Plan**: Structure everything for the execution step

**Output Format:**
Provide structured response with:
- Determined intent
- All extracted parameters
- Entity IDs found (if any)
- Missing required fields (if any)
- Clear execution plan for next step
- User message if more input needed

**Remember: You are the "brain" that plans, but you don't execute. The next step will handle execution.**`,
    model: openai('gpt-4o-mini'),
    memory,
    tools: careerTools.filter(tool => ['semantic-search', 'get-experiences'].includes(tool.id)) as any,
  });
}

// ========================================
// TOOL EXECUTION AGENT
// ========================================

async function createToolExecutionAgent() {
  return new Agent({
    name: 'Tool Execution Agent',
    instructions: `You are a tool execution agent that performs career management operations using the context and parameters prepared by the context understanding agent.

Your role:
1. **Receive structured execution plan** from the previous step
2. **Execute the specified tool** with the provided parameters
3. **Handle results** and provide user feedback
4. **Focus only on execution** - all analysis and planning is already done

**Available Tools (EXECUTION):**
- addExperience: Add new work experience
- updateExperience: Update existing experience
- addEducation: Add new education entry  
- updateEducation: Update existing education
- addProjectToExperience: Add project to existing experience
- addUpdateToProject: Add update to existing project

**Execution Pattern:**
1. Receive: intent, toolToExecute, parameters, entityIds from previous step
2. Execute: Call the specified tool with validated parameters
3. Return: Success/failure status and user-friendly message

**Tool Mapping:**
- add_experience → addExperience
- update_experience → updateExperience 
- add_education → addEducation
- update_education → updateEducation
- add_project_to_experience → addProjectToExperience
- add_update_to_project → addUpdateToProject

You are the "hands" of the system - execute with confidence using the prepared data.`,
    model: openai('gpt-4o-mini'),
    tools: careerTools.filter(tool => !['semantic-search', 'get-experiences'].includes(tool.id)) as any,
  });
}

// ========================================
// WORKFLOW STEPS
// ========================================

const contextUnderstandingStep = createStep({
  id: 'context-understanding',
  inputSchema: z.object({
    userId: z.string(),
    message: z.string(),
    threadId: z.string().optional(),
  }),
  outputSchema: WorkflowContextSchema,
  suspendSchema: z.object({
    reason: z.string(),
    pauseMessage: z.string(),
    userId: z.string(),
    currentStep: z.string(),
  }),
  resumeSchema: z.object({
    userInput: z.string(),
  }),
  execute: async ({ inputData, runtimeContext, suspend, resumeData }) => {
    console.log(`🧠 Step 1: Context understanding and input collection: "${inputData.message}"`);
    
    const agent = await createContextUnderstandingAgent();
    
    let analysisPrompt = `Analyze this user message and collect all necessary information for career action:

"${inputData.message}"

Your tasks:
1. **Determine user intent** - what do they want to do?
2. **Use semantic search** to find existing entities if needed
3. **Extract all parameters** from the message
4. **Identify missing required fields** 
5. **Prepare execution plan** with all collected data

IMPORTANT: Do NOT execute any create/update tools. Only gather information and prepare for execution.

Provide structured response with intent, parameters, entity IDs, and execution plan.`;
    
    // Handle resume from user input
    if (resumeData?.userInput) {
      analysisPrompt += `\n\nUser provided additional input: "${resumeData.userInput}"\nUse this to complete the information gathering.`;
    }
    
    try {
      const response = await agent.generate(analysisPrompt, {
        memory: {
          resource: inputData.userId,
          thread: inputData.threadId || 'context-understanding',
        },
        runtimeContext,
        maxSteps: 5, // Allow multiple tool calls for search/context gathering
      });
      
      console.log(`🤖 Context understanding result:`, response.text);
      
      // Parse the agent's response to extract structured data
      const contextResult = parseContextUnderstandingResponse(response);
      
      // Check if we need more information from user
      if (contextResult.needsUserInput) {
        console.log(`⏸️ Suspending for user input: ${contextResult.pauseMessage}`);
        
        await suspend({
          reason: contextResult.suspendReason || 'information_needed',
          pauseMessage: contextResult.pauseMessage || 'I need more information to proceed.',
          userId: inputData.userId,
          currentStep: 'context-understanding',
        });
      }
      
      // Prepare execution context for next step
      const executionContext = {
        intent: contextResult.intent,
        toolToExecute: contextResult.toolToExecute,
        parameters: contextResult.parameters,
        entityIds: contextResult.entityIds,
        readyForExecution: contextResult.readyForExecution,
      };
      
      console.log(`✅ Context collected:`, {
        intent: contextResult.intent,
        readyForExecution: contextResult.readyForExecution,
        toolToExecute: contextResult.toolToExecute
      });
      
      return {
        ...inputData,
        agentResponse: response.text,
        actionTaken: 'context_collected',
        updatedProfile: false, // No updates in this step
        needsConfirmation: false,
        clarificationNeeded: [],
        executionContext,
        currentStep: 'context-understanding',
      };
      
    } catch (error) {
      console.error(`❌ Context understanding failed:`, error);
      
      return {
        ...inputData,
        agentResponse: 'I encountered an issue understanding your request. Please try rephrasing it.',
        actionTaken: 'error',
        updatedProfile: false,
        needsConfirmation: false,
        clarificationNeeded: [],
        executionContext: {},
        currentStep: 'context-understanding',
      };
    }
  },
});

const toolExecutionStep = createStep({
  id: 'tool-execution',
  inputSchema: WorkflowContextSchema,
  outputSchema: z.object({
    response: z.string(),
    actionTaken: z.string(),
    updatedProfile: z.boolean(),
    executionSuccess: z.boolean(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    console.log(`⚙️ Step 2: Tool execution using collected context`);
    
    const executionContext = inputData.executionContext || {};
    
    // Handle general chat or read-only operations
    if (!executionContext.readyForExecution || executionContext.intent === 'general_chat') {
      console.log(`💬 No tool execution needed - returning context response`);
      
      return {
        response: inputData.agentResponse || 'I can help you manage your career profile. What would you like to work on?',
        actionTaken: executionContext.intent || 'general_chat',
        updatedProfile: false,
        executionSuccess: true,
      };
    }
    
    // Execute the specific tool with collected parameters
    const agent = await createToolExecutionAgent();
    
    const executionPrompt = `Execute the career tool based on the collected context:

Intent: ${executionContext.intent}
Tool to execute: ${executionContext.toolToExecute}
Parameters: ${JSON.stringify(executionContext.parameters)}
Entity IDs: ${JSON.stringify(executionContext.entityIds)}

Your task:
1. Execute the ${executionContext.toolToExecute} tool with the provided parameters
2. Handle the result and provide user feedback
3. All required data has been collected in the previous step

Proceed with execution.`;
    
    try {
      const response = await agent.generate(executionPrompt, {
        memory: {
          resource: inputData.userId,
          thread: inputData.threadId || 'tool-execution',
        },
        runtimeContext,
        maxSteps: 2, // Should only need 1-2 steps for execution
      });
      
      console.log(`🤖 Tool execution result:`, response.text);
      
      // Parse execution result
      const executionResult = parseToolExecutionResponse(response);
      
      return {
        response: executionResult.message || response.text,
        actionTaken: executionContext.intent || 'tool_executed',
        updatedProfile: executionResult.success,
        executionSuccess: executionResult.success,
      };
      
    } catch (error) {
      console.error(`❌ Tool execution failed:`, error);
      
      return {
        response: 'I encountered an issue executing the action. Please try again.',
        actionTaken: 'execution_error',
        updatedProfile: false,
        executionSuccess: false,
      };
    }
  },
});

// ========================================
// WORKFLOW DEFINITION: UNDERSTAND → EXECUTE
// ========================================

export const semanticSearchWorkflow = createWorkflow({
  id: 'agent-based-career-workflow',
  inputSchema: z.object({
    userId: z.string(),
    message: z.string(),
    threadId: z.string().optional(),
  }),
  outputSchema: z.object({
    response: z.string(),
    actionTaken: z.string(),
    updatedProfile: z.boolean(),
    executionSuccess: z.boolean(),
  }),
  steps: [
    contextUnderstandingStep,
    toolExecutionStep,
  ],
})
  .then(contextUnderstandingStep)
  .then(toolExecutionStep)
  .commit();

// ========================================
// WORKFLOW EXECUTION FUNCTIONS
// ========================================

export async function executeSemanticSearchWorkflow(
  input: { message: string; userId: string; threadId?: string }
): Promise<{
  response: string;
  actionTaken: string;
  updatedProfile: boolean;
  executionSuccess: boolean;
  suspended?: boolean;
  suspensionId?: string;
  runId?: string;
}> {
  console.log(`🚀 Executing agent-based career workflow for user ${input.userId}`);
  
  try {
    const workflowRun = await semanticSearchWorkflow.createRunAsync();
    
    const runtimeContext = new RuntimeContext();
    runtimeContext.set('userId', input.userId);
    
    const result = await workflowRun.start({
      inputData: input,
      runtimeContext
    });
    
    console.log(`✅ Workflow execution result status: ${result.status}`);
    
    if (result.status === 'success') {
      return {
        response: result.result.response,
        actionTaken: result.result.actionTaken,
        updatedProfile: result.result.updatedProfile,
        executionSuccess: result.result.executionSuccess,
      };
    }
    
    if (result.status === 'suspended') {
      console.log(`⏸️ Workflow suspended for user input`);
      
      const suspendedSteps = result.suspended || [];
      const suspendedStepId = Array.isArray(suspendedSteps[0]) ? suspendedSteps[0][0] : suspendedSteps[0];
      
      let suspensionMessage = 'Please provide additional information to continue.';
      if (result.steps && (result.steps as any)[suspendedStepId]) {
        const stepResult = (result.steps as any)[suspendedStepId];
        suspensionMessage = stepResult.suspendPayload?.pauseMessage || suspensionMessage;
      }
      
      return {
        response: suspensionMessage,
        actionTaken: 'workflow_suspended',
        updatedProfile: false,
        executionSuccess: false,
        suspended: true,
        suspensionId: `${input.userId}-${suspendedStepId}-${Date.now()}`,
        runId: workflowRun.runId,
      };
    }
    
    console.error(`❌ Workflow execution failed:`, result.error);
    return {
      response: 'I encountered an issue processing your request. Please try again.',
      actionTaken: 'workflow_error',
      updatedProfile: false,
      executionSuccess: false,
    };
    
  } catch (error) {
    console.error(`❌ Workflow execution error:`, error);
    return {
      response: 'I encountered an issue processing your request. Please try again.',
      actionTaken: 'execution_error',
      updatedProfile: false,
      executionSuccess: false,
    };
  }
}

export async function resumeSemanticSearchWorkflow(
  runId: string,
  userInput: any,
  userId?: string
): Promise<{
  response: string;
  actionTaken: string;
  updatedProfile: boolean;
  executionSuccess: boolean;
  suspended?: boolean;
  suspensionId?: string;
  runId?: string;
}> {
  console.log(`🔄 Resuming agent-based career workflow: ${runId}`);
  
  try {
    const workflowRun = await semanticSearchWorkflow.createRunAsync({ runId });
    
    const runtimeContext = new RuntimeContext();
    if (userId) {
      runtimeContext.set('userId', userId);
    }
    
    const result = await workflowRun.resume({
      step: runId.split('-')[1],
      resumeData: {
        userInput: userInput,
      },
      runtimeContext
    });
    
    console.log(`✅ Resume result status: ${result.status}`);
    
    
    if (result.status === 'success') {
      return {
        response: result.result.response,
        actionTaken: result.result.actionTaken,
        updatedProfile: result.result.updatedProfile,
        executionSuccess: result.result.executionSuccess,
      };
    }
    
    if (result.status === 'suspended') {
      console.log(`⏸️ Workflow suspended again after resume`);
      
      const suspendedSteps = result.suspended || [];
      const suspendedStepId = Array.isArray(suspendedSteps[0]) ? suspendedSteps[0][0] : suspendedSteps[0];
      
      let suspensionMessage = 'Please provide additional information to continue.';
      if (result.steps && (result.steps as any)[suspendedStepId]) {
        const stepResult = (result.steps as any)[suspendedStepId];
        suspensionMessage = stepResult.suspendPayload?.pauseMessage || suspensionMessage;
      }
      
      return {
        response: suspensionMessage,
        actionTaken: 'workflow_suspended_again',
        updatedProfile: false,
        executionSuccess: false,
        suspended: true,
        suspensionId: `${userId || 'unknown'}-${suspendedStepId}-${Date.now()}`,
        runId: runId,
      };
    }
    
    console.error(`❌ Workflow resume failed:`, result.error);
    return {
      response: 'I encountered an issue resuming your conversation. Please try again.',
      actionTaken: 'resume_error',
      updatedProfile: false,
      executionSuccess: false,
    };
    
  } catch (error) {
    console.error(`❌ Resume workflow error:`, error);
    return {
      response: 'I encountered an error resuming your conversation. Please try again.',
      actionTaken: 'resume_error',
      updatedProfile: false,
      executionSuccess: false,
    };
  }
}

// ========================================
// RESPONSE PARSING FUNCTIONS
// ========================================

function parseContextUnderstandingResponse(response: any): {
  intent: string;
  toolToExecute: string;
  parameters: Record<string, any>;
  entityIds: Record<string, string>;
  readyForExecution: boolean;
  needsUserInput: boolean;
  pauseMessage?: string;
  suspendReason?: string;
} {
  // Extract tool results to get search data
  const toolResults = response.toolResults || [];
  const entityIds: Record<string, string> = {};
  const parameters: Record<string, any> = {};
  
  // Extract entity IDs from semantic search results
  for (const toolResult of toolResults) {
    if (toolResult.toolName === 'semantic-search' && toolResult.result?.results) {
      for (const result of toolResult.result.results) {
        const entity = result.metadata?.entity;
        const entityType = result.metadata?.entityType;
        
        if (entity?.id && entityType) {
          const idField = `${entityType}Id`;
          entityIds[idField] = entity.id;
        }
      }
    }
  }
  
  // Extract intent from response text
  const intent = extractIntentFromResponse(response.text);
  
  // Map intent to tool
  const toolMap: Record<string, string> = {
    'add_experience': 'addExperience',
    'update_experience': 'updateExperience',
    'add_education': 'addEducation',
    'update_education': 'updateEducation',
    'add_project_to_experience': 'addProjectToExperience',
    'add_update_to_project': 'addUpdateToProject',
  };
  
  const toolToExecute = toolMap[intent] || '';
  
  // Extract parameters from response text
  extractParametersFromResponse(response.text, parameters);
  
  // Check if we need user input
  const needsUserInput = response.text.includes('need more information') || 
                        response.text.includes('missing') ||
                        response.text.includes('clarification needed') ||
                        response.text.includes('which one') ||
                        response.text.includes('please provide');
  
  const pauseMessage = needsUserInput ? 
    response.text.match(/(?:need|missing|provide|which).+?[.!?]/i)?.[0] || 'Additional information needed' :
    undefined;
  
  const readyForExecution = !needsUserInput && intent !== 'general_chat' && toolToExecute !== '';
  
  return {
    intent,
    toolToExecute,
    parameters: { ...parameters, ...entityIds },
    entityIds,
    readyForExecution,
    needsUserInput,
    pauseMessage,
    suspendReason: needsUserInput ? 'information_needed' : undefined,
  };
}

function parseToolExecutionResponse(response: any): {
  success: boolean;
  message: string;
} {
  // Check tool results for success indicators
  const toolResults = response.toolResults || [];
  
  for (const toolResult of toolResults) {
    if (toolResult.result && toolResult.result.success !== undefined) {
      return {
        success: toolResult.result.success,
        message: toolResult.result.message || response.text
      };
    }
  }
  
  // Parse from response text
  const successIndicators = [
    /successfully/i, /completed/i, /added/i, /updated/i, /created/i
  ];
  
  const errorIndicators = [
    /error/i, /failed/i, /unsuccessful/i, /problem/i
  ];
  
  const isSuccess = successIndicators.some(pattern => pattern.test(response.text));
  const isError = errorIndicators.some(pattern => pattern.test(response.text));
  
  return {
    success: isSuccess && !isError,
    message: response.text
  };
}

function extractIntentFromResponse(response: string): string {
  const intentPatterns = {
    'add_experience': /add.{0,10}experience|new.{0,10}job|start.{0,10}work/i,
    'update_experience': /update.{0,10}experience|modify.{0,10}job/i,
    'add_education': /add.{0,10}education|new.{0,10}school|study/i,
    'update_education': /update.{0,10}education|modify.{0,10}school/i,
    'add_project_to_experience': /add.{0,10}project.{0,10}to|project.{0,10}at/i,
    'add_update_to_project': /update.{0,10}project|project.{0,10}update/i,
  };
  
  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    if (pattern.test(response)) {
      return intent;
    }
  }
  
  return 'general_chat';
}

function extractParametersFromResponse(response: string, parameters: Record<string, any>) {
  // Extract common parameters from agent response
  
  // Company names
  const companyMatch = response.match(/company[:\s"']*([A-Z][\w\s&.,-]+?)(?=[\s"',.!?]|$)/i);
  if (companyMatch) parameters.company = companyMatch[1].trim();
  
  // Job titles
  const titleMatch = response.match(/title[:\s"']*([A-Za-z][\w\s-]+?)(?=[\s"',.!?]|$)/i);
  if (titleMatch) parameters.title = titleMatch[1].trim();
  
  // Project names
  const projectMatch = response.match(/project[:\s"']*([A-Za-z][\w\s-]+?)(?=[\s"',.!?]|$)/i);
  if (projectMatch) parameters.projectTitle = projectMatch[1].trim();
  
  // School names
  const schoolMatch = response.match(/school[:\s"']*([A-Z][\w\s&.,-]+?)(?=[\s"',.!?]|$)/i);
  if (schoolMatch) parameters.school = schoolMatch[1].trim();
  
  // Dates
  const startMatch = response.match(/start[:\s"']*([\d]{4}|[A-Za-z]+\s+\d{4})(?=[\s"',.!?]|$)/i);
  if (startMatch) parameters.start = startMatch[1].trim();
}