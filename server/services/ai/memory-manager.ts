import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import Redis from 'ioredis';

// Initialize Redis client for working memory (optional, can use PG for everything)
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

// Singleton pattern to avoid duplicate connections
let memoryInstance: {
  memory: any;
  redis: any;
  storage: any;
  vectorStore: any;
} | null = null;

// Initialize memory with all storage layers
export async function createCareerMemory() {
  // Return existing instance if already created
  if (memoryInstance) {
    return memoryInstance;
  }

  let storage: any;
  let vectorStore: any;

  try {
    // Initialize PostgreSQL storage adapter with separate schema for Mastra
    storage = new PostgresStore({
      connectionString: process.env.DATABASE_URL!,
      schemaName: 'mastra_ai', // Isolate Mastra tables in separate schema
    });

    // Initialize PostgreSQL vector store with same schema and connection pooling
    vectorStore = new PgVector({
      connectionString: process.env.DATABASE_URL!,
      schemaName: 'mastra_ai', // Keep vector data in same schema
      pgPoolOptions: {
        max: 10, // Connection pool size
        idleTimeoutMillis: 30000, // 30 seconds idle timeout
        connectionTimeoutMillis: 5000, // 2 seconds connection timeout
      },
    });

    console.log('✅ Database connections established');
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    console.log('💡 Using in-memory fallback (data will not persist)');

    // For now, we'll still create the memory without storage
    // In production, you might want to retry or use a different strategy
    throw new Error('Database connection required for AI features');
  }

  // Try to ensure the vector index exists, but don't fail if DB is not ready
  try {
    // Add timeout and retry logic for index creation
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Index creation timeout')), 5000)
    );

    const indexPromise = vectorStore.createIndex({
      indexName: 'user_entities',
      dimension: 1536, // OpenAI text-embedding-3-small dimension
      metric: 'cosine'
    });

    await Promise.race([indexPromise, timeoutPromise]);
    console.log('✅ Vector index "user_entities" ready');
  } catch (error) {
    console.warn('⚠️  Vector index setup skipped (DB not ready):', (error as Error).message);
    console.log('💡 The index will be created automatically when the database is available');
  }

  // Working memory template for career guidance
  const workingMemoryTemplate = `
# User Profile

## Personal Info
- Name:
- Current Role:
- Company:
- Location:
- Career Interest: [find-job/grow-career/change-careers/start-startup]

## Current Projects/Journeys
1. Project:
   - Goal:
   - Status:
   - Last Update:
2. Project:
   - Goal:
   - Status:
   - Last Update:
3. Project:
   - Goal:
   - Status:
   - Last Update:

## Career Goals
- Short-term (6 months):
- Long-term (2-3 years):
- Key Skills to Develop:

## Session Context
- Onboarding Stage: [not-started/in-progress/completed]
- Last Milestone Added:
- Open Questions:
`;

  const memory = new Memory({
    storage,
    vector: vectorStore,
    embedder: openai.embedding('text-embedding-3-small'),
    options: {
      lastMessages: 10,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: 'resource', // Search across all user conversations
      },
      workingMemory: {
        enabled: true,
        scope: 'resource', // Persist across all conversations for the user
        template: workingMemoryTemplate,
      },
    },
  });

  // Cache the instance to prevent duplicate connections
  memoryInstance = {
    memory,
    redis,
    storage,
    vectorStore,
  };

  return memoryInstance;
}

// Helper to store temporary onboarding state in Redis
export class OnboardingStateManager {
  constructor(private redis: Redis) {}

  async getState(userId: string) {
    const state = await this.redis.get(`onboarding:${userId}`);
    return state ? JSON.parse(state) : null;
  }

  async setState(userId: string, state: any) {
    // Store with 1 hour TTL
    await this.redis.setex(`onboarding:${userId}`, 3600, JSON.stringify(state));
  }

  async clearState(userId: string) {
    await this.redis.del(`onboarding:${userId}`);
  }
}
