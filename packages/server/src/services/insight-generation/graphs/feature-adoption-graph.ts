/**
 * A5 Feature Adoption Agent Graph
 *
 * LangGraph implementation of the Feature Adoption Agent (A5) that:
 * 1. Analyzes user's tool usage patterns from userToolbox
 * 2. Detects feature gaps based on workflow patterns and inefficiencies
 * 3. Generates personalized tips for underused features in tools they already use
 *
 * Key Design Decisions:
 * - Only suggests features from tools in user's existing toolbox
 * - Output as separate "Tips" - NOT merged with optimization blocks
 * - No external APIs (web search) - pure LLM analysis
 * - Uses Gemini 2.5 Flash for fast, cost-effective generation
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import { withTimeout } from '../../../core/retry-utils.js';

// LLM call timeout constant
const LLM_TIMEOUT_MS = 60000; // 60 seconds
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type { FeatureAdoptionTip, UserToolbox, Diagnostics, EvidenceBundle } from '../types.js';
import { A5_FEATURE_ADOPTION_SYSTEM_PROMPT } from '../prompts/system-prompts.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureAdoptionGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

/**
 * Tool feature definition
 */
interface ToolFeature {
  feature: string;
  description: string;
  trigger: string;
  category: 'planning' | 'editing' | 'navigation' | 'automation' | 'debugging' | 'design' | 'organization';
}

/**
 * Behavior pattern for detection
 */
interface BehaviorPattern {
  id: string;
  name: string;
  detect: (evidence: EvidenceBundle, diagnostics: Diagnostics) => boolean;
  matchingFeatures: Array<{ tool: string; feature: string }>;
  messageTemplate: string;
  savingsEstimate: number;
}

// ============================================================================
// TOOL-FEATURE KNOWLEDGE BASE
// ============================================================================

/**
 * Comprehensive per-tool feature catalog
 * Maps normalized tool names to their available features
 */
const TOOL_FEATURE_KNOWLEDGE: Record<string, ToolFeature[]> = {
  cursor: [
    {
      feature: 'Plan Mode',
      description: 'Create implementation plans before coding',
      trigger: '@plan',
      category: 'planning',
    },
    {
      feature: 'Composer',
      description: 'Multi-file changes and refactoring',
      trigger: 'Cmd+I',
      category: 'editing',
    },
    {
      feature: 'Chat with codebase',
      description: 'Search and understand code context',
      trigger: '@codebase',
      category: 'navigation',
    },
    {
      feature: 'Tab completion',
      description: 'AI-powered autocomplete',
      trigger: 'Tab',
      category: 'editing',
    },
    {
      feature: 'Agent Mode',
      description: 'Autonomous code generation and problem-solving',
      trigger: 'Cmd+.',
      category: 'automation',
    },
  ],
  vscode: [
    { feature: 'Multi-cursor', description: 'Edit multiple locations at once', trigger: 'Cmd+D', category: 'editing' },
    { feature: 'Quick Open', description: 'Fast file navigation', trigger: 'Cmd+P', category: 'navigation' },
    { feature: 'Go to Definition', description: 'Jump to code definitions', trigger: 'F12', category: 'navigation' },
    { feature: 'Snippets', description: 'Custom code templates', trigger: 'Cmd+Shift+P > Snippets', category: 'editing' },
    { feature: 'Find in Files', description: 'Search across entire project', trigger: 'Cmd+Shift+F', category: 'navigation' },
    { feature: 'Source Control', description: 'Git integration panel', trigger: 'Cmd+Shift+G', category: 'automation' },
  ],
  terminal: [
    { feature: 'Shell aliases', description: 'Shortcuts for common commands', trigger: 'alias in .zshrc', category: 'automation' },
    { feature: 'History search', description: 'Find previous commands', trigger: 'Ctrl+R', category: 'navigation' },
    { feature: 'Tab completion', description: 'Auto-complete paths and commands', trigger: 'Tab', category: 'editing' },
    { feature: 'Command substitution', description: 'Use command output in other commands', trigger: '$(command)', category: 'automation' },
  ],
  chrome: [
    { feature: 'DevTools shortcuts', description: 'Quick access to developer tools', trigger: 'Cmd+Option+I', category: 'debugging' },
    { feature: 'Network throttling', description: 'Test slow connections', trigger: 'DevTools > Network > Throttling', category: 'debugging' },
    { feature: 'Console shortcuts', description: 'Quick console access', trigger: 'Cmd+Option+J', category: 'debugging' },
    { feature: 'Element inspection', description: 'Inspect page elements', trigger: 'Cmd+Shift+C', category: 'debugging' },
  ],
  slack: [
    { feature: 'Quick switcher', description: 'Fast channel/DM navigation', trigger: 'Cmd+K', category: 'navigation' },
    { feature: 'Threads', description: 'Keep conversations organized', trigger: 'Reply in thread', category: 'organization' },
    { feature: 'Saved items', description: 'Bookmark important messages', trigger: 'Add to saved items', category: 'organization' },
    { feature: 'Reminders', description: 'Set reminders for messages', trigger: '/remind', category: 'automation' },
  ],
  notion: [
    { feature: 'Slash commands', description: 'Quick formatting and blocks', trigger: '/', category: 'editing' },
    { feature: 'Templates', description: 'Reusable page structures', trigger: '/template', category: 'automation' },
    { feature: 'Linked databases', description: 'Create views of existing databases', trigger: '/linked', category: 'organization' },
    { feature: 'Toggle blocks', description: 'Collapsible content sections', trigger: '/toggle', category: 'editing' },
  ],
  figma: [
    { feature: 'Auto-layout', description: 'Responsive design containers', trigger: 'Shift+A', category: 'design' },
    { feature: 'Components', description: 'Reusable design elements', trigger: 'Cmd+Option+K', category: 'design' },
    { feature: 'Variants', description: 'Component states and variations', trigger: 'Add variant', category: 'design' },
    { feature: 'Dev Mode', description: 'Developer handoff view', trigger: 'Shift+D', category: 'design' },
  ],
  github: [
    { feature: 'Keyboard shortcuts', description: 'Navigate GitHub faster', trigger: '?', category: 'navigation' },
    { feature: 'Code search', description: 'Search across repositories', trigger: '/', category: 'navigation' },
    { feature: 'Actions', description: 'CI/CD automation', trigger: '.github/workflows', category: 'automation' },
    { feature: 'Copilot', description: 'AI code suggestions', trigger: 'Tab', category: 'editing' },
  ],
  linear: [
    { feature: 'Keyboard shortcuts', description: 'Navigate Linear faster', trigger: '?', category: 'navigation' },
    { feature: 'Quick actions', description: 'Fast issue creation', trigger: 'C', category: 'automation' },
    { feature: 'Filters', description: 'Custom issue views', trigger: 'F', category: 'organization' },
    { feature: 'Cycles', description: 'Sprint planning', trigger: 'Cycles tab', category: 'planning' },
  ],
};

// ============================================================================
// BEHAVIOR PATTERN DETECTION
// ============================================================================

/**
 * Behavior patterns that indicate potential feature adoption opportunities
 */
const BEHAVIOR_PATTERNS: BehaviorPattern[] = [
  {
    id: 'coding_without_planning',
    name: 'Heavy coding without planning',
    detect: (evidence: EvidenceBundle) => {
      if (!evidence.workflows) return false;
      const codingSteps = evidence.workflows.flatMap(w =>
        w.steps.filter(s => ['cursor', 'vscode', 'code'].some(t =>
          s.app?.toLowerCase().includes(t)
        ))
      );
      const hasPlanningSteps = codingSteps.some(s =>
        s.description?.toLowerCase().includes('plan') ||
        s.description?.toLowerCase().includes('@plan') ||
        s.description?.toLowerCase().includes('design')
      );
      return codingSteps.length > 10 && !hasPlanningSteps;
    },
    matchingFeatures: [{ tool: 'cursor', feature: 'Plan Mode' }],
    messageTemplate: "It looks like you're coding heavily in {tool} but haven't been using {feature}. {feature} can help streamline your workflow and avoid repetitive tasks. Give it a try with {trigger}!",
    savingsEstimate: 300,
  },
  {
    id: 'repetitive_edits_no_multicursor',
    name: 'Repetitive edits without multi-cursor',
    detect: (_evidence: EvidenceBundle, diagnostics: Diagnostics) => {
      if (!diagnostics?.inefficiencies) return false;
      return diagnostics.inefficiencies.some(i =>
        i.type === 'repetitive_search' || i.type === 'rework_loop'
      );
    },
    matchingFeatures: [
      { tool: 'vscode', feature: 'Multi-cursor' },
      { tool: 'cursor', feature: 'Composer' },
    ],
    messageTemplate: "We noticed some repetitive editing patterns in your workflow. Using {feature} in {tool} ({trigger}) could help you make multiple changes at once.",
    savingsEstimate: 120,
  },
  {
    id: 'manual_file_navigation',
    name: 'Manual file browsing instead of quick open',
    detect: (evidence: EvidenceBundle) => {
      if (!evidence.workflows) return false;
      const browsingSteps = evidence.workflows.flatMap(w =>
        w.steps.filter(s =>
          s.description?.toLowerCase().includes('open') ||
          s.description?.toLowerCase().includes('navigate') ||
          s.description?.toLowerCase().includes('browse')
        )
      );
      return browsingSteps.length > 5;
    },
    matchingFeatures: [
      { tool: 'vscode', feature: 'Quick Open' },
      { tool: 'cursor', feature: 'Chat with codebase' },
    ],
    messageTemplate: "You're spending time navigating files manually. Try {feature} ({trigger}) in {tool} to jump directly to files and code!",
    savingsEstimate: 60,
  },
  {
    id: 'context_switching_no_shortcuts',
    name: 'Frequent context switching without shortcuts',
    detect: (_evidence: EvidenceBundle, diagnostics: Diagnostics) => {
      if (!diagnostics?.inefficiencies) return false;
      return diagnostics.inefficiencies.some(i =>
        i.type === 'context_switching'
      );
    },
    matchingFeatures: [
      { tool: 'slack', feature: 'Quick switcher' },
      { tool: 'vscode', feature: 'Quick Open' },
    ],
    messageTemplate: "We noticed frequent context switching in your workflow. {tool}'s {feature} ({trigger}) can help you switch faster without losing focus.",
    savingsEstimate: 90,
  },
  {
    id: 'manual_automation_opportunity',
    name: 'Manual tasks that could be automated',
    detect: (_evidence: EvidenceBundle, diagnostics: Diagnostics) => {
      if (!diagnostics?.inefficiencies) return false;
      return diagnostics.inefficiencies.some(i =>
        i.type === 'manual_automation'
      );
    },
    matchingFeatures: [
      { tool: 'cursor', feature: 'Agent Mode' },
      { tool: 'terminal', feature: 'Shell aliases' },
      { tool: 'github', feature: 'Actions' },
    ],
    messageTemplate: "Some of your manual tasks could be automated. Try {feature} in {tool} ({trigger}) to speed up repetitive work.",
    savingsEstimate: 180,
  },
  // NEW CURSOR-SPECIFIC PATTERNS
  {
    id: 'repetitive_ai_prompting',
    name: 'Repetitive AI prompting without Plan Mode',
    detect: (evidence: EvidenceBundle) => {
      if (!evidence.workflows) return false;
      // Look for multiple similar AI interactions without planning
      const cursorSteps = evidence.workflows.flatMap(w =>
        w.steps.filter(s =>
          s.app?.toLowerCase().includes('cursor') &&
          (s.description?.toLowerCase().includes('ask') ||
           s.description?.toLowerCase().includes('prompt') ||
           s.description?.toLowerCase().includes('chat') ||
           s.description?.toLowerCase().includes('ai'))
        )
      );
      const hasPlanning = evidence.workflows.some(w =>
        w.steps.some(s =>
          s.description?.toLowerCase().includes('@plan') ||
          s.description?.toLowerCase().includes('plan mode')
        )
      );
      // Trigger if multiple AI prompts without planning
      return cursorSteps.length >= 5 && !hasPlanning;
    },
    matchingFeatures: [{ tool: 'cursor', feature: 'Plan Mode' }],
    messageTemplate: "You're asking multiple AI prompts in {tool}. Try {feature} ({trigger}) to create a plan first, then execute - this reduces back-and-forth and produces more coherent code changes.",
    savingsEstimate: 420,
  },
  {
    id: 'multi_file_edits_no_composer',
    name: 'Multi-file editing without Composer',
    detect: (evidence: EvidenceBundle) => {
      if (!evidence.workflows) return false;
      // Count file switches during coding sessions
      const cursorWorkflows = evidence.workflows.filter(w =>
        w.tools?.some(t => t.toLowerCase().includes('cursor'))
      );
      const totalFileSwitches = cursorWorkflows.reduce((sum, w) => {
        const files = new Set<string>();
        w.steps.forEach(s => {
          if (s.description?.toLowerCase().includes('switch') ||
              s.description?.toLowerCase().includes('open') ||
              s.description?.match(/\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h)/i)) {
            const fileMatch = s.description?.match(/[\w-]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h)/i);
            if (fileMatch) files.add(fileMatch[0]);
          }
        });
        return sum + files.size;
      }, 0);
      const hasComposer = evidence.workflows.some(w =>
        w.steps.some(s =>
          s.description?.toLowerCase().includes('composer') ||
          s.description?.toLowerCase().includes('cmd+i')
        )
      );
      return totalFileSwitches >= 3 && !hasComposer;
    },
    matchingFeatures: [{ tool: 'cursor', feature: 'Composer' }],
    messageTemplate: "You're editing multiple files in {tool}. {feature} ({trigger}) can make coordinated changes across files in a single operation - no more switching back and forth!",
    savingsEstimate: 300,
  },
  {
    id: 'code_exploration_no_codebase_chat',
    name: 'Code exploration without @codebase',
    detect: (evidence: EvidenceBundle) => {
      if (!evidence.workflows) return false;
      // Look for exploration patterns
      const explorationSteps = evidence.workflows.flatMap(w =>
        w.steps.filter(s =>
          s.description?.toLowerCase().includes('search') ||
          s.description?.toLowerCase().includes('find') ||
          s.description?.toLowerCase().includes('where is') ||
          s.description?.toLowerCase().includes('looking for')
        )
      );
      const hasCodebaseChat = evidence.workflows.some(w =>
        w.steps.some(s =>
          s.description?.toLowerCase().includes('@codebase') ||
          s.description?.toLowerCase().includes('codebase')
        )
      );
      return explorationSteps.length >= 3 && !hasCodebaseChat;
    },
    matchingFeatures: [{ tool: 'cursor', feature: 'Chat with codebase' }],
    messageTemplate: "You're spending time searching through code. Try {feature} ({trigger}) in {tool} - it understands your entire codebase and can answer questions like 'where is X defined?' instantly.",
    savingsEstimate: 240,
  },
  {
    id: 'longcut_path_detected',
    name: 'Taking longer paths in workflows',
    detect: (_evidence: EvidenceBundle, diagnostics: Diagnostics) => {
      if (!diagnostics?.inefficiencies) return false;
      return diagnostics.inefficiencies.some(i =>
        i.type === 'longcut_path'
      );
    },
    matchingFeatures: [
      { tool: 'cursor', feature: 'Tab completion' },
      { tool: 'vscode', feature: 'Snippets' },
    ],
    messageTemplate: "We detected some inefficient patterns in your workflow. {tool}'s {feature} ({trigger}) can help you complete common patterns much faster.",
    savingsEstimate: 150,
  },
];

// ============================================================================
// LLM SCHEMA
// ============================================================================

/**
 * Zod schema for LLM output validation
 * NOTE: Schema is intentionally flexible with defaults to handle various LLM response formats.
 * Empty arrays and fallback values prevent parsing failures when LLM returns partial/empty data.
 */
const featureAdoptionTipsSchema = z.object({
  tips: z.array(z.object({
    toolName: z.string().default('unknown').describe('The tool name (must be from user toolbox)'),
    featureName: z.string().default('unknown').describe('The specific feature name'),
    triggerOrShortcut: z.string().default('').describe('How to activate the feature (shortcut, command, etc.)'),
    message: z.string().default('').describe('Friendly, non-intrusive tip message for the user'),
    addressesPattern: z.string().default('').describe('What workflow pattern this addresses'),
    estimatedSavingsSeconds: z.number().default(0).describe('Estimated time saved per use'),
    confidence: z.number().min(0).max(1).catch(0.5).describe('Confidence score'),
  })).max(3).default([]), // Default to empty array if missing or malformed
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize tool name for matching
 */
function normalizeToolName(tool: string): string {
  const normalized = tool.toLowerCase().trim();

  // Handle common aliases
  const aliases: Record<string, string> = {
    'visual studio code': 'vscode',
    'vs code': 'vscode',
    'code': 'vscode',
    'google chrome': 'chrome',
    'iterm': 'terminal',
    'iterm2': 'terminal',
    'warp': 'terminal',
    'hyper': 'terminal',
    'alacritty': 'terminal',
    'jetbrains': 'vscode', // Similar feature set
    'webstorm': 'vscode',
    'intellij': 'vscode',
    'pycharm': 'vscode',
  };

  return aliases[normalized] || normalized;
}

/**
 * Check if user has a tool in their toolbox
 */
function userHasTool(userToolbox: UserToolbox | null, toolName: string): boolean {
  if (!userToolbox?.normalizedTools) return false;

  const normalizedTarget = normalizeToolName(toolName);
  return userToolbox.normalizedTools.some(t =>
    normalizeToolName(t).includes(normalizedTarget) ||
    normalizedTarget.includes(normalizeToolName(t))
  );
}

/**
 * Build relevant features context for LLM
 */
function buildRelevantFeaturesContext(userToolbox: UserToolbox | null): string {
  if (!userToolbox?.normalizedTools) return 'No tools detected';

  const relevantFeatures: string[] = [];

  for (const tool of userToolbox.normalizedTools) {
    const normalized = normalizeToolName(tool);
    const features = TOOL_FEATURE_KNOWLEDGE[normalized];

    if (features) {
      const featureList = features.map(f =>
        `  - ${f.feature}: ${f.description} (${f.trigger})`
      ).join('\n');
      relevantFeatures.push(`${tool}:\n${featureList}`);
    }
  }

  return relevantFeatures.length > 0
    ? relevantFeatures.join('\n\n')
    : 'No feature knowledge available for detected tools';
}

/**
 * Format template message with placeholders
 */
function formatMessage(template: string, tool: string, feature: string, trigger: string): string {
  return template
    .replace(/{tool}/g, tool)
    .replace(/{feature}/g, feature)
    .replace(/{trigger}/g, trigger);
}

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Analyze tool usage patterns from user's historical data
 */
async function analyzeToolUsage(
  state: InsightState,
  deps: FeatureAdoptionGraphDeps
): Promise<Partial<InsightState>> {
  const { logger } = deps;

  if (!state.userToolbox || state.userToolbox.tools.length === 0) {
    logger.warn('A5: No user toolbox available, skipping feature adoption analysis');
    return {
      currentStage: 'a5_analysis_skipped',
      featureAdoptionTips: [],
    };
  }

  // Get tools that match our feature knowledge
  const knownTools = state.userToolbox.normalizedTools.filter(tool => {
    const normalized = normalizeToolName(tool);
    return TOOL_FEATURE_KNOWLEDGE[normalized] !== undefined;
  });

  logger.info('A5: Analyzing tool usage', {
    totalTools: state.userToolbox.tools.length,
    knownToolsWithFeatures: knownTools.length,
    knownTools: knownTools.slice(0, 10),
  });

  return {
    currentStage: 'a5_tool_analysis_complete',
    progress: 70,
  };
}

/**
 * Node: Detect feature gaps based on workflow patterns
 */
async function detectFeatureGaps(
  state: InsightState,
  deps: FeatureAdoptionGraphDeps
): Promise<Partial<InsightState>> {
  const { logger } = deps;

  if (!state.userEvidence) {
    logger.warn('A5: No user evidence available');
    return {
      currentStage: 'a5_gap_detection_skipped',
      featureAdoptionTips: [],
    };
  }

  const matchedPatterns: Array<{
    pattern: BehaviorPattern;
    matchedFeature: { tool: string; feature: string };
  }> = [];

  // Check each behavior pattern against user's evidence
  for (const pattern of BEHAVIOR_PATTERNS) {
    try {
      const detected = pattern.detect(
        state.userEvidence,
        state.userDiagnostics || {
          workflowId: '',
          workflowName: '',
          metrics: {
            totalWorkflowTime: 0,
            activeTime: 0,
            idleTime: 0,
            contextSwitches: 0,
            reworkLoops: 0,
            uniqueToolsUsed: 0,
            toolDistribution: {},
            workflowTagDistribution: {},
            averageStepDuration: 0
          },
          inefficiencies: [],
          opportunities: [],
          overallEfficiencyScore: 0,
          confidence: 0,
          analysisTimestamp: ''
        }
      );

      if (detected) {
        // Find matching features from tools user actually has
        for (const mf of pattern.matchingFeatures) {
          if (userHasTool(state.userToolbox, mf.tool)) {
            matchedPatterns.push({ pattern, matchedFeature: mf });
            break; // One feature per pattern
          }
        }
      }
    } catch (err) {
      logger.warn('A5: Error detecting pattern', { patternId: pattern.id, error: err });
    }
  }

  logger.info('A5: Feature gaps detected', {
    patternsChecked: BEHAVIOR_PATTERNS.length,
    matchedPatterns: matchedPatterns.length,
    patterns: matchedPatterns.map(mp => ({
      patternId: mp.pattern.id,
      tool: mp.matchedFeature.tool,
      feature: mp.matchedFeature.feature,
    })),
  });

  return {
    currentStage: 'a5_gap_detection_complete',
    progress: 75,
  };
}

/**
 * Node: Generate personalized tips using LLM
 */
async function generateTips(
  state: InsightState,
  deps: FeatureAdoptionGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  // Build context for LLM
  const userTools = state.userToolbox?.tools.join(', ') || 'unknown';
  const relevantFeatures = buildRelevantFeaturesContext(state.userToolbox);
  const inefficiencies = state.userDiagnostics?.inefficiencies
    ?.map(i => `- ${i.type}: ${i.description}`)
    .join('\n') || 'None identified';

  // Extract specific steps with their descriptions and tools for step-level matching
  const workflowSteps = state.userEvidence?.workflows
    ?.slice(0, 5)
    .flatMap(w => w.steps.map((s, idx) => ({
      workflowTitle: w.title,
      stepIndex: idx + 1,
      description: s.description || 'Unknown step',
      tool: s.app || 'unknown',
      durationSeconds: s.durationSeconds || 0,
    })))
    .slice(0, 20) || [];

  const stepsContext = workflowSteps.length > 0
    ? workflowSteps.map(s =>
        `- [${s.tool}] ${s.description} (${s.durationSeconds}s) - from "${s.workflowTitle}"`
      ).join('\n')
    : 'No specific steps available';

  // Also include workflow summaries for high-level context
  const workflowSummaries = state.userEvidence?.workflows
    ?.slice(0, 5)
    .map(w => `- ${w.title}: ${w.summary}`)
    .join('\n') || 'No workflows analyzed';

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: A5_FEATURE_ADOPTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Analyze this user's SPECIFIC WORKFLOW STEPS and suggest features they might not be using.

CRITICAL RULES FOR STEP-SPECIFIC TIPS:
1. ONLY suggest features from tools the user already uses (listed below)
2. ONLY generate a tip if it DIRECTLY applies to one or more SPECIFIC STEPS listed below
3. The tip's tool MUST match the tool used in those specific steps
4. Do NOT suggest general tips that don't apply to the exact activities described in the steps
5. Be specific - mention exact shortcuts/triggers
6. Maximum 3 tips - focus on highest impact

EXAMPLES OF GOOD vs BAD TIPS:
✅ GOOD: User step is "Searching for files in VS Code" → Suggest "Quick Open (Cmd+P)"
✅ GOOD: User step is "Editing multiple similar lines in Cursor" → Suggest "Multi-cursor (Cmd+D)"
❌ BAD: User step is "Researching documentation in Chrome" → Suggest "Shell aliases" (wrong tool!)
❌ BAD: User step is "Writing notes in Notion" → Suggest "Terminal history search" (unrelated activity!)

USER'S TOOLS: ${userTools}

SPECIFIC STEPS TO ANALYZE (suggest tips ONLY for these exact activities):
${stepsContext}

WORKFLOW SUMMARIES (for context):
${workflowSummaries}

IDENTIFIED INEFFICIENCIES:
${inefficiencies}

AVAILABLE FEATURES IN THEIR TOOLS:
${relevantFeatures}

Generate 1-3 personalized tips ONLY if there are specific steps above that would benefit from an underused feature. Each tip MUST:
1. Apply to a specific step activity listed above
2. Use the SAME tool as that step (e.g., Chrome tip for Chrome steps only)
3. Include the exact shortcut or trigger

If no steps would clearly benefit from a feature, return an empty tips array - do NOT force tips that don't semantically match.`
          }
        ],
        featureAdoptionTipsSchema
      ),
      LLM_TIMEOUT_MS,
      'A5 feature adoption tips generation timed out'
    );

    const rawTips = response.content.tips || [];
    const tips: FeatureAdoptionTip[] = rawTips.map((tip) => ({
      tipId: `tip-${uuidv4().slice(0, 8)}`,
      toolName: tip.toolName || 'unknown',
      featureName: tip.featureName || 'unknown',
      triggerOrShortcut: tip.triggerOrShortcut || '',
      message: tip.message || '',
      addressesPattern: tip.addressesPattern || '',
      estimatedSavingsSeconds: tip.estimatedSavingsSeconds || 0,
      confidence: typeof tip.confidence === 'number' ? tip.confidence : 0.5,
      affectedWorkflowIds: state.userEvidence?.workflows.map(w => w.workflowId) || [],
    }));

    logger.info('A5: Tips generated via LLM', {
      tipCount: tips.length,
      tools: tips.map(t => t.toolName),
      features: tips.map(t => t.featureName),
    });

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A5 FEATURE ADOPTION AGENT OUTPUT ===');
      logger.debug(JSON.stringify({
        agent: 'A5_FEATURE_ADOPTION',
        outputType: 'featureAdoptionTips',
        tips: tips.map(t => ({
          tipId: t.tipId,
          toolName: t.toolName,
          featureName: t.featureName,
          trigger: t.triggerOrShortcut,
          message: t.message.slice(0, 100) + '...',
          confidence: t.confidence,
        })),
      }));
      logger.debug('=== END A5 OUTPUT ===');
    }

    return {
      featureAdoptionTips: tips,
      currentStage: 'a5_tips_generated',
      progress: 78,
    };
  } catch (error) {
    logger.error('A5: LLM tip generation failed, falling back to heuristic tips', error instanceof Error ? error : new Error(String(error)));

    // Fallback: Generate tips from detected patterns without LLM
    const fallbackTips = generateHeuristicTips(state, logger);

    return {
      featureAdoptionTips: fallbackTips,
      currentStage: 'a5_tips_generated_fallback',
      progress: 78,
    };
  }
}

/**
 * Generate heuristic-based tips when LLM fails
 */
function generateHeuristicTips(
  state: InsightState,
  logger: Logger
): FeatureAdoptionTip[] {
  const tips: FeatureAdoptionTip[] = [];

  // Check each behavior pattern
  for (const pattern of BEHAVIOR_PATTERNS) {
    if (tips.length >= 3) break;

    try {
      const detected = pattern.detect(
        state.userEvidence || { workflows: [], sessions: [], entities: [], concepts: [], totalStepCount: 0, totalDurationSeconds: 0, retrievalMetadata: { queryTimeMs: 0, sourcesRetrieved: 0, retrievalMethod: 'hybrid', embeddingModel: '' } },
        state.userDiagnostics || { workflowId: '', workflowName: '', metrics: { totalWorkflowTime: 0, activeTime: 0, idleTime: 0, contextSwitches: 0, reworkLoops: 0, uniqueToolsUsed: 0, toolDistribution: {}, workflowTagDistribution: {}, averageStepDuration: 0 }, inefficiencies: [], opportunities: [], overallEfficiencyScore: 0, confidence: 0, analysisTimestamp: '' }
      );

      if (detected) {
        for (const mf of pattern.matchingFeatures) {
          if (userHasTool(state.userToolbox, mf.tool)) {
            const normalized = normalizeToolName(mf.tool);
            const featureInfo = TOOL_FEATURE_KNOWLEDGE[normalized]?.find(f => f.feature === mf.feature);

            if (featureInfo) {
              tips.push({
                tipId: `tip-${uuidv4().slice(0, 8)}`,
                toolName: mf.tool,
                featureName: mf.feature,
                triggerOrShortcut: featureInfo.trigger,
                message: formatMessage(pattern.messageTemplate, mf.tool, mf.feature, featureInfo.trigger),
                addressesPattern: pattern.name,
                estimatedSavingsSeconds: pattern.savingsEstimate,
                confidence: 0.7,
                affectedWorkflowIds: state.userEvidence?.workflows.map(w => w.workflowId) || [],
              });
              break;
            }
          }
        }
      }
    } catch (err) {
      logger.warn('A5: Error generating heuristic tip', { patternId: pattern.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  logger.info('A5: Heuristic tips generated', { tipCount: tips.length });
  return tips;
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A5 Feature Adoption Agent graph
 */
export function createFeatureAdoptionGraph(deps: FeatureAdoptionGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A5 Feature Adoption Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('analyze_tool_usage', (state) => analyzeToolUsage(state, deps))
    .addNode('detect_feature_gaps', (state) => detectFeatureGaps(state, deps))
    .addNode('generate_tips', (state) => generateTips(state, deps))

    // Define edges
    .addEdge('__start__', 'analyze_tool_usage')
    .addEdge('analyze_tool_usage', 'detect_feature_gaps')
    .addEdge('detect_feature_gaps', 'generate_tips')
    .addEdge('generate_tips', END);

  return graph.compile();
}
