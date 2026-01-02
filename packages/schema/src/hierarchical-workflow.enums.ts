/**
 * Hierarchical Workflow Enums
 *
 * Defines enums for the 3-level hierarchical workflow abstraction:
 * - Level 1: WorkflowPattern (intent-driven sequences)
 * - Level 2: Block (tool-level execution units)
 * - Level 3: Step (fine-grained UI actions)
 */

// ============================================================================
// LEVEL 1: WORKFLOW PATTERN ENUMS
// ============================================================================

/**
 * High-level workflow intent categories
 * Used to classify WorkflowPatterns by their primary purpose
 */
export enum WorkflowIntent {
  /** Creating new features, products, or functionality */
  Build = 'build',
  /** Fixing bugs, troubleshooting issues */
  Debug = 'debug',
  /** Learning, investigating, exploring options */
  Research = 'research',
  /** Reviewing code, PRs, designs */
  Review = 'review',
  /** Deploying code, infrastructure changes */
  Deploy = 'deploy',
  /** Writing documentation, comments, guides */
  Document = 'document',
  /** Slack, email, meetings, chat */
  Communicate = 'communicate',
  /** UI/UX design, architecture planning */
  Design = 'design',
  /** Writing and running tests */
  Test = 'test',
  /** Code improvement without changing functionality */
  Refactor = 'refactor',
}

/**
 * Human-readable labels for workflow intents
 */
export const WORKFLOW_INTENT_LABELS: Record<WorkflowIntent, string> = {
  [WorkflowIntent.Build]: 'Build & Create',
  [WorkflowIntent.Debug]: 'Debug & Fix',
  [WorkflowIntent.Research]: 'Research & Learn',
  [WorkflowIntent.Review]: 'Review & Validate',
  [WorkflowIntent.Deploy]: 'Deploy & Ship',
  [WorkflowIntent.Document]: 'Document & Write',
  [WorkflowIntent.Communicate]: 'Communicate',
  [WorkflowIntent.Design]: 'Design & Plan',
  [WorkflowIntent.Test]: 'Test & Verify',
  [WorkflowIntent.Refactor]: 'Refactor & Improve',
};

// ============================================================================
// LEVEL 2: BLOCK ENUMS
// ============================================================================

/**
 * Block-level intent categories
 * Represents the purpose of a single execution unit within a workflow
 */
export enum BlockIntent {
  /** Prompting AI assistants (Cursor, Claude, ChatGPT) */
  AiPrompt = 'ai_prompt',
  /** Manual code editing without AI */
  CodeEdit = 'code_edit',
  /** Reviewing code changes, diffs, PRs */
  CodeReview = 'code_review',
  /** Running CLI commands, scripts */
  TerminalCommand = 'terminal_command',
  /** Finding and opening files */
  FileNavigation = 'file_navigation',
  /** Browser-based research and reading */
  WebResearch = 'web_research',
  /** Git operations (commit, push, pull, merge) */
  GitOperation = 'git_operation',
  /** Reading or writing documentation */
  Documentation = 'documentation',
  /** Running or writing tests */
  Testing = 'testing',
  /** Using debugger, investigating issues */
  Debugging = 'debugging',
  /** Chat, email, Slack, meetings */
  Communication = 'communication',
}

/**
 * Human-readable labels for block intents
 */
export const BLOCK_INTENT_LABELS: Record<BlockIntent, string> = {
  [BlockIntent.AiPrompt]: 'AI Prompting',
  [BlockIntent.CodeEdit]: 'Code Editing',
  [BlockIntent.CodeReview]: 'Code Review',
  [BlockIntent.TerminalCommand]: 'Terminal',
  [BlockIntent.FileNavigation]: 'File Navigation',
  [BlockIntent.WebResearch]: 'Web Research',
  [BlockIntent.GitOperation]: 'Git Operations',
  [BlockIntent.Documentation]: 'Documentation',
  [BlockIntent.Testing]: 'Testing',
  [BlockIntent.Debugging]: 'Debugging',
  [BlockIntent.Communication]: 'Communication',
};

/**
 * Icons for block intents (for UI rendering)
 */
export const BLOCK_INTENT_ICONS: Record<BlockIntent, string> = {
  [BlockIntent.AiPrompt]: '🤖',
  [BlockIntent.CodeEdit]: '✏️',
  [BlockIntent.CodeReview]: '👀',
  [BlockIntent.TerminalCommand]: '⌨️',
  [BlockIntent.FileNavigation]: '📁',
  [BlockIntent.WebResearch]: '🔍',
  [BlockIntent.GitOperation]: '🔀',
  [BlockIntent.Documentation]: '📝',
  [BlockIntent.Testing]: '🧪',
  [BlockIntent.Debugging]: '🐛',
  [BlockIntent.Communication]: '💬',
};

// ============================================================================
// LEVEL 3: STEP ENUMS
// ============================================================================

/**
 * Fine-grained step action types
 * Represents individual UI interactions within a Block
 */
export enum StepActionType {
  /** User entered a prompt in AI assistant */
  PromptEntered = 'prompt_entered',
  /** User clicked a button */
  ButtonClicked = 'button_clicked',
  /** User opened a file */
  FileOpened = 'file_opened',
  /** User saved a file */
  FileSaved = 'file_saved',
  /** User selected text */
  TextSelected = 'text_selected',
  /** User pasted content */
  TextPasted = 'text_pasted',
  /** User switched browser tabs or editor tabs */
  TabSwitched = 'tab_switched',
  /** User executed a terminal command */
  CommandExecuted = 'command_executed',
  /** User used a keyboard shortcut */
  ShortcutUsed = 'shortcut_used',
  /** User scrolled content */
  ScrollAction = 'scroll_action',
  /** User selected from a menu */
  MenuSelected = 'menu_selected',
  /** User interacted with a dialog/modal */
  DialogInteraction = 'dialog_interaction',
}

/**
 * Human-readable labels for step action types
 */
export const STEP_ACTION_TYPE_LABELS: Record<StepActionType, string> = {
  [StepActionType.PromptEntered]: 'Entered Prompt',
  [StepActionType.ButtonClicked]: 'Clicked Button',
  [StepActionType.FileOpened]: 'Opened File',
  [StepActionType.FileSaved]: 'Saved File',
  [StepActionType.TextSelected]: 'Selected Text',
  [StepActionType.TextPasted]: 'Pasted Content',
  [StepActionType.TabSwitched]: 'Switched Tab',
  [StepActionType.CommandExecuted]: 'Ran Command',
  [StepActionType.ShortcutUsed]: 'Used Shortcut',
  [StepActionType.ScrollAction]: 'Scrolled',
  [StepActionType.MenuSelected]: 'Selected Menu',
  [StepActionType.DialogInteraction]: 'Dialog Action',
};

// ============================================================================
// TOOL CATEGORY ENUMS
// ============================================================================

/**
 * Tool categories for generalization across specific tools
 */
export enum ToolCategory {
  /** IDEs: VSCode, Cursor, IntelliJ, etc. */
  Ide = 'ide',
  /** AI Assistants: Claude, ChatGPT, Gemini, etc. */
  AiAssistant = 'ai_assistant',
  /** Browsers: Chrome, Firefox, Safari, etc. */
  Browser = 'browser',
  /** Terminals: iTerm, Terminal, Warp, etc. */
  Terminal = 'terminal',
  /** Version Control: GitHub, GitLab, GitKraken, etc. */
  VersionControl = 'version_control',
  /** Documentation: Notion, Confluence, etc. */
  Documentation = 'documentation',
  /** Communication: Slack, Discord, Teams, etc. */
  Communication = 'communication',
  /** Design: Figma, Sketch, etc. */
  Design = 'design',
  /** Database: TablePlus, pgAdmin, etc. */
  Database = 'database',
  /** Meeting Notes: Granola, Otter, etc. */
  MeetingNotes = 'meeting_notes',
  /** Other/Unknown tools */
  Other = 'other',
}

/**
 * Human-readable labels for tool categories
 */
export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  [ToolCategory.Ide]: 'Code Editor',
  [ToolCategory.AiAssistant]: 'AI Assistant',
  [ToolCategory.Browser]: 'Browser',
  [ToolCategory.Terminal]: 'Terminal',
  [ToolCategory.VersionControl]: 'Version Control',
  [ToolCategory.Documentation]: 'Documentation',
  [ToolCategory.Communication]: 'Communication',
  [ToolCategory.Design]: 'Design',
  [ToolCategory.Database]: 'Database',
  [ToolCategory.MeetingNotes]: 'Meeting Notes',
  [ToolCategory.Other]: 'Other',
};

// ============================================================================
// EDGE STRENGTH ENUMS
// ============================================================================

/**
 * Edge strength for visualization
 * Based on transition probability between blocks
 */
export enum EdgeStrength {
  /** Probability > 0.5 (strong pattern) */
  Strong = 'strong',
  /** Probability 0.2-0.5 (moderate pattern) */
  Medium = 'medium',
  /** Probability < 0.2 (occasional pattern) */
  Weak = 'weak',
}

// ============================================================================
// EXTRACTION METHOD ENUMS
// ============================================================================

/**
 * How a step was extracted from screenshots
 */
export enum ExtractionMethod {
  /** Extracted via OCR from screenshot */
  Ocr = 'ocr',
  /** Inferred by LLM from screenshot analysis */
  LlmInference = 'llm_inference',
  /** Captured directly from UI events */
  UiEvent = 'ui_event',
  /** Matched from session chapter data */
  ChapterMatch = 'chapter_match',
}

// ============================================================================
// CANONICALIZATION METHOD ENUMS
// ============================================================================

/**
 * How a block name was canonicalized
 */
export enum CanonicalizationMethod {
  /** Matched by rule-based patterns */
  RuleBased = 'rule_based',
  /** Matched by embedding similarity to existing block */
  EmbeddingMatch = 'embedding_match',
  /** Inferred by LLM (fallback) */
  LlmInference = 'llm_inference',
}
