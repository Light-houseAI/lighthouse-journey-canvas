/**
 * Insight Assistant API Schemas
 *
 * Schemas for the Insight Assistant feature that provides AI-powered
 * strategy proposals and workflow optimization recommendations.
 */

import { z } from 'zod';

// ============================================================================
// STRATEGY PROPOSAL SCHEMAS
// ============================================================================

/**
 * Tags for strategy proposal metrics
 */
export const strategyProposalTagsSchema = z.object({
  costOptimization: z.number().min(0).max(100).optional(),
  efficiency: z.number().min(0).max(100).optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export type StrategyProposalTags = z.infer<typeof strategyProposalTagsSchema>;

/**
 * Retrieved source for proposal citations
 */
export const proposalSourceSchema = z.object({
  id: z.string(),
  type: z.enum(['session', 'screenshot', 'entity', 'concept', 'workflow_pattern']),
  title: z.string(),
  description: z.string().optional(),
  relevanceScore: z.number().min(0).max(1),
});

export type ProposalSource = z.infer<typeof proposalSourceSchema>;

/**
 * Strategy Proposal - AI-generated workflow optimization recommendation
 */
export const strategyProposalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  workflowCount: z.number().int().min(0),
  stepCount: z.number().int().min(0),
  tags: strategyProposalTagsSchema,
  isBookmarked: z.boolean().default(false),
  feedback: z.enum(['up', 'down']).nullable().default(null),
  sources: z.array(proposalSourceSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StrategyProposal = z.infer<typeof strategyProposalSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request to generate strategy proposals
 */
export const generateProposalsRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  nodeId: z.string().uuid().optional(),
  conversationContext: z.array(z.string()).max(10).optional(),
});

export type GenerateProposalsRequest = z.infer<typeof generateProposalsRequestSchema>;

/**
 * Response from strategy proposals generation
 */
export const generateProposalsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    proposals: z.array(strategyProposalSchema),
    queryId: z.string().uuid(),
  }),
});

export type GenerateProposalsResponse = z.infer<typeof generateProposalsResponseSchema>;

/**
 * Request to submit feedback for a proposal
 */
export const proposalFeedbackRequestSchema = z.object({
  feedback: z.enum(['up', 'down']).nullable().optional(),
  isBookmarked: z.boolean().optional(),
});

export type ProposalFeedbackRequest = z.infer<typeof proposalFeedbackRequestSchema>;

/**
 * Response from feedback submission
 */
export const proposalFeedbackResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    proposalId: z.string().uuid(),
    feedback: z.enum(['up', 'down']).nullable(),
    isBookmarked: z.boolean(),
  }),
});

export type ProposalFeedbackResponse = z.infer<typeof proposalFeedbackResponseSchema>;

/**
 * Request to get saved/bookmarked proposals
 */
export const getProposalsQuerySchema = z.object({
  bookmarkedOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type GetProposalsQuery = z.infer<typeof getProposalsQuerySchema>;

/**
 * Response from get proposals
 */
export const getProposalsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    proposals: z.array(strategyProposalSchema),
    total: z.number().int(),
    hasMore: z.boolean(),
  }),
});

export type GetProposalsResponse = z.infer<typeof getProposalsResponseSchema>;
