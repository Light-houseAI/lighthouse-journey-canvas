/**
 * Action Plan Generator Service
 *
 * Converts natural language step descriptions or captured workflow patterns
 * into executable Playwright actions for the Nano Agent system.
 *
 * Two modes:
 * - Mode A: NL steps → LLM → ExecutableAction[]
 * - Mode B: WorkflowPattern blocks/steps → LLM → ExecutableAction[]
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../core/logger.js';
import type { LLMProvider } from '../../core/llm-provider.js';
import type {
  ExecutableAction,
  PlaywrightActionType,
  TargetAppType,
  GenerateActionsFromNLOptions,
  GenerateActionsFromWorkflowOptions,
} from './types.js';

// ============================================================================
// LLM OUTPUT SCHEMA
// ============================================================================

const llmActionSchema = z.object({
  description: z.string(),
  playwrightAction: z.enum([
    'navigate', 'click', 'type', 'press_key',
    'select_option', 'wait_for', 'screenshot',
    'scroll', 'shell_command', 'app_launch',
  ]),
  targetApp: z.enum(['browser', 'desktop', 'terminal']),
  appName: z.string(),
  params: z.object({
    url: z.string().optional(),
    selector: z.string().optional(),
    selectorType: z.enum(['css', 'xpath', 'text', 'role']).optional(),
    text: z.string().optional(),
    key: z.string().optional(),
    command: z.string().optional(),
    optionValue: z.string().optional(),
    scrollDirection: z.enum(['up', 'down']).optional(),
    scrollAmount: z.number().optional(),
    timeout: z.number().optional(),
  }),
  preconditions: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).default([]),
  expectedResult: z.array(z.object({
    type: z.string(),
    value: z.string().optional(),
  })).default([]),
  confidence: z.number().min(0).max(1),
  postActionDelayMs: z.number().default(500),
});

const llmActionsResponseSchema = z.object({
  actions: z.array(llmActionSchema),
});

// ============================================================================
// SERVICE
// ============================================================================

export interface ActionPlanGeneratorServiceDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

export class ActionPlanGeneratorService {
  private logger: Logger;
  private llmProvider: LLMProvider;

  constructor({ logger, llmProvider }: ActionPlanGeneratorServiceDeps) {
    this.logger = logger;
    this.llmProvider = llmProvider;
  }

  /**
   * Mode A: Generate executable actions from natural language step descriptions.
   */
  async generateFromNaturalLanguage(
    options: GenerateActionsFromNLOptions
  ): Promise<ExecutableAction[]> {
    const { steps, context } = options;

    this.logger.info('[ActionPlanGenerator] Generating actions from NL', {
      stepCount: steps.length,
      hasContext: !!context,
    });

    const prompt = this.buildNLPrompt(steps, context);

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [{ role: 'user', content: prompt }],
        llmActionsResponseSchema,
        { temperature: 0.2, maxTokens: 4000 }
      );

      const actions = response.content.actions.map((action: any, index: number) =>
        this.toLLMAction(action, index, steps[index] || steps[steps.length - 1])
      );

      this.logger.info('[ActionPlanGenerator] Generated NL actions', {
        count: actions.length,
        avgConfidence: actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length,
      });

      return actions;
    } catch (error) {
      this.logger.error('[ActionPlanGenerator] Failed to generate NL actions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Mode B: Generate executable actions from a workflow pattern's blocks and steps.
   * Accepts pre-fetched step data to avoid coupling to specific services.
   */
  async generateFromWorkflowSteps(
    patternName: string,
    stepsData: Array<{
      blockName: string;
      blockIntent: string;
      primaryTool: string;
      steps: Array<{
        actionType: string;
        description: string;
        rawInput: string | null;
        targetElement: string | null;
        appContext: string;
        confidence: number;
      }>;
    }>
  ): Promise<ExecutableAction[]> {
    this.logger.info('[ActionPlanGenerator] Generating actions from workflow', {
      patternName,
      blockCount: stepsData.length,
      totalSteps: stepsData.reduce((sum, b) => sum + b.steps.length, 0),
    });

    const prompt = this.buildWorkflowPrompt(patternName, stepsData);

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [{ role: 'user', content: prompt }],
        llmActionsResponseSchema,
        { temperature: 0.2, maxTokens: 6000 }
      );

      // Build NL inputs from original steps for provenance
      const flatSteps = stepsData.flatMap((block) =>
        block.steps.map((s) => `[${block.blockName}] ${s.description}`)
      );

      const actions = response.content.actions.map((action: any, index: number) =>
        this.toLLMAction(action, index, flatSteps[index] || action.description)
      );

      this.logger.info('[ActionPlanGenerator] Generated workflow actions', {
        count: actions.length,
        avgConfidence: actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length,
      });

      return actions;
    } catch (error) {
      this.logger.error('[ActionPlanGenerator] Failed to generate workflow actions', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE: PROMPT BUILDERS
  // ============================================================================

  private buildNLPrompt(steps: string[], context?: string): string {
    const contextSection = context
      ? `\n## Context\n${context}\n`
      : '';

    const stepsSection = steps
      .map((step, i) => `${i + 1}. ${step}`)
      .join('\n');

    return `You are an automation expert. Convert the following natural language steps into Playwright browser automation actions.

${contextSection}
## Steps to automate
${stepsSection}

## Rules
- Each step should map to exactly ONE Playwright action
- For browser navigation, use "navigate" with the full URL
- For clicking elements, use "click" with a descriptive text or role selector (prefer selectorType: "text" or "role" over CSS)
- For typing text, use "type" with the text to enter and a selector for the input field
- For keyboard shortcuts, use "press_key" with the key combo (e.g., "Control+S")
- For selecting from dropdowns, use "select_option"
- Set confidence to 1.0 for unambiguous steps (navigate to URL, type specific text)
- Set confidence to 0.5-0.8 for steps that need selector inference
- Set confidence below 0.5 for vague steps
- Set appName to the target application (e.g., "Google Chrome", "Terminal")
- Set targetApp to "browser" for web actions, "terminal" for shell commands, "desktop" for desktop app actions
- Add relevant preconditions. Allowed precondition types: "url_matches", "element_visible", "text_present", "app_focused"
- Add expected results where possible. Allowed expectedResult types: "url_changed", "element_appeared", "text_appeared", "page_loaded", "none"
- Set postActionDelayMs between 300-2000 based on expected page load time

Return JSON with an "actions" array.`;
  }

  private buildWorkflowPrompt(
    patternName: string,
    stepsData: Array<{
      blockName: string;
      blockIntent: string;
      primaryTool: string;
      steps: Array<{
        actionType: string;
        description: string;
        rawInput: string | null;
        targetElement: string | null;
        appContext: string;
        confidence: number;
      }>;
    }>
  ): string {
    const blocksSection = stepsData
      .map((block) => {
        const stepsText = block.steps
          .map((step, i) => {
            const parts = [`  ${i + 1}. [${step.actionType}] ${step.description}`];
            if (step.rawInput) parts.push(`     Input: "${step.rawInput}"`);
            if (step.targetElement) parts.push(`     Target: ${step.targetElement}`);
            if (step.appContext) parts.push(`     Context: ${step.appContext}`);
            return parts.join('\n');
          })
          .join('\n');
        return `### Block: ${block.blockName} (intent: ${block.blockIntent}, tool: ${block.primaryTool})\n${stepsText}`;
      })
      .join('\n\n');

    return `You are an automation expert. Convert the following captured workflow pattern into Playwright browser automation actions.

## Workflow: ${patternName}

${blocksSection}

## Rules
- Convert each captured step into ONE executable Playwright action
- Use the actionType, rawInput, and targetElement to infer the correct Playwright action
- For "prompt_entered" steps with rawInput, use "type" action with the rawInput as text
- For "button_clicked" steps, use "click" action with a text/role selector
- For "command_executed" steps, use "shell_command" action
- For "file_opened" steps, use "navigate" or "click" depending on context
- Steps with rawInput get higher confidence (0.8-1.0)
- Steps inferred from descriptions get lower confidence (0.4-0.7)
- Preserve the original execution order
- Set appName based on the block's primaryTool
- Add preconditions where inferable. Allowed precondition types: "url_matches", "element_visible", "text_present", "app_focused"
- Add expected results where inferable. Allowed expectedResult types: "url_changed", "element_appeared", "text_appeared", "page_loaded", "none"

Return JSON with an "actions" array.`;
  }

  // ============================================================================
  // PRIVATE: HELPERS
  // ============================================================================

  private static VALID_PRECONDITION_TYPES = new Set(['url_matches', 'element_visible', 'text_present', 'app_focused']);
  private static VALID_EXPECTED_RESULT_TYPES = new Set(['url_changed', 'element_appeared', 'text_appeared', 'page_loaded', 'none']);

  /** Map common LLM hallucinations to valid enum values */
  private static PRECONDITION_COERCE: Record<string, string> = {
    element_exists: 'element_visible',
    element_present: 'element_visible',
    url_changed: 'url_matches',
    page_loaded: 'url_matches',
  };
  private static EXPECTED_RESULT_COERCE: Record<string, string> = {
    url_matches: 'url_changed',
    element_visible: 'element_appeared',
    element_exists: 'element_appeared',
    text_present: 'text_appeared',
  };

  private toLLMAction(
    llmAction: any,
    index: number,
    naturalLanguageInput: string
  ): ExecutableAction {
    return {
      actionId: uuidv4(),
      order: index,
      description: llmAction.description,
      naturalLanguageInput,
      playwrightAction: llmAction.playwrightAction as PlaywrightActionType,
      targetApp: llmAction.targetApp as TargetAppType,
      appName: llmAction.appName,
      params: llmAction.params,
      preconditions: (llmAction.preconditions || [])
        .map((p: any) => {
          const type = ActionPlanGeneratorService.VALID_PRECONDITION_TYPES.has(p.type)
            ? p.type
            : ActionPlanGeneratorService.PRECONDITION_COERCE[p.type] || null;
          if (!type) return null;
          return { type, value: p.value };
        })
        .filter(Boolean),
      expectedResult: (llmAction.expectedResult || [])
        .map((r: any) => {
          const type = ActionPlanGeneratorService.VALID_EXPECTED_RESULT_TYPES.has(r.type)
            ? r.type
            : ActionPlanGeneratorService.EXPECTED_RESULT_COERCE[r.type] || null;
          if (!type) return null;
          return { type, value: r.value };
        })
        .filter(Boolean),
      confidence: llmAction.confidence,
      requiresConfirmation: true,
      postActionDelayMs: llmAction.postActionDelayMs,
    };
  }
}
