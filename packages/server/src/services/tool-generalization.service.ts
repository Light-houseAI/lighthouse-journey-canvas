/**
 * Tool Generalization Service
 *
 * Maps specific tool names (Cursor, VSCode, iTerm) to canonical categories
 * for tool-agnostic workflow pattern matching.
 */

import {
  ToolCategory,
  type ToolMapping,
  type CanonicalizedTool,
  type WorkflowPatternNode,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';

// ============================================================================
// TOOL MAPPINGS
// ============================================================================

/**
 * Comprehensive tool mappings for canonicalization
 */
const TOOL_MAPPINGS: ToolMapping[] = [
  // AI Code Editors
  {
    canonical: 'AI Code Editor',
    category: ToolCategory.Ide,
    variants: ['cursor', 'windsurf', 'copilot', 'codeium', 'tabnine'],
    patterns: [
      /cursor/i,
      /windsurf/i,
      /copilot/i,
      /codeium/i,
      /tabnine/i,
      /ai.*editor/i,
    ],
  },

  // Traditional Code Editors
  {
    canonical: 'Code Editor',
    category: ToolCategory.Ide,
    variants: ['vscode', 'visual studio code', 'sublime', 'atom', 'vim', 'neovim', 'emacs', 'intellij', 'webstorm', 'pycharm'],
    patterns: [
      /vscode/i,
      /visual studio code/i,
      /sublime/i,
      /atom/i,
      /vim/i,
      /neovim/i,
      /nvim/i,
      /emacs/i,
      /intellij/i,
      /webstorm/i,
      /pycharm/i,
      /goland/i,
      /rubymine/i,
      /phpstorm/i,
      /rider/i,
      /android studio/i,
      /xcode/i,
    ],
  },

  // AI Chat Assistants
  {
    canonical: 'AI Chat Assistant',
    category: ToolCategory.AiAssistant,
    variants: ['claude', 'chatgpt', 'gemini', 'perplexity', 'anthropic', 'openai'],
    patterns: [
      /claude/i,
      /chatgpt/i,
      /openai/i,
      /gemini/i,
      /bard/i,
      /perplexity/i,
      /anthropic/i,
      /ai.*chat/i,
      /chat.*ai/i,
    ],
  },

  // Terminals
  {
    canonical: 'Terminal',
    category: ToolCategory.Terminal,
    variants: ['iterm', 'iterm2', 'terminal', 'warp', 'hyper', 'alacritty', 'kitty', 'konsole'],
    patterns: [
      /iterm/i,
      /terminal/i,
      /warp/i,
      /hyper/i,
      /alacritty/i,
      /kitty/i,
      /konsole/i,
      /gnome-terminal/i,
      /powershell/i,
      /cmd\.exe/i,
      /command prompt/i,
      /zsh/i,
      /bash/i,
    ],
  },

  // Browsers
  {
    canonical: 'Browser',
    category: ToolCategory.Browser,
    variants: ['chrome', 'google chrome', 'firefox', 'safari', 'edge', 'arc', 'brave', 'opera'],
    patterns: [
      /chrome/i,
      /google chrome/i,
      /firefox/i,
      /safari/i,
      /edge/i,
      /arc/i,
      /brave/i,
      /opera/i,
      /vivaldi/i,
    ],
  },

  // Version Control
  {
    canonical: 'Version Control',
    category: ToolCategory.VersionControl,
    variants: ['github', 'gitlab', 'bitbucket', 'gitkraken', 'sourcetree', 'github desktop', 'lazygit'],
    patterns: [
      /github/i,
      /gitlab/i,
      /bitbucket/i,
      /gitkraken/i,
      /sourcetree/i,
      /github desktop/i,
      /lazygit/i,
      /git gui/i,
      /tower/i,
      /fork/i,
    ],
  },

  // Documentation
  {
    canonical: 'Documentation',
    category: ToolCategory.Documentation,
    variants: ['notion', 'confluence', 'obsidian', 'roam', 'logseq', 'google docs', 'dropbox paper'],
    patterns: [
      /notion/i,
      /confluence/i,
      /obsidian/i,
      /roam/i,
      /logseq/i,
      /google docs/i,
      /dropbox paper/i,
      /coda/i,
      /slite/i,
      /gitbook/i,
    ],
  },

  // Communication
  {
    canonical: 'Communication',
    category: ToolCategory.Communication,
    variants: ['slack', 'discord', 'teams', 'microsoft teams', 'zoom', 'google meet'],
    patterns: [
      /slack/i,
      /discord/i,
      /teams/i,
      /microsoft teams/i,
      /zoom/i,
      /google meet/i,
      /webex/i,
      /skype/i,
      /telegram/i,
    ],
  },

  // Design
  {
    canonical: 'Design',
    category: ToolCategory.Design,
    variants: ['figma', 'sketch', 'adobe xd', 'invision', 'zeplin', 'framer'],
    patterns: [
      /figma/i,
      /sketch/i,
      /adobe xd/i,
      /invision/i,
      /zeplin/i,
      /framer/i,
      /canva/i,
      /photoshop/i,
      /illustrator/i,
    ],
  },

  // Database Tools
  {
    canonical: 'Database Tool',
    category: ToolCategory.Database,
    variants: ['tableplus', 'pgadmin', 'dbeaver', 'datagrip', 'mongodb compass', 'sequel pro'],
    patterns: [
      /tableplus/i,
      /pgadmin/i,
      /dbeaver/i,
      /datagrip/i,
      /mongodb compass/i,
      /sequel pro/i,
      /mysql workbench/i,
      /redis insight/i,
      /navicat/i,
    ],
  },

  // Meeting Notes
  {
    canonical: 'Meeting Notes',
    category: ToolCategory.MeetingNotes,
    variants: ['granola', 'otter', 'otter.ai', 'fireflies', 'grain', 'fathom'],
    patterns: [
      /granola/i,
      /otter/i,
      /otter\.ai/i,
      /fireflies/i,
      /grain/i,
      /fathom/i,
      /krisp/i,
      /read\.ai/i,
    ],
  },
];

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ToolGeneralizationService {
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
  }

  /**
   * Canonicalize a tool name to its category
   */
  canonicalizeTool(toolName: string): CanonicalizedTool {
    const normalized = toolName.toLowerCase().trim();

    for (const mapping of TOOL_MAPPINGS) {
      // Check exact variant match first
      if (mapping.variants.includes(normalized)) {
        this.logger.debug('Tool matched by variant', {
          original: toolName,
          canonical: mapping.canonical,
        });

        return {
          canonical: mapping.canonical,
          specific: toolName,
          category: mapping.category,
          variants: mapping.variants,
        };
      }

      // Check pattern match
      if (mapping.patterns.some((p) => p.test(toolName))) {
        this.logger.debug('Tool matched by pattern', {
          original: toolName,
          canonical: mapping.canonical,
        });

        return {
          canonical: mapping.canonical,
          specific: toolName,
          category: mapping.category,
          variants: mapping.variants,
        };
      }
    }

    // Unknown tool - return as-is
    this.logger.debug('Unknown tool, using as-is', { toolName });

    return {
      canonical: toolName,
      specific: toolName,
      category: ToolCategory.Other,
      variants: [normalized],
    };
  }

  /**
   * Get the canonical tool category for a tool name
   */
  getToolCategory(toolName: string): ToolCategory {
    return this.canonicalizeTool(toolName).category;
  }

  /**
   * Check if two tool names belong to the same category
   */
  areToolsInSameCategory(tool1: string, tool2: string): boolean {
    const cat1 = this.getToolCategory(tool1);
    const cat2 = this.getToolCategory(tool2);
    return cat1 === cat2;
  }

  /**
   * Check if two workflows are equivalent across tool variants
   *
   * Two workflows are equivalent if:
   * 1. They have the same number of blocks
   * 2. Each corresponding block has the same intent
   * 3. Each corresponding block uses tools in the same category
   */
  areWorkflowsEquivalent(
    workflow1: WorkflowPatternNode & { blocks?: Array<{ intentLabel: string; primaryTool: string }> },
    workflow2: WorkflowPatternNode & { blocks?: Array<{ intentLabel: string; primaryTool: string }> }
  ): boolean {
    const blocks1 = workflow1.blocks || [];
    const blocks2 = workflow2.blocks || [];

    // Must have same number of blocks
    if (blocks1.length !== blocks2.length) {
      return false;
    }

    // Each block must be equivalent
    for (let i = 0; i < blocks1.length; i++) {
      const block1 = blocks1[i];
      const block2 = blocks2[i];

      // Same intent
      if (block1.intentLabel !== block2.intentLabel) {
        return false;
      }

      // Same tool category
      if (!this.areToolsInSameCategory(block1.primaryTool, block2.primaryTool)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all known tool variants for a category
   */
  getToolVariantsForCategory(category: ToolCategory): string[] {
    const mapping = TOOL_MAPPINGS.find((m) => m.category === category);
    return mapping?.variants || [];
  }

  /**
   * Merge tool variants from multiple observations
   */
  mergeToolVariants(existingVariants: string[], newTool: string): string[] {
    const normalized = newTool.toLowerCase().trim();
    if (existingVariants.includes(normalized)) {
      return existingVariants;
    }
    return [...existingVariants, normalized];
  }

  /**
   * Get canonical name for a tool category
   */
  getCanonicalNameForCategory(category: ToolCategory): string {
    const mapping = TOOL_MAPPINGS.find((m) => m.category === category);
    return mapping?.canonical || 'Unknown';
  }

  /**
   * Extract unique tool categories from a list of tools
   */
  extractUniqueCategories(tools: string[]): ToolCategory[] {
    const categories = new Set<ToolCategory>();
    for (const tool of tools) {
      categories.add(this.getToolCategory(tool));
    }
    return Array.from(categories);
  }

  /**
   * Check if a tool is an AI assistant (for detecting AI-assisted workflows)
   */
  isAiTool(toolName: string): boolean {
    const category = this.getToolCategory(toolName);
    return category === ToolCategory.AiAssistant || category === ToolCategory.Ide;
  }

  /**
   * Check if the tool category suggests AI code editing
   */
  isAiCodeEditor(toolName: string): boolean {
    const canonicalized = this.canonicalizeTool(toolName);
    return (
      canonicalized.canonical === 'AI Code Editor' ||
      canonicalized.variants.some((v) =>
        ['cursor', 'windsurf', 'copilot', 'codeium', 'tabnine'].includes(v)
      )
    );
  }
}
