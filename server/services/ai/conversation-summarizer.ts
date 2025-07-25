import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { PgVector } from '@mastra/pg';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { createCareerMemory } from './memory-manager';

// Schema for conversation summary
export const ConversationSummarySchema = z.object({
  threadId: z.string(),
  userId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  messageCount: z.number(),
  summary: z.object({
    keyTopics: z.array(z.string()),
    decisions: z.array(z.string()),
    actionItems: z.array(z.string()),
    milestones: z.array(z.string()),
    challenges: z.array(z.string()),
    achievements: z.array(z.string()),
    nextSteps: z.array(z.string()),
  }),
  rawSummary: z.string(),
  extractedInsights: z.array(z.object({
    type: z.enum(['milestone', 'goal', 'challenge', 'decision', 'skill']),
    content: z.string(),
    confidence: z.number(),
  })),
});

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export class ConversationSummarizer {
  private agent: Agent;
  private vectorStore: PgVector | null = null;
  private embeddingModel: any;

  constructor() {
    this.embeddingModel = openai.embedding('text-embedding-3-small');

    // Skip vector store initialization in development to avoid connection issues
      try {
        this.vectorStore = new PgVector({
          connectionString: process.env.DATABASE_URL!,
          schemaName: 'mastra_ai',
          pgPoolOptions: {
            max: 10, // Connection pool size
            idleTimeoutMillis: 30000, // 30 seconds idle timeout
            connectionTimeoutMillis: 5000, // 2 seconds connection timeout
          },
        });
      } catch (error) {
        console.log('ConversationSummarizer vector store initialization failed:', error instanceof Error ? error.message : error);
      }

    this.agent = new Agent({
      name: 'Conversation Summarizer',
      instructions: `You are a conversation summarizer for career guidance sessions. Your job is to:

1. Extract key insights from career conversations
2. Identify important milestones, decisions, and achievements
3. Note challenges and areas for growth
4. Summarize action items and next steps
5. Maintain professional context for future conversations

Focus on actionable insights that would be valuable for future career guidance sessions.`,
      model: openai('gpt-4o-mini'),
    });
  }

  // Ensure the main index exists - call this before any operations
  private async ensureIndexExists() {
    if (!this.vectorStore) {
      return;
    }

    const indexName = 'user_entities';
    try {
      await this.vectorStore.createIndex({
        indexName,
        dimension: 1536, // text-embedding-3-small dimension
        metric: 'cosine'
      });
      console.log(`✅ Index ${indexName} created/verified by ConversationSummarizer`);
    } catch (error) {
      // Index might already exist, continue
      console.log('Index already exists or creation failed:', error instanceof Error ? error.message : error);
    }
  }

  // Summarize and archive a thread
  async summarizeAndArchiveThread(threadId: string, userId: string): Promise<ConversationSummary> {
    try {
      console.log(`📄 Summarizing thread ${threadId} for user ${userId}`);

      // 1. Get thread messages from Mastra
      const messages = await this.getThreadMessages(threadId);

      if (messages.length === 0) {
        throw new Error(`No messages found for thread ${threadId}`);
      }

      // 2. Generate summary
      const summary = await this.generateSummary(messages, threadId, userId);

      // 3. Store summary as vector for future retrieval
      await this.storeSummaryVector(summary);

      // 4. Archive original messages (optional - depending on storage strategy)
      await this.archiveMessages(threadId, messages);

      console.log(`✅ Thread ${threadId} summarized and archived`);
      return summary;

    } catch (error) {
      console.error(`❌ Failed to summarize thread ${threadId}:`, error);
      throw error;
    }
  }

  // Get messages from Mastra thread
  private async getThreadMessages(threadId: string): Promise<any[]> {
    try {
      const { memory } = await createCareerMemory();

      // Use Mastra's memory system to get thread messages
      const result = await memory.query({
        threadId,
        selectBy: {
          last: 1000, // Get all messages in thread
        },
      });

      const messages = result.messages;

      return messages || [];
    } catch (error) {
      console.error(`Failed to get messages for thread ${threadId}:`, error);
      return [];
    }
  }

  // Generate AI summary of conversation
  private async generateSummary(messages: any[], threadId: string, userId: string): Promise<ConversationSummary> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `Summarize this career guidance conversation:

${conversationText}

Extract the following information:
1. Key topics discussed
2. Important decisions made
3. Action items identified
4. Milestones or achievements mentioned
5. Challenges discussed
6. Next steps planned

Provide a comprehensive but concise summary that would help in future conversations.`;

    const response = await this.agent.generate(prompt, {
      output: z.object({
        keyTopics: z.array(z.string()),
        decisions: z.array(z.string()),
        actionItems: z.array(z.string()),
        milestones: z.array(z.string()),
        challenges: z.array(z.string()),
        achievements: z.array(z.string()),
        nextSteps: z.array(z.string()),
        rawSummary: z.string(),
        extractedInsights: z.array(z.object({
          type: z.enum(['milestone', 'goal', 'challenge', 'decision', 'skill']),
          content: z.string(),
          confidence: z.number(),
        })),
      }),
    });

    const summary: ConversationSummary = {
      threadId,
      userId,
      startTime: new Date(messages[0]?.createdAt || Date.now()),
      endTime: new Date(messages[messages.length - 1]?.createdAt || Date.now()),
      messageCount: messages.length,
      summary: {
        keyTopics: response.object?.keyTopics || [],
        decisions: response.object?.decisions || [],
        actionItems: response.object?.actionItems || [],
        milestones: response.object?.milestones || [],
        challenges: response.object?.challenges || [],
        achievements: response.object?.achievements || [],
        nextSteps: response.object?.nextSteps || [],
      },
      rawSummary: response.object?.rawSummary || 'Summary generation failed',
      extractedInsights: response.object?.extractedInsights || [],
    };

    return summary;
  }

  // Store summary as vector for semantic search
  private async storeSummaryVector(summary: ConversationSummary): Promise<void> {
    if (!this.vectorStore) {
      console.log('Vector store not available, skipping summary vector storage');
      return;
    }

    try {
      // Ensure index exists first
      await this.ensureIndexExists();

      // Create searchable text from summary
      const searchableText = [
        summary.rawSummary,
        ...summary.summary.keyTopics,
        ...summary.summary.decisions,
        ...summary.summary.actionItems,
        ...summary.summary.milestones,
        ...summary.summary.challenges,
        ...summary.summary.achievements,
        ...summary.summary.nextSteps,
        ...summary.extractedInsights.map(insight => insight.content),
      ].join(' ');

      // Generate embedding using AI SDK
      const { embedding } = await embed({
        model: this.embeddingModel,
        value: searchableText,
      });

      // Store in vector database - use unified index
      // Index creation will be handled by ProfileVectorManager, no need to duplicate

      // Store using upsert method - now using unified index
      await this.vectorStore.upsert({
        indexName: 'user_entities', // Use same unified index
        vectors: [embedding],
        metadata: [{
          entityType: 'conversation_summary',
          threadId: summary.threadId,
          userId: summary.userId,
          startTime: summary.startTime.toISOString(),
          endTime: summary.endTime.toISOString(),
          messageCount: summary.messageCount,
          summary: summary.summary,
          extractedInsights: summary.extractedInsights,
          searchableText,
        }],
        ids: [`summary_${summary.threadId}`],
      });

      console.log(`✅ Stored summary vector for thread ${summary.threadId}`);
    } catch (error) {
      console.error(`❌ Failed to store summary vector:`, error);
      throw error;
    }
  }

  // Archive original messages (move to cold storage)
  private async archiveMessages(threadId: string, messages: any[]): Promise<void> {
    try {
      // For now, we'll just log this
      // In a real implementation, you might:
      // 1. Move messages to a separate archive table
      // 2. Compress the messages
      // 3. Store in cheaper storage (S3, etc.)
      console.log(`📦 Archived ${messages.length} messages for thread ${threadId}`);
    } catch (error) {
      console.error(`❌ Failed to archive messages for thread ${threadId}:`, error);
    }
  }

  // Search conversation summaries
  async searchConversationHistory(userId: string, query: string, limit: number = 5): Promise<any[]> {
    if (!this.vectorStore) {
      console.log('Vector store not available, returning empty conversation history');
      return [];
    }

    try {
      // Ensure index exists first
      await this.ensureIndexExists();

      // Generate query embedding using AI SDK
      const { embedding: queryEmbedding } = await embed({
        model: this.embeddingModel,
        value: query,
      });

      // Search summaries using unified index
      const results = await this.vectorStore.query({
        indexName: 'user_entities',
        queryVector: queryEmbedding,
        topK: limit,
        minScore: 0.7,
        filter: {
          entityType: 'conversation_summary',
          userId,
        },
      });

      return results.map(result => ({
        threadId: result.metadata.threadId,
        similarity: result.score,
        summary: result.metadata.summary,
        extractedInsights: result.metadata.extractedInsights,
        startTime: result.metadata.startTime,
        endTime: result.metadata.endTime,
        messageCount: result.metadata.messageCount,
      }));
    } catch (error) {
      console.error('❌ Failed to search conversation history:', error);
      return [];
    }
  }

  // Get recent conversation summaries for context
  async getRecentSummaries(userId: string, limit: number = 3): Promise<any[]> {
    return await this.searchConversationHistory(userId, 'recent career conversation discussion', limit);
  }
}
