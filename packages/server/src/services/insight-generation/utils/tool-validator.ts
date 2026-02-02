/**
 * Tool Validator Utilities
 *
 * Provides inline validation for TOOL_INTEGRATION queries to prevent hallucination
 * when web search returns results that don't contain info about the queried tool.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StepOptimizationPlan, InsightGenerationResult } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ToolValidationResult {
  /** Whether at least one tool was found in the search results */
  found: boolean;
  /** Confidence level based on number of mentions */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Tools that were successfully found */
  foundTools: string[];
  /** Tools that were NOT found in results */
  missingTools: string[];
  /** Number of mentions found */
  mentionCount: number;
}

// ============================================================================
// TOOL NAME EXTRACTION
// ============================================================================

/**
 * Common words that should NOT be treated as tool names
 */
const COMMON_WORDS = new Set([
  // Question words
  'how', 'what', 'why', 'when', 'where', 'which', 'who',
  // Verbs
  'do', 'use', 'integrate', 'setup', 'configure', 'install', 'connect', 'add',
  'get', 'make', 'create', 'build', 'run', 'start', 'enable', 'disable',
  'can', 'could', 'would', 'should', 'will', 'need', 'want', 'like',
  // Articles/prepositions
  'the', 'a', 'an', 'to', 'with', 'for', 'in', 'on', 'at', 'of', 'from',
  'into', 'onto', 'about', 'between', 'through',
  // Pronouns
  'i', 'my', 'me', 'you', 'your', 'we', 'our', 'it', 'its', 'they', 'their',
  // Common nouns
  'workflow', 'workflows', 'productivity', 'tool', 'tools', 'app', 'apps',
  'application', 'applications', 'software', 'feature', 'features',
  'integration', 'integrations', 'automation', 'automations',
  'shortcut', 'shortcuts', 'keyboard', 'command', 'commands',
  'time', 'work', 'project', 'projects', 'task', 'tasks', 'team', 'teams',
  // Adjectives
  'better', 'best', 'faster', 'more', 'most', 'new', 'other',
  // Misc
  'help', 'please', 'thanks', 'thank',
]);

/**
 * Known tool name patterns (for better extraction)
 */
const KNOWN_TOOL_PATTERNS = [
  // Popular productivity tools
  /\b(slack|notion|asana|trello|jira|confluence|linear|monday|clickup|todoist)\b/gi,
  // Development tools
  /\b(vscode|vs\s*code|cursor|github|gitlab|bitbucket|docker|kubernetes|terraform)\b/gi,
  /\b(figma|sketch|adobe\s*xd|canva|miro|lucidchart)\b/gi,
  // AI tools
  /\b(claude|chatgpt|gpt-?4|copilot|github\s*copilot|codewhisperer|tabnine)\b/gi,
  // Communication
  /\b(zoom|teams|google\s*meet|discord|telegram|whatsapp)\b/gi,
  // Browsers/OS
  /\b(chrome|firefox|safari|edge|arc|brave)\b/gi,
  // Package managers / build tools
  /\b(npm|yarn|pnpm|webpack|vite|rollup|esbuild|turbo|nx)\b/gi,
  // Databases
  /\b(postgres|postgresql|mysql|mongodb|redis|elasticsearch|supabase|firebase)\b/gi,
  // Cloud
  /\b(aws|gcp|azure|vercel|netlify|cloudflare|render|railway|fly\.io)\b/gi,
];

/**
 * Extract potential tool/product names from a query string.
 * Uses heuristics to identify capitalized words, known patterns, and quoted terms.
 */
export function extractToolNames(query: string): string[] {
  const toolNames: Set<string> = new Set();

  // 1. Extract quoted terms (high confidence these are tool names)
  const quotedMatches = query.match(/["']([^"']+)["']/g);
  if (quotedMatches) {
    for (const match of quotedMatches) {
      const term = match.replace(/["']/g, '').trim();
      if (term.length >= 2 && term.length <= 50) {
        toolNames.add(term.toLowerCase());
      }
    }
  }

  // 2. Match known tool patterns
  for (const pattern of KNOWN_TOOL_PATTERNS) {
    const matches = query.match(pattern);
    if (matches) {
      for (const match of matches) {
        toolNames.add(match.toLowerCase().replace(/\s+/g, ' '));
      }
    }
  }

  // 3. Extract capitalized words (potential proper nouns / tool names)
  // Match words that start with capital letter (but not at sentence start)
  const words = query.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.replace(/[^a-zA-Z0-9-_.]/g, '');

    // Skip common words
    if (COMMON_WORDS.has(cleanWord.toLowerCase())) {
      continue;
    }

    // Check for capitalized words (not at sentence start)
    // Also accept words with mixed case like "GitHub", "VSCode"
    if (
      cleanWord.length >= 2 &&
      cleanWord.length <= 30 &&
      (
        // Capitalized (not at sentence start)
        (i > 0 && /^[A-Z][a-zA-Z0-9]*$/.test(cleanWord)) ||
        // Mixed case (like VSCode, GitHub)
        /^[A-Z][a-z]+[A-Z]/.test(cleanWord) ||
        // All caps (like AWS, GCP)
        /^[A-Z]{2,}$/.test(cleanWord) ||
        // CamelCase
        /^[a-z]+[A-Z]/.test(cleanWord)
      )
    ) {
      toolNames.add(cleanWord.toLowerCase());
    }
  }

  // 4. Look for compound terms that might be tool names
  // e.g., "vs code", "google meet", "github copilot"
  const compoundPattern = /\b([a-zA-Z]+\s+[a-zA-Z]+)\b/g;
  let compoundMatch;
  while ((compoundMatch = compoundPattern.exec(query)) !== null) {
    const compound = compoundMatch[1].toLowerCase();
    // Check against known patterns
    for (const pattern of KNOWN_TOOL_PATTERNS) {
      if (pattern.test(compound)) {
        toolNames.add(compound);
      }
    }
  }

  // 5. If no tools found, try to extract nouns that look like product names
  // (words ending in common suffixes like -io, -ly, -app, etc.)
  if (toolNames.size === 0) {
    const productPatterns = /\b([a-zA-Z]+(io|ly|app|hub|ai|hq|ify|able|ful))\b/gi;
    let productMatch;
    while ((productMatch = productPatterns.exec(query)) !== null) {
      const product = productMatch[1].toLowerCase();
      if (!COMMON_WORDS.has(product) && product.length >= 3) {
        toolNames.add(product);
      }
    }
  }

  // 6. CRITICAL: Extract words following action verbs (for unknown tools)
  // This catches patterns like "How do I integrate openclaw?" or "How to use xyzTool?"
  // where the tool name is unknown and wouldn't match any patterns above
  if (toolNames.size === 0) {
    const actionVerbPatterns = [
      // "integrate X", "integrate with X", "integration with X"
      /\b(?:integrate|integrating|integration)\s+(?:with\s+)?([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "use X", "using X"
      /\b(?:use|using)\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "setup X", "set up X", "setting up X"
      /\b(?:setup|set\s+up|setting\s+up)\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "configure X", "configuring X"
      /\b(?:configure|configuring|configuration\s+(?:of|for))\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "install X", "installing X"
      /\b(?:install|installing)\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "connect X", "connect to X", "connecting to X"
      /\b(?:connect|connecting)\s+(?:to\s+)?([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "add X", "adding X"
      /\b(?:add|adding)\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "start with X", "get started with X"
      /\b(?:start|get\s+started)\s+with\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
      // "learn X", "learning X"
      /\b(?:learn|learning)\s+([a-zA-Z][a-zA-Z0-9_-]{1,30})\b/gi,
    ];

    for (const pattern of actionVerbPatterns) {
      let actionMatch;
      // Reset lastIndex for each pattern
      pattern.lastIndex = 0;
      while ((actionMatch = pattern.exec(query)) !== null) {
        const candidate = actionMatch[1].toLowerCase();
        // Only add if not a common word and reasonable length
        if (
          !COMMON_WORDS.has(candidate) &&
          candidate.length >= 2 &&
          candidate.length <= 30
        ) {
          toolNames.add(candidate);
        }
      }
    }
  }

  // 7. Last resort: extract any non-common word that looks like a proper noun
  // This catches standalone tool names that don't follow action verbs
  if (toolNames.size === 0) {
    const lowerQuery = query.toLowerCase();
    const allWords = lowerQuery.split(/\s+/);
    for (const word of allWords) {
      const cleanWord = word.replace(/[^a-z0-9-_]/g, '');
      if (
        cleanWord.length >= 3 &&
        cleanWord.length <= 30 &&
        !COMMON_WORDS.has(cleanWord) &&
        // Must contain at least one letter
        /[a-z]/.test(cleanWord) &&
        // Avoid pure numbers
        !/^\d+$/.test(cleanWord)
      ) {
        // Check if it's not a common English word by looking for unusual patterns
        // (consecutive consonants, unusual letter combos, etc.)
        const hasUnusualPattern =
          /[qxz]/.test(cleanWord) || // Contains uncommon letters
          /[bcdfghjklmnpqrstvwxz]{3,}/.test(cleanWord) || // 3+ consonants in a row
          /([a-z])\1{2,}/.test(cleanWord); // 3+ repeated letters

        if (hasUnusualPattern) {
          toolNames.add(cleanWord);
        }
      }
    }
  }

  return Array.from(toolNames);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate whether the extracted tool names appear in web search results.
 * Checks block titles, descriptions, citations, and step transformations.
 */
export function validateToolInResults(
  toolNames: string[],
  webPlan: StepOptimizationPlan | null
): ToolValidationResult {
  if (!toolNames.length) {
    return {
      found: true, // No specific tools to validate
      confidence: 'high',
      foundTools: [],
      missingTools: [],
      mentionCount: 0,
    };
  }

  if (!webPlan || !webPlan.blocks?.length) {
    return {
      found: false,
      confidence: 'none',
      foundTools: [],
      missingTools: [...toolNames],
      mentionCount: 0,
    };
  }

  // Build searchable text from web plan
  const searchableTexts: string[] = [];

  for (const block of webPlan.blocks) {
    // Add block-level text
    if (block.title) searchableTexts.push(block.title);
    if (block.whyThisMatters) searchableTexts.push(block.whyThisMatters);
    if (block.workflowName) searchableTexts.push(block.workflowName);

    // Add step transformation text
    if (block.stepTransformations) {
      for (const transformation of block.stepTransformations) {
        // Add current steps text
        if (transformation.currentSteps) {
          for (const step of transformation.currentSteps) {
            if (step.description) searchableTexts.push(step.description);
            if (step.tool) searchableTexts.push(step.tool);
          }
        }
        // Add optimized steps text
        if (transformation.optimizedSteps) {
          for (const step of transformation.optimizedSteps) {
            if (step.description) searchableTexts.push(step.description);
            if (step.tool) searchableTexts.push(step.tool);
            if (step.claudeCodePrompt) searchableTexts.push(step.claudeCodePrompt);
          }
        }
        // Add rationale
        if (transformation.rationale) searchableTexts.push(transformation.rationale);
      }
    }

    // Add citations
    if (block.citations) {
      for (const citation of block.citations) {
        if (citation.title) searchableTexts.push(citation.title);
        if (citation.excerpt) searchableTexts.push(citation.excerpt);
        if (citation.url) searchableTexts.push(citation.url);
      }
    }
  }

  // Combine and lowercase for searching
  const combinedText = searchableTexts.join(' ').toLowerCase();

  // Check each tool
  const foundTools: string[] = [];
  const missingTools: string[] = [];
  let totalMentions = 0;

  for (const tool of toolNames) {
    const toolLower = tool.toLowerCase();
    // Count mentions (simple word boundary match)
    const regex = new RegExp(`\\b${escapeRegex(toolLower)}\\b`, 'gi');
    const matches = combinedText.match(regex);
    const count = matches?.length || 0;

    if (count > 0) {
      foundTools.push(tool);
      totalMentions += count;
    } else {
      missingTools.push(tool);
    }
  }

  // Determine confidence based on mention count
  let confidence: ToolValidationResult['confidence'];
  if (totalMentions >= 5) {
    confidence = 'high';
  } else if (totalMentions >= 2) {
    confidence = 'medium';
  } else if (totalMentions >= 1) {
    confidence = 'low';
  } else {
    confidence = 'none';
  }

  return {
    found: foundTools.length > 0,
    confidence,
    foundTools,
    missingTools,
    mentionCount: totalMentions,
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// HONEST RESPONSE GENERATION
// ============================================================================

/**
 * Generate an honest response when the queried tool(s) were not found in search results.
 * Provides helpful suggestions instead of hallucinating.
 */
export function generateUnknownToolResponse(
  query: string,
  unknownTools: string[]
): InsightGenerationResult {
  const toolList = unknownTools.length > 0
    ? unknownTools.map(t => `"${t}"`).join(', ')
    : 'the tool mentioned';

  const userQueryAnswer = `## I Couldn't Find Information About ${toolList}

I searched for information about ${toolList} but couldn't find relevant documentation or details in my search results.

### Why This Might Happen

- The tool name might be misspelled or use a different official name
- The tool might be very new, niche, or internal to your organization
- My web search didn't return relevant results for this specific query

### What You Can Try

1. **Check the spelling** — Verify the exact name of the tool
2. **Provide a URL** — If you have the tool's documentation or website, include the link in your query and I'll analyze it directly
3. **Provide more context** — Tell me what category of tool it is (e.g., "openclaw, a legal research tool") so I can search more effectively
4. **Ask about alternatives** — I can suggest similar tools in the same category if you describe what you're trying to accomplish

### Need Help With Something Else?

I can help you with:
- Analyzing your workflow patterns and finding inefficiencies
- Recommending productivity improvements for tools you're already using
- Comparing your workflows with peer benchmarks
- Finding keyboard shortcuts and features in popular tools

Just let me know how I can assist!`;

  return {
    queryId: uuidv4(),
    query,
    userId: 0, // Will be overwritten by caller
    userQueryAnswer,
    executiveSummary: {
      totalTimeReduced: 0,
      totalRelativeImprovement: 0,
      topInefficiencies: [],
      claudeCodeInsertionPoints: [],
      passesQualityThreshold: false,
    },
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    suggestedFollowUps: [
      `What is ${unknownTools[0] || 'this tool'} and where can I find its documentation?`,
      'What productivity tools do you recommend for my workflow?',
      'Can you analyze my workflow patterns instead?',
    ],
  };
}
