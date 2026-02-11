/**
 * Nano Agent Zod Schemas
 *
 * Validation schemas for API request/response payloads.
 */

import { z } from 'zod';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

export const playwrightActionTypeSchema = z.enum([
  'navigate',
  'click',
  'type',
  'press_key',
  'select_option',
  'wait_for',
  'screenshot',
  'scroll',
  'shell_command',
  'app_launch',
]);

export const targetAppTypeSchema = z.enum(['browser', 'desktop', 'terminal']);

export const selectorTypeSchema = z.enum(['css', 'xpath', 'text', 'role']);

export const actionParamsSchema = z.object({
  url: z.string().optional(),
  selector: z.string().optional(),
  selectorType: selectorTypeSchema.optional(),
  text: z.string().optional(),
  key: z.string().optional(),
  command: z.string().optional(),
  optionValue: z.string().optional(),
  scrollDirection: z.enum(['up', 'down']).optional(),
  scrollAmount: z.number().optional(),
  timeout: z.number().optional(),
});

export const actionPreconditionSchema = z.object({
  type: z.enum(['url_matches', 'element_visible', 'text_present', 'app_focused']),
  value: z.string(),
  timeout: z.number().optional(),
});

export const actionExpectedResultSchema = z.object({
  type: z.enum(['url_changed', 'element_appeared', 'text_appeared', 'page_loaded', 'none']),
  value: z.string().optional(),
  timeout: z.number().optional(),
});

export const executableActionSchema = z.object({
  actionId: z.string(),
  order: z.number().int().min(0),
  description: z.string(),
  naturalLanguageInput: z.string(),
  playwrightAction: playwrightActionTypeSchema,
  targetApp: targetAppTypeSchema,
  appName: z.string(),
  params: actionParamsSchema,
  preconditions: z.array(actionPreconditionSchema).default([]),
  expectedResult: z.array(actionExpectedResultSchema).default([]),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean().default(true),
  postActionDelayMs: z.number().int().min(0).default(500),
});

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

/**
 * POST /api/v2/nano-agent/generate-actions
 */
export const generateActionsFromNLRequestSchema = z.object({
  steps: z.array(z.string().min(1)).min(1).max(50),
  context: z.string().optional(),
});

/**
 * POST /api/v2/nano-agent/generate-from-workflow
 */
export const generateActionsFromWorkflowRequestSchema = z.object({
  workflowPatternId: z.string().min(1),
  blockIds: z.array(z.string()).optional(),
});

/**
 * POST /api/v2/nano-agent/flows
 */
export const createFlowRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  actions: z.array(executableActionSchema).min(1),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  sourceType: z.enum(['custom', 'workflow_pattern', 'hybrid']).optional().default('custom'),
  sourcePatternId: z.string().optional(),
});

/**
 * PUT /api/v2/nano-agent/flows/:flowId
 */
export const updateFlowRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  actions: z.array(executableActionSchema).min(1).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * POST /api/v2/nano-agent/flows/:flowId/share
 */
export const shareFlowRequestSchema = z.object({
  orgId: z.number().int().positive(),
});

/**
 * POST /api/v2/nano-agent/desktop/report
 */
export const desktopStepReportSchema = z.object({
  executionId: z.string().uuid(),
  actionId: z.string(),
  status: z.enum(['completed', 'failed', 'skipped']),
  durationMs: z.number().int().min(0).optional(),
  error: z.string().optional(),
  verificationScreenshotUrl: z.string().optional(),
  userNote: z.string().optional(),
});

/**
 * GET /api/v2/nano-agent/flows query params
 */
export const listFlowsQuerySchema = z.object({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  includeShared: z.string().optional().default('true'),
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type GenerateActionsFromNLRequest = z.infer<typeof generateActionsFromNLRequestSchema>;
export type GenerateActionsFromWorkflowRequest = z.infer<typeof generateActionsFromWorkflowRequestSchema>;
export type CreateFlowRequest = z.infer<typeof createFlowRequestSchema>;
export type UpdateFlowRequest = z.infer<typeof updateFlowRequestSchema>;
export type ShareFlowRequest = z.infer<typeof shareFlowRequestSchema>;
export type DesktopStepReport = z.infer<typeof desktopStepReportSchema>;
export type ListFlowsQuery = z.infer<typeof listFlowsQuerySchema>;
