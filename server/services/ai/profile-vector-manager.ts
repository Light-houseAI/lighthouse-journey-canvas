import { PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { datetime } from 'drizzle-orm/mysql-core';

// Schema for vectorized profile data - unified for all entity types
export const ProfileVectorSchema = z.object({
  id: z.string(),
  userId: z.string(),
  entityType: z.enum(['milestone', 'education', 'project', 'skill', 'experience', 'project_update', 'conversation_summary']),
  description: z.string(),
  entity: z.any().optional(), // For linking projects to experiences
});

export type ProfileVectorData = z.infer<typeof ProfileVectorSchema>;

export class ProfileVectorManager {
  private vectorStore: PgVector | null = null;
  private embeddingModel: any;

  constructor() {
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
      console.log('Vector store initialization failed:', error instanceof Error ? error.message : error);
    }
    this.embeddingModel = openai.embedding('text-embedding-3-small');
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
      console.log(`✅ Index ${indexName} created/verified`);
    } catch (error) {
      // Index might already exist, continue
      console.log('Index already exists or creation failed:', error instanceof Error ? error.message : error);
    }
  }

  // Generic method to store any entity type as vector
  async storeEntity(userId: string, entity: any, entityType: 'milestone' | 'education' | 'project' | 'skill' | 'experience' | 'project_update' | 'conversation_summary') {
    const vectorData: ProfileVectorData = {
      id: entity.id || nanoid(),
      userId,
      entityType,
      description: entity.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storeVector(vectorData);
  }

  // Helper method to build description based on entity type
  private buildDescription(entity: any, entityType: string): string {
    switch (entityType) {
      case 'milestone':
        return `${entity.description || 'Career milestone'} | Skills: ${entity.skills?.join(', ') || 'None'} | Organization: ${entity.organization || 'Unknown'}`;
      case 'education':
        return `Studied ${entity.field || entity.degree || 'various subjects'} at ${entity.school || entity.organization || 'Unknown'} from ${entity.start || entity.startDate || 'unknown'} to ${entity.end || entity.endDate || 'unknown'}`;
      case 'project':
        return `${entity.description || entity.objectives || 'Project work'} | Technologies: ${entity.technologies?.join(', ') || 'Not specified'} | Impact: ${entity.impact || 'Not specified'}`;
      case 'experience':
        return `${entity.description || 'Professional role'} at ${entity.company || entity.organization || 'Unknown'} from ${entity.start || entity.startDate || 'unknown'} to ${entity.end || entity.endDate || 'present'}`;
      case 'project_update':
        return `Project update: ${entity.description || entity.title || 'Progress update'} | Skills: ${entity.skills?.join(', ') || 'None'} | Impact: ${entity.impact || 'Not specified'}`;
      case 'conversation_summary':
        return entity.searchableText || entity.rawSummary || 'Conversation summary';
      default:
        return entity.description || entity.name || `${entityType} entry`;
    }
  }

  // Legacy method for backward compatibility
  async storeMilestone(userId: string, milestone: any) {
    return this.storeEntity(userId, milestone, 'milestone');
  }

  // Store education as vector
  async storeEducation(userId: string, education: any) {
    const entity: ProfileVectorData = {
      id: education.id,
      userId,
      entityType: 'education',
      description: ` Studied ${education.degree} - ${education.field} in ${education.school} from ${education.start || 'unknown'} to ${education.end || 'unknown'}`,
      entity: education
    }
    return this.storeEntity(userId, entity, 'education');
  }

  // Store project as vector
  async storeProject(userId: string, project: any) {

    for (const update of project.updates || []) {
      const updateEntity: ProfileVectorData = {
        id: update.id,
        userId,
        entityType: 'project_update',
        description: `${project.title}: ${update.title} : ${update.description}`,
        entity: update
      };
      await this.storeEntity(userId, updateEntity, 'project_update');
    }
    const projectEntity: ProfileVectorData = {
      id: project.id,
      userId,
      entityType: 'project',
      description: `${project.title}`,
      entity: project
    };
    return this.storeEntity(userId, projectEntity, 'project');
  }

  // Store experience as vector
  async storeExperience(userId: string, experience: any) {
    const entity: ProfileVectorData = {
      id: experience.id,
      userId,
      entityType: 'experience',
      description: `${experience.title.name || experience.title} at ${experience.company} from ${experience.start} to ${experience.end || 'present'}`,
      entity: experience
    }
    return this.storeEntity(userId, entity, 'experience');
  }

  // Store conversation summary as vector
  async storeConversationSummary(userId: string, summary: any) {
    return this.storeEntity(userId, summary, 'conversation_summary');
  }

  // Generic vector storage
  private async storeVector(vectorData: ProfileVectorData) {
    if (!this.vectorStore) {
      console.log('Vector store not available, skipping storage for:', vectorData.description);
      return;
    }

    try {
      // Ensure index exists first
      await this.ensureIndexExists();

      // Create searchable text for embedding
      const searchableText = vectorData.description;

      console.log(`Storing vector for ${vectorData.entityType} with description:`, searchableText);

      // Generate embedding using AI SDK
      const { embedding } = await embed({
        model: this.embeddingModel,
        value: searchableText,
      });

      // Store in vector database - use unified index for all entity types
      const indexName = `user_entities`;

      // Store using upsert method
      await this.vectorStore.upsert({
        indexName,
        vectors: [embedding],
        metadata: [{
          ...vectorData,
          searchableText,
        }]
      });

      console.log(`✅ Stored ${vectorData.entityType} vector for user ${vectorData.userId}`);
    } catch (error) {
      console.error(`❌ Failed to store ${vectorData.entityType} vector:`, error);
      throw error;
    }
  }

  async clearProfileData(userId: string) {
    if (!this.vectorStore) {
      console.log('Vector store not available, skipping deletion for vectors of user:', userId);
      return;
    }
    try {
      // Ensure index exists first
      await this.ensureIndexExists();

      // Delete vector by ID
      const indexName = `user_entities`;

      // For deletion, you don't need a query vector; you just want to filter by userId.
      // PgVector's query method may require a queryVector, but for filtering, you can use a zero vector or any dummy vector.
      // Here, we use an array of zeros with the same dimension as your index (1536).
      const vectors = await this.vectorStore.query({
        indexName,
        queryVector: new Array(1536).fill(0), // Dummy vector for filtering
        filter: { userId },
        topK: 1000, // Adjust based on expected number of vectors per user
      });
      if (vectors.length === 0) {
        console.log(`No vectors found for user ${userId}`);
        return;
      }
      for (const vector of vectors) {
        await this.vectorStore.deleteVector({ indexName, id: vector.id });
        console.log(`✅ Deleted vector ${vector.id} for user ${userId}`);
      }

    } catch (error) {
      console.error(`❌ Failed to delete vectors for userId ${userId}:`, error);
      throw error;
    }
  }

  // Search relevant profile history - now supports all entity types
  async searchProfileHistory(userId: string, query: string, options: {
    entityTypes?: Array<'milestone' | 'education' | 'project' | 'skill' | 'experience' | 'project_update' | 'conversation_summary'>;
    limit?: number;
    threshold?: number;
  } = {}) {
    if (!this.vectorStore) {
      console.log('Vector store not available, returning empty search results');
      return [];
    }

    try {
      // Ensure index exists first
      await this.ensureIndexExists();

      const { entityTypes, limit = 10, threshold = 0.3 } = options;

      // Generate query embedding using AI SDK
      const { embedding: queryEmbedding } = await embed({
        model: this.embeddingModel,
        value: query,
      });

      // Search vectors using query method - unified index
      const indexName = `user_entities`;
      const filter: any = { userId };
      if (entityTypes && entityTypes.length > 0) {
        if (entityTypes.length === 1) {
          filter.entityType = entityTypes[0];
        } else {
          // For multiple entity types, use $in operator
          filter.entityType = { $in: entityTypes };
        }
      }

      const vectorQuery = {
        indexName,
        queryVector: queryEmbedding,
        topK: limit,
        minScore: threshold,
        filter,
        includeVector: true,

      };

      const results = await this.vectorStore.query(vectorQuery);

      return results.map(result => ({
        id: result.id,
        content: result.metadata?.searchableText || '',
        similarity: result.score,
        metadata: result.metadata,
      }));
    } catch (error) {
      console.error('❌ Failed to search profile history:', error);
      return [];
    }
  }

  // Bulk import existing profile data
  async importProfileData(userId: string, profileData: any) {
    try {
      const promises = [];

      // Import experiences
      if (profileData.experiences) {
        for (const experience of profileData.experiences) {
          promises.push(this.storeExperience(userId, experience));

          for (const project of experience.projects || []) {
            promises.push(this.storeProject(userId, project));
          }
        }
      }
      // Import education
      if (profileData.education) {
        for (const education of profileData.education) {
          promises.push(this.storeEducation(userId, education));
        }
      }
      await Promise.all(promises);
      console.log(`✅ Imported profile data for user ${userId}`);
    } catch (error) {
      console.error(`❌ Failed to import profile data for user ${userId}:`, error);
      throw error;
    }
  }

  // Get user's profile timeline
  async getProfileTimeline(userId: string, limit: number = 50) {
    try {
      // This would require a custom query to get all vectors for a user sorted by date
      // For now, we'll search with a broad query
      return await this.searchProfileHistory(userId, 'career professional work education experience project', {
        limit,
        threshold: 0.1, // Very low threshold to get all items
      });
    } catch (error) {
      console.error('❌ Failed to get profile timeline:', error);
      return [];
    }
  }
}

// Singleton instance with safe initialization
let _profileVectorManager: ProfileVectorManager | null = null;

export const profileVectorManager = {
  async storeMilestone(userId: string, milestone: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeMilestone(userId, milestone);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async storeExperience(userId: string, experience: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeExperience(userId, experience);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async storeEducation(userId: string, education: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeEducation(userId, education);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async storeProject(userId: string, project: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeProject(userId, project);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async storeEntity(userId: string, entity: any, entityType: 'milestone' | 'education' | 'project' | 'skill' | 'experience' | 'project_update' | 'conversation_summary') {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeEntity(userId, entity, entityType);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async storeConversation(userId: string, conversation: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping vector storage:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.storeConversationSummary(userId, conversation);
    } catch (error) {
      console.log('Vector storage failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async searchProfileHistory(userId: string, query: string, options: any = {}) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, returning empty results:', error instanceof Error ? error.message : error);
        return [];
      }
    }
    try {
      return await _profileVectorManager.searchProfileHistory(userId, query, options);
    } catch (error) {
      console.log('Vector search failed, returning empty results:', error instanceof Error ? error.message : error);
      return [];
    }
  },

  async importProfileData(userId: string, profileData: any) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping import:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.importProfileData(userId, profileData);
    } catch (error) {
      console.log('Vector import failed, continuing without it:', error instanceof Error ? error.message : error);
    }
  },

  async clearProfileData(userId: string) {
    if (!_profileVectorManager) {
      try {
        _profileVectorManager = new ProfileVectorManager();
      } catch (error) {
        console.log('ProfileVectorManager initialization failed, skipping clear:', error instanceof Error ? error.message : error);
        return;
      }
    }
    try {
      return await _profileVectorManager.clearProfileData(userId);
    } catch (error) {
      console.log('Failed to clear profile data:', error instanceof Error ? error.message : error);
    }
  }
};
