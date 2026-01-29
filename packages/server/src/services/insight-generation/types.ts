/**
 * Insight Generation Multi-Agent System Types
 *
 * Core type definitions for the insight generation pipeline:
 * - A1: Retrieval Agent (Hybrid RAG)
 * - A2: Judge Agent (LLM-as-judge)
 * - A3: Comparator Agent (Peer comparison)
 * - A4-Web: Web Best Practices Agent (Perplexity)
 * - A4-Company: Company Docs Agent (PyMUPDF + RAG)
 */

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

export const QUALITY_THRESHOLDS = {
  /** Absolute savings threshold: 10 minutes */
  ABSOLUTE_SAVINGS_SECONDS: 600,
  /** Relative savings threshold: 40% improvement */
  RELATIVE_SAVINGS_PERCENT: 40,
  /** Minimum absolute savings: 2 minutes (reject below) */
  MIN_ABSOLUTE_SECONDS: 120,
  /** Minimum relative savings: 10% (reject below) */
  MIN_RELATIVE_PERCENT: 10,
  /** Minimum confidence score for recommendations */
  MIN_CONFIDENCE: 0.6,
} as const;

// ============================================================================
// USER STEP & WORKFLOW TYPES (A1 Output)
// Mirrors the session capture structure from Desktop-companion:
// Session → Workflows/Chapters → Steps (from screenshot analysis)
// ============================================================================

/**
 * Individual step within a workflow (from screenshot analysis)
 * Generated from user's screenshots with accessibility data (Gemini Flash 2.5)
 *
 * Data captured per step:
 * - Screenshot description (AI-generated)
 * - App name (from accessibility APIs)
 * - Browser URL (if browser app)
 * - Timestamps
 * - Window metadata
 */
export interface UserStep {
  stepId: string;
  /** Short step name/title (from step_name in semantic_steps) */
  description: string;
  /** Longer step summary/description (from description in semantic_steps) */
  stepSummary?: string;
  /** App name from accessibility feature */
  app: string;
  /** Tool category (browser, ide, terminal, communication, etc.) */
  toolCategory?: string;
  /** Browser URL if captured (for browser apps) */
  browserUrl?: string;
  /** Timestamp of the step */
  timestamp: string;
  /** Duration in seconds (calculated from adjacent timestamps) */
  durationSeconds: number;
  /** Order within the workflow */
  order?: number;
  /** Workflow tag (research, coding, debugging, etc.) */
  workflowTag?: string;
  /** V2: Agentic pattern (The Architect, The Operator, The Reviewer, The Centaur) */
  agenticPattern?: string;
  /** V2: Number of raw actions clustered into this semantic step */
  rawActionCount?: number;
  /** Additional metadata from accessibility capture */
  metadata?: {
    windowTitle?: string;
    screenshotPath?: string;
    cloudUrl?: string;
    cursorPosition?: { x: number; y: number };
    keyboardActivity?: boolean;
    idleDetected?: boolean;
  };
}

/**
 * Workflow/Chapter containing multiple steps
 * Groups related steps into logical workflows (e.g., Research & Planning, Debugging)
 *
 * Structure from screenshot analysis:
 * - Intent: What the user was trying to achieve
 * - Approach: How they attempted to achieve it
 * - Tools used: Applications and services utilized
 * - Contextual reasoning: Why certain decisions were made
 */
export interface UserWorkflow {
  workflowId: string;
  /** Chapter title (e.g., "Research & Planning", "Documentation Writing") */
  title: string;
  /** High-level summary of the workflow from AI analysis */
  summary: string;
  /** What the user was trying to achieve (intent/problem) */
  intent: string;
  /** How the user attempted to achieve it (approach) */
  approach: string;
  /** Primary app used in this workflow */
  primaryApp: string;
  /** All steps in this workflow (granular_steps) */
  steps: UserStep[];
  /** Total duration of this workflow in seconds */
  totalDurationSeconds: number;
  /** All tools/apps used across steps */
  tools: string[];
  /** Time boundaries */
  timeStart: string;
  timeEnd: string;
  /** Parent session ID */
  sessionId: string;
  /** Context around the workflow (why certain decisions were made) */
  context?: string;
}

/**
 * Session containing multiple workflows/chapters
 * Represents a continuous period of user activity related to a specific task or goal
 *
 * Layered structure:
 * - Session Level: High-level narrative, start/end goals
 * - Workflow Level: Intent-based groupings with approach
 * - Step Level: Granular actions from screenshot analysis
 */
export interface SessionInfo {
  sessionId: string;
  /** High-level narrative of the entire session */
  highLevelSummary: string;
  /** What the user aimed to achieve at the beginning (start activity/goal) */
  startActivity: string;
  /** The outcome or completion state (end activity/goal) */
  endActivity: string;
  /** Overall intent for the session */
  intent?: string;
  /** Overall approach used across the session */
  approach?: string;
  /** Session time boundaries */
  startTime: string;
  endTime: string;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Number of workflows/chapters in this session */
  workflowCount: number;
  /** All apps used across the session */
  appsUsed: string[];
  /** User role category (software_engineer, product_manager, etc.) */
  roleCategory?: string;
  /** User-provided notes to improve summary accuracy */
  userNotes?: string;
}

/**
 * Extracted entity from workflow
 */
export interface ExtractedEntity {
  name: string;
  type: 'technology' | 'tool' | 'person' | 'organization' | 'concept' | 'other';
  frequency: number;
  confidence: number;
}

/**
 * Extracted concept from workflow
 */
export interface ExtractedConcept {
  name: string;
  category: string;
  relevanceScore: number;
}

/**
 * User's historical toolbox - all tools/apps they have used across sessions
 */
export interface UserToolbox {
  /** Original tool names as captured */
  tools: string[];
  /** Normalized tool names for matching (lowercase, common aliases resolved) */
  normalizedTools: string[];
}

/**
 * Repetitive workflow pattern detected across user's sessions.
 * Represents recurring sequences like "research → summarize → email" that
 * happen frequently and represent optimization opportunities.
 */
export interface RepetitiveWorkflowPattern {
  /** Type of pattern (workflow_sequence or tool_combination) */
  patternType: 'workflow_sequence' | 'tool_combination' | 'entity_access';
  /** The repeated sequence (e.g., ['Research', 'Documentation', 'Email']) */
  sequence: string[];
  /** Number of times this pattern occurred */
  occurrenceCount: number;
  /** Average duration per occurrence in seconds */
  avgDurationSeconds: number;
  /** Total time spent on this pattern in seconds */
  totalTimeSpentSeconds: number;
  /** First occurrence timestamp */
  firstSeen: string;
  /** Most recent occurrence timestamp */
  lastSeen: string;
  /** Session IDs where this pattern was detected */
  sessions: string[];
  /** AI-generated suggestion for optimization */
  optimizationOpportunity: string;
}

/**
 * Evidence bundle from A1 retrieval
 */
export interface EvidenceBundle {
  workflows: UserWorkflow[];
  sessions: SessionInfo[];
  entities: ExtractedEntity[];
  concepts: ExtractedConcept[];
  totalStepCount: number;
  totalDurationSeconds: number;
  retrievalMetadata: {
    queryTimeMs: number;
    sourcesRetrieved: number;
    retrievalMethod: 'hybrid' | 'graph' | 'vector';
    embeddingModel: string;
  };
  /** Repetitive workflow patterns detected across user's sessions (optional) */
  repetitivePatterns?: RepetitiveWorkflowPattern[];
}

// ============================================================================
// DIAGNOSTICS TYPES (A2 Output)
// ============================================================================

/**
 * Types of workflow inefficiencies
 */
export type InefficiencyType =
  | 'repetitive_search'
  | 'context_switching'
  | 'rework_loop'
  | 'manual_automation'
  | 'idle_time'
  | 'tool_fragmentation'
  | 'information_gathering'
  | 'longcut_path'
  | 'repetitive_workflow'  // Cross-session repetitive patterns (e.g., research → summarize → email 10x/week)
  | 'other';

/**
 * Identified inefficiency in a workflow
 */
export interface Inefficiency {
  id: string;
  workflowId: string;
  stepIds: string[];
  type: InefficiencyType;
  description: string;
  estimatedWastedSeconds: number;
  confidence: number;
  evidence: string[]; // Step descriptions that support this finding
  /** For longcut_path: the shorter alternative that exists within user's current tools */
  shorterAlternative?: string;
}

/**
 * Types of improvement opportunities
 */
export type OpportunityType =
  | 'automation'
  | 'consolidation'
  | 'tool_switch'
  | 'workflow_reorder'
  | 'elimination'
  | 'claude_code_integration'
  | 'tool_feature_optimization'
  | 'shortcut_available';

/**
 * Improvement opportunity mapped to inefficiency
 */
export interface Opportunity {
  id: string;
  inefficiencyId: string;
  type: OpportunityType;
  description: string;
  estimatedSavingsSeconds: number;
  suggestedTool?: string;
  claudeCodeApplicable: boolean;
  confidence: number;
  /** For tool_feature_optimization: the specific feature to use (e.g., "Plan Mode", "Composer") */
  featureSuggestion?: string;
  /** For shortcut_available: the exact shortcut/command that replaces multiple steps */
  shortcutCommand?: string;
}

/**
 * Workflow metrics
 */
export interface WorkflowMetrics {
  totalWorkflowTime: number;
  activeTime: number;
  idleTime: number;
  contextSwitches: number;
  reworkLoops: number;
  uniqueToolsUsed: number;
  toolDistribution: Record<string, number>;
  workflowTagDistribution: Record<string, number>;
  averageStepDuration: number;
}

/**
 * Diagnostics output from A2 Judge Agent
 */
export interface Diagnostics {
  workflowId: string;
  workflowName: string;
  metrics: WorkflowMetrics;
  inefficiencies: Inefficiency[];
  opportunities: Opportunity[];
  overallEfficiencyScore: number; // 0-100
  confidence: number;
  analysisTimestamp: string;
}

// ============================================================================
// STEP OPTIMIZATION TYPES (A3/A4 Output)
// ============================================================================

/**
 * Current step in optimization transformation
 */
export interface CurrentStep {
  stepId: string;
  tool: string;
  durationSeconds: number;
  description: string;
}

/**
 * Optimized step replacement
 */
export interface OptimizedStep {
  stepId: string;
  tool: string;
  estimatedDurationSeconds: number;
  description: string;
  claudeCodePrompt?: string;
  isNew: boolean;
  replacesSteps?: string[];
  /** Whether the suggested tool is already in the user's historical toolbox (tools they've used before) */
  isInUserToolbox?: boolean;
}

/**
 * Step-level transformation
 */
export interface StepTransformation {
  transformationId: string;
  currentSteps: CurrentStep[];
  optimizedSteps: OptimizedStep[];
  timeSavedSeconds: number;
  confidence: number;
  rationale: string;
}

/**
 * Metric deltas from optimization
 */
export interface MetricDeltas {
  contextSwitchesReduction?: number;
  reworkLoopsReduction?: number;
  idleTimeReduction?: number;
  toolCountReduction?: number;
}

/**
 * Optimization source type
 */
export type OptimizationSource =
  | 'peer_comparison'
  | 'web_best_practice'
  | 'company_docs'
  | 'heuristic';

// ============================================================================
// FEATURE ADOPTION TYPES (A5 Output)
// ============================================================================

/**
 * Feature adoption tip from A5 Feature Adoption Agent
 * Suggests underused features within tools the user already has
 * Displayed as separate "Workflow Tips" section (not merged with optimization blocks)
 */
export interface FeatureAdoptionTip {
  /** Unique identifier for the tip */
  tipId: string;
  /** Tool name (must be from user's toolbox) */
  toolName: string;
  /** Specific feature name within the tool */
  featureName: string;
  /** How to activate the feature (shortcut, command, etc.) */
  triggerOrShortcut: string;
  /** User-friendly, non-intrusive message explaining the suggestion */
  message: string;
  /** What workflow pattern/behavior this addresses */
  addressesPattern: string;
  /** Estimated time saved per use in seconds */
  estimatedSavingsSeconds: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** IDs of workflows that would benefit from this feature */
  affectedWorkflowIds: string[];
}

/**
 * Optimization block (group of related transformations)
 */
export interface OptimizationBlock {
  blockId: string;
  workflowName: string;
  workflowId: string;
  currentTimeTotal: number;
  optimizedTimeTotal: number;
  timeSaved: number;
  relativeImprovement: number; // Percentage
  confidence: number;
  whyThisMatters: string;
  metricDeltas: MetricDeltas;
  stepTransformations: StepTransformation[];
  source: OptimizationSource;
  citations?: Citation[];
}

/**
 * Citation for company docs or external sources
 */
export interface Citation {
  documentId?: string;
  title: string;
  excerpt: string;
  url?: string;
  pageNumber?: number;
}

/**
 * Step-level optimization plan
 */
export interface StepOptimizationPlan {
  blocks: OptimizationBlock[];
  totalTimeSaved: number;
  totalRelativeImprovement: number;
  passesThreshold: boolean;
  thresholdReason?: string;
}

// ============================================================================
// FINAL OUTPUT TYPES
// ============================================================================

/**
 * Executive summary of insights
 */
export interface ExecutiveSummary {
  totalTimeReduced: number;
  totalRelativeImprovement: number;
  topInefficiencies: string[];
  claudeCodeInsertionPoints: string[];
  passesQualityThreshold: boolean;
}

/**
 * Final optimized workflow step
 */
export interface FinalWorkflowStep {
  stepId: string;
  order: number;
  tool: string;
  description: string;
  estimatedDurationSeconds: number;
  isNew: boolean;
  replacesSteps?: string[];
  claudeCodePrompt?: string;
}

/**
 * Comparison table entry - shows current vs proposed workflow step-by-step
 * Used for the "Current vs Proposed" comparison table in the UI
 */
export interface ComparisonTableEntry {
  /** Step number in the workflow sequence */
  stepNumber: number;
  /** Description of what the user currently does */
  currentAction: string;
  /** Tool/app used in current workflow */
  currentTool: string;
  /** Duration of current step in seconds */
  currentDuration: number;
  /** Description of the proposed optimized action */
  proposedAction: string;
  /** Tool/app for proposed workflow (may include Claude Code) */
  proposedTool: string;
  /** Estimated duration of proposed step in seconds */
  proposedDuration: number;
  /** Time saved for this step in seconds */
  timeSaved: number;
  /** Note explaining the improvement and why it matters */
  improvementNote: string;
}

/**
 * External source reference
 */
export interface ExternalSource {
  url: string;
  title: string;
  relevance: string;
  fetchedAt: string;
}

/**
 * Supporting evidence for recommendations
 */
export interface SupportingEvidence {
  userStepReferences: string[];
  companyDocCitations?: Citation[];
  externalSources?: ExternalSource[];
  peerWorkflowPatterns?: string[];
}

/**
 * Metadata about the insight generation process
 */
export interface InsightGenerationMetadata {
  queryId: string;
  agentsUsed: string[];
  totalProcessingTimeMs: number;
  peerDataAvailable: boolean;
  companyDocsAvailable: boolean;
  webSearchUsed: boolean;
  llmTokensUsed?: number;
  modelVersion: string;
}

/**
 * Final insight generation result
 * Includes direct answer, executive summary, optimization strategies, and follow-ups
 */
export interface InsightGenerationResult {
  queryId: string;
  query: string;
  userId: number;

  /** Direct answer to the user's query generated from aggregated agent context */
  userQueryAnswer: string;

  /** Executive Summary with key metrics */
  executiveSummary: ExecutiveSummary;

  /** Optimization strategies with detailed blocks */
  optimizationPlan?: StepOptimizationPlan;

  /** Timestamps */
  createdAt: string;
  completedAt: string;

  /** LLM-generated follow-up questions based on the analysis context */
  suggestedFollowUps?: string[];

  /** Feature adoption tips from A5 (displayed as separate "Workflow Tips" section) */
  featureAdoptionTips?: FeatureAdoptionTip[];

  /**
   * Repetitive workflow patterns detected across user's sessions
   * (e.g., "research → summarize → email" 10 times/week)
   * Displayed as optimization opportunities in the UI
   */
  repetitivePatterns?: RepetitiveWorkflowPattern[];
}

// ============================================================================
// CRITIQUE LOOP TYPES
// ============================================================================

/**
 * Critique validation result
 */
export interface CritiqueResult {
  passed: boolean;
  issues: CritiqueIssue[];
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
}

/**
 * Individual critique issue
 */
export interface CritiqueIssue {
  type: 'insufficient_evidence' | 'pii_detected' | 'low_confidence' | 'missing_citations' | 'generic_advice' | 'auto_fixed';
  description: string;
  severity: 'error' | 'warning';
  affectedIds?: string[];
}

// ============================================================================
// ROUTING & ORCHESTRATION TYPES
// ============================================================================

/**
 * Agent identifiers
 */
export type AgentId =
  | 'A1_RETRIEVAL'
  | 'A2_JUDGE'
  | 'A3_COMPARATOR'
  | 'A4_WEB'
  | 'A4_COMPANY'
  | 'A5_FEATURE_ADOPTION';

/**
 * Routing decision from orchestrator
 */
export interface RoutingDecision {
  agentsToRun: AgentId[];
  reason: string;
  peerDataUsable: boolean;
  companyDocsAvailable: boolean;
}

/**
 * Insight generation job status
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Job progress update
 */
export interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress: number; // 0-100
  currentStage: string;
  stageDetails?: string;
  estimatedRemainingMs?: number;
}

// ============================================================================
// MODEL CONFIGURATION TYPES
// ============================================================================

/**
 * Supported LLM providers
 */
export type LLMProviderType = 'openai' | 'google';

/**
 * Model configuration for a specific agent
 */
export interface AgentModelConfig {
  provider: LLMProviderType;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Model configuration for the entire insight generation system
 *
 * Default configuration:
 * - A1, A3, A4-Web, A4-Company: Gemini 2.5 Flash (fast, cost-effective)
 * - A2 Judge: GPT-4 (high quality for LLM-as-judge evaluation)
 */
export interface InsightModelConfiguration {
  /** A1 Retrieval Agent - Gemini 2.5 Flash by default */
  a1Retrieval: AgentModelConfig;
  /** A2 Judge Agent - GPT-4 by default (LLM-as-judge) */
  a2Judge: AgentModelConfig;
  /** A3 Comparator Agent - Gemini 2.5 Flash by default */
  a3Comparator: AgentModelConfig;
  /** A4 Web Best Practices Agent - Gemini 2.5 Flash by default */
  a4Web: AgentModelConfig;
  /** A4 Company Docs Agent - Gemini 2.5 Flash by default */
  a4Company: AgentModelConfig;
  /** A5 Feature Adoption Agent - Gemini 2.5 Flash by default */
  a5FeatureAdoption: AgentModelConfig;
}

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_CONFIG: InsightModelConfiguration = {
  a1Retrieval: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8000,
  },
  a2Judge: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.1, // Lower temperature for consistent judgments
    maxTokens: 4000,
  },
  a3Comparator: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8000,
  },
  a4Web: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8000,
  },
  a4Company: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8000,
  },
  a5FeatureAdoption: {
    provider: 'google',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 8000,
  },
};

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request options for insight generation
 */
export interface InsightGenerationOptions {
  nodeId?: string;
  lookbackDays?: number;
  includeWebSearch?: boolean;
  includePeerComparison?: boolean;
  includeCompanyDocs?: boolean;
  /** Filter Slack/communication apps from evidence (default: true) */
  filterNoise?: boolean;
  maxOptimizationBlocks?: number;
  /** Custom model configuration (uses defaults if not provided) */
  modelConfig?: Partial<InsightModelConfiguration>;
}

/**
 * Semantic step within an attached workflow
 */
export interface AttachedSemanticStep {
  step_name: string;
  description: string;
  duration_seconds: number;
  tools_involved: string[];
}

/**
 * Workflow within an attached session
 */
export interface AttachedWorkflow {
  workflow_summary: string;
  semantic_steps: AttachedSemanticStep[];
  classification?: {
    level_1_intent: string;
    level_4_tools: string[];
  };
  timestamps?: { duration_ms: number };
}

/**
 * User-attached session context for analysis
 * Contains full workflow/step data from user-selected sessions via @mention
 * When provided, A1 will skip NLQ retrieval and use this directly as userEvidence
 */
export interface AttachedSessionContext {
  sessionId: string;
  title: string;
  highLevelSummary?: string;
  workflows: AttachedWorkflow[];
  totalDurationSeconds: number;
  appsUsed: string[];
}

/**
 * Request to generate insights
 */
export interface GenerateInsightsRequest {
  query: string;
  /** User-attached sessions for analysis (bypasses NLQ retrieval in A1) */
  sessionContext?: AttachedSessionContext[];
  options?: InsightGenerationOptions;
}

// ============================================================================
// CONVERSATION MEMORY TYPES
// ============================================================================

/**
 * Conversation memory entry for follow-up question context
 */
export interface ConversationMemory {
  id: string;
  /** The memory content (Q&A summary) */
  content: string;
  /** User ID associated with this memory */
  userId: number;
  /** Relevance score from memory search (0-1) */
  relevanceScore?: number;
  /** When the memory was created */
  createdAt: string;
  /** Key topics extracted from the conversation */
  topics?: string[];
  /** The original query that produced this memory */
  originalQuery?: string;
  /** Session IDs that were part of the context */
  sessionIds?: string[];
}

/**
 * Retrieved conversation memories for a query
 */
export interface RetrievedMemories {
  /** Relevant memories from previous conversations */
  memories: ConversationMemory[];
  /** Total number of memories found */
  totalFound: number;
  /** Time taken to retrieve memories (ms) */
  retrievalTimeMs: number;
  /** Formatted context string for LLM consumption */
  formattedContext: string;
}

/**
 * Response from starting insight generation
 */
export interface GenerateInsightsResponse {
  jobId: string;
  status: JobStatus;
  estimatedDurationMs?: number;
}
