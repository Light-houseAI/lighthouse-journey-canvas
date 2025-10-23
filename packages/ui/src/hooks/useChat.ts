/**
 * TanStack Query hooks for chat management
 * Separates server state from UI state
 *
 * Pattern:
 * - useChat hooks handle server data (messages, workflow state) via TanStack Query
 * - Chat store handles UI state (isTyping, inputValue, isPanelOpen) via Zustand
 */

import { useMutation } from '@tanstack/react-query';

import {
  parseSSEChunk,
  resumeWorkflow as resumeWorkflowApi,
  sendChatMessage,
  sendOnboardingMessage,
} from '../services/ai-api';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTemporary?: boolean;
}

export type ConversationState =
  | 'initial'
  | 'awaiting_update'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'adding_milestone'
  | 'confirming_updates'
  | 'time_selection'
  | 'quick_update'
  | 'detailed_star';

export type TimeFrame = 'quick' | 'standard' | 'detailed' | null;

export interface MilestoneContext {
  parentNodeId?: string;
  parentTitle?: string;
  parentOrganization?: string;
  step?: 'situation' | 'task' | 'action' | 'result';
  situation?: string;
  task?: string;
  action?: string;
  initialDescription?: string;
}

export interface WorkflowSuspension {
  isSuspended: boolean;
  suspensionId: string | null;
  runId: string | null;
  suspendedStep: string | null;
}

export interface ConversationContext {
  conversationState: ConversationState;
  selectedTimeFrame: TimeFrame;
  onboardingStep: number;
  isOnboardingComplete: boolean;
  addingMilestoneContext: MilestoneContext | null;
  pendingUpdates: any[];
  workflowSuspension: WorkflowSuspension;
}

export interface StreamingMessageCallbacks {
  onTextChunk?: (content: string) => void;
  onSuspended?: (data: WorkflowSuspension & { message: string }) => void;
  onComplete?: () => void;
}

// ============================================================================
// Query Keys
// ============================================================================

export const chatKeys = {
  all: ['chat'] as const,
  messages: () => [...chatKeys.all, 'messages'] as const,
  context: () => [...chatKeys.all, 'context'] as const,
};

// ============================================================================
// Streaming Message Handler
// ============================================================================

/**
 * Process streaming response from AI endpoints
 */
async function processStreamingResponse(
  response: Response,
  callbacks: StreamingMessageCallbacks
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body reader available');
  }

  const decoder = new TextDecoder();
  let accumulatedText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const events = parseSSEChunk(chunk);

    for (const data of events) {
      if (data.type === 'text') {
        accumulatedText += data.content || '';
        callbacks.onTextChunk?.(accumulatedText);
      } else if (data.type === 'suspended') {
        const suspensionData: WorkflowSuspension & { message: string } = {
          isSuspended: true,
          suspensionId: data.data?.suspensionId || null,
          runId: data.data?.runId || null,
          suspendedStep: data.data?.suspendedStep || null,
          message:
            data.data?.message ||
            'Please provide additional information to continue.',
        };
        callbacks.onSuspended?.(suspensionData);
        return; // Exit early on suspension
      } else if (data.type === 'done') {
        callbacks.onComplete?.();
        return;
      }
    }
  }

  callbacks.onComplete?.();
}

// ============================================================================
// Chat Message Mutations
// ============================================================================

export interface SendMessageParams {
  message: string;
  callbacks?: StreamingMessageCallbacks;
}

export interface UseSendMessageReturn {
  mutate: (params: SendMessageParams) => void;
  mutateAsync: (params: SendMessageParams) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to send a chat message to the AI
 * Returns streaming response
 */
export function useSendMessage(): UseSendMessageReturn {
  const mutation = useMutation({
    mutationFn: async ({ message, callbacks }: SendMessageParams) => {
      const response = await sendChatMessage(message);
      await processStreamingResponse(response, callbacks || {});
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// Onboarding Mutations
// ============================================================================

export interface SendOnboardingMessageParams {
  step: number;
  message: string;
}

export interface OnboardingResponse {
  message: string;
  step: number;
  isComplete: boolean;
}

export interface UseSendOnboardingMessageReturn {
  mutate: (params: SendOnboardingMessageParams) => void;
  mutateAsync: (
    params: SendOnboardingMessageParams
  ) => Promise<OnboardingResponse>;
  isPending: boolean;
  error: Error | null;
  data: OnboardingResponse | undefined;
}

/**
 * Hook to send an onboarding message
 * Returns JSON response (not streaming)
 */
export function useSendOnboardingMessage(): UseSendOnboardingMessageReturn {
  const mutation = useMutation({
    mutationFn: async ({ step, message }: SendOnboardingMessageParams) => {
      return await sendOnboardingMessage(step, message);
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ============================================================================
// Workflow Resume Mutations
// ============================================================================

export interface ResumeWorkflowParams {
  runId: string;
  suspendedStep: string;
  userInput: string;
  userId: string;
  callbacks?: StreamingMessageCallbacks;
}

export interface UseResumeWorkflowReturn {
  mutate: (params: ResumeWorkflowParams) => void;
  mutateAsync: (params: ResumeWorkflowParams) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook to resume a suspended workflow
 * Returns streaming response
 */
export function useResumeWorkflow(): UseResumeWorkflowReturn {
  const mutation = useMutation({
    mutationFn: async ({
      runId,
      suspendedStep,
      userInput,
      userId,
      callbacks,
    }: ResumeWorkflowParams) => {
      const response = await resumeWorkflowApi(
        runId,
        suspendedStep,
        userInput,
        userId
      );
      await processStreamingResponse(response, callbacks || {});
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Combined hook for handling all chat message sending scenarios
 * Automatically determines which mutation to use based on context
 */
export function useChatMutation() {
  const sendMessage = useSendMessage();
  const sendOnboardingMessage = useSendOnboardingMessage();
  const resumeWorkflow = useResumeWorkflow();

  return {
    sendMessage,
    sendOnboardingMessage,
    resumeWorkflow,
  };
}
