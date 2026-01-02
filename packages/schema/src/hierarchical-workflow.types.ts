/**
 * Hierarchical Workflow Types
 *
 * TypeScript interfaces for the 3-level hierarchical workflow abstraction:
 * - Level 1: WorkflowPattern (intent-driven sequences across sessions)
 * - Level 2: Block (tool-level execution units)
 * - Level 3: Step (fine-grained UI actions)
 *
 * These types map to ArangoDB nodes and edges for Graph RAG.
 */

import type {
  WorkflowIntent,
  BlockIntent,
  StepActionType,
  ToolCategory,
  EdgeStrength,
  ExtractionMethod,
  CanonicalizationMethod,
} from './hierarchical-workflow.enums.js';
import type { WorkflowTagType } from './api/workflow-analysis.schemas.js';

// ============================================================================
// LEVEL 1: WORKFLOW PATTERN TYPES
// ============================================================================

/**
 * WorkflowPattern node in ArangoDB
 * Represents a high-level, intent-driven sequence inferred across sessions
 */
export interface WorkflowPatternNode {
  /** ArangoDB document key: "wp_<hash>" */
  _key: string;
  /** ArangoDB document ID: "workflow_patterns/wp_<hash>" */
  _id: string;
  /** Node type identifier */
  type: 'workflow_pattern';

  // Intent & Identity
  /** Human-readable name: "AI-Assisted Code Development" */
  canonicalName: string;
  /** Primary intent category */
  intentCategory: WorkflowIntent;
  /** LLM-generated summary of the workflow */
  description: string;

  // Frequency & Confidence
  /** Times this pattern has occurred */
  occurrenceCount: number;
  /** Unique sessions containing this pattern */
  sessionCount: number;
  /** Unique users (for multi-tenant analytics) */
  userCount: number;
  /** Pattern confidence score (0.0-1.0) */
  confidence: number;

  // Temporal
  /** When pattern was first observed */
  firstSeenAt: string;
  /** When pattern was last observed */
  lastSeenAt: string;
  /** Average duration in seconds */
  avgDurationSeconds: number;

  // Generalization
  /** True if pattern generalizes across tool variants */
  toolAgnostic: boolean;
  /** Tool variants where pattern was observed */
  toolVariants: string[];

  // Metadata
  /** Owner user ID (null for global patterns) */
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// LEVEL 2: BLOCK TYPES
// ============================================================================

/**
 * Block node in ArangoDB
 * Represents a tool-level, meaningful execution unit
 */
export interface BlockNode {
  /** ArangoDB document key: "blk_<hash>" */
  _key: string;
  /** ArangoDB document ID: "blocks/blk_<hash>" */
  _id: string;
  /** Node type identifier */
  type: 'block';

  // Identity
  /** Human-readable canonical name: "AI Code Prompting" */
  canonicalName: string;
  /** URL-safe slug for deduplication: "ai-code-prompting" */
  canonicalSlug: string;
  /** Block intent category */
  intentLabel: BlockIntent;

  // Tool Association
  /** Primary tool: "cursor" */
  primaryTool: string;
  /** All tool variants where this block was observed */
  toolVariants: string[];

  // Aggregated Metrics
  /** Times this block has occurred across all patterns */
  occurrenceCount: number;
  /** Average duration in seconds */
  avgDurationSeconds: number;
  /** Typical number of steps within this block */
  avgStepCount: number;
  /** Extraction confidence (0.0-1.0) */
  confidence: number;

  // Semantic
  /** 1536-dim embedding for similarity matching (null if not computed) */
  embedding: number[] | null;
  /** Workflow tags from the 16 categories */
  workflowTags: WorkflowTagType[];

  // Evidence
  /** Screenshot IDs that best represent this block */
  representativeScreenshotIds: number[];

  // Metadata
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extracted block before canonicalization
 */
export interface RawExtractedBlock {
  /** Suggested name from LLM extraction */
  suggestedName: string;
  /** Inferred intent */
  intentLabel: BlockIntent;
  /** Confidence of extraction */
  confidence: number;
  /** Primary app/tool */
  primaryTool: string;
  /** Screenshots in this block */
  screenshots: Array<{
    id: number;
    summary: string;
    timestamp: string;
    appName: string;
  }>;
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Duration in seconds */
  durationSeconds: number;
  /** LLM reasoning for extraction */
  reasoning?: string;
}

/**
 * Block after canonicalization
 */
export interface CanonicalizedBlock extends RawExtractedBlock {
  /** Canonical name after normalization */
  canonicalName: string;
  /** URL-safe slug */
  canonicalSlug: string;
  /** How the name was canonicalized */
  canonicalizationMethod: CanonicalizationMethod;
  /** If matched to existing block, its key */
  matchedBlockId?: string;
}

// ============================================================================
// LEVEL 3: STEP TYPES
// ============================================================================

/**
 * Step node in ArangoDB
 * Represents a fine-grained UI action within a Block
 */
export interface StepNode {
  /** ArangoDB document key: "stp_<uuid>" */
  _key: string;
  /** ArangoDB document ID: "steps/stp_<uuid>" */
  _id: string;
  /** Node type identifier */
  type: 'step';

  // Identity
  /** Type of action performed */
  actionType: StepActionType;
  /** Human-readable description */
  description: string;

  // Granular Detail
  /** Actual text entered (if applicable) */
  rawInput: string | null;
  /** UI element interacted with */
  targetElement: string | null;
  /** App context: "cursor.editor.chat" */
  appContext: string;

  // Temporal
  /** When the action occurred */
  timestamp: string;
  /** Time spent on this step (milliseconds) */
  durationMs: number | null;
  /** 0-indexed position within block */
  orderInBlock: number;

  // Evidence
  /** Reference to workflow_screenshots table */
  screenshotId: number | null;

  // Confidence
  /** Extraction confidence (0.0-1.0) */
  confidence: number;
  /** How the step was extracted */
  extractionMethod: ExtractionMethod;

  // Metadata
  /** Source session ID */
  sessionId: string;
  createdAt: string;
}

/**
 * Raw step extracted from screenshots
 */
export interface RawExtractedStep {
  actionType: StepActionType;
  description: string;
  rawInput?: string;
  targetElement?: string;
  confidence: number;
  /** 1-indexed screenshot reference */
  screenshotIndex: number;
}

// ============================================================================
// TOOL NODE TYPES
// ============================================================================

/**
 * Tool node in ArangoDB
 * Represents a specific application/tool
 */
export interface ToolNode {
  /** ArangoDB document key: "tool_<name>" */
  _key: string;
  /** ArangoDB document ID: "tools/tool_<name>" */
  _id: string;
  /** Node type identifier */
  type: 'tool';

  /** Canonical display name: "Cursor" */
  canonicalName: string;
  /** Tool category */
  category: ToolCategory;
  /** Known aliases: ["cursor.app", "Cursor IDE"] */
  aliases: string[];

  // Metrics
  /** Total usage count across all users */
  usageCount: number;
  /** Unique users who have used this tool */
  uniqueUserCount: number;
}

// ============================================================================
// EDGE TYPES
// ============================================================================

/**
 * Edge: Pattern contains Block
 * workflow_patterns -> blocks
 */
export interface PatternContainsBlockEdge {
  _from: string;
  _to: string;
  type: 'PATTERN_CONTAINS_BLOCK';

  /** 0-indexed position in pattern sequence */
  orderInPattern: number;
  /** How often this block appears in this pattern */
  frequency: number;
  /** True if block is sometimes skipped */
  isOptional: boolean;
  /** Average duration at this position */
  avgDurationAtPosition: number;
}

/**
 * Edge: Block follows Block
 * blocks -> blocks
 */
export interface NextBlockEdge {
  _from: string;
  _to: string;
  type: 'NEXT_BLOCK';

  /** Transition count */
  frequency: number;
  /** Transition probability (0.0-1.0) */
  probability: number;
  /** Average time gap between blocks (seconds) */
  avgGapSeconds: number;

  // Context
  /** Pattern IDs where this transition occurs */
  patternIds: string[];
  /** Sessions with this transition */
  sessionCount: number;

  // Visualization
  /** Edge strength based on probability */
  strength: EdgeStrength;
}

/**
 * Edge: Block contains Step
 * blocks -> steps
 */
export interface BlockContainsStepEdge {
  _from: string;
  _to: string;
  type: 'BLOCK_CONTAINS_STEP';

  /** 0-indexed position within block */
  orderInBlock: number;
  /** True if this is a defining step for the block */
  isCanonical: boolean;
}

/**
 * Edge: Step follows Step
 * steps -> steps
 */
export interface NextStepEdge {
  _from: string;
  _to: string;
  type: 'NEXT_STEP';

  /** Milliseconds between steps */
  gapMs: number;
  /** True if both steps are in the same block */
  withinBlock: boolean;
}

/**
 * Edge: Block uses Tool
 * blocks -> tools
 */
export interface BlockUsesToolEdge {
  _from: string;
  _to: string;
  type: 'BLOCK_USES_TOOL';

  /** True if this is the primary tool for the block */
  isPrimary: boolean;
  /** Usage count */
  frequency: number;
}

/**
 * Edge: Block relates to Concept
 * blocks -> concepts
 */
export interface BlockRelatesConceptEdge {
  _from: string;
  _to: string;
  type: 'BLOCK_RELATES_CONCEPT';

  /** How relevant the concept is (0.0-1.0) */
  relevanceScore: number;
  /** Extraction confidence */
  extractionConfidence: number;
}

/**
 * Edge: Pattern occurs in Session
 * workflow_patterns -> sessions
 */
export interface PatternOccursInSessionEdge {
  _from: string;
  _to: string;
  type: 'PATTERN_OCCURS_IN_SESSION';

  /** If pattern occurs multiple times in session */
  occurrenceIndex: number;
  startTimestamp: string;
  endTimestamp: string;
  confidence: number;
}

/**
 * Edge: Step evidenced by Screenshot
 * steps -> external (PostgreSQL reference)
 */
export interface StepEvidencedByEdge {
  _from: string;
  _to: string;
  type: 'STEP_EVIDENCED_BY';

  /** FK to workflow_screenshots table */
  screenshotId: number;
  /** If we can localize the action in the screenshot */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  confidence: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Top Workflow response (Level 1 + Level 2)
 */
export interface TopWorkflowResponse {
  workflows: EnrichedWorkflowPattern[];
  metadata: {
    totalPatterns: number;
    queryParams: TopWorkflowsQueryParams;
    generatedAt: string;
  };
}

/**
 * Query parameters for top workflows
 */
export interface TopWorkflowsQueryParams {
  userId?: string;
  nodeId?: string;
  limit: number;
  minOccurrences: number;
  minConfidence: number;
  intentFilter?: WorkflowIntent[];
  toolFilter?: string[];
  includeGlobal: boolean;
}

/**
 * Enriched workflow pattern with blocks, tools, and concepts
 */
export interface EnrichedWorkflowPattern extends WorkflowPatternNode {
  /** API-friendly ID (maps to _key) */
  id: string;
  /** Blocks in this pattern */
  blocks: EnrichedBlock[];
  /** Connections between blocks */
  blockConnections: BlockConnection[];
  /** Tools used in this pattern */
  tools: PatternTool[];
  /** Concepts related to this pattern */
  concepts: PatternConcept[];
  /** Recent sessions where pattern occurred */
  recentSessions: PatternSession[];
}

/**
 * Block with enriched metadata for API response
 */
export interface EnrichedBlock {
  id: string;
  order: number;
  canonicalName: string;
  intent: BlockIntent;
  primaryTool: string;
  toolVariants: string[];
  avgDurationSeconds: number;
  occurrenceCount: number;
  confidence: number;
  workflowTags: WorkflowTagType[];
}

/**
 * Connection between blocks for visualization
 */
export interface BlockConnection {
  from: string;
  to: string;
  frequency: number;
  probability: number;
  strength: EdgeStrength;
}

/**
 * Tool used in a pattern
 */
export interface PatternTool {
  name: string;
  category: ToolCategory;
  usageCount: number;
}

/**
 * Concept related to a pattern
 */
export interface PatternConcept {
  name: string;
  category: string;
  relevance: number;
}

/**
 * Session where pattern occurred
 */
export interface PatternSession {
  id: string;
  date: string;
  nodeTitle?: string;
}

/**
 * Block drill-down response (Level 3)
 */
export interface BlockDrilldownResponse {
  block: {
    id: string;
    canonicalName: string;
    intent: BlockIntent;
    tool: string;
    duration: number;
    confidence: number;
  };
  steps: StepDetail[];
  metadata: {
    totalSteps: number;
    extractionMethod: ExtractionMethod;
    lastExtracted: string;
  };
}

/**
 * Step detail for drill-down response
 */
export interface StepDetail {
  id: string;
  order: number;
  actionType: StepActionType;
  description: string;
  rawInput: string | null;
  timestamp: string;
  confidence: number;
  screenshot: {
    id: number;
    thumbnailUrl: string;
    appName: string;
  } | null;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

/**
 * Configuration for block extraction
 */
export interface BlockExtractionConfig {
  /** Maximum gap between screenshots to be same block (seconds) */
  maxGapSeconds: number;
  /** Minimum screenshots to form a block */
  minScreenshotsPerBlock: number;
  /** Minimum block duration (seconds) */
  minBlockDurationSeconds: number;
}

/**
 * Configuration for block merging
 */
export interface BlockMergingConfig {
  /** Don't create blocks shorter than this (seconds) */
  minBlockDurationSeconds: number;
  /** Merge blocks closer than this (seconds) */
  maxGapForMergeSeconds: number;
  /** Need at least N screenshots per block */
  minScreenshotsPerBlock: number;
  /** Merge if embedding similarity exceeds this */
  semanticSimilarityThreshold: number;
}

/**
 * Confidence factors for scoring
 */
export interface ConfidenceFactors {
  extractionSource: ExtractionMethod;
  screenshotQuality: number;
  temporalConsistency: number;
  toolRecognition: number;
  semanticCoherence: number;
}

/**
 * Tool mapping for generalization
 */
export interface ToolMapping {
  /** Canonical name for the tool category */
  canonical: string;
  /** Category of the tool */
  category: ToolCategory;
  /** Specific tool names that map to this canonical */
  variants: string[];
  /** Regex patterns to match tool names */
  patterns: RegExp[];
}

/**
 * Canonicalized tool result
 */
export interface CanonicalizedTool {
  /** Canonical category name */
  canonical: string;
  /** Original specific tool name */
  specific: string;
  /** Tool category */
  category: ToolCategory;
  /** All known variants */
  variants: string[];
}

/**
 * Block sequence for pattern matching
 */
export interface BlockSequence {
  blocks: Array<{
    id: string;
    name: string;
    intent: BlockIntent;
    tool: string;
  }>;
  frequency: number;
  confidence: number;
}
