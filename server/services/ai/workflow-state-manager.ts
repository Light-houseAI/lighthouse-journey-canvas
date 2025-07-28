import Redis from 'ioredis';
import { z } from 'zod';

// Workflow state schema for persistence
const WorkflowStateSchema = z.object({
  userId: z.string(),
  workflowId: z.string(),
  runId: z.string(),
  currentStepId: z.string(),
  stepData: z.record(z.any()), // Data accumulated across steps
  suspensionReason: z.enum(['awaiting_user_input', 'clarification_needed', 'error']),
  suspensionMessage: z.string(),
  expectedInputType: z.enum(['text', 'confirmation', 'selection', 'structured_data']).optional(),
  possibleResponses: z.array(z.string()).optional(), // For selection type
  createdAt: z.string(),
  expiresAt: z.string(), // Auto-cleanup suspended workflows
});

type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Suspend/Resume result types
export interface SuspendResult {
  isSuspended: true;
  suspensionId: string;
  message: string;
  expectedInputType?: 'text' | 'confirmation' | 'selection' | 'structured_data';
  possibleResponses?: string[];
}

export interface ResumeResult {
  response: string;
  actionTaken?: string;
  nextAction: 'completed' | 'needs_followup' | 'error' | 'suspended';
  updatedNodes?: string[];
  suspendResult?: SuspendResult;
}

export class WorkflowStateManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  // Suspend a workflow at any step
  async suspendWorkflow(
    userId: string,
    workflowId: string,
    runId: string,
    currentStepId: string,
    stepData: Record<string, any>,
    suspensionReason: 'awaiting_user_input' | 'clarification_needed' | 'error',
    suspensionMessage: string,
    options?: {
      expectedInputType?: 'text' | 'confirmation' | 'selection' | 'structured_data';
      possibleResponses?: string[];
      expirationHours?: number;
    }
  ): Promise<SuspendResult> {
    const suspensionId = `${userId}-${workflowId}-${runId}`;
    const expirationHours = options?.expirationHours || 24;
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

    const state: WorkflowState = {
      userId,
      workflowId,
      runId,
      currentStepId,
      stepData,
      suspensionReason,
      suspensionMessage,
      expectedInputType: options?.expectedInputType,
      possibleResponses: options?.possibleResponses,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    // Store in Redis with TTL
    await this.redis.setex(
      `workflow_state:${suspensionId}`,
      expirationHours * 60 * 60,
      JSON.stringify(state)
    );

    console.log(`⏸️  Workflow suspended: ${suspensionId} at step ${currentStepId}`);

    return {
      isSuspended: true,
      suspensionId,
      message: suspensionMessage,
      expectedInputType: options?.expectedInputType,
      possibleResponses: options?.possibleResponses,
    };
  }

  // Check if user has a suspended workflow
  async hasSuspendedWorkflow(userId: string): Promise<string | null> {
    const keys = await this.redis.keys(`workflow_state:${userId}-*`);
    return keys.length > 0 ? keys[0].replace('workflow_state:', '') : null;
  }

  // Get suspended workflow state
  async getSuspendedWorkflow(suspensionId: string): Promise<WorkflowState | null> {
    const stateData = await this.redis.get(`workflow_state:${suspensionId}`);
    if (!stateData) return null;

    const parsed = JSON.parse(stateData);
    return WorkflowStateSchema.parse(parsed);
  }

  // Resume a suspended workflow
  async resumeWorkflow(
    suspensionId: string,
    userInput: string,
    inputType: 'text' | 'confirmation' | 'selection' | 'structured_data' = 'text'
  ): Promise<ResumeResult> {

    try {
      const state = await this.getSuspendedWorkflow(suspensionId);
    if (!state) {
      return {
        response: 'No suspended workflow found. Please start a new conversation.',
        actionTaken: 'no_suspended_workflow',
        nextAction: 'error',
      };
    }

    // Check if workflow has expired
    if (new Date() > new Date(state.expiresAt)) {
      await this.clearSuspendedWorkflow(suspensionId);
      return {
        response: 'Your previous conversation has expired. Please start a new conversation.',
        actionTaken: 'workflow_expired',
        nextAction: 'error',
      };
    }

    console.log(`▶️  Resuming workflow: ${suspensionId} from step ${state.currentStepId}`);
      // Import the workflow execution dynamically to avoid circular deps
      const { resumeWorkflowFromStep } = await import('./workflow-resume-handler');

      const result = await resumeWorkflowFromStep(
        state.userId,
        state.currentStepId,
        state.stepData,
        userInput,
        inputType
      );

      // If workflow completes or errors, clear the suspension
      if (result.nextAction === 'completed' || result.nextAction === 'error') {
        await this.clearSuspendedWorkflow(suspensionId);
      } else if (result.suspendResult) {
        // If workflow suspends again, update the state
        await this.suspendWorkflow(
          state.userId,
          state.workflowId,
          state.runId,
          result.suspendResult.suspensionId.split('-').pop() || state.currentStepId,
          result.suspendResult as any,
          'awaiting_user_input',
          result.suspendResult.message,
          {
            expectedInputType: result.suspendResult.expectedInputType,
            possibleResponses: result.suspendResult.possibleResponses,
          }
        );
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to resume workflow:', error);
      await this.clearSuspendedWorkflow(suspensionId);

      return {
        response: 'I encountered an error resuming your conversation. Please start a new conversation.',
        actionTaken: 'workflow_resume_error',
        nextAction: 'error',
      };
    }
  }

  // Clear a suspended workflow
  async clearSuspendedWorkflow(suspensionId: string): Promise<void> {
    await this.redis.del(`workflow_state:${suspensionId}`);
    console.log(`🗑️  Cleared suspended workflow: ${suspensionId}`);
  }

  // List all suspended workflows for a user (for debugging)
  async listUserSuspendedWorkflows(userId: string): Promise<WorkflowState[]> {
    const keys = await this.redis.keys(`workflow_state:${userId}-*`);
    const states: WorkflowState[] = [];

    for (const key of keys) {
      const stateData = await this.redis.get(key);
      if (stateData) {
        try {
          const parsed = JSON.parse(stateData);
          states.push(WorkflowStateSchema.parse(parsed));
        } catch (error) {
          console.error('Failed to parse workflow state:', error);
        }
      }
    }

    return states;
  }

  // Cleanup expired workflows (called periodically)
  async cleanupExpiredWorkflows(): Promise<number> {
    const keys = await this.redis.keys('workflow_state:*');
    let cleaned = 0;

    for (const key of keys) {
      const stateData = await this.redis.get(key);
      if (stateData) {
        try {
          const state = JSON.parse(stateData);
          if (new Date() > new Date(state.expiresAt)) {
            await this.redis.del(key);
            cleaned++;
          }
        } catch (error) {
          // Invalid state, delete it
          await this.redis.del(key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired workflow states`);
    }

    return cleaned;
  }
}

// Singleton instance
let stateManagerInstance: WorkflowStateManager | null = null;

export function getWorkflowStateManager(): WorkflowStateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new WorkflowStateManager();
  }
  return stateManagerInstance;
}
