/**
 * Query Classification System for Insight Generation
 *
 * Classifies user queries along 3 dimensions to optimize:
 * 1. SCOPE: How many sessions to retrieve (all, filtered, specific)
 * 2. INTENT: Which agents to run (diagnostic, optimization, comparison, etc.)
 * 3. SPECIFICITY: Retrieval strategy (broad semantic vs targeted filter)
 */

import type { AgentId } from '../types.js';

// ============================================================================
// CLASSIFICATION TYPES
// ============================================================================

/**
 * Scope determines HOW MANY sessions to retrieve
 */
export type QueryScope =
  | 'HOLISTIC'         // All sessions (generic "my workflows" queries)
  | 'TIME_BOUNDED'     // Filter by date range ("yesterday", "last week")
  | 'SESSION_SPECIFIC' // Exact session(s) via @mention or ID
  | 'TOOL_FILTERED'    // Filter by tool/app ("VSCode workflows")
  | 'TASK_FILTERED';   // Filter by task type ("debugging sessions")

/**
 * Intent determines WHICH AGENTS to run
 */
export type QueryIntent =
  | 'DIAGNOSTIC'        // Finding problems/inefficiencies → A1→A2→A4
  | 'OPTIMIZATION'      // How to improve → A1→A2→A5→A4
  | 'COMPARISON'        // Compare with peers → A1→A2→A3→A4
  | 'EXPLORATION'       // Show me what I did → A1 only
  | 'LEARNING'          // Best practices → A1→A4-Web
  | 'PATTERN'           // Find patterns/trends → A1→A2
  | 'FEATURE_DISCOVERY' // Discover underused features → A1→A2→A5
  | 'TOOL_MASTERY'      // Master specific tool → A1→A2→A5
  | 'TOOL_INTEGRATION'  // Integrate/use/add a tool → A4-Web priority (web search first)
  | 'BLOG_CREATION'     // Create blog/article from workflow → A1 only, uses blog prompt
  | 'PROGRESS_UPDATE'   // Create weekly progress update report → A1 only, uses progress update prompt
  | 'GENERAL';          // Fallback for unclear queries

/**
 * Specificity determines RETRIEVAL STRATEGY
 */
export type QuerySpecificity =
  | 'BROAD'     // Generic query, use semantic search
  | 'TARGETED'  // Specific tool/task/time, use filters
  | 'NEEDLE';   // Looking for exact match

/**
 * Full query classification result
 */
export interface QueryClassification {
  scope: QueryScope;
  intent: QueryIntent;
  specificity: QuerySpecificity;

  // Extracted filters
  filters: {
    tools?: string[];        // Detected tools/apps
    taskTypes?: string[];    // Detected task types (debugging, coding, etc.)
    timeRange?: {
      start?: Date;
      end?: Date;
      description: string;   // "yesterday", "last week", etc.
    };
    sessionIds?: string[];   // Explicitly mentioned session IDs
    domainKeywords?: string[];  // Domain-specific keywords for relevance filtering
  };

  // Routing decisions
  routing: {
    maxResults: number;      // How many to retrieve
    agentsToRun: AgentId[];  // Which agents to invoke
    includePeerComparison: boolean;
    includeWebSearch: boolean;
    includeFeatureAdoption: boolean;  // Run A5 Feature Adoption agent
    useSemanticSearch: boolean;  // vs pure filtering
    strictDomainMatching: boolean;  // Require domain keyword match for workflows
  };

  // Classification confidence
  confidence: number;        // 0-1 score
  reasoning: string;         // Why this classification
}

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

const SCOPE_PATTERNS: Record<QueryScope, RegExp[]> = {
  HOLISTIC: [
    /\b(all\s+)?(my\s+)?workflow/i,
    /\bmy\s+(efficiency|productivity|work|patterns?)/i,
    /\b(overall|general|typical)\s+(workflow|efficiency)/i,
    /\bhow\s+(can|do)\s+i\s+(improve|optimize|work)/i,
    /\bwhere\s+(am\s+i|do\s+i)\s+(wasting|losing|spending)/i,
    /\bwhat\s+are\s+my\s+(patterns?|habits?)/i,
  ],
  TIME_BOUNDED: [
    /\b(yesterday|today|this\s+morning|this\s+afternoon)/i,
    /\b(last|past|previous)\s+(week|month|day|hour|few\s+days)/i,
    /\b(this|current)\s+(week|month)/i,
    /\b(since|from|after|before)\s+\d{1,2}/i,  // dates
    /\b(recent|lately|recently)/i,
    /\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  ],
  SESSION_SPECIFIC: [
    /\[Analyzing\s+sessions?:/i,  // @mention format
    /\bsession\s+[a-f0-9-]{36}/i, // UUID
    /\bthis\s+session/i,
    /\bthat\s+session/i,
  ],
  TOOL_FILTERED: [
    /\b(vscode|vs\s*code|visual\s+studio)/i,
    /\b(chrome|firefox|safari|browser)/i,
    /\b(slack|discord|teams)/i,
    /\b(notion|obsidian|roam)/i,
    /\b(figma|sketch|adobe)/i,
    /\b(terminal|iterm|shell|bash)/i,
    /\b(github|gitlab|bitbucket)/i,
    /\b(jira|linear|asana|trello)/i,
    /\b(claude|chatgpt|copilot)/i,
    /\busing\s+(\w+)/i,  // "using X"
    /\bin\s+(\w+)/i,     // "in X"
  ],
  TASK_FILTERED: [
    /\b(debug|debugging|bug\s*fix)/i,
    /\b(code\s*review|reviewing\s*code|pr\s*review)/i,
    /\b(coding|programming|developing)/i,
    /\b(research|researching|searching)/i,
    /\b(documentation|documenting|writing\s*docs)/i,
    /\b(testing|test|running\s*tests)/i,
    /\b(deploy|deployment|shipping)/i,
    /\b(meeting|standup|sync)/i,
    /\b(planning|sprint|roadmap)/i,
    /\b(design|designing|ui|ux)/i,
  ],
};

const INTENT_PATTERNS: Record<QueryIntent, RegExp[]> = {
  DIAGNOSTIC: [
    /\bwhere\s+(am\s+i|do\s+i)\s+(slow|wasting|losing|spending|inefficient)/i,
    /\bwhat('s|\s+is)\s+(slowing|taking|wasting)/i,
    /\b(bottleneck|problem|issue|inefficien)/i,
    /\bwhy\s+(am\s+i|do\s+i|does\s+it)\s+(take|slow)/i,
    /\bwhat\s+(am\s+i|do\s+i)\s+doing\s+wrong/i,
    /\bfind\s+(the\s+)?(problem|issue|bottleneck)/i,
  ],
  OPTIMIZATION: [
    /\bhow\s+(can|do|should)\s+i\s+(improve|optimize|speed|faster|better)/i,
    /\b(improve|optimize|speed\s*up|streamline)/i,
    /\b(faster|quicker|more\s+efficient)/i,
    /\b(save\s+time|reduce\s+time)/i,
    /\bwhat\s+(can|should)\s+i\s+(change|do\s+differently)/i,
    /\b(my\s+)?efficiency/i, // Explicit efficiency pattern
    /\bimprove\s+(my\s+)?(efficiency|productivity|workflow)/i,
    /\b(increase|boost|enhance)\s+(my\s+)?(efficiency|productivity)/i,
  ],
  COMPARISON: [
    /\b(compare|comparison|versus|vs\.?)\b/i,
    /\b(others?|peers?|team|colleagues?)\b/i,
    /\bam\s+i\s+(slower|faster|better|worse)\s+than/i,
    /\bhow\s+do\s+(i|my)\s+(compare|stack\s+up)/i,
    /\b(benchmark|baseline)/i,
  ],
  EXPLORATION: [
    /\b(show|list|display|what)\s+(me\s+)?(my\s+)?(sessions?|workflows?|work)/i,
    /\bwhat\s+(did|have)\s+i\s+(work|do|accomplish)/i,
    // "Show me what I worked on" / "What I worked on yesterday"
    /\b(show\s+me\s+)?what\s+i\s+worked\s+on/i,
    /\bsummar(y|ize)/i,
    /\b(overview|recap|review)\s+(of\s+)?(my\s+)?work/i,
    /\btell\s+me\s+about/i,
  ],
  LEARNING: [
    /\b(best\s+practice|industry\s+standard|recommended)/i,
    /\bhow\s+should\s+i/i,
    /\bwhat('s|\s+is)\s+the\s+(best|right|proper)\s+way/i,
    /\b(tip|trick|advice|suggestion)/i,
    /\bteach\s+me/i,
    /\bhow\s+do\s+(expert|professional|senior)/i,
  ],
  PATTERN: [
    /\b(pattern|trend|habit|routine)/i,
    /\b(common|frequent|usual|typical)\s+(workflow|task|activity)/i,
    /\bwhat\s+do\s+i\s+(usually|typically|often)/i,
    /\bhow\s+often\s+do\s+i/i,
    /\bmost\s+(common|frequent)/i,
  ],
  FEATURE_DISCOVERY: [
    /\b(feature|capability|function)\s+(i('m|\s+am)\s+)?(not\s+using|missing|underus)/i,
    /\bwhat\s+(feature|tool|capability)\s+(am\s+i|should\s+i)/i,
    /\bam\s+i\s+(missing|not\s+using|underutilizing)/i,
    /\bwhat\s+(am\s+i|could\s+i\s+be)\s+(missing|not\s+using)/i,
    /\b(hidden|unknown|underused|overlooked)\s+(feature|capability|tool)/i,
    /\bwhat\s+(else\s+)?can\s+(i|my\s+tool)\s+do/i,
    /\b(discover|find)\s+(new\s+)?(feature|capability)/i,
    /\bam\s+i\s+using\s+.*\s+(correctly|properly|fully)/i,
    /\bwhat\s+should\s+i\s+be\s+using/i,
  ],
  TOOL_MASTERY: [
    /\bhow\s+(can|do)\s+i\s+(use|master|leverage)\s+\w+\s+(better|more|effectively)/i,
    /\b(master|learn|get\s+better\s+at)\s+(using\s+)?\w+/i,
    /\bhow\s+to\s+(fully\s+)?use\s+\w+/i,
    /\bget\s+(the\s+)?most\s+(out\s+of|from)\s+\w+/i,
    /\b(maximize|optimize)\s+(my\s+use\s+of|usage\s+of)\s+\w+/i,
    /\bwhat\s+can\s+\w+\s+do\s+(for\s+me|that\s+i)/i,
    /\b(cursor|vscode|copilot|claude)\s+(feature|mode|capability)/i,
    /\bplanner\s+mode/i,
    /\bcomposer\s+mode/i,
    /\bagent\s+mode/i,
  ],
  TOOL_INTEGRATION: [
    // "How do I use/incorporate X in my workflow?"
    /\bhow\s+(can|do)\s+i\s+(use|incorporate|add|integrate)\s+\w+/i,
    // "How to integrate X with Y?"
    /\bhow\s+to\s+(integrate|connect|combine|use)\s+\w+\s+(with|and|into)/i,
    // "What is X?" / "Tell me about X" (for unknown tools)
    /\b(what\s+is|tell\s+me\s+about|explain)\s+\w+\s*(tool|app|platform|service)?/i,
    // "Integrate X and Y" / "Connect X to Y"
    /\b(integrate|connect|combine|link)\s+\w+\s+(with|and|to)\s+\w+/i,
    // "Add X to my workflow"
    /\badd\s+\w+\s+to\s+(my\s+)?(workflow|process|pipeline)/i,
    // "Use X for Y" (e.g., "use Granola for meeting notes")
    /\buse\s+\w+\s+for\s+(my\s+)?\w+/i,
    // "X integration" / "X plugin"
    /\b\w+\s+(integration|plugin|extension|addon|add-on)/i,
    // "Set up X" / "Configure X"
    /\b(set\s*up|configure|install)\s+\w+/i,
  ],
  BLOG_CREATION: [
    // "Create/write/generate a blog/article"
    /\b(create|write|generate|make|draft)\s+(an?\s+)?(blog|article|post|story)/i,
    // "Blog/article about/from my workflow"
    /\b(blog|article|post)\s+(about|from|based\s+on)\s+(my\s+)?(workflow|session|work)/i,
    // "Turn my workflow into a blog/an article"
    /\bturn\s+(my\s+)?(workflow|session|work)\s+into\s+(an?\s+)?(blog|article|story|post)/i,
    // "Convert/transform workflow to blog"
    /\b(convert|transform)\s+(my\s+)?(workflow|session)\s+(to|into)\s+(an?\s+)?(blog|article)/i,
    // "Write about/up my workflow"
    /\bwrite\s+(about|up)\s+(my\s+)?(workflow|session|productivity|work)/i,
    // "Blog about/from/based on"
    /\bblog\s+(about|from|based\s+on)\s+/i,
    // "Narrative of my workflow"
    /\bnarrative\s+(of|about|from)\s+(my\s+)?(workflow|session|work)/i,
    // "Create content from my session"
    /\b(create|generate)\s+(content|post)\s+(from|based\s+on)\s+(my\s+)?(workflow|session)/i,
    // "Document my workflow as a blog"
    /\bdocument\s+(my\s+)?(workflow|session)\s+(as|into)\s+(an?\s+)?(blog|article)/i,
  ],
  PROGRESS_UPDATE: [
    // "Create/write/generate a weekly progress update/report"
    /\b(create|write|generate|make|draft)\s+(an?\s+)?(weekly\s+)?(progress\s+)?(update|report)/i,
    // "Weekly update/report"
    /\b(weekly|daily|monthly)\s+(progress\s+)?(update|report|summary)/i,
    // "Progress report/update from my workflow"
    /\b(progress\s+)?(report|update)\s+(from|based\s+on|about)\s+(my\s+)?(workflow|session|work)/i,
    // "Turn my workflow into a progress report"
    /\bturn\s+(my\s+)?(workflow|session|work)\s+into\s+(an?\s+)?(progress\s+)?(report|update)/i,
    // "Summarize my work/week as a report"
    /\bsummar(ize|y)\s+(my\s+)?(work|week|activities?)\s+(as|into)\s+(an?\s+)?(report|update)/i,
    // "What did I accomplish this week"
    /\bwhat\s+(did|have)\s+i\s+(accomplish|achieve|complete|do)\s+(this|last)\s+(week|month)/i,
    // "Create a status report"
    /\b(create|write|generate)\s+(an?\s+)?(status|activity|work)\s+(report|update|summary)/i,
    // "Weekly standup/status update"
    /\b(weekly|daily)\s+(standup|status)\s+(update|report|summary)/i,
    // "Generate progress summary"
    /\b(generate|create)\s+(progress|weekly|work)\s+(summary|overview)/i,
    // "Report on my activities"
    /\breport\s+(on|about)\s+(my\s+)?(activities?|work|accomplishments?)/i,
    // "Structure my weekly update"
    /\bstructure\s+(my\s+)?(weekly|progress)\s+(update|report)/i,
    // "Format as progress report"
    /\bformat\s+(as|into)\s+(an?\s+)?(progress|weekly)\s+(report|update)/i,
  ],
  GENERAL: [], // Fallback
};

// Tool name normalization map
const TOOL_ALIASES: Record<string, string> = {
  'vscode': 'VSCode',
  'vs code': 'VSCode',
  'visual studio code': 'VSCode',
  'chrome': 'Google Chrome',
  'firefox': 'Firefox',
  'safari': 'Safari',
  'slack': 'Slack',
  'discord': 'Discord',
  'notion': 'Notion',
  'figma': 'Figma',
  'terminal': 'Terminal',
  'iterm': 'Terminal',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'jira': 'Jira',
  'linear': 'Linear',
  'claude': 'Claude',
  'chatgpt': 'ChatGPT',
  'copilot': 'GitHub Copilot',
  // Apple/iOS development tools
  'xcode': 'Xcode',
  'fastlane': 'fastlane',
  'app store connect': 'App Store Connect',
  'testflight': 'TestFlight',
  'simulator': 'iOS Simulator',
  'instruments': 'Instruments',
  // Android development tools
  'android studio': 'Android Studio',
  'gradle': 'Gradle',
  'adb': 'Android Debug Bridge',
  // Web development
  'webpack': 'Webpack',
  'vite': 'Vite',
  'next': 'Next.js',
  'nextjs': 'Next.js',
  'react': 'React',
  'cursor': 'Cursor',
};

// Domain keyword patterns for relevance filtering
// These help match queries to workflows by domain/topic
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  // Platform domains
  'ios': ['ios', 'iphone', 'ipad', 'apple', 'swift', 'swiftui', 'uikit', 'xcode', 'cocoapods', 'spm', 'testflight'],
  'macos': ['macos', 'mac', 'apple', 'appkit', 'catalyst', 'xcode'],
  'android': ['android', 'kotlin', 'java', 'gradle', 'adb', 'play store', 'google play'],
  'web': ['web', 'browser', 'html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular', 'nextjs', 'webpack', 'vite'],
  'mobile': ['mobile', 'app', 'ios', 'android', 'react native', 'flutter', 'capacitor'],
  // Task domains
  'build': ['build', 'compile', 'bundle', 'package', 'archive', 'ci', 'cd', 'pipeline', 'automation'],
  'deploy': ['deploy', 'release', 'publish', 'ship', 'distribution', 'staging', 'production'],
  'test': ['test', 'testing', 'unit test', 'integration test', 'e2e', 'qa', 'coverage'],
  'debug': ['debug', 'debugging', 'bug', 'fix', 'error', 'crash', 'issue'],
  'code_review': ['review', 'pr', 'pull request', 'code review', 'merge'],
  // AI/ML domains
  'ai': ['ai', 'ml', 'machine learning', 'llm', 'gpt', 'claude', 'chatgpt', 'copilot', 'model'],
  'chat': ['chat', 'conversation', 'message', 'bot', 'assistant'],
};

// Task type normalization map
const TASK_ALIASES: Record<string, string> = {
  'debug': 'debugging',
  'debugging': 'debugging',
  'bug fix': 'debugging',
  'code review': 'code_review',
  'reviewing code': 'code_review',
  'pr review': 'code_review',
  'coding': 'development',
  'programming': 'development',
  'developing': 'development',
  'research': 'research',
  'researching': 'research',
  'documentation': 'documentation',
  'writing docs': 'documentation',
  'testing': 'testing',
  'deploy': 'deployment',
  'deployment': 'deployment',
  'meeting': 'meeting',
  'planning': 'planning',
  'design': 'design',
};

// ============================================================================
// CLASSIFIER IMPLEMENTATION
// ============================================================================

/**
 * Classify a user query to determine optimal retrieval and routing
 */
export function classifyQuery(
  query: string,
  hasAttachedSessions: boolean = false,
  attachedSessionCount: number = 0
): QueryClassification {
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Detect SCOPE
  const scope = detectScope(normalizedQuery, hasAttachedSessions);

  // 2. Detect INTENT
  const intent = detectIntent(normalizedQuery);

  // 3. Detect SPECIFICITY
  const specificity = detectSpecificity(scope, intent);

  // 4. Extract filters
  const filters = extractFilters(normalizedQuery);

  // 5. Determine routing
  const routing = determineRouting(scope, intent, specificity, filters);

  // 6. Calculate confidence
  const confidence = calculateConfidence(scope, intent, normalizedQuery);

  // 7. Generate reasoning
  const reasoning = generateReasoning(scope, intent, specificity, filters);

  return {
    scope,
    intent,
    specificity,
    filters,
    routing,
    confidence,
    reasoning,
  };
}

/**
 * Detect query scope
 */
function detectScope(query: string, hasAttachedSessions: boolean): QueryScope {
  // If user attached sessions via @mention, that takes precedence
  if (hasAttachedSessions || SCOPE_PATTERNS.SESSION_SPECIFIC.some(p => p.test(query))) {
    return 'SESSION_SPECIFIC';
  }

  // Check for time-bounded queries
  if (SCOPE_PATTERNS.TIME_BOUNDED.some(p => p.test(query))) {
    return 'TIME_BOUNDED';
  }

  // Check for tool-filtered queries
  if (SCOPE_PATTERNS.TOOL_FILTERED.some(p => p.test(query))) {
    return 'TOOL_FILTERED';
  }

  // Check for task-filtered queries
  if (SCOPE_PATTERNS.TASK_FILTERED.some(p => p.test(query))) {
    return 'TASK_FILTERED';
  }

  // Check for holistic queries
  if (SCOPE_PATTERNS.HOLISTIC.some(p => p.test(query))) {
    return 'HOLISTIC';
  }

  // Default to holistic for ambiguous queries (better to retrieve more)
  return 'HOLISTIC';
}

/**
 * Detect query intent
 */
function detectIntent(query: string): QueryIntent {
  // Check each intent pattern
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (patterns.some(p => p.test(query))) {
      return intent as QueryIntent;
    }
  }

  // Default to OPTIMIZATION for improvement-related queries
  if (/\b(improve|better|faster|efficient)/i.test(query)) {
    return 'OPTIMIZATION';
  }

  return 'GENERAL';
}

/**
 * Detect query specificity
 */
function detectSpecificity(scope: QueryScope, intent: QueryIntent): QuerySpecificity {
  // Session-specific is always NEEDLE
  if (scope === 'SESSION_SPECIFIC') {
    return 'NEEDLE';
  }

  // Tool/task filtered or time-bounded are TARGETED
  if (scope === 'TOOL_FILTERED' || scope === 'TASK_FILTERED' || scope === 'TIME_BOUNDED') {
    return 'TARGETED';
  }

  // Exploration intent is usually BROAD
  if (intent === 'EXPLORATION' || intent === 'PATTERN') {
    return 'BROAD';
  }

  // Holistic scope is BROAD
  if (scope === 'HOLISTIC') {
    return 'BROAD';
  }

  return 'BROAD';
}

/**
 * Extract domain keywords from query for relevance filtering
 * Returns keywords that should be present in matched workflows
 */
function extractDomainKeywords(query: string): string[] {
  const detectedDomains: string[] = [];
  const queryLower = query.toLowerCase();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      // Use word boundary matching to avoid partial matches
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(queryLower)) {
        if (!detectedDomains.includes(domain)) {
          detectedDomains.push(domain);
        }
        // Also add the specific keyword for more precise matching
        if (!detectedDomains.includes(keyword)) {
          detectedDomains.push(keyword);
        }
      }
    }
  }

  return detectedDomains;
}

/**
 * Extract filters from query
 */
function extractFilters(query: string): QueryClassification['filters'] {
  const filters: QueryClassification['filters'] = {};

  // Extract tools
  const detectedTools: string[] = [];
  for (const [alias, normalized] of Object.entries(TOOL_ALIASES)) {
    if (query.includes(alias)) {
      if (!detectedTools.includes(normalized)) {
        detectedTools.push(normalized);
      }
    }
  }
  if (detectedTools.length > 0) {
    filters.tools = detectedTools;
  }

  // Extract task types
  const detectedTasks: string[] = [];
  for (const [alias, normalized] of Object.entries(TASK_ALIASES)) {
    if (query.includes(alias)) {
      if (!detectedTasks.includes(normalized)) {
        detectedTasks.push(normalized);
      }
    }
  }
  if (detectedTasks.length > 0) {
    filters.taskTypes = detectedTasks;
  }

  // Extract time range
  const timeRange = extractTimeRange(query);
  if (timeRange) {
    filters.timeRange = timeRange;
  }

  // Extract domain keywords for relevance filtering
  const domainKeywords = extractDomainKeywords(query);
  if (domainKeywords.length > 0) {
    filters.domainKeywords = domainKeywords;
  }

  return filters;
}

/**
 * Extract time range from query
 */
function extractTimeRange(query: string): QueryClassification['filters']['timeRange'] | undefined {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (/\byesterday\b/i.test(query)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      start: yesterday,
      end: today,
      description: 'yesterday',
    };
  }

  if (/\btoday\b/i.test(query)) {
    return {
      start: today,
      end: now,
      description: 'today',
    };
  }

  if (/\b(this|current)\s+week\b/i.test(query)) {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return {
      start: startOfWeek,
      end: now,
      description: 'this week',
    };
  }

  if (/\blast\s+week\b/i.test(query)) {
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() + 7);
    return {
      start: startOfLastWeek,
      end: endOfLastWeek,
      description: 'last week',
    };
  }

  if (/\b(last|past)\s+(\d+)\s+(day|days)\b/i.test(query)) {
    const match = query.match(/\b(last|past)\s+(\d+)\s+(day|days)\b/i);
    if (match) {
      const days = parseInt(match[2], 10);
      const start = new Date(today);
      start.setDate(start.getDate() - days);
      return {
        start,
        end: now,
        description: `last ${days} days`,
      };
    }
  }

  if (/\brecent(ly)?\b/i.test(query)) {
    const start = new Date(today);
    start.setDate(start.getDate() - 7); // Default "recent" to last 7 days
    return {
      start,
      end: now,
      description: 'recent (last 7 days)',
    };
  }

  return undefined;
}

/**
 * Determine routing based on classification
 */
function determineRouting(
  scope: QueryScope,
  intent: QueryIntent,
  specificity: QuerySpecificity,
  filters: QueryClassification['filters']
): QueryClassification['routing'] {
  // Determine maxResults based on scope, specificity, and intent
  // For holistic queries about efficiency/improvement, retrieve ALL workflows
  let maxResults: number;

  // Check if this is a comprehensive analysis query (efficiency, improvement, optimization)
  // These queries need ALL workflows to provide accurate analysis
  const isComprehensiveAnalysis =
    scope === 'HOLISTIC' &&
    (intent === 'OPTIMIZATION' || intent === 'DIAGNOSTIC' || intent === 'GENERAL' ||
     intent === 'FEATURE_DISCOVERY' || intent === 'PATTERN' || intent === 'TOOL_MASTERY' ||
     intent === 'COMPARISON' || intent === 'LEARNING');

  switch (scope) {
    case 'SESSION_SPECIFIC':
      maxResults = 50; // Only need related screenshots
      break;
    case 'TIME_BOUNDED':
      maxResults = 150; // Moderate amount for time range
      break;
    case 'TOOL_FILTERED':
    case 'TASK_FILTERED':
      maxResults = 150; // Moderate for filtered queries
      break;
    case 'HOLISTIC':
    default:
      // For comprehensive analysis queries, retrieve ALL workflows (use high limit)
      // Queries like "How can I improve my efficiency?" should get everything
      maxResults = isComprehensiveAnalysis ? 500 : 200;
      break;
  }

  // Determine agents based on intent
  let agentsToRun: AgentId[];
  let includePeerComparison = false;
  let includeWebSearch = false;
  let includeFeatureAdoption = false;

  switch (intent) {
    case 'DIAGNOSTIC':
      // Finding problems → A1→A2→A3 (peer comparison)→A5 (features)→A4 (web)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
    case 'OPTIMIZATION':
      // How to improve → A1→A2→A3 (peer comparison)→A5 (features)→A4 (web)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
    case 'COMPARISON':
      // Compare with peers → A1→A2→A3 (peer)→A5 (features)→A4 (web)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
    case 'EXPLORATION':
      // Show me what I did → A1→A5 (suggest features based on what user did)
      agentsToRun = ['A1_RETRIEVAL', 'A5_FEATURE_ADOPTION'];
      includeFeatureAdoption = true;
      break;
    case 'LEARNING':
      // Best practices → A1→A3 (peer patterns)→A5 (features)→A4 (web)
      agentsToRun = ['A1_RETRIEVAL', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
    case 'PATTERN':
      // Find patterns → A1→A2→A5 (feature patterns)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A5_FEATURE_ADOPTION'];
      includeFeatureAdoption = true;
      break;
    case 'FEATURE_DISCOVERY':
      // Discover underused features → A1→A2→A3 (peer comparison)→A5 (features)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION'];
      includePeerComparison = true;
      includeFeatureAdoption = true;
      break;
    case 'TOOL_MASTERY':
      // Master specific tool → A1→A2→A3 (peer patterns)→A5 (features)→A4 (web tips)
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
    case 'TOOL_INTEGRATION':
      // Integrate/use/add a tool → A4 (web search FIRST for tool info), then A1 for context
      // Web search is the PRIMARY source for unknown tools and integration guidance
      agentsToRun = ['A4_WEB', 'A1_RETRIEVAL', 'A5_FEATURE_ADOPTION'];
      includePeerComparison = false;  // Peers unlikely to help with new tool integration
      includeWebSearch = true;        // PRIMARY source
      includeFeatureAdoption = true;  // May have relevant feature tips
      break;
    case 'BLOG_CREATION':
      // Blog creation only needs retrieval - the blog prompt does the heavy lifting
      // Uses BLOG_GENERATION_SYSTEM_PROMPT instead of ANSWER_GENERATION_SYSTEM_PROMPT
      agentsToRun = ['A1_RETRIEVAL'];
      includePeerComparison = false;  // No peer comparison for blog
      includeWebSearch = false;       // No web search for blog
      includeFeatureAdoption = false; // No feature tips for blog
      break;
    case 'PROGRESS_UPDATE':
      // Progress update only needs retrieval - the progress update prompt does the heavy lifting
      // Uses PROGRESS_UPDATE_SYSTEM_PROMPT instead of ANSWER_GENERATION_SYSTEM_PROMPT
      agentsToRun = ['A1_RETRIEVAL'];
      includePeerComparison = false;  // No peer comparison for progress report
      includeWebSearch = false;       // No web search for progress report
      includeFeatureAdoption = false; // No feature tips for progress report
      break;
    case 'GENERAL':
    default:
      // Default: Full pipeline for comprehensive analysis
      agentsToRun = ['A1_RETRIEVAL', 'A2_JUDGE', 'A3_COMPARATOR', 'A5_FEATURE_ADOPTION', 'A4_WEB'];
      includePeerComparison = true;
      includeWebSearch = true;
      includeFeatureAdoption = true;
      break;
  }

  // Determine if semantic search is needed
  const useSemanticSearch = specificity === 'BROAD' ||
    (specificity === 'TARGETED' && !filters.tools && !filters.taskTypes && !filters.timeRange);

  // Enable strict domain matching when domain keywords are detected
  // This prevents returning unrelated workflows (e.g., "chat app research" for "Apple build automation")
  const strictDomainMatching = (filters.domainKeywords?.length ?? 0) > 0;

  return {
    maxResults,
    agentsToRun,
    includePeerComparison,
    includeWebSearch,
    includeFeatureAdoption,
    useSemanticSearch,
    strictDomainMatching,
  };
}

/**
 * Calculate classification confidence
 */
function calculateConfidence(scope: QueryScope, intent: QueryIntent, query: string): number {
  let confidence = 0.5; // Base confidence

  // Higher confidence if we matched explicit patterns
  const scopeMatched = SCOPE_PATTERNS[scope]?.some(p => p.test(query));
  const intentMatched = INTENT_PATTERNS[intent]?.some(p => p.test(query));

  if (scopeMatched) confidence += 0.2;
  if (intentMatched) confidence += 0.2;

  // Lower confidence for very short queries
  if (query.length < 20) confidence -= 0.1;

  // Higher confidence for longer, more specific queries
  if (query.length > 50) confidence += 0.1;

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Generate reasoning for the classification
 */
function generateReasoning(
  scope: QueryScope,
  intent: QueryIntent,
  specificity: QuerySpecificity,
  filters: QueryClassification['filters']
): string {
  const parts: string[] = [];

  parts.push(`Scope: ${scope}`);
  parts.push(`Intent: ${intent}`);
  parts.push(`Specificity: ${specificity}`);

  if (filters.tools?.length) {
    parts.push(`Tools detected: ${filters.tools.join(', ')}`);
  }
  if (filters.taskTypes?.length) {
    parts.push(`Task types detected: ${filters.taskTypes.join(', ')}`);
  }
  if (filters.timeRange) {
    parts.push(`Time range: ${filters.timeRange.description}`);
  }

  return parts.join(' | ');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SCOPE_PATTERNS,
  INTENT_PATTERNS,
  TOOL_ALIASES,
  TASK_ALIASES,
  DOMAIN_KEYWORDS,
  extractDomainKeywords,
};
