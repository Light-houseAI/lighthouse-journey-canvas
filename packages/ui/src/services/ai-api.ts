/**
 * AI API Service
 *
 * Handles communication with AI chat endpoints
 * These endpoints return streaming responses (Server-Sent Events)
 */

export interface ChatMessage {
  message: string;
  userId?: string;
}

export interface OnboardingMessage {
  step: number;
  message: string;
}

export interface ResumeWorkflowRequest {
  runId: string;
  suspendedStep: string;
  userInput: string;
  userId: string;
}

export interface StreamEvent {
  type: 'text' | 'suspended' | 'done';
  content?: string;
  data?: {
    message?: string;
    suspensionId?: string;
    runId?: string;
    suspendedStep?: string;
  };
  suspended?: boolean;
}

/**
 * Send a chat message to the AI
 * Returns a streaming response (ReadableStream)
 */
export async function sendChatMessage(message: string): Promise<Response> {
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Chat request failed');
  }

  return response;
}

/**
 * Send an onboarding message to the AI
 * Returns a JSON response
 */
export async function sendOnboardingMessage(
  step: number,
  message: string
): Promise<{
  message: string;
  step: number;
  isComplete: boolean;
}> {
  const response = await fetch('/api/ai/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ step, message }),
  });

  if (!response.ok) {
    throw new Error('Onboarding request failed');
  }

  return response.json();
}

/**
 * Resume a suspended workflow
 * Returns a streaming response (ReadableStream)
 */
export async function resumeWorkflow(
  runId: string,
  suspendedStep: string,
  userInput: string,
  userId: string
): Promise<Response> {
  const response = await fetch('/api/ai/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      runId,
      suspendedStep,
      userInput,
      userId,
    }),
  });

  if (!response.ok) {
    throw new Error('Resume request failed');
  }

  return response;
}

/**
 * Parse a Server-Sent Events stream
 * Helper function to process SSE data
 */
export function parseSSEChunk(chunk: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        events.push(data);
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    }
  }

  return events;
}
