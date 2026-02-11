/**
 * Nano Agent API Service
 *
 * Client-side API functions for the Nano Agent automation system.
 * Covers action generation, flow CRUD, and execution management.
 */

import { httpClient } from './http-client';

const BASE_URL = '/api/v2/nano-agent';

// ============================================================================
// TYPES (mirrors server-side types for the UI)
// ============================================================================

export interface ExecutableAction {
  actionId: string;
  order: number;
  description: string;
  naturalLanguageInput: string;
  playwrightAction: string;
  targetApp: 'browser' | 'desktop' | 'terminal';
  appName: string;
  params: {
    url?: string;
    selector?: string;
    selectorType?: 'css' | 'xpath' | 'text' | 'role';
    text?: string;
    key?: string;
    command?: string;
    optionValue?: string;
    scrollDirection?: 'up' | 'down';
    scrollAmount?: number;
    timeout?: number;
  };
  preconditions: Array<{ type: string; value: string }>;
  expectedResult: Array<{ type: string; value?: string }>;
  confidence: number;
  requiresConfirmation: boolean;
  postActionDelayMs: number;
}

export interface NanoAgentFlow {
  id: string;
  userId: number;
  name: string;
  description: string;
  sourceType: 'custom' | 'workflow_pattern' | 'hybrid';
  sourcePatternId: string | null;
  actions: ExecutableAction[];
  isTemplate: boolean;
  orgId: number | null;
  tags: string[];
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NanoAgentExecution {
  id: string;
  flowId: string;
  userId: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
  currentStep: number;
  totalSteps: number;
  stepResults: Array<{
    actionId: string;
    status: string;
    executedAt: string | null;
    durationMs: number | null;
    error: string | null;
  }>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExecutionSSEEvent {
  type: string;
  step?: number;
  action?: ExecutableAction;
  result?: any;
  error?: string;
}

// ============================================================================
// ACTION GENERATION
// ============================================================================

/**
 * Convert natural language steps to executable actions via LLM.
 */
export async function generateActionsFromNL(
  steps: string[],
  context?: string
): Promise<ExecutableAction[]> {
  const data = await httpClient.post<{ actions: ExecutableAction[] }>(
    `${BASE_URL}/generate-actions`,
    { steps, context }
  );
  return data.actions;
}

/**
 * Convert a workflow pattern to executable actions.
 */
export async function generateActionsFromWorkflow(
  workflowPatternId: string,
  blockIds?: string[]
): Promise<ExecutableAction[]> {
  const data = await httpClient.post<{ actions: ExecutableAction[] }>(
    `${BASE_URL}/generate-from-workflow`,
    { workflowPatternId, blockIds }
  );
  return data.actions;
}

// ============================================================================
// FLOW CRUD
// ============================================================================

/**
 * Create a new flow.
 */
export async function createFlow(input: {
  name: string;
  description?: string;
  actions: ExecutableAction[];
  tags?: string[];
  sourceType?: 'custom' | 'workflow_pattern' | 'hybrid';
  sourcePatternId?: string;
}): Promise<NanoAgentFlow> {
  const data = await httpClient.post<{ flow: NanoAgentFlow }>(
    `${BASE_URL}/flows`,
    input
  );
  return data.flow;
}

/**
 * Get a flow by ID.
 */
export async function getFlow(flowId: string): Promise<NanoAgentFlow> {
  const data = await httpClient.get<{ flow: NanoAgentFlow }>(
    `${BASE_URL}/flows/${flowId}`
  );
  return data.flow;
}

/**
 * List user's flows (including shared flows).
 */
export async function listFlows(options?: {
  search?: string;
  tags?: string[];
  includeShared?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ flows: NanoAgentFlow[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.tags?.length) params.set('tags', options.tags.join(','));
  if (options?.includeShared !== undefined)
    params.set('includeShared', String(options.includeShared));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const queryStr = params.toString();
  const url = queryStr ? `${BASE_URL}/flows?${queryStr}` : `${BASE_URL}/flows`;
  return httpClient.get<{ flows: NanoAgentFlow[]; total: number }>(url);
}

/**
 * Update a flow.
 */
export async function updateFlow(
  flowId: string,
  updates: {
    name?: string;
    description?: string;
    actions?: ExecutableAction[];
    tags?: string[];
  }
): Promise<NanoAgentFlow> {
  const data = await httpClient.put<{ flow: NanoAgentFlow }>(
    `${BASE_URL}/flows/${flowId}`,
    updates
  );
  return data.flow;
}

/**
 * Delete a flow.
 */
export async function deleteFlow(flowId: string): Promise<void> {
  await httpClient.delete(`${BASE_URL}/flows/${flowId}`);
}

/**
 * Share a flow with an organization.
 */
export async function shareFlow(
  flowId: string,
  orgId: number
): Promise<NanoAgentFlow> {
  const data = await httpClient.post<{ flow: NanoAgentFlow }>(
    `${BASE_URL}/flows/${flowId}/share`,
    { orgId }
  );
  return data.flow;
}

/**
 * Fork (copy) a shared flow.
 */
export async function forkFlow(flowId: string): Promise<NanoAgentFlow> {
  const data = await httpClient.post<{ flow: NanoAgentFlow }>(
    `${BASE_URL}/flows/${flowId}/fork`,
    {}
  );
  return data.flow;
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Start executing a flow.
 */
export async function startExecution(
  flowId: string
): Promise<{ executionId: string }> {
  return httpClient.post<{ executionId: string }>(
    `${BASE_URL}/flows/${flowId}/execute`,
    {}
  );
}

/**
 * Get execution status.
 */
export async function getExecution(
  executionId: string
): Promise<NanoAgentExecution> {
  const data = await httpClient.get<{ execution: NanoAgentExecution }>(
    `${BASE_URL}/executions/${executionId}`
  );
  return data.execution;
}

/**
 * Confirm current step in an execution.
 */
export async function confirmStep(executionId: string): Promise<void> {
  await httpClient.post(`${BASE_URL}/executions/${executionId}/confirm`, {});
}

/**
 * Skip current step in an execution.
 */
export async function skipStep(executionId: string): Promise<void> {
  await httpClient.post(`${BASE_URL}/executions/${executionId}/skip`, {});
}

/**
 * Abort an execution.
 */
export async function abortExecution(executionId: string): Promise<void> {
  await httpClient.post(`${BASE_URL}/executions/${executionId}/abort`, {});
}

/**
 * Poll execution status for real-time-ish progress.
 * Uses httpClient (with automatic auth) instead of EventSource (which can't send auth headers).
 * Follows the polling pattern from insight-assistant-api.ts pollForJobCompletion().
 *
 * @returns cleanup object with stop() to cancel polling
 */
export function pollExecution(
  executionId: string,
  onUpdate: (execution: NanoAgentExecution) => void,
  onError?: (error: Error) => void,
  pollIntervalMs: number = 1500
): { stop: () => void } {
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    if (stopped) return;
    try {
      const execution = await getExecution(executionId);
      if (stopped) return;
      onUpdate(execution);

      // Stop polling when execution reaches a terminal state
      if (['completed', 'failed', 'aborted'].includes(execution.status)) {
        stopped = true;
        return;
      }
    } catch (err) {
      if (stopped) return;
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    }

    if (!stopped) {
      timeoutId = setTimeout(poll, pollIntervalMs);
    }
  };

  // Start first poll immediately
  poll();

  return {
    stop: () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}
