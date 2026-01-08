/**
 * Progress Snapshot API Schemas
 *
 * Zod schemas for LLM-generated progress snapshots.
 * Designed for outcome-oriented summaries suitable for status updates.
 */

import { z } from 'zod';

// ============================================================================
// PROGRESS SNAPSHOT LLM RESPONSE SCHEMAS
// ============================================================================

/**
 * Session input for progress snapshot generation
 */
export const progressSnapshotSessionInputSchema = z.object({
  sessionId: z.string(),
  generatedTitle: z.string().nullable(),
  highLevelSummary: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  startedAt: z.string().datetime().nullable(),
});

export type ProgressSnapshotSessionInput = z.infer<typeof progressSnapshotSessionInputSchema>;

/**
 * Theme in a progress snapshot
 * Represents a workstream/focus area with outcome-oriented content
 */
export const progressSnapshotThemeSchema = z.object({
  /** Theme name (2-5 words) */
  name: z.string().max(50),
  /** One sentence outcome summary */
  outcome: z.string().max(200),
  /** Key work accomplished (1-3 bullets) */
  keyWork: z.array(z.string()).max(3),
  /** Blockers/risks encountered (0-2 bullets) */
  blockers: z.array(z.string()).max(2),
  /** Next steps (0-2 bullets) */
  next: z.array(z.string()).max(2),
  /** Session IDs that support this theme */
  sessionIds: z.array(z.string()),
  /** Total time spent on this theme in seconds */
  timeSeconds: z.number(),
});

export type ProgressSnapshotTheme = z.infer<typeof progressSnapshotThemeSchema>;

/**
 * Metrics summary for the snapshot
 */
export const progressSnapshotMetricsSchema = z.object({
  sessionCount: z.number(),
  timeSeconds: z.number(),
  focusAreaCount: z.number(),
});

export type ProgressSnapshotMetrics = z.infer<typeof progressSnapshotMetricsSchema>;

/**
 * Complete progress snapshot response from LLM
 * This is the structured output format for the snapshot generation
 */
export const progressSnapshotLLMResponseSchema = z.object({
  /** Time range label (e.g., "Last 7 days") */
  rangeLabel: z.string(),
  /** Journey/project name */
  journeyName: z.string(),
  /** Aggregated metrics */
  metrics: progressSnapshotMetricsSchema,
  /** Top 1-3 outcome-oriented headlines */
  headlines: z.array(z.string()).max(3),
  /** Top 1-3 work themes/workstreams */
  themes: z.array(progressSnapshotThemeSchema).max(3),
  /** Items needing input/decision (0-3 bullets) */
  needsInput: z.array(z.string()).max(3),
});

export type ProgressSnapshotLLMResponse = z.infer<typeof progressSnapshotLLMResponseSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request schema for generating a progress snapshot
 */
export const generateProgressSnapshotRequestSchema = z.object({
  /** Node ID to generate snapshot for */
  nodeId: z.string().uuid(),
  /** Time range label (e.g., "Last 7 days", "Last 14 days") */
  rangeLabel: z.string(),
  /** Journey/project name */
  journeyName: z.string(),
  /** Number of days to include */
  days: z.number().positive().max(28),
});

export type GenerateProgressSnapshotRequest = z.infer<typeof generateProgressSnapshotRequestSchema>;

/**
 * Response schema for progress snapshot generation
 */
export const generateProgressSnapshotResponseSchema = z.object({
  success: z.boolean(),
  data: progressSnapshotLLMResponseSchema.nullable(),
  /** Error message if generation failed */
  message: z.string().optional(),
  /** Whether fallback to client-side clustering should be used */
  useFallback: z.boolean().optional(),
});

export type GenerateProgressSnapshotResponse = z.infer<typeof generateProgressSnapshotResponseSchema>;


