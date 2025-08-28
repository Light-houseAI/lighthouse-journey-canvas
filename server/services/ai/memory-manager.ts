import { Memory } from '@mastra/memory';
import { PostgresStore, PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { redisAdapter } from '../../adapters/redis-adapter';
import { DatabaseConfig } from '../../config/database-config.js';
import { getDatabaseInstance } from '../../config/database.config.js';

// Use the centralized Redis adapter
const redis = redisAdapter;

// Store multiple memory instances for different database configs
const memoryInstances = new Map<string, {
  memory: any;
  redis: any;
  storage: any;
  vectorStore: any;
}>();

// Initialize memory with configurable database
export async function createCareerMemory(databaseConfig?: DatabaseConfig) {
  // Use container database if no specific config provided
  let dbConfig: DatabaseConfig;
  let instanceKey: string;
  
  if (databaseConfig) {
    dbConfig = databaseConfig;
    instanceKey = `${dbConfig.type}_${dbConfig.connectionString}_${dbConfig.schemaName}`;
  } else {
    // Get database from container (avoids creating a new connection)
    try {
      const db = getDatabaseInstance();
      const pool = (db as any).__pool;
      const connectionString = pool?.options?.connectionString || 'container-db';
      instanceKey = `container_${connectionString}`;
      
      // Create a minimal config for the container database
      dbConfig = {
        type: 'postgresql' as const,
        connectionString: connectionString,
        schemaName: 'mastra_ai',
      };
    } catch (error) {
      throw new Error('Memory manager requires initialized database container');
    }
  }

  // Return existing instance if already created
  if (memoryInstances.has(instanceKey)) {
    return memoryInstances.get(instanceKey)!;
  }

  let storage: any;
  let vectorStore: any;

  try {
    // Use PostgreSQL for both testing and production
    // Testing uses unique database names for isolation
    const storageOptions: any = {
      connectionString: dbConfig.connectionString,
      schemaName: dbConfig.schemaName,
    };
    
    const vectorOptions: any = {
      connectionString: dbConfig.connectionString,
      schemaName: dbConfig.schemaName,
      pgPoolOptions: dbConfig.pgPoolOptions,
    };
    
    // Configure SSL - node-postgres 8.0+ requires explicit SSL config
    if (dbConfig.type === 'testing') {
      const connectionString = dbConfig.connectionString;
      if (connectionString.includes('sslmode=require') || 
          connectionString.includes('ssl=true') ||
          connectionString.includes('sslmode=prefer')) {
        // Use rejectUnauthorized: false for self-signed certificates (common in development)
        storageOptions.ssl = { rejectUnauthorized: false };
        vectorOptions.ssl = { rejectUnauthorized: false };
      } else if (connectionString.includes('sslmode=disable')) {
        storageOptions.ssl = false;
        vectorOptions.ssl = false;
      } else {
        // Default behavior for cloud databases - try SSL with fallback
        storageOptions.ssl = { rejectUnauthorized: false };
        vectorOptions.ssl = { rejectUnauthorized: false };
      }
    }
    
    storage = new PostgresStore(storageOptions);
    vectorStore = new PgVector(vectorOptions);

    if (dbConfig.type === 'testing') {
      console.log(`✅ PostgreSQL test database connected: ${(dbConfig as any).testDatabaseName}`);
    } else {
      console.log(`✅ PostgreSQL database connections established (schema: ${dbConfig.schemaName})`);
    }
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    console.log('💡 Unable to establish database connection for AI features');
    throw new Error(`Database connection required for AI features: ${(error as Error).message}`);
  }

  // Try to ensure the vector index exists, but don't fail if DB is not ready
  try {
    if (vectorStore) {
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
    } else {
      console.log('⚠️ Vector store not available - semantic search disabled');
    }
  } catch (error) {
    console.warn('⚠️  Vector index setup skipped (DB not ready):', (error as Error).message);
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
    embedder: vectorStore ? openai.embedding('text-embedding-3-small') : undefined,
    options: {
      lastMessages: 10,
      semanticRecall: vectorStore ? {
        topK: 5,
        messageRange: 3,
        scope: 'resource', // Search across all user conversations
      } : false, // Disable semantic recall if no vector store
      workingMemory: {
        enabled: false,
        scope: 'resource', // Persist across all conversations for the user
        schema: careerWorkingMemorySchema,
      },
    },
  });

  // Cache the instance to prevent duplicate connections
  const instance = {
    memory,
    redis,
    storage,
    vectorStore,
  };

  memoryInstances.set(instanceKey, instance);

  return instance;
}

// Helper function to preload working memory with user profile data
export async function preloadUserWorkingMemory(
  userId: string,
  profileData: any, // ProfileData from your schema
  databaseConfig?: DatabaseConfig
): Promise<void> {
  const { Agent } = await import('@mastra/core/agent');
  const { memory } = await createCareerMemory(databaseConfig);

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
