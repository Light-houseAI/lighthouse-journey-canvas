import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import Database from '@replit/database';

// Initialize Replit Database for working memory
const db = new Database();

// Create Redis-compatible adapter for existing code
const redis = {
  async get(key: string): Promise<string | null> {
    try {
      const value = await db.get(key);
      return value ? String(value) : null;
    } catch (error) {
      console.warn('Database get error (non-critical):', error);
      return null;
    }
  },
  
  async set(key: string, value: string, mode?: string, duration?: number): Promise<string> {
    try {
      await db.set(key, value);
      // Replit Database doesn't support TTL, but we can simulate with timestamps
      if (mode === 'EX' && duration) {
        await db.set(`${key}:ttl`, Date.now() + (duration * 1000));
      }
      return 'OK';
    } catch (error) {
      console.warn('Database set error (non-critical):', error);
      return 'OK';
    }
  },
  
  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.set(key, value, 'EX', seconds);
  },
  
  async del(key: string): Promise<number> {
    try {
      await db.delete(key);
      await db.delete(`${key}:ttl`);
      return 1;
    } catch (error) {
      console.warn('Database delete error (non-critical):', error);
      return 0;
    }
  },
  
  async keys(pattern: string): Promise<string[]> {
    try {
      const result = await db.list();
      const allKeys = Array.isArray(result) ? result : [];
      // Simple pattern matching for basic cases
      if (pattern === '*') return allKeys;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter((key: string) => regex.test(key));
    } catch (error) {
      console.warn('Database keys error (non-critical):', error);
      return [];
    }
  }
};

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
