/**
 * Hierarchical Workflow API Schemas
 *
 * Zod schemas for validating API requests and responses for the
 * 3-level hierarchical workflow system.
 */

import { z } from 'zod';

import {
  WorkflowIntent,
  BlockIntent,
  StepActionType,
  ToolCategory,
  EdgeStrength,
  ExtractionMethod,
} from '../hierarchical-workflow.enums.js';
import { workflowTagSchema } from './workflow-analysis.schemas.js';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const workflowIntentSchema = z.nativeEnum(WorkflowIntent);
export const blockIntentSchema = z.nativeEnum(BlockIntent);
export const stepActionTypeSchema = z.nativeEnum(StepActionType);
export const toolCategorySchema = z.nativeEnum(ToolCategory);
export const edgeStrengthSchema = z.nativeEnum(EdgeStrength);
export const extractionMethodSchema = z.nativeEnum(ExtractionMethod);

// ============================================================================
// BLOCK SCHEMAS
// ============================================================================

/**
 * Enriched block for API responses
 */
export const enrichedBlockSchema = z.object({
  id: z.string(),
  order: z.number(),
  canonicalName: z.string(),
  intent: blockIntentSchema,
  primaryTool: z.string(),
  toolVariants: z.array(z.string()),
  avgDurationSeconds: z.number(),
  occurrenceCount: z.number(),
  confidence: z.number().min(0).max(1),
  workflowTags: z.array(workflowTagSchema),
});

export type EnrichedBlockSchema = z.infer<typeof enrichedBlockSchema>;

/**
 * Block connection for flow visualization
 */
export const blockConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  frequency: z.number(),
  probability: z.number().min(0).max(1),
  strength: edgeStrengthSchema,
});

export type BlockConnectionSchema = z.infer<typeof blockConnectionSchema>;

// ============================================================================
// STEP SCHEMAS
// ============================================================================

/**
 * Screenshot reference in step detail
 */
export const stepScreenshotSchema = z.object({
  id: z.number(),
  thumbnailUrl: z.string(),
  appName: z.string(),
});

/**
 * Step detail for drill-down responses
 */
export const stepDetailSchema = z.object({
  id: z.string(),
  order: z.number(),
  actionType: stepActionTypeSchema,
  description: z.string(),
  rawInput: z.string().nullable(),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  screenshot: stepScreenshotSchema.nullable(),
});

export type StepDetailSchema = z.infer<typeof stepDetailSchema>;

// ============================================================================
// WORKFLOW PATTERN SCHEMAS
// ============================================================================

/**
 * Tool used in a pattern
 */
export const patternToolSchema = z.object({
  name: z.string(),
  category: toolCategorySchema,
  usageCount: z.number(),
});

/**
 * Concept related to a pattern
 */
export const patternConceptSchema = z.object({
  name: z.string(),
  category: z.string(),
  relevance: z.number().min(0).max(1),
});

/**
 * Session where pattern occurred
 */
export const patternSessionSchema = z.object({
  id: z.string(),
  date: z.string().datetime(),
  nodeTitle: z.string().optional(),
});

/**
 * Complete enriched workflow pattern
 */
export const enrichedWorkflowPatternSchema = z.object({
  // Pattern identity
  id: z.string(),
  canonicalName: z.string(),
  intentCategory: workflowIntentSchema,
  description: z.string(),

  // Metrics
  occurrenceCount: z.number(),
  sessionCount: z.number(),
  confidence: z.number().min(0).max(1),
  avgDurationSeconds: z.number(),

  // Generalization
  toolAgnostic: z.boolean(),
  toolVariants: z.array(z.string()),

  // Temporal
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),

  // Nested data (Level 2)
  blocks: z.array(enrichedBlockSchema),
  blockConnections: z.array(blockConnectionSchema),

  // Enrichment
  tools: z.array(patternToolSchema),
  concepts: z.array(patternConceptSchema),
  recentSessions: z.array(patternSessionSchema),
});

export type EnrichedWorkflowPatternSchema = z.infer<typeof enrichedWorkflowPatternSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Request to get top hierarchical workflows
 */
export const getHierarchicalWorkflowsRequestSchema = z.object({
  userId: z.string().optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().positive().max(20).default(10),
  minOccurrences: z.coerce.number().positive().default(1),
  minConfidence: z.coerce.number().min(0).max(1).default(0.6),
  intentFilter: z.array(workflowIntentSchema).optional(),
  toolFilter: z.array(z.string()).optional(),
  includeGlobal: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(false)
  ),
});

export type GetHierarchicalWorkflowsRequest = z.infer<typeof getHierarchicalWorkflowsRequestSchema>;

/**
 * Request to drill down into a block's steps
 */
export const getBlockStepsRequestSchema = z.object({
  blockId: z.string(),
  extractIfMissing: z.boolean().default(true),
});

export type GetBlockStepsRequest = z.infer<typeof getBlockStepsRequestSchema>;

/**
 * Request to extract blocks from a session
 */
export const extractBlocksRequestSchema = z.object({
  sessionId: z.string(),
  nodeId: z.string().uuid(),
  forceReextract: z.boolean().default(false),
});

export type ExtractBlocksRequest = z.infer<typeof extractBlocksRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Response for top hierarchical workflows
 */
export const getHierarchicalWorkflowsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    workflows: z.array(enrichedWorkflowPatternSchema),
    metadata: z.object({
      totalPatterns: z.number(),
      queryParams: z.object({
        userId: z.string().optional(),
        nodeId: z.string().optional(),
        limit: z.number(),
        minOccurrences: z.number(),
        minConfidence: z.number(),
        intentFilter: z.array(workflowIntentSchema).optional(),
        toolFilter: z.array(z.string()).optional(),
        includeGlobal: z.boolean(),
      }),
      generatedAt: z.string().datetime(),
    }),
  }).nullable(),
  message: z.string().optional(),
});

export type GetHierarchicalWorkflowsResponse = z.infer<typeof getHierarchicalWorkflowsResponseSchema>;

/**
 * Response for block drill-down (steps)
 */
export const getBlockStepsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    block: z.object({
      id: z.string(),
      canonicalName: z.string(),
      intent: blockIntentSchema,
      tool: z.string(),
      duration: z.number(),
      confidence: z.number().min(0).max(1),
    }),
    steps: z.array(stepDetailSchema),
    metadata: z.object({
      totalSteps: z.number(),
      extractionMethod: extractionMethodSchema,
      lastExtracted: z.string().datetime(),
    }),
  }).nullable(),
  message: z.string().optional(),
});

export type GetBlockStepsResponse = z.infer<typeof getBlockStepsResponseSchema>;

/**
 * Response for block extraction
 */
export const extractBlocksResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    sessionId: z.string(),
    blocksExtracted: z.number(),
    blocks: z.array(z.object({
      id: z.string(),
      canonicalName: z.string(),
      intent: blockIntentSchema,
      tool: z.string(),
      screenshotCount: z.number(),
      durationSeconds: z.number(),
      confidence: z.number().min(0).max(1),
    })),
  }).nullable(),
  message: z.string().optional(),
});

export type ExtractBlocksResponse = z.infer<typeof extractBlocksResponseSchema>;

/**
 * Response for single workflow pattern detail
 */
export const getWorkflowPatternResponseSchema = z.object({
  success: z.boolean(),
  data: enrichedWorkflowPatternSchema.nullable(),
  message: z.string().optional(),
});

export type GetWorkflowPatternResponse = z.infer<typeof getWorkflowPatternResponseSchema>;

/**
 * Response for block transitions
 */
export const getBlockTransitionsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    blockSlug: z.string(),
    outgoing: z.array(z.object({
      toBlock: z.string(),
      frequency: z.number(),
      probability: z.number().min(0).max(1),
      strength: edgeStrengthSchema,
    })),
    incoming: z.array(z.object({
      fromBlock: z.string(),
      frequency: z.number(),
      probability: z.number().min(0).max(1),
      strength: edgeStrengthSchema,
    })),
  }).nullable(),
  message: z.string().optional(),
});

export type GetBlockTransitionsResponse = z.infer<typeof getBlockTransitionsResponseSchema>;
