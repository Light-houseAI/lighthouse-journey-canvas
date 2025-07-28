import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import Redis from 'ioredis';
import { z } from 'zod';

// Initialize Redis client for working memory (optional, can use PG for everything)
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
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
        idleTimeoutMillis: 60000, // 30 seconds idle timeout
        connectionTimeoutMillis: 10000, // 2 seconds connection timeout
      },
    });

    console.log('✅ Database connections established');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
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
    console.warn('⚠️  Vector index setup skipped (DB not ready):', error.message);
    console.log('💡 The index will be created automatically when the database is available');
  }

  // Simplified career working memory schema (no skills, no career goals)
  const careerWorkingMemorySchema = z.object({
    personalInfo: z.object({
      name: z.string().optional(),
      location: z.string().optional(),
      contact: z.string().optional(),
    }).optional(),

    currentWork: z.object({
      role: z.string().optional(),
      company: z.string().optional(),
      startDate: z.string().optional(),
      projects: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        status: z.string().optional(),
      })).default([]),
    }).optional(),

    workHistory: z.array(z.object({
      role: z.string(),
      company: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      description: z.string().optional(),
    })).default([]),

    education: z.array(z.object({
      degree: z.string().optional(),
      field: z.string().optional(),
      school: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })).default([]),
  });

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
        enabled: false,
        scope: 'resource', // Persist across all conversations for the user
        schema: careerWorkingMemorySchema,
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

// Helper function to preload working memory with user profile data
export async function preloadUserWorkingMemory(
  userId: string,
  profileData: any // ProfileData from your schema
): Promise<void> {
  const { Agent } = await import('@mastra/core/agent');
  const { memory } = await createCareerMemory();

  // Create a temporary agent just for initialization
  const initAgent = new Agent({
    name: 'Memory Initializer',
    instructions: `You are a memory initialization agent. Your job is to populate working memory with user profile data.
    Use <working_memory> tags to update the structured working memory with the provided information.
    Be thorough and accurate - this data will persist across all future conversations.`,
    model: openai('gpt-4o-mini'), // Use cheaper model for initialization
    memory,
  });

  // Create comprehensive initialization message
  const initMessage = `Initialize working memory for user ${userId} with the following profile data:

**Personal Information:**
- Name: ${profileData.name || ''}
- Location: ${profileData.location || ''}

**Professional Experience:**
${profileData.experiences?.map((exp: any, i: number) => `
${i + 1}. ${exp.title} at ${exp.company}
   - Duration: ${exp.start || 'Unknown'} to ${exp.end || 'Present'}
   - Description: ${exp.description || 'No description'}
   ${exp.projects?.length ? `- Projects: ${exp.projects.map((p: any) => p.title).join(', ')}` : ''}
`).join('') || 'No experience data available'}

**Education:**
${profileData.education?.map((edu: any, i: number) => `
${i + 1}. ${edu.degree || 'Degree'} in ${edu.field || 'Field'} from ${edu.school}
   - Duration: ${edu.start || 'Unknown'} to ${edu.end || 'Unknown'}
`).join('') || 'No education data available'}

Please populate the structured working memory with this information. Organize current work separate from work history, and include any current projects under the current work section.`;

  try {
    // Process the initialization - this will populate working memory
    await initAgent.generate(initMessage, {
      memory: {
        resource: userId,
        thread: `init-${Date.now()}`, // Use temporary thread for initialization
      }
    });

    console.log(`✅ Working memory preloaded for user: ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to preload working memory for user ${userId}:`, error);
    throw error;
  }
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
