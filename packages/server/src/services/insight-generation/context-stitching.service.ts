/**
 * Context Stitching Service
 *
 * Implements two-tier context stitching for the Insight Assistant:
 *
 * Tier 1: Outcome-Based Stitching (Project-Level)
 * - Groups all activities contributing to a single deliverable or goal
 * - Example: Advisory board presentation = Granola analysis + team calls + Slack + Google Slides
 * - User mental model: "Everything I did to create that presentation"
 *
 * Tier 2: Tool-Mastery Stitching (Skill-Level)
 * - Groups how specific tools are used across different projects
 * - Example: All Google Slides usage = presentation building + template creation + feedback
 * - User mental model: "How I can get better at using Slides"
 *
 * Uses:
 * - Fact Disambiguation to prevent hallucination
 * - Few-Shot Prompting for consistent classification
 * - Recursive refinement for prompt robustness
 */

import type { Logger } from '../../core/logger.js';
import type { LLMProvider } from '../../core/llm-provider.js';
import type { EmbeddingService } from '../interfaces/index.js';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A workstream represents a goal/deliverable the user is working toward
 */
export interface Workstream {
  /** Unique identifier for the workstream */
  workstreamId: string;
  /** User-meaningful name (e.g., "Advisory Board Presentation") */
  name: string;
  /** Description of the outcome being pursued */
  outcomeDescription: string;
  /** Confidence score for this grouping (0-1) */
  confidence: number;
  /** Session IDs that belong to this workstream */
  sessionIds: string[];
  /** Key topics/themes extracted */
  topics: string[];
  /** Tools used across all sessions */
  toolsUsed: string[];
  /** First activity timestamp */
  firstActivity: string;
  /** Most recent activity timestamp */
  lastActivity: string;
  /** Total duration across all sessions (seconds) */
  totalDurationSeconds: number;
}

/**
 * Tool mastery group - how a specific tool is used across projects
 */
export interface ToolMasteryGroup {
  /** Tool name (normalized) */
  toolName: string;
  /** Usage patterns detected */
  usagePatterns: ToolUsagePattern[];
  /** Session IDs where this tool was used */
  sessionIds: string[];
  /** Total time spent with this tool (seconds) */
  totalTimeSeconds: number;
  /** Optimization opportunities for this tool */
  optimizationOpportunities: string[];
}

export interface ToolUsagePattern {
  /** Pattern name (e.g., "Presentation Building", "Template Creation") */
  patternName: string;
  /** Description of this usage pattern */
  description: string;
  /** Frequency of this pattern */
  frequency: number;
  /** Average duration per occurrence (seconds) */
  avgDurationSeconds: number;
  /** Session IDs where this pattern occurred */
  sessionIds: string[];
}

/**
 * Session data for stitching analysis
 */
export interface SessionForStitching {
  sessionId: string;
  title: string;
  highLevelSummary: string;
  workflows: Array<{
    intent: string;
    approach: string;
    tools: string[];
    summary: string;
    durationSeconds: number;
  }>;
  toolsUsed: string[];
  totalDurationSeconds: number;
  timestamp: string;
}

/**
 * Stitched context result containing both tiers
 */
export interface StitchedContext {
  /** Tier 1: Outcome-based workstreams */
  workstreams: Workstream[];
  /** Tier 2: Tool mastery groups */
  toolMasteryGroups: ToolMasteryGroup[];
  /** Sessions that couldn't be grouped (orphans) */
  ungroupedSessionIds: string[];
  /** Stitching metadata */
  metadata: {
    totalSessions: number;
    sessionsStitched: number;
    workstreamCount: number;
    toolGroupCount: number;
    processingTimeMs: number;
    stitchingVersion: string;
  };
}

// ============================================================================
// FACT DISAMBIGUATION FRAMEWORK
// ============================================================================

/**
 * Evidence tiers for fact disambiguation
 * Forces the LLM to ground claims in specific evidence levels
 */
const FACT_DISAMBIGUATION_FRAMEWORK = `
================================================================================
FACT DISAMBIGUATION FRAMEWORK
================================================================================

You MUST ground every grouping decision in observable evidence. Use these tiers:

| Tier | Evidence Type | Confidence | When to Use |
|------|--------------|------------|-------------|
| **F1 — Explicit** | Session contains exact keywords matching another | 0.95+ | "Advisory board" in both sessions |
| **F2 — Strong Signal** | Same project/deliverable mentioned | 0.80-0.94 | "Q4 presentation" + "board deck" = same work |
| **F3 — Contextual** | Related activities, shared context | 0.60-0.79 | Research + drafting about same topic |
| **F4 — Weak Inference** | Only tool overlap or temporal proximity | 0.40-0.59 | Both use Slides, done same week |
| **F5 — Speculation** | No direct evidence, pure guess | <0.40 | NEVER USE - reject grouping |

**ANTI-HALLUCINATION RULES:**
1. NEVER group sessions without citing specific evidence from each session
2. NEVER invent project names not found in session data
3. NEVER assume temporal proximity means related work
4. ALWAYS prefer NOT grouping over speculative grouping
5. If confidence < 0.60, sessions remain UNGROUPED

================================================================================
`;

// ============================================================================
// TIER 1: OUTCOME-BASED STITCHING PROMPT
// ============================================================================

const TIER1_OUTCOME_STITCHING_SYSTEM_PROMPT = `You are an OUTCOME-BASED CONTEXT STITCHER. Your job is to identify which user sessions belong to the same workstream (deliverable/goal).

${FACT_DISAMBIGUATION_FRAMEWORK}

================================================================================
TIER 1: OUTCOME-BASED STITCHING RULES
================================================================================

**WHAT IS A WORKSTREAM?**
A workstream is a user's goal or deliverable that spans multiple sessions.
- Example: "Advisory Board Presentation" = research session + drafting session + feedback session
- Example: "Q4 Product Launch" = planning calls + design work + documentation
- Example: "Customer Onboarding Redesign" = analysis + prototyping + testing

**GROUPING CRITERIA (must meet at least 2):**
1. SAME DELIVERABLE: Sessions explicitly mention the same output (e.g., "advisory deck", "board presentation")
2. SHARED PROJECT: Sessions reference the same project name or context
3. SEQUENTIAL PHASES: Sessions represent clear phases of one effort (research → draft → review)
4. SHARED STAKEHOLDERS: Same people/teams mentioned across sessions

**DO NOT GROUP IF:**
- Only tool overlap (both used Slides ≠ same project)
- Only temporal proximity (same week ≠ same work)
- Only similar topics without explicit connection
- Confidence would be below 0.60

================================================================================
FEW-SHOT EXAMPLES: CORRECT GROUPING
================================================================================

### EXAMPLE 1: High-Confidence Grouping (F1/F2)

**Sessions:**
Session A: "Researching advisory board priorities and stakeholder analysis" | Tools: Chrome, Notion | Dec 10
Session B: "Drafting advisory board presentation deck" | Tools: Google Slides, Notion | Dec 12
Session C: "Incorporating feedback on advisory deck from John" | Tools: Google Slides, Slack | Dec 14

**Correct Output:**
{
  "workstreams": [{
    "workstreamId": "ws-001",
    "name": "Advisory Board Presentation",
    "outcomeDescription": "Creating and refining the advisory board presentation deck",
    "confidence": 0.92,
    "sessionIds": ["session-a", "session-b", "session-c"],
    "topics": ["advisory board", "stakeholder priorities", "presentation"],
    "evidenceChain": [
      "F1: All sessions explicitly mention 'advisory board' or 'advisory deck'",
      "F2: Sequential workflow pattern: research → draft → feedback",
      "F2: Session C references 'advisory deck' mentioned in Session B"
    ]
  }],
  "ungroupedSessionIds": []
}

**WHY CORRECT:**
✅ All sessions share explicit "advisory board" keyword (F1)
✅ Clear sequential phases of same deliverable
✅ Session C references output from Session B
✅ Confidence 0.92 justified by F1/F2 evidence

---

### EXAMPLE 2: Separate Workstreams (Not Grouped)

**Sessions:**
Session A: "Advisory board deck research" | Tools: Chrome, Notion | Dec 10
Session B: "Customer onboarding flow redesign" | Tools: Figma, Miro | Dec 11
Session C: "Team standup and sprint planning" | Tools: Zoom, Linear | Dec 12

**Correct Output:**
{
  "workstreams": [],
  "ungroupedSessionIds": ["session-a", "session-b", "session-c"]
}

**WHY CORRECT:**
✅ No shared deliverable/project across sessions
✅ Different topics, tools, and purposes
✅ Temporal proximity alone is NOT sufficient for grouping
✅ Correctly leaves all sessions ungrouped

---

### EXAMPLE 3: Partial Grouping (Mixed)

**Sessions:**
Session A: "iOS app store screenshots design" | Tools: Figma | Dec 5
Session B: "App store listing text and descriptions" | Tools: Notion, Chrome | Dec 6
Session C: "Team retrospective meeting" | Tools: Zoom | Dec 6
Session D: "Submitting app to App Store review" | Tools: Xcode, Chrome | Dec 8

**Correct Output:**
{
  "workstreams": [{
    "workstreamId": "ws-001",
    "name": "App Store Release",
    "outcomeDescription": "Preparing and submitting the iOS app to App Store",
    "confidence": 0.85,
    "sessionIds": ["session-a", "session-b", "session-d"],
    "topics": ["app store", "iOS release", "screenshots", "submission"],
    "evidenceChain": [
      "F2: Sessions A, B, D all reference 'app store' as shared deliverable",
      "F3: Sequential phases: design assets → listing copy → submission",
      "F4: NOT including Session C - no app store connection"
    ]
  }],
  "ungroupedSessionIds": ["session-c"]
}

**WHY CORRECT:**
✅ Sessions A, B, D share "app store" deliverable (F2)
✅ Session C correctly excluded - retrospective is unrelated
✅ Evidence chain documents why each session was included/excluded

================================================================================
FEW-SHOT EXAMPLES: INCORRECT GROUPING (NEVER DO THIS)
================================================================================

### WRONG EXAMPLE 1: Tool-Only Grouping

**Sessions:**
Session A: "Q4 planning presentation" | Tools: Google Slides | Dec 10
Session B: "Customer testimonials deck" | Tools: Google Slides | Dec 11

**WRONG Output:**
{
  "workstreams": [{
    "name": "Presentation Work",
    "sessionIds": ["session-a", "session-b"],
    "confidence": 0.75
  }]
}

**WHY WRONG:**
❌ Grouped only because both use Google Slides
❌ Q4 planning ≠ customer testimonials (different deliverables)
❌ "Presentation Work" is not a real workstream - it's a tool category
❌ Confidence 0.75 is unjustified - this is F4/F5 level evidence

**CORRECT:** These should be UNGROUPED or in separate workstreams.

---

### WRONG EXAMPLE 2: Temporal Proximity Grouping

**Sessions:**
Session A: "Morning email triage" | Tools: Gmail, Slack | Dec 10, 9am
Session B: "Product roadmap discussion" | Tools: Zoom, Notion | Dec 10, 10am
Session C: "Code review for feature X" | Tools: GitHub, VSCode | Dec 10, 2pm

**WRONG Output:**
{
  "workstreams": [{
    "name": "Dec 10 Work",
    "sessionIds": ["session-a", "session-b", "session-c"],
    "confidence": 0.65
  }]
}

**WHY WRONG:**
❌ Grouped only because same day
❌ Email, roadmap discussion, and code review are unrelated activities
❌ "Dec 10 Work" is a date, not a workstream
❌ This is F5 speculation - no shared deliverable

**CORRECT:** All three should be UNGROUPED.

---

### WRONG EXAMPLE 3: Invented Project Name

**Sessions:**
Session A: "Research on competitive landscape" | Tools: Chrome, Notion | Dec 8
Session B: "Market analysis notes" | Tools: Notion | Dec 9

**WRONG Output:**
{
  "workstreams": [{
    "name": "Strategic Market Intelligence Initiative",
    "sessionIds": ["session-a", "session-b"],
    "confidence": 0.80
  }]
}

**WHY WRONG:**
❌ "Strategic Market Intelligence Initiative" is INVENTED - not in session data
❌ While topics are related, we don't know these are the same project
❌ Could be for different purposes (investor deck vs. product strategy vs. blog post)
❌ Confidence 0.80 is too high for F3/F4 evidence

**CORRECT:** Either UNGROUPED, or if grouped, use data-derived name like "Market Research" with confidence 0.55-0.65.

================================================================================
OUTPUT FORMAT
================================================================================

Return valid JSON with this structure:
{
  "workstreams": [
    {
      "workstreamId": "ws-{uuid}",
      "name": "string - derived from session data, not invented",
      "outcomeDescription": "string - what deliverable is being created",
      "confidence": number - 0.0 to 1.0, following evidence tiers,
      "sessionIds": ["session-id-1", "session-id-2"],
      "topics": ["topic1", "topic2"],
      "evidenceChain": ["F1/F2/F3: specific evidence from sessions"]
    }
  ],
  "ungroupedSessionIds": ["session-ids-that-dont-belong-to-any-workstream"]
}

CRITICAL: Every session MUST appear in EITHER a workstream OR ungroupedSessionIds. Never lose sessions.
`;

// ============================================================================
// TIER 2: TOOL-MASTERY STITCHING PROMPT
// ============================================================================

const TIER2_TOOL_MASTERY_SYSTEM_PROMPT = `You are a TOOL-MASTERY ANALYZER. Your job is to identify how the user uses specific tools across different projects to reveal optimization opportunities.

${FACT_DISAMBIGUATION_FRAMEWORK}

================================================================================
TIER 2: TOOL-MASTERY STITCHING RULES
================================================================================

**WHAT IS TOOL MASTERY ANALYSIS?**
Analyzing how a user employs a specific tool across different contexts to identify:
- Consistent usage patterns (where they're efficient)
- Inconsistent patterns (where they could improve)
- Underused features (optimization opportunities)

**FOR EACH TOOL, IDENTIFY:**
1. USAGE PATTERNS: How is this tool being used? (e.g., "drafting", "reviewing", "presenting")
2. TIME INVESTMENT: How much time spent on each pattern
3. CONTEXT VARIATIONS: How usage differs by project type
4. OPTIMIZATION SIGNALS: Repetitive actions, long durations, workarounds

**OPTIMIZATION OPPORTUNITIES TO DETECT:**
- Long durations on simple tasks → shortcuts/templates available
- Repetitive patterns → automation possible
- Frequent context switching → workflow improvements
- Manual processes → built-in features underused

================================================================================
FEW-SHOT EXAMPLES: CORRECT TOOL MASTERY ANALYSIS
================================================================================

### EXAMPLE 1: Google Slides Analysis

**Sessions:**
Session A: "Advisory board deck" | Slides: 45min | Patterns: formatting, adding charts
Session B: "Customer pitch" | Slides: 60min | Patterns: duplicating slides, reformatting
Session C: "Team update" | Slides: 30min | Patterns: copy-paste from old deck

**Correct Output:**
{
  "toolMasteryGroups": [{
    "toolName": "Google Slides",
    "usagePatterns": [
      {
        "patternName": "Presentation Building",
        "description": "Creating new presentations with charts and formatting",
        "frequency": 3,
        "avgDurationSeconds": 2700,
        "sessionIds": ["session-a", "session-b", "session-c"]
      },
      {
        "patternName": "Template Reuse",
        "description": "Duplicating and adapting existing slides",
        "frequency": 2,
        "avgDurationSeconds": 2700,
        "sessionIds": ["session-b", "session-c"]
      }
    ],
    "sessionIds": ["session-a", "session-b", "session-c"],
    "totalTimeSeconds": 8100,
    "optimizationOpportunities": [
      "F2: High frequency of duplicating slides (sessions B, C) → Create master template deck",
      "F3: Reformatting observed in multiple sessions → Use consistent theme/style",
      "F3: 2+ hours on slides weekly → Consider Slides shortcuts (Ctrl+D for duplicate)"
    ]
  }]
}

**WHY CORRECT:**
✅ Patterns derived from actual session observations
✅ Optimization opportunities grounded in specific session evidence
✅ Frequency and duration calculated from data
✅ Actionable suggestions tied to observed patterns

---

### EXAMPLE 2: VSCode Analysis

**Sessions:**
Session A: "Feature development" | VSCode: 3h | Patterns: coding, debugging, git
Session B: "Bug fixes" | VSCode: 2h | Patterns: debugging, searching, git
Session C: "Code review" | VSCode: 1h | Patterns: reading, commenting

**Correct Output:**
{
  "toolMasteryGroups": [{
    "toolName": "VSCode",
    "usagePatterns": [
      {
        "patternName": "Active Development",
        "description": "Writing and debugging code with git operations",
        "frequency": 2,
        "avgDurationSeconds": 9000,
        "sessionIds": ["session-a", "session-b"]
      },
      {
        "patternName": "Code Review",
        "description": "Reading and annotating code",
        "frequency": 1,
        "avgDurationSeconds": 3600,
        "sessionIds": ["session-c"]
      }
    ],
    "sessionIds": ["session-a", "session-b", "session-c"],
    "totalTimeSeconds": 21600,
    "optimizationOpportunities": [
      "F2: Debugging in sessions A and B → Consider debugger configurations/launch.json",
      "F3: Searching patterns in B → Multi-cursor (Ctrl+D) and global search (Ctrl+Shift+F)"
    ]
  }]
}

================================================================================
FEW-SHOT EXAMPLES: INCORRECT ANALYSIS (NEVER DO THIS)
================================================================================

### WRONG: Inventing Patterns Not in Data

**Sessions:**
Session A: "Work session" | VSCode: 2h | (no specific patterns mentioned)

**WRONG Output:**
{
  "toolMasteryGroups": [{
    "toolName": "VSCode",
    "usagePatterns": [
      {
        "patternName": "Test-Driven Development",
        "description": "Writing tests before implementation",
        "frequency": 5
      }
    ],
    "optimizationOpportunities": [
      "Use Jest runner extension for faster TDD cycles"
    ]
  }]
}

**WHY WRONG:**
❌ "Test-Driven Development" not mentioned in session data
❌ Frequency of 5 is fabricated
❌ Jest suggestion not grounded in any evidence

**CORRECT:** If session data lacks detail, say "Insufficient pattern data for VSCode analysis"

================================================================================
OUTPUT FORMAT
================================================================================

Return valid JSON:
{
  "toolMasteryGroups": [
    {
      "toolName": "string - tool name from session data",
      "usagePatterns": [
        {
          "patternName": "string - pattern name derived from data",
          "description": "string - what this pattern involves",
          "frequency": number - count from sessions,
          "avgDurationSeconds": number - calculated average,
          "sessionIds": ["session-ids-where-pattern-occurred"]
        }
      ],
      "sessionIds": ["all-session-ids-using-this-tool"],
      "totalTimeSeconds": number,
      "optimizationOpportunities": [
        "F2/F3: specific opportunity grounded in session evidence"
      ]
    }
  ]
}
`;

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const workstreamSchema = z.object({
  workstreamId: z.string(),
  name: z.string(),
  outcomeDescription: z.string(),
  confidence: z.number().min(0).max(1),
  sessionIds: z.array(z.string()),
  topics: z.array(z.string()),
  evidenceChain: z.array(z.string()).optional(),
});

const tier1OutputSchema = z.object({
  workstreams: z.array(workstreamSchema),
  ungroupedSessionIds: z.array(z.string()),
});

const usagePatternSchema = z.object({
  patternName: z.string(),
  description: z.string(),
  frequency: z.number(),
  avgDurationSeconds: z.number(),
  sessionIds: z.array(z.string()),
});

const toolMasteryGroupSchema = z.object({
  toolName: z.string(),
  usagePatterns: z.array(usagePatternSchema),
  sessionIds: z.array(z.string()),
  totalTimeSeconds: z.number(),
  optimizationOpportunities: z.array(z.string()),
});

const tier2OutputSchema = z.object({
  toolMasteryGroups: z.array(toolMasteryGroupSchema),
});

// ============================================================================
// TIER 3: PROCESS PATTERN DETECTION (Cross-Tool Workflow Sequences)
// ============================================================================

const TIER3_PROCESS_PATTERN_SYSTEM_PROMPT = `You are a PROCESS PATTERN DETECTOR. Your job is to identify repetitive cross-tool workflow sequences that occur across multiple sessions.

DETECTION CRITERIA:
1. **Sequence**: Must be an ordered series of 2-4 tools (e.g., Chrome → Docs → Gmail)
2. **Repetition**: Pattern must occur in at least 2 separate sessions
3. **Coherence**: Tools in sequence should represent logical workflow steps
4. **Time-bounded**: Each pattern instance should complete within same session/day

WHAT TO DETECT:
✅ "Chrome research → Google Docs document → Gmail send" (repeated 5x)
✅ "Figma design → Notion document → Slack discussion" (repeated 3x)
✅ "Terminal debug → VS Code fix → GitHub commit" (repeated 4x)

WHAT NOT TO DETECT:
❌ Single tool repeated (that's tool mastery, not a process)
❌ Random tool combinations without logical flow
❌ One-off sequences (must repeat 2+ times)
❌ Sequences longer than 4 steps (too complex to automate)

OUTPUT FORMAT:
For each detected pattern, provide:
- **patternName**: Descriptive name (e.g., "Research-Document-Communicate")
- **workflow**: Ordered array of steps with tools and duration
- **frequency**: How many times pattern occurred
- **sessionIds**: Which sessions contained this pattern
- **optimization**: Automation potential + suggestions

Keep descriptions evidence-based and concise.`;

const workflowStepSchema = z.object({
  stepName: z.string().describe('Step name like "Research", "Document", "Communicate"'),
  toolsUsed: z.array(z.string()).describe('Tools used in this step'),
  avgDurationSeconds: z.number().describe('Average duration of this step'),
  order: z.number().describe('Step order (1, 2, 3...)'),
});

const processPatternSchema = z.object({
  patternId: z.string().describe('Unique ID for pattern'),
  patternName: z.string().describe('Descriptive name like "Research-Document-Share"'),
  workflow: z.array(workflowStepSchema).describe('Ordered workflow steps'),
  frequency: z.number().describe('How many times pattern occurred'),
  avgDurationSeconds: z.number().describe('Average total duration of pattern'),
  sessionIds: z.array(z.string()).describe('Sessions where pattern was detected'),
  firstSeen: z.string().describe('ISO timestamp of first occurrence'),
  lastSeen: z.string().describe('ISO timestamp of last occurrence'),
  optimization: z.object({
    automationPotential: z.enum(['high', 'medium', 'low']).describe('Automation potential'),
    suggestions: z.array(z.string()).describe('Optimization suggestions'),
  }),
});

const tier3OutputSchema = z.object({
  processPatterns: z.array(processPatternSchema),
});

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class ContextStitchingService {
  private logger: Logger;
  private llmProvider: LLMProvider;
  private embeddingService: EmbeddingService;

  constructor(
    logger: Logger,
    llmProvider: LLMProvider,
    embeddingService: EmbeddingService
  ) {
    this.logger = logger;
    this.llmProvider = llmProvider;
    this.embeddingService = embeddingService;
  }

  /**
   * Perform two-tier context stitching on user sessions
   */
  async stitchContext(
    sessions: SessionForStitching[],
    options?: {
      minConfidence?: number;
      focusWorkstream?: string; // Optional: prioritize sessions matching this workstream
    }
  ): Promise<StitchedContext> {
    const startTime = Date.now();
    const minConfidence = options?.minConfidence ?? 0.60;

    this.logger.info('ContextStitching: Starting two-tier stitching', {
      sessionCount: sessions.length,
      minConfidence,
      focusWorkstream: options?.focusWorkstream,
    });

    if (sessions.length === 0) {
      return this.emptyResult(startTime);
    }

    // If focusing on a specific workstream, filter sessions first
    let targetSessions = sessions;
    if (options?.focusWorkstream) {
      targetSessions = await this.filterSessionsByWorkstream(
        sessions,
        options.focusWorkstream
      );
    }

    // Cap sessions to reduce LLM input size (most relevant first, by recency)
    const MAX_STITCHING_SESSIONS = 10;
    if (targetSessions.length > MAX_STITCHING_SESSIONS) {
      this.logger.info('ContextStitching: Capping sessions', {
        original: targetSessions.length,
        capped: MAX_STITCHING_SESSIONS,
      });
      // Sort by timestamp descending (most recent first) and take top N
      targetSessions = [...targetSessions]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, MAX_STITCHING_SESSIONS);
    }

    // Execute all three tiers in parallel with a hard timeout
    const STITCHING_TIMEOUT_MS = 25000; // 25s hard cap
    const stitchingPromise = Promise.all([
      this.executeTier1Stitching(targetSessions, minConfidence),
      this.executeTier2Stitching(targetSessions),
      this.executeTier3Stitching(targetSessions),
    ]);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        this.logger.warn('ContextStitching: Timeout reached, using partial results');
        resolve(null);
      }, STITCHING_TIMEOUT_MS);
    });

    const stitchResult = await Promise.race([stitchingPromise, timeoutPromise]);

    // Handle timeout — use empty results for tiers that didn't complete
    const [tier1Result, tier2Result, tier3Result] = stitchResult
      ? stitchResult
      : [
          { workstreams: [], ungroupedSessionIds: targetSessions.map(s => s.sessionId) },
          { toolMasteryGroups: [] },
          { processPatterns: [] },
        ];

    const processingTimeMs = Date.now() - startTime;

    // Calculate stitched count
    const stitchedSessionIds = new Set<string>();
    tier1Result.workstreams.forEach(ws => ws.sessionIds.forEach(id => stitchedSessionIds.add(id)));

    this.logger.info('ContextStitching: Complete', {
      workstreamCount: tier1Result.workstreams.length,
      toolGroupCount: tier2Result.toolMasteryGroups.length,
      processPatternCount: tier3Result.processPatterns.length,
      ungroupedCount: tier1Result.ungroupedSessionIds.length,
      processingTimeMs,
    });

    return {
      workstreams: tier1Result.workstreams,
      toolMasteryGroups: tier2Result.toolMasteryGroups,
      processPatterns: tier3Result.processPatterns,
      ungroupedSessionIds: tier1Result.ungroupedSessionIds,
      metadata: {
        totalSessions: sessions.length,
        sessionsStitched: stitchedSessionIds.size,
        workstreamCount: tier1Result.workstreams.length,
        toolGroupCount: tier2Result.toolMasteryGroups.length,
        processPatternCount: tier3Result.processPatterns.length,
        processingTimeMs,
        stitchingVersion: '1.0.0',
      },
    };
  }

  /**
   * Filter sessions that likely belong to a specific workstream
   * Uses embedding similarity for semantic matching
   */
  private async filterSessionsByWorkstream(
    sessions: SessionForStitching[],
    workstreamQuery: string
  ): Promise<SessionForStitching[]> {
    this.logger.info('ContextStitching: Filtering sessions by workstream', {
      workstreamQuery,
      totalSessions: sessions.length,
    });

    try {
      // Generate embedding for the workstream query
      const queryEmbedding = await this.embeddingService.generateEmbedding(workstreamQuery);

      // Score each session by similarity
      const scoredSessions = await Promise.all(
        sessions.map(async (session) => {
          const sessionText = `${session.title} ${session.highLevelSummary} ${session.workflows.map(w => w.intent).join(' ')}`;
          const sessionEmbedding = await this.embeddingService.generateEmbedding(sessionText);
          const similarity = this.cosineSimilarity(queryEmbedding, sessionEmbedding);
          return { session, similarity };
        })
      );

      // Filter sessions above threshold (0.5 similarity)
      const threshold = 0.5;
      const filtered = scoredSessions
        .filter(s => s.similarity > threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .map(s => s.session);

      this.logger.info('ContextStitching: Workstream filter complete', {
        filteredCount: filtered.length,
        threshold,
      });

      // If no sessions match, return all (graceful fallback)
      return filtered.length > 0 ? filtered : sessions;
    } catch (error) {
      this.logger.warn('ContextStitching: Workstream filtering failed, using all sessions', {
        error: String(error),
      });
      return sessions;
    }
  }

  /**
   * Execute Tier 1: Outcome-Based Stitching
   */
  private async executeTier1Stitching(
    sessions: SessionForStitching[],
    minConfidence: number
  ): Promise<{ workstreams: Workstream[]; ungroupedSessionIds: string[] }> {
    this.logger.info('ContextStitching: Executing Tier 1 (Outcome-Based)');

    // Format sessions for the prompt (truncate summaries to reduce token count)
    const MAX_SUMMARY_LENGTH = 300;
    const sessionDescriptions = sessions.map((s, idx) => {
      const workflowIntents = s.workflows.map(w => w.intent).join(', ');
      const tools = s.toolsUsed.slice(0, 5).join(', '); // Cap tools at 5
      const summary = s.highLevelSummary.length > MAX_SUMMARY_LENGTH
        ? s.highLevelSummary.slice(0, MAX_SUMMARY_LENGTH) + '...'
        : s.highLevelSummary;
      return `Session ${idx + 1} (ID: ${s.sessionId}):
  Title: "${s.title}"
  Summary: "${summary}"
  Workflow Intents: ${workflowIntents || 'None specified'}
  Tools: ${tools || 'None recorded'}
  Duration: ${Math.round(s.totalDurationSeconds / 60)}min
  Date: ${s.timestamp}`;
    }).join('\n\n');

    const userPrompt = `Analyze these ${sessions.length} sessions and identify workstreams (shared deliverables/goals).

SESSIONS TO ANALYZE:
${sessionDescriptions}

Remember:
- Only group sessions with confidence >= ${minConfidence}
- Every session must appear in either a workstream OR ungroupedSessionIds
- Cite specific evidence (F1/F2/F3) for each grouping decision
- Do NOT invent project names - derive from session data

Return your analysis as valid JSON.`;

    try {
      const result = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: TIER1_OUTCOME_STITCHING_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tier1OutputSchema,
        { temperature: 0.1, maxTokens: 10000 } // Low temperature for consistency, increased maxTokens to prevent truncation
      );

      // Validate and filter by confidence
      const validWorkstreams: Workstream[] = result.content.workstreams
        .filter(ws => ws.confidence >= minConfidence)
        .map(ws => ({
          workstreamId: ws.workstreamId,
          name: ws.name,
          outcomeDescription: ws.outcomeDescription,
          confidence: ws.confidence,
          sessionIds: ws.sessionIds,
          topics: ws.topics,
          toolsUsed: this.extractToolsFromSessions(sessions, ws.sessionIds),
          firstActivity: this.getEarliestTimestamp(sessions, ws.sessionIds),
          lastActivity: this.getLatestTimestamp(sessions, ws.sessionIds),
          totalDurationSeconds: this.sumDuration(sessions, ws.sessionIds),
        }));

      // Determine ungrouped sessions
      const groupedSessionIds = new Set(validWorkstreams.flatMap(ws => ws.sessionIds));
      const allSessionIds = sessions.map(s => s.sessionId);
      const ungroupedSessionIds = allSessionIds.filter(id => !groupedSessionIds.has(id));

      // Add any sessions returned as ungrouped by LLM
      result.content.ungroupedSessionIds.forEach(id => {
        if (!ungroupedSessionIds.includes(id)) {
          ungroupedSessionIds.push(id);
        }
      });

      return { workstreams: validWorkstreams, ungroupedSessionIds };
    } catch (error) {
      this.logger.error('ContextStitching: Tier 1 failed', error instanceof Error ? error : new Error(String(error)));
      // Graceful degradation: all sessions ungrouped
      return {
        workstreams: [],
        ungroupedSessionIds: sessions.map(s => s.sessionId),
      };
    }
  }

  /**
   * Execute Tier 2: Tool-Mastery Stitching
   * Includes retry logic for truncated JSON responses from Gemini models
   */
  private async executeTier2Stitching(
    sessions: SessionForStitching[]
  ): Promise<{ toolMasteryGroups: ToolMasteryGroup[] }> {
    this.logger.info('ContextStitching: Executing Tier 2 (Tool-Mastery)');

    // Extract unique tools and their usage
    const toolUsage = new Map<string, { sessions: SessionForStitching[]; totalTime: number }>();
    for (const session of sessions) {
      for (const tool of session.toolsUsed) {
        const normalized = this.normalizeTool(tool);
        if (!toolUsage.has(normalized)) {
          toolUsage.set(normalized, { sessions: [], totalTime: 0 });
        }
        const entry = toolUsage.get(normalized)!;
        entry.sessions.push(session);
        entry.totalTime += session.totalDurationSeconds;
      }
    }

    // Filter to tools with meaningful usage (2+ sessions or 30+ min)
    const significantTools = Array.from(toolUsage.entries())
      .filter(([_, usage]) => usage.sessions.length >= 2 || usage.totalTime >= 1800);

    if (significantTools.length === 0) {
      return { toolMasteryGroups: [] };
    }

    // Retry logic for truncated JSON responses
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // On retry, use a simpler prompt with fewer tools to reduce output size
        const toolsToAnalyze = attempt === 1
          ? significantTools
          : significantTools.slice(0, Math.max(2, Math.ceil(significantTools.length / attempt)));

        // Format for prompt
        const toolDescriptions = toolsToAnalyze.map(([toolName, usage]) => {
          // On retry, use shorter session details
          const maxSessions = attempt === 1 ? usage.sessions.length : Math.min(3, usage.sessions.length);
          const sessionDetails = usage.sessions.slice(0, maxSessions).map((s) =>
            `  - "${s.title}" (${Math.round(s.totalDurationSeconds / 60)}min)`
          ).join('\n');
          return `${toolName} (${usage.sessions.length} sessions, ${Math.round(usage.totalTime / 60)}min total):
${sessionDetails}`;
        }).join('\n\n');

        const userPrompt = attempt === 1
          ? `Analyze tool usage patterns across these sessions:

TOOL USAGE:
${toolDescriptions}

For each tool, identify:
1. Usage patterns (how the tool is used)
2. Optimization opportunities (based on observed patterns)

Ground all observations in specific session evidence.
Return your analysis as valid JSON.`
          : `Briefly analyze these ${toolsToAnalyze.length} tools. Keep responses concise.

TOOLS:
${toolDescriptions}

Return JSON with toolMasteryGroups array. Keep descriptions short (under 50 words each).`;

        this.logger.debug(`ContextStitching: Tier 2 attempt ${attempt}/${maxRetries}`, {
          toolCount: toolsToAnalyze.length,
          promptLength: userPrompt.length,
        });

        const result = await this.llmProvider.generateStructuredResponse(
          [
            { role: 'system', content: TIER2_TOOL_MASTERY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          tier2OutputSchema,
          { temperature: 0.1, maxTokens: 10000 } // Increased to prevent truncation
        );

        this.logger.info('ContextStitching: Tier 2 succeeded', {
          attempt,
          groupCount: result.content.toolMasteryGroups.length,
        });

        return { toolMasteryGroups: result.content.toolMasteryGroups };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        // Check if this is a truncation/parsing error worth retrying
        const isTruncationError =
          errorMessage.includes('Unterminated string') ||
          errorMessage.includes('could not parse') ||
          errorMessage.includes('No object generated') ||
          errorMessage.includes('JSON parsing failed');

        if (!isTruncationError || attempt === maxRetries) {
          this.logger.error('ContextStitching: Tier 2 failed (not retrying)', lastError, {
            attempt,
            isTruncationError,
          });
          break;
        }

        this.logger.warn(`ContextStitching: Tier 2 attempt ${attempt} failed with truncation, retrying with simpler prompt`, {
          attempt,
          error: errorMessage.slice(0, 200),
        });
      }
    }

    return { toolMasteryGroups: [] };
  }

  /**
   * Execute Tier 3: Process Pattern Detection
   * Identifies repetitive cross-tool workflow sequences (e.g., "Chrome → Docs → Gmail")
   */
  private async executeTier3Stitching(
    sessions: SessionForStitching[]
  ): Promise<{ processPatterns: ProcessPattern[] }> {
    this.logger.info('ContextStitching: Executing Tier 3 (Process Patterns)');

    if (sessions.length < 2) {
      this.logger.info('ContextStitching: Tier 3 skipped - need 2+ sessions for pattern detection');
      return { processPatterns: [] };
    }

    // Extract workflow sequences from sessions
    // A sequence is an ordered list of tools used in a workflow
    const sequences: Array<{
      sessionId: string;
      tools: string[];
      timestamp: string;
      duration: number;
    }> = [];

    for (const session of sessions) {
      for (const workflow of session.workflows) {
        // Extract unique tools in order from workflow steps
        const toolSequence: string[] = [];
        const seenTools = new Set<string>();

        for (const step of workflow.steps || []) {
          const tool = this.normalizeTool(step.app || 'unknown');
          if (!seenTools.has(tool)) {
            toolSequence.push(tool);
            seenTools.add(tool);
          }
        }

        // Only consider sequences of 2-4 tools
        if (toolSequence.length >= 2 && toolSequence.length <= 4) {
          sequences.push({
            sessionId: session.sessionId,
            tools: toolSequence,
            timestamp: session.timestamp,
            duration: workflow.steps?.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) || 0,
          });
        }
      }
    }

    if (sequences.length < 2) {
      this.logger.info('ContextStitching: Tier 3 found no multi-tool sequences');
      return { processPatterns: [] };
    }

    // Group sequences by tool pattern (order matters)
    const patternGroups = new Map<string, typeof sequences>();
    for (const seq of sequences) {
      const patternKey = seq.tools.join(' → ');
      if (!patternGroups.has(patternKey)) {
        patternGroups.set(patternKey, []);
      }
      patternGroups.get(patternKey)!.push(seq);
    }

    // Filter to patterns that repeat (2+ occurrences)
    const repeatingPatterns = Array.from(patternGroups.entries())
      .filter(([_, instances]) => instances.length >= 2)
      .sort((a, b) => b[1].length - a[1].length); // Sort by frequency

    if (repeatingPatterns.length === 0) {
      this.logger.info('ContextStitching: Tier 3 found no repeating patterns');
      return { processPatterns: [] };
    }

    // Format top patterns for LLM analysis (limit to top 10 to avoid token limits)
    const patternsToAnalyze = repeatingPatterns.slice(0, 10);
    const patternDescriptions = patternsToAnalyze.map(([pattern, instances]) => {
      const avgDuration = instances.reduce((sum, i) => sum + i.duration, 0) / instances.length;
      const timestamps = instances.map(i => new Date(i.timestamp).toISOString().slice(0, 10));
      return `Pattern: ${pattern}
Frequency: ${instances.length}x
Avg Duration: ${Math.round(avgDuration / 60)}min
Sessions: ${instances.map(i => i.sessionId).join(', ')}
Dates: ${timestamps.slice(0, 3).join(', ')}${timestamps.length > 3 ? ` (+${timestamps.length - 3} more)` : ''}`;
    }).join('\n\n');

    const userPrompt = `Analyze these repetitive cross-tool workflow patterns:

${patternDescriptions}

For each pattern:
1. Give it a descriptive name (e.g., "Research-Document-Share")
2. Break down into workflow steps with tools
3. Assess automation potential (high/medium/low)
4. Suggest specific optimizations

Return JSON with processPatterns array.`;

    try {
      const result = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: TIER3_PROCESS_PATTERN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tier3OutputSchema,
        { temperature: 0.1, maxTokens: 10000 } // Increased to prevent truncation
      );

      // Enrich with actual data from our analysis
      const enrichedPatterns = result.content.processPatterns.map((pattern, idx) => {
        const [patternKey, instances] = patternsToAnalyze[idx] || [null, []];
        if (!instances || instances.length === 0) return pattern;

        const timestamps = instances.map(i => new Date(i.timestamp).getTime());
        return {
          ...pattern,
          frequency: instances.length,
          sessionIds: instances.map(i => i.sessionId),
          firstSeen: new Date(Math.min(...timestamps)).toISOString(),
          lastSeen: new Date(Math.max(...timestamps)).toISOString(),
          avgDurationSeconds: instances.reduce((sum, i) => sum + i.duration, 0) / instances.length,
        };
      });

      this.logger.info('ContextStitching: Tier 3 complete', {
        patternCount: enrichedPatterns.length,
      });

      return { processPatterns: enrichedPatterns };
    } catch (error) {
      this.logger.error('ContextStitching: Tier 3 failed', error instanceof Error ? error : new Error(String(error)));
      return { processPatterns: [] };
    }
  }

  /**
   * Identify which workstream a new session belongs to
   * Called when opening a new session to recognize existing workstreams
   */
  async identifyWorkstreamForSession(
    newSession: SessionForStitching,
    existingWorkstreams: Workstream[],
    recentSessions: SessionForStitching[]
  ): Promise<{ workstreamId: string | null; confidence: number; reason: string }> {
    this.logger.info('ContextStitching: Identifying workstream for new session', {
      sessionTitle: newSession.title,
      existingWorkstreams: existingWorkstreams.length,
    });

    if (existingWorkstreams.length === 0) {
      return { workstreamId: null, confidence: 0, reason: 'No existing workstreams to match' };
    }

    // Build context for matching
    const workstreamDescriptions = existingWorkstreams.map(ws =>
      `Workstream "${ws.name}" (ID: ${ws.workstreamId}):
  - Description: ${ws.outcomeDescription}
  - Topics: ${ws.topics.join(', ')}
  - Tools: ${ws.toolsUsed.join(', ')}
  - Sessions: ${ws.sessionIds.length}
  - Last activity: ${ws.lastActivity}`
    ).join('\n\n');

    const sessionDescription = `New Session:
  Title: "${newSession.title}"
  Summary: "${newSession.highLevelSummary}"
  Workflow Intents: ${newSession.workflows.map(w => w.intent).join(', ')}
  Tools: ${newSession.toolsUsed.join(', ')}`;

    const matchPrompt = `Determine if this new session belongs to an existing workstream.

${sessionDescription}

EXISTING WORKSTREAMS:
${workstreamDescriptions}

Apply Fact Disambiguation rules:
- F1/F2: Only match if explicit keyword or deliverable overlap
- F3: Match if contextually related with clear connection
- F4/F5: Do NOT match - leave unassigned

Return JSON: { "workstreamId": "id or null", "confidence": 0-1, "reason": "evidence-based explanation" }`;

    const matchSchema = z.object({
      workstreamId: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    });

    try {
      const result = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: TIER1_OUTCOME_STITCHING_SYSTEM_PROMPT },
          { role: 'user', content: matchPrompt },
        ],
        matchSchema,
        { temperature: 0.1 }
      );

      // Only return match if confidence >= 0.6
      if (result.content.confidence >= 0.6 && result.content.workstreamId) {
        return result.content;
      }

      return { workstreamId: null, confidence: result.content.confidence, reason: result.content.reason };
    } catch (error) {
      this.logger.warn('ContextStitching: Workstream identification failed', { error: String(error) });
      return { workstreamId: null, confidence: 0, reason: 'Identification failed' };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private normalizeTool(tool: string): string {
    const normalized = tool.trim().toLowerCase();
    // Map common variations to canonical names
    const toolMap: Record<string, string> = {
      'chrome': 'Google Chrome',
      'google chrome': 'Google Chrome',
      'vscode': 'VSCode',
      'vs code': 'VSCode',
      'visual studio code': 'VSCode',
      'google slides': 'Google Slides',
      'slides': 'Google Slides',
      'google docs': 'Google Docs',
      'docs': 'Google Docs',
      'notion': 'Notion',
      'slack': 'Slack',
      'figma': 'Figma',
      'terminal': 'Terminal',
      'iterm': 'Terminal',
      'zoom': 'Zoom',
      'github': 'GitHub',
    };
    return toolMap[normalized] || tool;
  }

  private extractToolsFromSessions(sessions: SessionForStitching[], sessionIds: string[]): string[] {
    const tools = new Set<string>();
    for (const session of sessions) {
      if (sessionIds.includes(session.sessionId)) {
        session.toolsUsed.forEach(t => tools.add(this.normalizeTool(t)));
      }
    }
    return Array.from(tools);
  }

  private getEarliestTimestamp(sessions: SessionForStitching[], sessionIds: string[]): string {
    const timestamps = sessions
      .filter(s => sessionIds.includes(s.sessionId))
      .map(s => new Date(s.timestamp).getTime())
      .filter(t => !isNaN(t)); // Filter out invalid timestamps
    return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : '';
  }

  private getLatestTimestamp(sessions: SessionForStitching[], sessionIds: string[]): string {
    const timestamps = sessions
      .filter(s => sessionIds.includes(s.sessionId))
      .map(s => new Date(s.timestamp).getTime())
      .filter(t => !isNaN(t)); // Filter out invalid timestamps
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : '';
  }

  private sumDuration(sessions: SessionForStitching[], sessionIds: string[]): number {
    return sessions
      .filter(s => sessionIds.includes(s.sessionId))
      .reduce((sum, s) => sum + s.totalDurationSeconds, 0);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private emptyResult(startTime: number): StitchedContext {
    return {
      workstreams: [],
      toolMasteryGroups: [],
      processPatterns: [],
      ungroupedSessionIds: [],
      metadata: {
        totalSessions: 0,
        sessionsStitched: 0,
        workstreamCount: 0,
        toolGroupCount: 0,
        processPatternCount: 0,
        processingTimeMs: Date.now() - startTime,
        stitchingVersion: '1.0.0',
      },
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createContextStitchingService(
  logger: Logger,
  llmProvider: LLMProvider,
  embeddingService: EmbeddingService
): ContextStitchingService {
  return new ContextStitchingService(logger, llmProvider, embeddingService);
}
