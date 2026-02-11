/**
 * Nano Agent Types
 *
 * Core type definitions for the nano agent automation system.
 * Covers executable actions, flows, execution sessions, and communication protocol.
 */

// ============================================================================
// PLAYWRIGHT ACTION TYPES
// ============================================================================

/**
 * Playwright automation primitive types
 */
export type PlaywrightActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'press_key'
  | 'select_option'
  | 'wait_for'
  | 'screenshot'
  | 'scroll'
  | 'shell_command'
  | 'app_launch';

/**
 * Target application type for the action
 */
export type TargetAppType = 'browser' | 'desktop' | 'terminal';

/**
 * Selector strategy for finding UI elements
 */
export type SelectorType = 'css' | 'xpath' | 'text' | 'role';

// ============================================================================
// EXECUTABLE ACTION
// ============================================================================

/**
 * Parameters for an executable action
 */
export interface ActionParams {
  url?: string;
  selector?: string;
  selectorType?: SelectorType;
  text?: string;
  key?: string;
  command?: string;
  optionValue?: string;
  scrollDirection?: 'up' | 'down';
  scrollAmount?: number;
  timeout?: number;
}

/**
 * Precondition that must be true before executing an action
 */
export interface ActionPrecondition {
  type: 'url_matches' | 'element_visible' | 'text_present' | 'app_focused';
  value: string;
  timeout?: number;
}

/**
 * Expected result after action execution for verification
 */
export interface ActionExpectedResult {
  type: 'url_changed' | 'element_appeared' | 'text_appeared' | 'page_loaded' | 'none';
  value?: string;
  timeout?: number;
}

/**
 * A single executable automation action.
 * Derived from natural language input or captured workflow steps.
 */
export interface ExecutableAction {
  /** Unique ID for this action */
  actionId: string;
  /** Order in the execution sequence (0-indexed) */
  order: number;
  /** Human-readable description */
  description: string;
  /** Original natural language input from the user */
  naturalLanguageInput: string;
  /** The Playwright automation primitive */
  playwrightAction: PlaywrightActionType;
  /** Target application type */
  targetApp: TargetAppType;
  /** Application name (e.g., "Google Chrome", "Terminal") */
  appName: string;
  /** Action parameters */
  params: ActionParams;
  /** Preconditions that must be met before executing */
  preconditions: ActionPrecondition[];
  /** Expected result after execution */
  expectedResult: ActionExpectedResult[];
  /** Confidence that this action is correctly translated (0-1) */
  confidence: number;
  /** Whether user must confirm before execution (default true) */
  requiresConfirmation: boolean;
  /** Suggested wait time after execution (ms) */
  postActionDelayMs: number;
}

// ============================================================================
// STEP EXECUTION RESULT
// ============================================================================

/**
 * Status of an individual step during execution
 */
export type StepExecutionStatus =
  | 'pending'
  | 'confirmed'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Result of executing a single step
 */
export interface StepExecutionResult {
  actionId: string;
  status: StepExecutionStatus;
  executedAt: string | null;
  durationMs: number | null;
  verificationScreenshotUrl: string | null;
  error: string | null;
  userNote: string | null;
}

// ============================================================================
// COMMUNICATION PROTOCOL (Server <-> Desktop Companion)
// ============================================================================

/**
 * Messages from Server to Desktop Companion
 */
export type ServerToDesktopMessage =
  | { type: 'execute_action'; action: ExecutableAction; sessionId: string }
  | { type: 'pause_execution'; sessionId: string }
  | { type: 'resume_execution'; sessionId: string }
  | { type: 'abort_execution'; sessionId: string };

/**
 * Messages from Desktop Companion to Server
 */
export type DesktopToServerMessage =
  | { type: 'action_completed'; sessionId: string; actionId: string; result: StepExecutionResult }
  | { type: 'action_failed'; sessionId: string; actionId: string; error: string; screenshot?: string }
  | { type: 'ready_for_next'; sessionId: string }
  | { type: 'execution_aborted'; sessionId: string; reason: string }
  | { type: 'desktop_status'; capabilities: DesktopCapabilities };

/**
 * Desktop companion capabilities report
 */
export interface DesktopCapabilities {
  playwrightAvailable: boolean;
  supportedBrowsers: string[];
  accessibilityEnabled: boolean;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

/**
 * Options for generating actions from natural language
 */
export interface GenerateActionsFromNLOptions {
  steps: string[];
  context?: string;
}

/**
 * Options for generating actions from a workflow pattern
 */
export interface GenerateActionsFromWorkflowOptions {
  workflowPatternId: string;
  blockIds?: string[];
}

/**
 * Create flow request
 */
export interface CreateFlowRequest {
  name: string;
  description?: string;
  actions: ExecutableAction[];
  tags?: string[];
  sourceType?: 'custom' | 'workflow_pattern' | 'hybrid';
  sourcePatternId?: string;
}

/**
 * Update flow request
 */
export interface UpdateFlowRequest {
  name?: string;
  description?: string;
  actions?: ExecutableAction[];
  tags?: string[];
}

/**
 * Share flow request
 */
export interface ShareFlowRequest {
  orgId: number;
}

/**
 * Desktop step report from the Desktop companion
 */
export interface DesktopStepReport {
  executionId: string;
  actionId: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string;
  verificationScreenshotUrl?: string;
  userNote?: string;
}

/**
 * Pending execution data for Desktop polling
 */
export interface PendingExecutionData {
  executionId: string;
  flowId: string;
  flowName: string;
  actions: ExecutableAction[];
  currentStep: number;
  totalSteps: number;
}

/**
 * Pending execution response for Desktop polling (null when no pending work)
 */
export type PendingExecutionResponse = PendingExecutionData | null;

/**
 * SSE event types for execution streaming
 */
export type ExecutionSSEEvent =
  | { type: 'step_pending'; step: number; action: ExecutableAction }
  | { type: 'step_confirmed'; step: number }
  | { type: 'step_executing'; step: number }
  | { type: 'step_completed'; step: number; result: StepExecutionResult }
  | { type: 'step_failed'; step: number; error: string }
  | { type: 'step_skipped'; step: number }
  | { type: 'execution_running' }
  | { type: 'execution_completed' }
  | { type: 'execution_aborted' }
  | { type: 'execution_error'; error: string };
