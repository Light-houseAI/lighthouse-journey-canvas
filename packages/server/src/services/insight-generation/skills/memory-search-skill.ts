/**
 * Memory Search Skill (wraps MemoryService)
 *
 * This skill searches previous conversations with the user to retrieve
 * relevant context for follow-up questions using Mem0.
 */

import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult, ConversationMemory, RetrievedMemories } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const memorySearchSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'search_conversation_memory',

  name: 'Search Conversation Memory',

  description: `This skill searches previous conversations with the user to retrieve relevant context for follow-up questions. It uses Mem0 for memory storage and retrieval.

The skill is essential for handling conversational queries where the user references past interactions, such as "Do you remember when...", "Earlier you mentioned...", or follow-up questions without full context.

This skill retrieves relevant Q&A pairs, topics, and session references from past conversations.`,

  whenToUse: [
    'User references past conversations ("remember when...", "earlier you mentioned...")',
    'User asks follow-up questions without full context',
    'Need to understand ongoing conversation threads',
    'User refers to previous recommendations or analysis',
    'Query contains temporal references to past interactions ("last time", "before")',
    'User asks "what did we discuss about..."',
    'User asks "what did you suggest for..."',
  ],

  capabilities: [
    'Searches Mem0 memory store by semantic similarity',
    'Retrieves relevant conversation Q&A pairs',
    'Extracts topics and session IDs from memories',
    'Formats context for LLM consumption',
    'Scores relevance of each retrieved memory',
    'Filters by user ID for personalization',
    'Can filter by node ID for scoped conversations',
  ],

  produces: ['conversationMemory'],

  requires: [], // No prerequisites - can be first skill for follow-up queries

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, memoryService } = deps;
    const startTime = Date.now();

    const searchQuery = input.query || state.query;

    logger.info('Memory Search Skill: Starting execution', {
      query: searchQuery,
      userId: state.userId,
      hasMemoryService: !!memoryService,
    });

    // Check prerequisites
    if (!memoryService) {
      return {
        success: false,
        observation: 'Memory search is not available: Memory service is not configured.',
        stateUpdates: {},
        error: 'MemoryService not configured',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Search memories
      const searchResult = await memoryService.searchMemories({
        query: searchQuery,
        userId: state.userId,
        limit: input.maxResults || 5,
        nodeId: state.nodeId ?? undefined,
      });

      const executionTimeMs = Date.now() - startTime;

      // Transform to our memory format
      const memories: ConversationMemory[] = searchResult.memories.map((m) => ({
        id: m.id,
        content: m.memory,
        userId: state.userId,
        relevanceScore: m.score,
        createdAt: m.createdAt,
        topics: m.metadata?.topics,
        originalQuery: m.metadata?.query,
        sessionIds: m.metadata?.sessionIds,
      }));

      // Format context for LLM
      const formattedContext = memoryService.formatMemoriesForContext(searchResult.memories);

      const retrievedMemories: RetrievedMemories = {
        memories,
        totalFound: searchResult.totalFound,
        retrievalTimeMs: executionTimeMs,
        formattedContext,
      };

      // Build observation
      const memoryCount = memories.length;
      let observation = `Found ${memoryCount} relevant memories from past conversations.`;

      if (memoryCount > 0) {
        const topTopics = memories
          .flatMap((m) => m.topics || [])
          .filter((t, i, arr) => arr.indexOf(t) === i)
          .slice(0, 3);

        if (topTopics.length > 0) {
          observation += ` Topics covered: ${topTopics.join(', ')}.`;
        }

        const avgRelevance = memories.reduce((sum, m) => sum + (m.relevanceScore || 0), 0) / memoryCount;
        observation += ` Average relevance score: ${(avgRelevance * 100).toFixed(0)}%.`;
      } else {
        observation = 'No relevant memories found from past conversations. This may be a new topic or the user hasn\'t discussed this before.';
      }

      logger.info('Memory Search Skill: Execution complete', {
        memoryCount,
        totalFound: searchResult.totalFound,
        executionTimeMs,
      });

      return {
        success: memoryCount > 0,
        observation,
        stateUpdates: {
          conversationMemory: retrievedMemories,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Memory Search Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to search conversation memory: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'MEMORY_SERVICE',
  canRunInParallel: true, // Can run in parallel with other skills
  estimatedExecutionMs: 1000, // Memory search is fast
};
