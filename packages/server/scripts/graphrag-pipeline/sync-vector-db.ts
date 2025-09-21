#!/usr/bin/env tsx
/**
 * GraphRAG Vector Database Sync Script
 *
 * This script syncs existing timeline nodes to the pgvector database.
 * It's useful when you have timeline nodes that weren't automatically synced
 * or when you need to regenerate embeddings.
 *
 * Usage:
 *   npx tsx server/scripts/graphrag-pipeline/sync-vector-db.ts --all
 *   npx tsx server/scripts/graphrag-pipeline/sync-vector-db.ts --user-id 1248
 *   npx tsx server/scripts/graphrag-pipeline/sync-vector-db.ts --check
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load environment variables
dotenv.config();

// Import schema from shared
import { timelineNodes, users } from '@journey/schema';
// Import existing DI container and services
import { Container } from '../../src/core/container-setup';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens';
import type {
  EmbeddingService,
  IPgVectorGraphRAGRepository,
  IPgVectorGraphRAGService,
} from '../../src/types/graphrag.types';

const program = new Command();

program
  .name('sync-vector-db')
  .description('Sync existing timeline nodes to pgvector GraphRAG database')
  .option('-a, --all', 'Sync all timeline nodes to vector database')
  .option('-u, --user-id <userId>', "Sync specific user's timeline nodes")
  .option('-c, --check', 'Check vector database status without syncing')
  .option('-f, --force', 'Force re-sync even if embeddings exist')
  .option('--batch-size <size>', 'Batch size for processing', '10')
  .parse(process.argv);

const options = program.opts();

interface VectorSyncStats {
  totalNodes: number;
  existingChunks: number;
  missingChunks: number;
  zeroEmbeddings: number;
  synced: number;
  errors: number;
}

class VectorSyncService {
  private container: typeof Container;
  private db: any;
  private graphragService: IPgVectorGraphRAGService;
  private repository: IPgVectorGraphRAGRepository;
  private embeddingService: EmbeddingService;

  constructor() {
    this.container = Container;
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Vector Sync Service...');

    // Initialize database
    const sql = postgres(process.env.DATABASE_URL!);
    this.db = drizzle(sql);

    try {
      // Create mock logger for container (same as index.ts)
      const mockLogger = {
        debug: console.log,
        info: console.log,
        warn: console.warn,
        error: console.error,
      };

      // Configure DI container with proper error handling
      const container = await this.container.configure(mockLogger);
      console.log('✅ DI Container initialized');

      // Resolve services
      this.graphragService = container.resolve<IPgVectorGraphRAGService>(
        CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_SERVICE
      );
      this.repository = container.resolve<IPgVectorGraphRAGRepository>(
        CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_REPOSITORY
      );
      this.embeddingService = container.resolve<EmbeddingService>(
        CONTAINER_TOKENS.OPENAI_EMBEDDING_SERVICE
      );
      console.log('✅ GraphRAG services resolved');
    } catch (error) {
      console.error('❌ Failed to initialize container:', error);
      throw error;
    }
  }

  async checkVectorStatus(userId?: number): Promise<VectorSyncStats> {
    console.log('🔍 Checking vector database status...');

    // Get timeline nodes
    const nodeQuery = this.db.select().from(timelineNodes);
    if (userId) {
      nodeQuery.where(eq(timelineNodes.userId, userId));
    }
    const nodes = await nodeQuery;

    console.log(`📊 Found ${nodes.length} timeline nodes`);

    // Check existing chunks
    const existingChunks = await this.repository.getChunksByUserId(userId || 0);

    // Check for zero embeddings
    const zeroEmbeddings = await this.countZeroEmbeddings();

    const stats: VectorSyncStats = {
      totalNodes: nodes.length,
      existingChunks: existingChunks.length,
      missingChunks: Math.max(0, nodes.length - existingChunks.length),
      zeroEmbeddings,
      synced: 0,
      errors: 0,
    };

    return stats;
  }

  private async countZeroEmbeddings(): Promise<number> {
    try {
      const result = await this.db.execute(`
        SELECT COUNT(*) as count
        FROM graphrag_chunks
        WHERE embedding::text LIKE '[0,0,0%'
      `);
      return parseInt(result[0]?.count || '0');
    } catch (error) {
      console.warn('⚠️ Could not count zero embeddings:', error);
      return 0;
    }
  }

  async syncTimelineNodesToVector(
    userId?: number,
    force: boolean = false
  ): Promise<VectorSyncStats> {
    console.log('🚀 Starting vector sync...');

    const stats: VectorSyncStats = {
      totalNodes: 0,
      existingChunks: 0,
      missingChunks: 0,
      zeroEmbeddings: 0,
      synced: 0,
      errors: 0,
    };

    // Get timeline nodes
    let nodeQuery = this.db.select().from(timelineNodes);
    if (userId) {
      nodeQuery = nodeQuery.where(eq(timelineNodes.userId, userId));
    }
    const nodes = await nodeQuery;

    stats.totalNodes = nodes.length;
    console.log(`📊 Processing ${nodes.length} timeline nodes...`);

    if (nodes.length === 0) {
      console.log('ℹ️ No timeline nodes found to sync');
      return stats;
    }

    // Process nodes in batches
    const batchSize = parseInt(options.batchSize);

    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      console.log(
        `\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(nodes.length / batchSize)} (${batch.length} nodes)...`
      );

      for (const node of batch) {
        try {
          // Check if chunks already exist for this node
          const existingChunks = await this.repository.getChunksByNodeId(
            node.id
          );

          if (existingChunks.length > 0 && !force) {
            // Check if embeddings are zero
            const hasZeroEmbeddings = existingChunks.some(
              (chunk) =>
                chunk.embedding &&
                chunk.embedding.toString().startsWith('[0,0,0')
            );

            if (!hasZeroEmbeddings) {
              console.log(
                `  ⏭️  Skipping ${node.id} (already has valid embeddings)`
              );
              continue;
            } else {
              console.log(`  🔄 Re-syncing ${node.id} (has zero embeddings)`);
            }
          } else if (existingChunks.length > 0 && force) {
            console.log(`  🧹 Force cleaning and re-syncing ${node.id}`);
            // Clean existing chunks first when force is enabled
            try {
              await this.cleanNodeChunks(node.id);
              console.log(`  ✅ Cleaned existing chunks for ${node.id}`);
            } catch (cleanError) {
              console.warn(
                `  ⚠️  Failed to clean chunks for ${node.id}:`,
                cleanError
              );
            }
          } else {
            console.log(`  ➕ Creating new chunks for ${node.id}`);
          }

          // Generate chunk text from timeline node
          const chunkText = this.generateChunkText(node);

          // Generate embedding for the chunk text
          const embedding =
            await this.embeddingService.generateEmbedding(chunkText);

          // Fetch insights and include in meta
          let nodeMetaWithInsights = { ...node.meta };
          try {
            // Simple query to get insights
            const insightQuery = await this.db.execute(`
              SELECT description, resources
              FROM node_insights
              WHERE node_id = '${node.id}'
            `);

            if (insightQuery.length > 0) {
              nodeMetaWithInsights.insights = insightQuery.map(
                (insight: any) => {
                  // Ensure resources is always an array
                  let resources = [];
                  if (insight.resources) {
                    if (Array.isArray(insight.resources)) {
                      resources = insight.resources;
                    } else if (typeof insight.resources === 'string') {
                      try {
                        resources = JSON.parse(insight.resources);
                        if (!Array.isArray(resources)) {
                          resources = [];
                        }
                      } catch {
                        resources = [];
                      }
                    }
                  }

                  return {
                    text: insight.description,
                    category: 'general',
                    resources: resources,
                  };
                }
              );
            }
          } catch (insightError) {
            console.warn(
              `  ⚠️  Failed to fetch insights for ${node.id}:`,
              insightError
            );
          }

          // Create or update chunk in vector database
          await this.graphragService.createChunk({
            userId: node.userId,
            nodeId: node.id,
            chunkText,
            embedding: new Float32Array(embedding),
            nodeType: node.type,
            meta: nodeMetaWithInsights,
            tenantId: 'default',
          });

          stats.synced++;
          console.log(`  ✅ Synced node ${node.id} (${node.type})`);
        } catch (error) {
          stats.errors++;
          console.error(
            `  ❌ Failed to sync node ${node.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < nodes.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return stats;
  }

  private async cleanNodeChunks(nodeId: string): Promise<void> {
    // Remove all existing chunks for this node to ensure clean re-sync
    try {
      // Use SQL with Drizzle syntax
      await this.db.execute(
        `DELETE FROM graphrag_chunks WHERE node_id = '${nodeId}'`
      );
    } catch (error) {
      throw new Error(`Failed to clean chunks for node ${nodeId}: ${error}`);
    }
  }

  private generateChunkText(node: any): string {
    const { type, meta } = node;
    const parts: string[] = [];

    // Start with node type context
    if (type === 'job') {
      parts.push('job experience');
      if (meta.role) parts.push(`Role: ${meta.role}`);
      if (meta.company) parts.push(`Company: ${meta.company}`);
      if (meta.location) parts.push(`Location: ${meta.location}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      if (meta.skills && Array.isArray(meta.skills)) {
        parts.push(`Skills: ${meta.skills.join(', ')}`);
      }
      if (meta.technologies && Array.isArray(meta.technologies)) {
        parts.push(`Technologies: ${meta.technologies.join(', ')}`);
      }
      if (meta.achievements && Array.isArray(meta.achievements)) {
        parts.push(`Achievements: ${meta.achievements.join(', ')}`);
      }
    } else if (type === 'education') {
      parts.push('education experience');
      if (meta.degree) parts.push(`Degree: ${meta.degree}`);
      if (meta.field) parts.push(`Field: ${meta.field}`);
      if (meta.institution) parts.push(`Institution: ${meta.institution}`);
      if (meta.major) parts.push(`Major: ${meta.major}`);
      if (meta.gpa) parts.push(`GPA: ${meta.gpa}`);
      if (meta.coursework && Array.isArray(meta.coursework)) {
        parts.push(`Coursework: ${meta.coursework.join(', ')}`);
      }
    } else if (type === 'project') {
      parts.push('project experience');
      if (meta.title) parts.push(`Project: ${meta.title}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
      if (meta.technologies && Array.isArray(meta.technologies)) {
        parts.push(`Technologies: ${meta.technologies.join(', ')}`);
      }
      if (meta.skills && Array.isArray(meta.skills)) {
        parts.push(`Skills: ${meta.skills.join(', ')}`);
      }
    } else {
      parts.push(`${type} experience`);
      if (meta.title) parts.push(`Title: ${meta.title}`);
      if (meta.description) parts.push(`Description: ${meta.description}`);
    }

    // Add time period information
    if (meta.startDate) {
      const period = meta.endDate
        ? `Period: ${meta.startDate} to ${meta.endDate}`
        : `Period: ${meta.startDate} to present`;
      parts.push(period);
    }

    return parts.join('. ');
  }

  async getUsers(): Promise<Array<{ id: number; email: string }>> {
    return await this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users);
  }
}

async function main() {
  const syncService = new VectorSyncService();

  try {
    await syncService.initialize();

    if (options.check) {
      console.log('\n📋 VECTOR DATABASE STATUS CHECK\n');

      if (options.userId) {
        const stats = await syncService.checkVectorStatus(
          parseInt(options.userId)
        );
        printStats(stats, `User ${options.userId}`);
      } else {
        const stats = await syncService.checkVectorStatus();
        printStats(stats, 'All Users');
      }

      return;
    }

    if (!options.all && !options.userId) {
      console.error(
        '❌ Either --all or --user-id must be specified for syncing'
      );
      process.exit(1);
    }

    console.log('\n🚀 VECTOR DATABASE SYNC\n');

    let stats: VectorSyncStats;

    if (options.userId) {
      stats = await syncService.syncTimelineNodesToVector(
        parseInt(options.userId),
        options.force
      );
    } else {
      stats = await syncService.syncTimelineNodesToVector(
        undefined,
        options.force
      );
    }

    console.log('\n📊 SYNC COMPLETED\n');
    printStats(stats, options.userId ? `User ${options.userId}` : 'All Users');

    if (stats.errors > 0) {
      console.warn(`\n⚠️ ${stats.errors} errors occurred during sync`);
      process.exit(1);
    } else {
      console.log('\n✅ Sync completed successfully!');
    }
    process.exit(1);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

function printStats(stats: VectorSyncStats, scope: string) {
  console.log(`📊 ${scope} Statistics:`);
  console.log(`  • Timeline Nodes: ${stats.totalNodes}`);
  console.log(`  • Existing Chunks: ${stats.existingChunks}`);
  console.log(`  • Missing Chunks: ${stats.missingChunks}`);
  console.log(`  • Zero Embeddings: ${stats.zeroEmbeddings}`);
  if (stats.synced > 0 || stats.errors > 0) {
    console.log(`  • Successfully Synced: ${stats.synced}`);
    console.log(`  • Errors: ${stats.errors}`);
  }
}

// Show help if no arguments
if (process.argv.length <= 2) {
  program.help();
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
