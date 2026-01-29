/**
 * Toolbox Utility Functions
 *
 * Utilities for building and checking user's historical tool/app usage.
 * Used to categorize optimization suggestions as "within toolbox" vs "new tools".
 */

import type { UserToolbox } from '../types.js';

// ============================================================================
// TOOL NORMALIZATION
// ============================================================================

/**
 * Tool name aliases for normalization
 * Maps common variants to a canonical lowercase form
 */
const TOOL_ALIASES: Record<string, string> = {
  // Code Editors
  'visual studio code': 'vscode',
  'vs code': 'vscode',
  'vs-code': 'vscode',
  cursor: 'cursor',
  windsurf: 'windsurf',
  sublime: 'sublime text',
  'sublime text': 'sublime text',

  // Browsers
  'google chrome': 'chrome',
  'chrome canary': 'chrome',
  chromium: 'chrome',
  'mozilla firefox': 'firefox',
  'firefox developer': 'firefox',
  'microsoft edge': 'edge',
  safari: 'safari',
  arc: 'arc',

  // Terminals
  iterm: 'iterm',
  iterm2: 'iterm',
  'iterm 2': 'iterm',
  terminal: 'terminal',
  'apple terminal': 'terminal',
  warp: 'warp',
  hyper: 'hyper',
  kitty: 'kitty',
  alacritty: 'alacritty',

  // Communication
  'slack for mac': 'slack',
  'slack for windows': 'slack',
  slack: 'slack',
  discord: 'discord',
  'microsoft teams': 'teams',
  teams: 'teams',
  zoom: 'zoom',
  'zoom.us': 'zoom',

  // Note-taking / Documentation
  notion: 'notion',
  obsidian: 'obsidian',
  'bear notes': 'bear',
  bear: 'bear',
  evernote: 'evernote',
  roam: 'roam research',
  'roam research': 'roam research',

  // Design
  figma: 'figma',
  sketch: 'sketch',
  'adobe xd': 'xd',
  xd: 'xd',
  canva: 'canva',

  // AI Assistants
  claude: 'claude',
  chatgpt: 'chatgpt',
  'openai chatgpt': 'chatgpt',
  gemini: 'gemini',
  perplexity: 'perplexity',
  'perplexity.ai': 'perplexity',

  // Database Tools
  tableplus: 'tableplus',
  pgadmin: 'pgadmin',
  dbeaver: 'dbeaver',
  datagrip: 'datagrip',
  'mongodb compass': 'mongodb compass',

  // Version Control
  github: 'github',
  'github desktop': 'github desktop',
  gitlab: 'gitlab',
  sourcetree: 'sourcetree',
  'git kraken': 'gitkraken',
  gitkraken: 'gitkraken',

  // Other common apps
  finder: 'finder',
  'file explorer': 'file explorer',
  preview: 'preview',
  'activity monitor': 'activity monitor',
  'system preferences': 'system preferences',
  'system settings': 'system settings',
  notes: 'notes',
  'apple notes': 'notes',
  calendar: 'calendar',
  mail: 'mail',
  'apple mail': 'mail',
  outlook: 'outlook',
  'microsoft outlook': 'outlook',
  spotify: 'spotify',
  postman: 'postman',
  insomnia: 'insomnia',
  docker: 'docker',
  'docker desktop': 'docker',
};

/**
 * Normalize a tool name for consistent matching
 */
export function normalizeTool(tool: string): string {
  if (!tool) return '';

  const lower = tool.toLowerCase().trim();

  // Check explicit aliases first
  if (TOOL_ALIASES[lower]) {
    return TOOL_ALIASES[lower];
  }

  // Return lowercase version
  return lower;
}

// ============================================================================
// TOOLBOX BUILDING
// ============================================================================

/**
 * Build user's toolbox from a list of tool names
 * Deduplicates and normalizes tools for matching
 */
export function buildUserToolbox(toolNames: string[]): UserToolbox {
  const tools: string[] = [];
  const normalizedTools = new Set<string>();

  for (const tool of toolNames) {
    if (!tool || tool === 'Unknown' || tool === 'unknown') {
      continue;
    }

    const normalized = normalizeTool(tool);
    if (normalized && !normalizedTools.has(normalized)) {
      tools.push(tool);
      normalizedTools.add(normalized);
    }
  }

  return {
    tools,
    normalizedTools: Array.from(normalizedTools),
  };
}

/**
 * Merge multiple toolboxes into one
 */
export function mergeToolboxes(...toolboxes: UserToolbox[]): UserToolbox {
  const allTools: string[] = [];

  for (const toolbox of toolboxes) {
    if (toolbox?.tools) {
      allTools.push(...toolbox.tools);
    }
  }

  return buildUserToolbox(allTools);
}

// ============================================================================
// TOOLBOX CHECKING
// ============================================================================

/**
 * Check if a tool is in the user's toolbox
 * Uses normalized comparison for accurate matching
 */
export function isToolInUserToolbox(tool: string, toolbox: UserToolbox | null | undefined): boolean {
  if (!tool || tool === 'Unknown' || !toolbox) {
    return false;
  }

  const normalized = normalizeTool(tool);
  if (!normalized) {
    return false;
  }

  // Check against normalized tools set
  return toolbox.normalizedTools.includes(normalized);
}

/**
 * Categorize a list of tools by whether they're in the user's toolbox
 */
export function categorizeToolsByToolbox(
  tools: string[],
  toolbox: UserToolbox | null | undefined
): { withinToolbox: string[]; outsideToolbox: string[] } {
  const withinToolbox: string[] = [];
  const outsideToolbox: string[] = [];

  for (const tool of tools) {
    if (isToolInUserToolbox(tool, toolbox)) {
      withinToolbox.push(tool);
    } else {
      outsideToolbox.push(tool);
    }
  }

  return { withinToolbox, outsideToolbox };
}

// ============================================================================
// SMART SUGGESTION MATCHING
// ============================================================================

/**
 * Keywords that indicate an IDE/code editor enhancement
 */
const IDE_ENHANCEMENT_KEYWORDS = [
  'ide', 'editor', 'plugin', 'extension', 'linting', 'formatter',
  'auto-format', 'autocomplete', 'intellisense', 'snippet',
  'eslint', 'prettier', 'black', 'pylint', 'typescript',
];

/**
 * Keywords that indicate a browser enhancement
 */
const BROWSER_ENHANCEMENT_KEYWORDS = [
  'browser', 'devtools', 'dev tools', 'chrome extension',
  'lighthouse', 'network tab', 'console', 'debugger',
];

/**
 * Keywords that indicate a terminal enhancement
 */
const TERMINAL_ENHANCEMENT_KEYWORDS = [
  'terminal', 'shell', 'command line', 'cli', 'alias',
  'bash', 'zsh', 'script', 'automation',
];

/**
 * Tool categories and their common names
 */
const TOOL_CATEGORIES: Record<string, string[]> = {
  ide: ['vscode', 'cursor', 'sublime', 'atom', 'vim', 'neovim', 'jetbrains', 'intellij', 'webstorm', 'pycharm'],
  browser: ['chrome', 'firefox', 'safari', 'edge', 'arc', 'brave'],
  terminal: ['terminal', 'iterm', 'warp', 'hyper', 'kitty', 'alacritty'],
};

/**
 * Check if a suggestion text mentions or applies to tools in the user's toolbox.
 * This is a smarter version of isToolInUserToolbox that handles verbose descriptions.
 *
 * Examples:
 * - "IDE plugins (e.g., ESLint, Prettier)" + user has VSCode → true
 * - "Use Chrome DevTools" + user has Chrome → true
 * - "Use Figma for design" + user doesn't have Figma → false
 */
export function isSuggestionForUserTools(
  suggestionText: string,
  toolbox: UserToolbox | null | undefined
): boolean {
  if (!suggestionText || !toolbox || toolbox.normalizedTools.length === 0) {
    return false;
  }

  const lowerSuggestion = suggestionText.toLowerCase();

  // First, check if any tool from user's toolbox is directly mentioned
  for (const tool of toolbox.normalizedTools) {
    if (lowerSuggestion.includes(tool)) {
      return true;
    }
  }

  // Check if suggestion is about IDE enhancements and user has an IDE
  const hasIDE = toolbox.normalizedTools.some(t => TOOL_CATEGORIES.ide.includes(t));
  if (hasIDE && IDE_ENHANCEMENT_KEYWORDS.some(kw => lowerSuggestion.includes(kw))) {
    return true;
  }

  // Check if suggestion is about browser enhancements and user has a browser
  const hasBrowser = toolbox.normalizedTools.some(t => TOOL_CATEGORIES.browser.includes(t));
  if (hasBrowser && BROWSER_ENHANCEMENT_KEYWORDS.some(kw => lowerSuggestion.includes(kw))) {
    return true;
  }

  // Check if suggestion is about terminal enhancements and user has a terminal
  const hasTerminal = toolbox.normalizedTools.some(t => TOOL_CATEGORIES.terminal.includes(t));
  if (hasTerminal && TERMINAL_ENHANCEMENT_KEYWORDS.some(kw => lowerSuggestion.includes(kw))) {
    return true;
  }

  // Check for explicit tool mentions in parentheses like "(e.g., VS Code, JetBrains)"
  const parenMatch = lowerSuggestion.match(/\(.*?\)/g);
  if (parenMatch) {
    for (const paren of parenMatch) {
      for (const tool of toolbox.normalizedTools) {
        if (paren.includes(tool)) {
          return true;
        }
      }
      // Also check for common IDE names
      for (const ideName of TOOL_CATEGORIES.ide) {
        if (paren.includes(ideName) && hasIDE) {
          return true;
        }
      }
    }
  }

  return false;
}
