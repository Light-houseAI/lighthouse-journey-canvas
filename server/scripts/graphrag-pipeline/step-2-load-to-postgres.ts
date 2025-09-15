#!/usr/bin/env tsx
/**
 * Step 2: Load Generated Profiles to PostgreSQL
 *
 * This script loads the generated career profiles into PostgreSQL following
 * the exact schema from @shared/schema.ts
 *
 * Usage:
 *   npx tsx pipeline/step-2-load-to-postgres.ts
 *   npx tsx pipeline/step-2-load-to-postgres.ts --batch-size 10
 */

import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { eq,inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Pool } from 'pg';
import postgres from 'postgres';

import { TimelineNodeType } from '../../../shared/enums';
// Import schema from shared
import { nodeInsights, organizations,timelineNodes, users } from '../../../shared/schema';
// Import existing DI container and services
import { Container } from '../../core/container-setup';
import { CONTAINER_TOKENS } from '../../core/container-tokens';
import type { HierarchyService } from '../../services/hierarchy-service';

dotenv.config();

interface GeneratedProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  userName?: string;
  interest?: string;
  timelineNodes: Array<{
    id: string;
    type: string;
    parentId?: string | null;
    meta: {
      // For all node types
      startDate: string;
      endDate?: string | null;

      // For project/event/action/careerTransition
      title?: string;
      description?: string;

      // For job nodes
      company?: string;
      role?: string;
      location?: string;

      // For education nodes
      institution?: string;
      degree?: string;
      field?: string;
    };
  }>;
  insights: Array<{
    id: string;
    nodeId: string;
    description: string;
    resources: string[];
  }>;
  createdAt: string;
}

class PostgreSQLLoader {
  private db: ReturnType<typeof drizzle>;
  private sql: ReturnType<typeof postgres>;
  private pool: Pool;
  private profilesDir: string;
  private orgCache: Map<string, number> = new Map();
  private container?: Container;
  private hierarchyService?: HierarchyService;
  private enableServiceSync: boolean = true;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('❌ DATABASE_URL is required');
    }

    this.sql = postgres(connectionString);
    this.db = drizzle(this.sql);

    // Create PostgreSQL pool for services
    this.pool = new Pool({ connectionString });

    this.profilesDir = path.join(process.cwd(), 'server', 'scripts', 'graphrag-pipeline', 'data', 'profiles');

    // Initialize DI container and services
    this.initializeContainer();
  }

  /**
   * Initialize DI container with all services
   */
  private async initializeContainer(): Promise<void> {
    try {
      // Setup container with all dependencies
      await Container.configure({
        pool: this.pool,
        db: this.db
      });

      this.container = Container;

      // Resolve HierarchyService from container (includes pgvector sync)
      this.hierarchyService = this.container.resolve<HierarchyService>(CONTAINER_TOKENS.hierarchyService);

      console.log('✅ DI Container initialized with pgvector sync services');
      this.enableServiceSync = true;
    } catch (error) {
      console.warn('⚠️ Failed to initialize DI container:', error);
      this.enableServiceSync = false;
    }
  }

  /**
   * Load all profile JSON files
   */
  async loadProfileFiles(): Promise<GeneratedProfile[]> {
    console.log(`📂 Loading profiles from: ${this.profilesDir}`);

    try {
      const files = await fs.readdir(this.profilesDir);
      const profileFiles = files.filter(file => file.endsWith('.json'));

      const profiles: GeneratedProfile[] = [];

      for (const file of profileFiles) {
        const filePath = path.join(this.profilesDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const profile = JSON.parse(content) as GeneratedProfile;
        profiles.push(profile);
      }

      console.log(`✅ Loaded ${profiles.length} profiles`);
      return profiles;
    } catch (error) {
      console.error('❌ Error loading profile files:', error);
      throw error;
    }
  }

  /**
   * Normalize timeline node type to match enum
   */
  private normalizeNodeType(type: string): TimelineNodeType {
    const typeMap: Record<string, TimelineNodeType> = {
      'education': TimelineNodeType.Education,
      'job': TimelineNodeType.Job,
      'project': TimelineNodeType.Project,
      'event': TimelineNodeType.Event,
      'action': TimelineNodeType.Action,
      'careerTransition': TimelineNodeType.CareerTransition,
      'careertransition': TimelineNodeType.CareerTransition,
      'transition': TimelineNodeType.CareerTransition,
    };

    return typeMap[type.toLowerCase()] || TimelineNodeType.Event;
  }

  /**
   * Get or create organization
   */
  private async getOrCreateOrganization(name: string, type: 'company' | 'educational_institution'): Promise<number | null> {
    if (!name) return null;

    // Check cache first
    const cacheKey = `${type}:${name.toLowerCase()}`;
    if (this.orgCache.has(cacheKey)) {
      return this.orgCache.get(cacheKey)!;
    }

    try {
      // Check if organization exists
      const existing = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.name, name))
        .limit(1);

      if (existing.length > 0) {
        this.orgCache.set(cacheKey, existing[0].id);
        return existing[0].id;
      }

      // Create new organization
      const result = await this.db
        .insert(organizations)
        .values({
          name,
          type,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: organizations.id });

      const orgId = result[0].id;
      this.orgCache.set(cacheKey, orgId);
      console.log(`  🏢 Created organization: ${name} (${type}) - ID: ${orgId}`);
      return orgId;
    } catch (error) {
      console.error(`❌ Error creating organization ${name}:`, error);
      return null;
    }
  }

  /**
   * Process meta field based on node type - all fields now in meta
   */
  private async cleanMetaField(nodeType: TimelineNodeType, node: any): Promise<Record<string, any>> {
    const meta = node.meta || {};

    if (nodeType === TimelineNodeType.Job) {
      const orgId = await this.getOrCreateOrganization(meta.company, 'company');
      return {
        company: meta.company,
        role: meta.role,
        location: meta.location,
        startDate: meta.startDate,
        endDate: meta.endDate || null,
        ...(orgId && { orgId }),
      };
    } else if (nodeType === TimelineNodeType.Education) {
      const orgId = await this.getOrCreateOrganization(meta.institution, 'educational_institution');
      return {
        institution: meta.institution,
        degree: meta.degree,
        field: meta.field,
        startDate: meta.startDate,
        endDate: meta.endDate || null,
        ...(orgId && { orgId }),
      };
    } else {
      // Other nodes have title, description, startDate, endDate in meta
      return {
        title: meta.title,
        description: meta.description,
        startDate: meta.startDate,
        endDate: meta.endDate || null,
      };
    }
  }

  /**
   * Insert a single user and return the user ID
   */
  async insertUser(profile: GeneratedProfile): Promise<number> {
    // Generate a simple password hash (for demo purposes)
    const passwordHash = await bcrypt.hash('demo-password-123', 10);

    // Use userName from profile or create from email
    const userName = profile.userName || profile.email.split('@')[0].toLowerCase();

    const userData = {
      email: profile.email,
      password: passwordHash,
      firstName: profile.firstName,
      lastName: profile.lastName,
      userName,
      interest: profile.interest || null,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
    };

    console.log(`👤 Inserting user: ${userData.firstName} ${userData.lastName} (${userData.email})`);

    try {
      const result = await this.db.insert(users).values(userData).returning({ id: users.id });
      return result[0].id;
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique constraint')) {
        console.log(`🔄 User ${userData.email} already exists, updating profile...`);

        // Get existing user ID
        const existingUser = await this.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, userData.email))
          .limit(1);

        if (existingUser[0]) {
          const userId = existingUser[0].id;

          // Update existing user with new data
          await this.db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              userName: userData.userName,
              interest: userData.interest,
              hasCompletedOnboarding: userData.hasCompletedOnboarding,
            })
            .where(eq(users.id, userId));

          // Clean up existing timeline nodes and insights for fresh reload
          await this.cleanupExistingData(userId);

          console.log(`✅ Updated existing user ${userData.email} (ID: ${userId})`);
          return userId;
        }
        return 0;
      }
      throw error;
    }
  }

  /**
   * Clean up existing timeline nodes and insights for a user
   */
  private async cleanupExistingData(userId: number): Promise<void> {
    try {
      // Delete insights first (due to foreign key constraints)
      const existingNodes = await this.db
        .select({ id: timelineNodes.id })
        .from(timelineNodes)
        .where(eq(timelineNodes.userId, userId));

      if (existingNodes.length > 0) {
        const nodeIds = existingNodes.map(node => node.id);
        await this.db
          .delete(nodeInsights)
          .where(inArray(nodeInsights.nodeId, nodeIds));

        console.log(`🧹 Cleaned up ${existingNodes.length} existing timeline nodes and insights`);
      }

      // Delete timeline nodes (cascading will handle closure table)
      await this.db
        .delete(timelineNodes)
        .where(eq(timelineNodes.userId, userId));

    } catch (error) {
      console.warn('⚠️ Error during cleanup:', error);
    }
  }

  /**
   * Insert timeline nodes using HierarchyService (includes automatic pgvector sync)
   */
  async insertTimelineNodes(userId: number, nodes: GeneratedProfile['timelineNodes']): Promise<Map<string, string>> {
    console.log(`🌳 Inserting ${nodes.length} timeline nodes for user ${userId}`);

    const nodeIdMapping = new Map<string, string>(); // old_id -> new_uuid

    // Sort nodes to insert root nodes first
    const rootNodes = nodes.filter(node => !node.parentId);
    const childNodes = nodes.filter(node => node.parentId);

    // Insert root nodes first using HierarchyService
    for (const node of rootNodes) {
      try {
        const nodeType = this.normalizeNodeType(node.type);
        const cleanMeta = await this.cleanMetaField(nodeType, node);

        const createDTO = {
          type: nodeType,
          parentId: null,
          meta: cleanMeta
        };

        let createdNode;
        if (this.hierarchyService && this.enableServiceSync) {
          // Use HierarchyService for creation (includes pgvector sync)
          createdNode = await this.hierarchyService.createNode(createDTO, userId);
        } else {
          // Fallback to direct database insertion
          const nodeData = {
            type: nodeType,
            parentId: null,
            meta: cleanMeta,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const result = await this.db.insert(timelineNodes).values(nodeData).returning({ id: timelineNodes.id });
          createdNode = { id: result[0].id };
        }

        const newNodeId = createdNode.id;
        nodeIdMapping.set(node.id, newNodeId);

        const title = nodeType === 'job' ? node.meta?.role : nodeType === 'education' ? node.meta?.degree : node.meta?.title;
        console.log(`  ✅ Root node: ${title || 'Unknown'} (${nodeType}) -> ${newNodeId}${this.enableServiceSync ? ' [pgvector synced]' : ''}`);
      } catch (error) {
        console.error(`❌ Error inserting root node ${node.id}:`, error);
      }
    }

    // Insert child nodes using HierarchyService
    for (const node of childNodes) {
      try {
        const nodeType = this.normalizeNodeType(node.type);
        const cleanMeta = await this.cleanMetaField(nodeType, node);

        // Map parent ID to new UUID
        const newParentId = node.parentId ? nodeIdMapping.get(node.parentId) : null;

        if (node.parentId && !newParentId) {
          console.warn(`⚠️ Parent node ${node.parentId} not found for child ${node.id}, skipping...`);
          continue;
        }

        const createDTO = {
          type: nodeType,
          parentId: newParentId,
          meta: cleanMeta
        };

        let createdNode;
        if (this.hierarchyService && this.enableServiceSync) {
          // Use HierarchyService for creation (includes pgvector sync)
          createdNode = await this.hierarchyService.createNode(createDTO, userId);
        } else {
          // Fallback to direct database insertion
          const nodeData = {
            type: nodeType,
            parentId: newParentId,
            meta: cleanMeta,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const result = await this.db.insert(timelineNodes).values(nodeData).returning({ id: timelineNodes.id });
          createdNode = { id: result[0].id };
        }

        const newNodeId = createdNode.id;
        nodeIdMapping.set(node.id, newNodeId);

        const title = nodeType === 'job' ? node.meta?.role : nodeType === 'education' ? node.meta?.degree : node.meta?.title;
        console.log(`  ✅ Child node: ${title || 'Unknown'} (${nodeType}) -> ${newNodeId}${this.enableServiceSync ? ' [pgvector synced]' : ''}`);
      } catch (error) {
        console.error(`❌ Error inserting child node ${node.id}:`, error);
      }
    }

    return nodeIdMapping;
  }

  /**
   * Insert insights for timeline nodes
   */
  async insertInsights(insights: GeneratedProfile['insights'] = [], nodeIdMapping: Map<string, string>): Promise<void> {
    if (!insights.length) {
      console.log('📝 No insights to insert');
      return;
    }

    console.log(`📝 Inserting ${insights.length} insights`);

    for (const insight of insights) {
      const newNodeId = nodeIdMapping.get(insight.nodeId);

      if (!newNodeId) {
        console.warn(`⚠️ Node ${insight.nodeId} not found for insight, skipping...`);
        continue;
      }

      const insightData = {
        nodeId: newNodeId,
        description: insight.description,
        resources: insight.resources || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.db.insert(nodeInsights).values(insightData);
        console.log(`  ✅ Insight for node ${newNodeId}`);
      } catch (error) {
        console.error(`❌ Error inserting insight:`, error);
      }
    }
  }

  /**
   * Load all profiles to PostgreSQL
   */
  async loadAllProfiles(batchSize: number = 5): Promise<void> {
    console.log('\n🚀 Starting PostgreSQL loading process...\n');

    const profiles = await this.loadProfileFiles();

    let processed = 0;
    let successful = 0;

    for (const profile of profiles) {
      try {
        console.log(`\n--- Processing Profile ${processed + 1}/${profiles.length} ---`);

        // Insert user
        const userId = await this.insertUser(profile);

        // Insert timeline nodes
        const nodeIdMapping = await this.insertTimelineNodes(userId, profile.timelineNodes);

        // Insert insights
        await this.insertInsights(profile.insights, nodeIdMapping);

        successful++;
        console.log(`✅ Successfully loaded profile for user ID ${userId}`);

        // Small delay to avoid overwhelming the database
        if (processed % batchSize === 0 && processed > 0) {
          console.log(`\n⏸️ Batch of ${batchSize} completed, pausing briefly...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error processing profile ${profile.email}:`, error);
      }

      processed++;
    }

    console.log(`\n✅ Loading complete! ${successful}/${processed} profiles loaded successfully.`);

    if (this.enableServiceSync && successful > 0) {
      console.log('🔍 Timeline nodes automatically synced to pgvector via HierarchyService');
    }
  }

  /**
   * Validate the loaded data
   */
  async validateData(): Promise<void> {
    console.log('\n🔍 Validating loaded data...');

    try {
      // Count users
      const userCount = await this.db.select().from(users);
      console.log(`👥 Total users: ${userCount.length}`);

      // Count timeline nodes by type
      const nodesByType = await this.db.select().from(timelineNodes);
      const typeCounts = nodesByType.reduce((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('🌳 Timeline nodes by type:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      // Count insights
      const insightCount = await this.db.select().from(nodeInsights);
      console.log(`📝 Total insights: ${insightCount.length}`);

      // Check for orphaned nodes (child nodes without parents)
      const orphanedNodes = nodesByType.filter(node => {
        if (!node.parentId) return false; // Root nodes are fine
        return !nodesByType.find(parent => parent.id === node.parentId);
      });

      if (orphanedNodes.length > 0) {
        console.warn(`⚠️ Found ${orphanedNodes.length} orphaned nodes`);
      } else {
        console.log('✅ No orphaned nodes found');
      }

    } catch (error) {
      console.error('❌ Error during validation:', error);
    }
  }

  /**
   * Clean up database connections
   */
  async cleanup(): Promise<void> {
    await this.sql.end();
    await this.pool.end();
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const batchSizeIndex = args.indexOf('--batch-size');
  const batchSize = batchSizeIndex !== -1 ? parseInt(args[batchSizeIndex + 1]) : 5;

  if (isNaN(batchSize) || batchSize < 1) {
    console.error('❌ Invalid batch size. Please provide a positive number.');
    process.exit(1);
  }

  const loader = new PostgreSQLLoader();

  try {
    await loader.loadAllProfiles(batchSize);
    await loader.validateData();
    console.log('\n🎉 Step 2: PostgreSQL loading completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await loader.cleanup();
  }
}

// Run if executed directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PostgreSQLLoader };
