#!/usr/bin/env tsx
/**
 * Enhanced Test User Generation with Updates and Insights
 *
 * This script generates test users with:
 * - Realistic career journeys
 * - Job search updates (for activity scoring)
 * - Experience-based insights (for relevance matching)
 * - JSON export/import capability
 * - Maintains test user convention
 *
 * Usage:
 *   # Generate JSON profiles
 *   npx tsx generate-enhanced-test-users.ts generate --count 10 --output test-users.json
 *
 *   # Load from JSON to database
 *   npx tsx generate-enhanced-test-users.ts load --input test-users.json
 *
 *   # Generate and load in one step
 *   npx tsx generate-enhanced-test-users.ts generate --count 10 --load
 *
 *   # Cleanup test users
 *   npx tsx generate-enhanced-test-users.ts cleanup --confirm
 */

import { Command } from 'commander';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import ora from 'ora';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, inArray, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import {
  users,
  organizations,
  timelineNodes,
  nodeInsights,
  updates,
  TimelineNodeType,
  OrganizationType,
  ProjectType,
  ProjectStatus,
} from '@journey/schema';

// Constants - maintain existing convention
const TEST_USER_PASSWORD = 'TestUser123!';
const TEST_USER_DOMAIN = 'test-lighthouse.com';
const SALT_ROUNDS = 10;

// Enhanced schemas for generation including updates and insights
const UpdateGenerationSchema = z.object({
  updateType: z.enum(['job-search', 'interview', 'offer', 'profile-update', 'career-move']),
  content: z.string().describe('Brief update about job search activity'),
  meta: z.object({
    appliedToJobs: z.boolean().optional(),
    pendingInterviews: z.boolean().optional(),
    hadInterviews: z.boolean().optional(),
    receivedOffers: z.boolean().optional(),
    receivedRejections: z.boolean().optional(),
    updatedProfile: z.boolean().optional(),
    updatedResume: z.boolean().optional(),
  }).describe('Activity flags for scoring'),
});

const InsightGenerationSchema = z.object({
  description: z.string().min(50).max(500).describe('A meaningful learning or advice from this experience'),
  resources: z.array(z.string()).default([]).describe('Related resources'),
});

const JobWithDetailsSchema = z.object({
  role: z.string(),
  company: z.string(),
  location: z.string(),
  description: z.string(),
  startDate: z.string().describe('YYYY-MM format'),
  endDate: z.string().nullable().describe('YYYY-MM format or null if current'),
  technologies: z.array(z.string()).optional(),
  projects: z.array(z.object({
    title: z.string(),
    description: z.string(),
    projectType: z.enum(['professional', 'personal', 'academic', 'freelance', 'open-source']),
    technologies: z.array(z.string()),
    startDate: z.string(),
    endDate: z.string(),
  })).min(2).max(4),
  insights: z.array(InsightGenerationSchema).min(2).max(3),
});

const CareerJourneyWithUpdatesSchema = z.object({
  summary: z.string(),
  currentStatus: z.enum(['actively-searching', 'passively-looking', 'not-looking', 'recently-started']),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    field: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    insights: z.array(InsightGenerationSchema).min(1).max(2),
  })),
  jobs: z.array(JobWithDetailsSchema).min(2).max(4),
  recentUpdates: z.array(UpdateGenerationSchema).min(3).max(8).describe('Recent job search activity'),
});

// Test user profile structure for JSON
interface TestUserProfile {
  user: {
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
    interest: string;
  };
  career: {
    summary: string;
    currentStatus: string;
    education: Array<{
      school: string;
      degree: string;
      field: string;
      startDate: string;
      endDate: string;
      insights: Array<{ description: string; resources: string[] }>;
    }>;
    jobs: Array<{
      role: string;
      company: string;
      location: string;
      description: string;
      startDate: string;
      endDate: string | null;
      technologies?: string[];
      projects: Array<{
        title: string;
        description: string;
        projectType: string;
        technologies: string[];
        startDate: string;
        endDate: string;
      }>;
      insights: Array<{ description: string; resources: string[] }>;
    }>;
    recentUpdates: Array<{
      updateType: string;
      content: string;
      meta: Record<string, boolean>;
    }>;
  };
}

class EnhancedTestUserGenerator {
  private spinner = ora();

  /**
   * Generate complete career journey with updates using LLM
   */
  async generateCareerJourney(persona: string): Promise<TestUserProfile> {
    const shortId = faker.string.alphanumeric(6);
    const yearsExperience = faker.number.int({ min: 2, max: 15 });
    const currentYear = new Date().getFullYear();

    const prompt = `Generate a realistic career journey for a ${persona} with ${yearsExperience} years of experience.
    Current year is ${currentYear}.

    IMPORTANT: Generate valid JSON with exactly this structure:
    - summary: Brief career summary
    - currentStatus: One of: actively-searching, passively-looking, not-looking, recently-started
    - education: 1-2 education entries with insights
    - jobs: 2-3 jobs with projects and insights
    - recentUpdates: 3-5 job search updates

    Keep all text fields concise and under 300 characters.
    Dates must be YYYY-MM format.
    Each job should have 2-3 projects.
    Each experience should have 2 insights.

    Focus on ${persona === 'engineer' ? 'software development, cloud, and modern frameworks' :
      persona === 'product' ? 'product strategy, user research, and metrics' :
      persona === 'design' ? 'UX, design systems, and user research' :
      'data science, ML, and analytics'}.`;

    let journey;
    let retries = 3;

    while (retries > 0) {
      try {
        const result = await generateObject({
          model: openai('gpt-4o-mini'),
          schema: CareerJourneyWithUpdatesSchema,
          prompt,
          temperature: 0.7, // Lower temperature for more consistent output
        });
        journey = result.object;
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.warn(`Generation failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!journey) {
      throw new Error('Failed to generate journey after retries');
    }

    // Create user data
    const userData = {
      email: `test.${persona}.${shortId}@${TEST_USER_DOMAIN}`,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      userName: `test_${persona}_${shortId}`,
      interest: this.getInterestFromStatus(journey.currentStatus),
    };

    return {
      user: userData,
      career: journey,
    };
  }

  /**
   * Generate multiple test user profiles
   */
  async generateProfiles(count: number, persona?: string): Promise<TestUserProfile[]> {
    this.spinner.start(`Generating ${count} test user profiles...`);

    const profiles: TestUserProfile[] = [];
    const personas = persona ? [persona] : ['engineer', 'product', 'design', 'data'];

    for (let i = 0; i < count; i++) {
      try {
        const selectedPersona = faker.helpers.arrayElement(personas);
        const profile = await this.generateCareerJourney(selectedPersona);
        profiles.push(profile);

        this.spinner.text = `Generated ${i + 1}/${count} profiles...`;

        // Rate limiting for API calls
        if ((i + 1) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate profile ${i}:`, error);
      }
    }

    this.spinner.succeed(`Generated ${profiles.length} test user profiles`);
    return profiles;
  }

  /**
   * Save profiles to JSON file
   */
  async saveToJson(profiles: TestUserProfile[], outputPath: string) {
    this.spinner.start('Saving profiles to JSON...');

    const data = {
      version: '1.0',
      generated: new Date().toISOString(),
      count: profiles.length,
      profiles,
    };

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    this.spinner.succeed(`Saved ${profiles.length} profiles to ${outputPath}`);
  }

  /**
   * Load profiles from JSON file
   */
  async loadFromJson(inputPath: string): Promise<TestUserProfile[]> {
    this.spinner.start('Loading profiles from JSON...');

    const content = await fs.readFile(inputPath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.profiles || !Array.isArray(data.profiles)) {
      throw new Error('Invalid JSON format: missing profiles array');
    }

    this.spinner.succeed(`Loaded ${data.profiles.length} profiles from ${inputPath}`);
    return data.profiles;
  }

  /**
   * Map current status to user interest
   */
  private getInterestFromStatus(status: string): string {
    switch (status) {
      case 'actively-searching':
        return 'find-job';
      case 'passively-looking':
        return 'grow-career';
      case 'recently-started':
        return 'grow-career';
      default:
        return 'change-careers';
    }
  }
}

class TestUserLoader {
  private db: any;
  private pool: Pool;
  private passwordHash: string = '';
  private organizationCache: Map<string, number> = new Map();
  private spinner = ora();

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/lighthouse';
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  async initialize() {
    // Pre-hash password
    this.passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, SALT_ROUNDS);

    // Load organizations
    const orgs = await this.db.select().from(organizations);
    orgs.forEach((org: any) => {
      this.organizationCache.set(org.name, org.id);
    });
  }

  /**
   * Load profiles into database
   */
  async loadProfiles(profiles: TestUserProfile[]) {
    await this.initialize();

    this.spinner.start(`Loading ${profiles.length} profiles into database...`);

    let successCount = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        await this.loadSingleProfile(profile);
        successCount++;
        this.spinner.text = `Loaded ${successCount}/${profiles.length} profiles...`;
      } catch (error) {
        errors.push(`${profile.user.email}: ${error}`);
      }
    }

    this.spinner.succeed(`Successfully loaded ${successCount} profiles`);

    if (errors.length > 0) {
      console.error(`\n⚠️ ${errors.length} profiles failed:`);
      errors.slice(0, 5).forEach(err => console.error(`  - ${err}`));
    }

    await this.pool.end();
  }

  /**
   * Load a single profile
   */
  private async loadSingleProfile(profile: TestUserProfile) {
    // Create user
    const [user] = await this.db.insert(users).values({
      email: profile.user.email,
      password: this.passwordHash,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      userName: profile.user.userName,
      interest: profile.user.interest,
      hasCompletedOnboarding: true,
    }).returning();

    // Create education nodes with insights
    for (const edu of profile.career.education) {
      const orgId = await this.getOrCreateOrganization(
        edu.school,
        OrganizationType.EducationalInstitution
      );

      const [eduNode] = await this.db.insert(timelineNodes).values({
        userId: user.id,
        type: TimelineNodeType.Education,
        title: `${edu.degree} in ${edu.field}`,
        description: `Studied ${edu.field} at ${edu.school}`,
        startDate: new Date(edu.startDate),
        endDate: new Date(edu.endDate),
        meta: {
          orgId,
          degree: edu.degree,
          field: edu.field,
          school: edu.school,
        },
      }).returning();

      // Add education insights
      for (const insight of edu.insights) {
        await this.db.insert(nodeInsights).values({
          nodeId: eduNode.id,
          description: insight.description,
          resources: insight.resources,
        });
      }
    }

    // Create job nodes with projects and insights
    for (const job of profile.career.jobs) {
      const orgId = await this.getOrCreateOrganization(
        job.company,
        OrganizationType.Company
      );

      const [jobNode] = await this.db.insert(timelineNodes).values({
        userId: user.id,
        type: TimelineNodeType.Job,
        title: job.role,
        description: job.description,
        startDate: new Date(job.startDate),
        endDate: job.endDate ? new Date(job.endDate) : null,
        meta: {
          orgId,
          role: job.role,
          company: job.company,
          location: job.location,
          technologies: job.technologies || [],
        },
      }).returning();

      // Add job insights
      for (const insight of job.insights) {
        await this.db.insert(nodeInsights).values({
          nodeId: jobNode.id,
          description: insight.description,
          resources: insight.resources,
        });
      }

      // Create projects under job
      for (const project of job.projects) {
        const [projectNode] = await this.db.insert(timelineNodes).values({
          userId: user.id,
          parentId: jobNode.id,
          type: TimelineNodeType.Project,
          title: project.title,
          description: project.description,
          startDate: new Date(project.startDate),
          endDate: new Date(project.endDate),
          meta: {
            projectType: project.projectType as ProjectType,
            status: ProjectStatus.Completed,
            technologies: project.technologies,
          },
        }).returning();

        // Add project insights (derived from job insights)
        if (faker.datatype.boolean({ probability: 0.5 })) {
          await this.db.insert(nodeInsights).values({
            nodeId: projectNode.id,
            description: `Key learning from ${project.title}: ${faker.helpers.arrayElement([
              'Importance of iterative development and user feedback',
              'Value of comprehensive testing and code reviews',
              'Benefits of clear documentation and knowledge sharing',
              'Impact of performance optimization on user experience',
            ])}`,
            resources: [],
          });
        }
      }
    }

    // Create recent updates for job search activity
    const recentDate = new Date();
    for (let i = 0; i < profile.career.recentUpdates.length; i++) {
      const update = profile.career.recentUpdates[i];

      // Space updates over the last 30 days
      const daysAgo = Math.floor((i / profile.career.recentUpdates.length) * 30);
      const updateDate = new Date(recentDate);
      updateDate.setDate(updateDate.getDate() - daysAgo);

      // Find most recent job node for the update
      const [recentNode] = await this.db
        .select()
        .from(timelineNodes)
        .where(
          sql`${timelineNodes.userId} = ${user.id} AND ${timelineNodes.type} = 'job'`
        )
        .orderBy(sql`${timelineNodes.startDate} DESC`)
        .limit(1);

      await this.db.insert(updates).values({
        userId: user.id,
        nodeId: recentNode?.id || null,
        updateType: update.updateType,
        content: update.content,
        meta: update.meta,
        createdAt: updateDate,
      });
    }
  }

  /**
   * Get or create organization
   */
  private async getOrCreateOrganization(name: string, type: OrganizationType): Promise<number> {
    if (this.organizationCache.has(name)) {
      return this.organizationCache.get(name)!;
    }

    try {
      const [org] = await this.db
        .insert(organizations)
        .values({
          name,
          type,
          metadata: { isTestData: true },
        })
        .returning();

      this.organizationCache.set(name, org.id);
      return org.id;
    } catch (error: any) {
      if (error.code === '23505') {
        const [existing] = await this.db
          .select()
          .from(organizations)
          .where(eq(organizations.name, name));

        if (existing) {
          this.organizationCache.set(name, existing.id);
          return existing.id;
        }
      }
      throw error;
    }
  }
}

/**
 * Cleanup functionality
 */
class TestUserCleaner {
  private db: any;
  private pool: Pool;
  private spinner = ora();

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/lighthouse';
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  async cleanup(confirm: boolean) {
    this.spinner.start('Finding test users...');

    // Find test users
    const testUsers = await this.db
      .select()
      .from(users)
      .where(like(users.email, `%@${TEST_USER_DOMAIN}`));

    this.spinner.succeed(`Found ${testUsers.length} test users`);

    if (testUsers.length === 0) {
      console.log('✅ No test users to clean up.');
      await this.pool.end();
      return;
    }

    console.log('\n📋 Test users to be deleted:');
    testUsers.slice(0, 5).forEach((user: any) => {
      console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
    });
    if (testUsers.length > 5) {
      console.log(`  ... and ${testUsers.length - 5} more`);
    }

    if (!confirm) {
      console.log('\n⚠️  Use --confirm to delete these users');
      await this.pool.end();
      return;
    }

    this.spinner.start('Deleting test users and data...');

    const userIds = testUsers.map((u: any) => u.id);

    await this.db.transaction(async (tx: any) => {
      // Delete in correct order
      const nodes = await tx
        .select({ id: timelineNodes.id })
        .from(timelineNodes)
        .where(inArray(timelineNodes.userId, userIds));

      if (nodes.length > 0) {
        const nodeIds = nodes.map((n: any) => n.id);
        await tx.delete(nodeInsights).where(inArray(nodeInsights.nodeId, nodeIds));
      }

      await tx.delete(updates).where(inArray(updates.userId, userIds));
      await tx.delete(timelineNodes).where(inArray(timelineNodes.userId, userIds));
      await tx.delete(users).where(inArray(users.id, userIds));
    });

    this.spinner.succeed(`Deleted ${testUsers.length} test users and all data`);
    await this.pool.end();
  }
}

// CLI
const program = new Command();

program
  .name('generate-enhanced-test-users')
  .description('Generate test users with updates and insights for enhanced matching');

program
  .command('generate')
  .description('Generate test user profiles')
  .option('-c, --count <number>', 'Number of users to generate', '10')
  .option('-p, --persona <type>', 'Persona type (engineer, product, design, data)')
  .option('-o, --output <file>', 'Output JSON file', 'test-users.json')
  .option('-l, --load', 'Load to database after generation', false)
  .action(async (options) => {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is required');
      process.exit(1);
    }

    const generator = new EnhancedTestUserGenerator();

    try {
      // Generate profiles
      const profiles = await generator.generateProfiles(
        parseInt(options.count),
        options.persona
      );

      // Save to JSON
      await generator.saveToJson(profiles, options.output);

      console.log('\n✨ Test user profiles generated!');
      console.log(`📊 Summary:`);
      console.log(`  - Total profiles: ${profiles.length}`);
      console.log(`  - Output file: ${options.output}`);
      console.log(`  - Includes: career journeys, updates, and insights`);

      // Optionally load to database
      if (options.load) {
        console.log('\n📦 Loading to database...');
        const loader = new TestUserLoader();
        await loader.loadProfiles(profiles);
        console.log('✅ Profiles loaded to database');
      } else {
        console.log('\n💡 To load these profiles to database:');
        console.log(`   npx tsx generate-enhanced-test-users.ts load --input ${options.output}`);
      }

      // Show sample data
      if (profiles.length > 0) {
        const sample = profiles[0];
        console.log('\n📝 Sample profile:');
        console.log(`  User: ${sample.user.email}`);
        console.log(`  Status: ${sample.career.currentStatus}`);
        console.log(`  Jobs: ${sample.career.jobs.length}`);
        console.log(`  Updates: ${sample.career.recentUpdates.length}`);
        console.log(`  Total insights: ${
          sample.career.education.flatMap(e => e.insights).length +
          sample.career.jobs.flatMap(j => j.insights).length
        }`);
      }

      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program
  .command('load')
  .description('Load test user profiles from JSON to database')
  .requiredOption('-i, --input <file>', 'Input JSON file')
  .action(async (options) => {
    try {
      const generator = new EnhancedTestUserGenerator();
      const profiles = await generator.loadFromJson(options.input);

      const loader = new TestUserLoader();
      await loader.loadProfiles(profiles);

      console.log('\n✅ Successfully loaded profiles to database');
      console.log(`📊 Summary:`);
      console.log(`  - Email pattern: test.*.XXXXXX@${TEST_USER_DOMAIN}`);
      console.log(`  - Password: ${TEST_USER_PASSWORD}`);
      console.log('\n✨ Features included:');
      console.log('  - Job search updates for activity scoring');
      console.log('  - Experience insights for relevance matching');
      console.log('  - Ready for enhanced matching validation');

      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Remove all test users and their data')
  .option('-c, --confirm', 'Confirm deletion', false)
  .action(async (options) => {
    const cleaner = new TestUserCleaner();
    await cleaner.cleanup(options.confirm);
    process.exit(0);
  });

program.parse();