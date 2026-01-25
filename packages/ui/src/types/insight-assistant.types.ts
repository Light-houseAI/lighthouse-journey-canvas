/**
 * Insight Assistant Types
 *
 * Types for the Insight Assistant feature including Strategy Proposals
 */

import type { RetrievedSource } from '../services/workflow-api';
import type { InsightGenerationResult } from '../services/insight-assistant-api';

/**
 * Strategy Proposal - AI-generated workflow optimization recommendation
 */
export interface StrategyProposal {
  id: string;
  title: string;
  description: string;
  workflowCount: number;
  stepCount: number;
  tags: {
    costOptimization?: number; // percentage 0-100
    efficiency?: number; // percentage 0-100
    confidence?: number; // percentage 0-100
  };
  isBookmarked: boolean;
  feedback: 'up' | 'down' | null;
  sources?: RetrievedSource[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Message in the Insight Assistant chat
 */
export interface InsightMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  sources?: RetrievedSource[];
  confidence?: number;
  suggestedFollowUps?: string[];
  generatedProposals?: StrategyProposal[];
  /** Full insight generation result for rich interactive display */
  insightResult?: InsightGenerationResult;
}

/**
 * Stored message format for localStorage persistence
 */
export interface StoredInsightMessage {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: string;
  sources?: RetrievedSource[];
  confidence?: number;
  suggestedFollowUps?: string[];
  generatedProposals?: StrategyProposal[];
  /** Full insight generation result for rich interactive display */
  insightResult?: InsightGenerationResult;
}

/**
 * Chat session for Insight Assistant
 */
export interface InsightChatSession {
  id: string;
  title: string;
  messages: StoredInsightMessage[];
  proposals: StrategyProposal[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to generate strategy proposals
 */
export interface GenerateProposalsRequest {
  query: string;
  nodeId?: string;
  conversationContext?: string[];
}

/**
 * Response from strategy proposals generation
 */
export interface GenerateProposalsResponse {
  proposals: StrategyProposal[];
  queryId: string;
}

/**
 * Feedback request for a strategy proposal
 */
export interface ProposalFeedbackRequest {
  proposalId: string;
  feedback?: 'up' | 'down' | null;
  isBookmarked?: boolean;
}

/**
 * UI State for Insight Assistant
 */
export interface InsightAssistantUIState {
  isProposalsPanelOpen: boolean;
  selectedProposalId: string | null;
  inputValue: string;
  isTyping: boolean;
}
