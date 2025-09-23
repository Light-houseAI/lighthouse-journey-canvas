#!/usr/bin/env tsx
/**
 * Realistic Test User Generation with LLM-powered Insights
 *
 * This consolidated script generates test users with:
 * - Realistic career journeys using faker + LLM
 * - Meaningful insights that are learnings/advice based on experiences
 * - Automatic vector database synchronization
 * - Proper organizational linking
 *
 * Usage:
 *   npx tsx generate-test-users.ts --count 10 --persona engineer
 *   npx tsx generate-test-users.ts --count 50 --mixed
 *   npx tsx generate-test-users.ts cleanup --confirm
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
import {
  users,
  organizations,
  timelineNodes,
  nodeInsights,
  TimelineNodeType,
  OrganizationType,
  ProjectType,
  ProjectStatus,
  jobMetaSchema,
  educationMetaSchema,
  projectMetaSchema,
  eventMetaSchema,
  insightCreateSchema,
} from '@journey/schema';
import { HierarchyService } from '../../src/services/hierarchy-service.js';
import { canBeChildOf } from './config/hierarchy-rules.js';
import { Container } from '../../src/core/container-setup.js';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens.js';
import type { AwilixContainer } from 'awilix';

// Use the schemas directly from @journey/schema with minor extensions for LLM generation
// We omit orgId since it will be added when we find/create the organization

const EducationGenerationSchema = educationMetaSchema.extend({
  school: z.string().describe('Name of the educational institution'),
}).omit({ orgId: true });

const JobGenerationSchema = jobMetaSchema.extend({
  company: z.string().describe('Company name'),
}).omit({ orgId: true });

// Projects and events use the schemas directly as they already have all fields
const ProjectGenerationSchema = projectMetaSchema;
const EventGenerationSchema = eventMetaSchema;

// For insights, we match the nodeInsights table structure
const InsightGenerationSchema = z.object({
  description: z.string().min(20).max(500).describe('A concise learning or advice from this experience'),
  resources: z.array(z.string()).default([]).describe('Optional resources: book titles, article URLs, course names, or documentation links'),
});

const CareerJourneySchema = z.object({
  summary: z.string().describe('Brief career summary for this person'),
  education: z.array(EducationGenerationSchema).min(1).max(2).describe('Educational background'),
  jobs: z.array(JobGenerationSchema).min(2).max(4).describe('Work experience from oldest to newest'),
  totalYearsExperience: z.number().min(1).max(30).describe('Total years of professional experience'),
});

const NodeWithInsightsSchema = z.object({
  projects: z.array(ProjectGenerationSchema).min(2).max(5).describe('Projects completed in this role'),
  events: z.array(EventGenerationSchema).min(0).max(3).describe('Notable events or achievements'),
  insights: z.array(InsightGenerationSchema).min(2).max(3).describe('Key learnings from this role'),
});

// Constants
const TEST_USER_PASSWORD = 'TestUser123!';
const TEST_USER_DOMAIN = 'test-lighthouse.com';
const SALT_ROUNDS = 10;

// Career progression templates
const CAREER_PROGRESSIONS = {
  engineer: {
    earlyCareer: ['Junior Developer', 'Software Engineer I', 'Associate Engineer'],
    midCareer: ['Software Engineer II', 'Senior Software Engineer', 'Tech Lead'],
    seniorCareer: ['Staff Engineer', 'Principal Engineer', 'Distinguished Engineer'],
    leadership: ['Engineering Manager', 'Director of Engineering', 'VP Engineering'],
  },
  product: {
    earlyCareer: ['Associate Product Manager', 'Product Analyst'],
    midCareer: ['Product Manager', 'Senior Product Manager'],
    seniorCareer: ['Principal Product Manager', 'Group Product Manager'],
    leadership: ['Director of Product', 'VP Product', 'Chief Product Officer'],
  },
  design: {
    earlyCareer: ['Junior Designer', 'UX Designer'],
    midCareer: ['Senior Designer', 'Product Designer'],
    seniorCareer: ['Principal Designer', 'Design Lead'],
    leadership: ['Design Manager', 'Director of Design', 'VP Design'],
  },
  data: {
    earlyCareer: ['Data Analyst', 'Junior Data Scientist'],
    midCareer: ['Data Scientist', 'Senior Data Scientist'],
    seniorCareer: ['Staff Data Scientist', 'Principal Data Scientist'],
    leadership: ['Data Science Manager', 'Director of Data Science', 'Chief Data Officer'],
  },
};

// Company categories for realistic progression
const COMPANY_TIERS = {
  startup: [
    { name: 'TechStart', type: 'company', size: 'startup' },
    { name: 'InnovateLabs', type: 'company', size: 'startup' },
    { name: 'DataPioneer', type: 'company', size: 'startup' },
    { name: 'CloudFirst', type: 'company', size: 'startup' },
  ],
  scaleup: [
    { name: 'GrowthTech', type: 'company', size: 'scaleup' },
    { name: 'ScaleAI', type: 'company', size: 'scaleup' },
    { name: 'NextGen Systems', type: 'company', size: 'scaleup' },
  ],
  enterprise: [
    { name: 'Google', type: 'company', size: 'enterprise' },
    { name: 'Microsoft', type: 'company', size: 'enterprise' },
    { name: 'Amazon', type: 'company', size: 'enterprise' },
    { name: 'Meta', type: 'company', size: 'enterprise' },
    { name: 'Apple', type: 'company', size: 'enterprise' },
  ],
};

// Universities
const UNIVERSITIES = [
  { name: 'MIT', type: 'educational_institution' },
  { name: 'Stanford University', type: 'educational_institution' },
  { name: 'Carnegie Mellon University', type: 'educational_institution' },
  { name: 'UC Berkeley', type: 'educational_institution' },
  { name: 'Georgia Tech', type: 'educational_institution' },
];

interface GenerationOptions {
  count: number;
  persona?: string;
  mixed: boolean;
}

class RealisticTestUserGenerator {
  private container: AwilixContainer;
  private hierarchyService: HierarchyService;
  private db: any;
  private organizationCache: Map<string, number> = new Map();
  private passwordHash: string = '';
  private spinner = ora();
  private options: GenerationOptions = { count: 0, mixed: false };

  async initialize() {
    // Create a simple logger
    const logger = {
      info: (msg: string) => console.log(msg),
      error: (msg: string, error?: any) => console.error(msg, error),
      warn: (msg: string) => console.warn(msg),
      debug: (msg: string) => console.debug(msg),
    };

    this.container = await Container.configure(logger);
    this.hierarchyService = this.container.resolve(CONTAINER_TOKENS.HIERARCHY_SERVICE);
    this.db = this.container.resolve(CONTAINER_TOKENS.DATABASE);

    // Pre-hash password
    this.passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, SALT_ROUNDS);

    // Load organizations
    const orgs = await this.db.select().from(organizations);
    orgs.forEach((org: any) => {
      this.organizationCache.set(org.name, org.id);
    });
  }

  /**
   * Generate realistic career journey using structured LLM output
   */
  async generateCareerJourney(persona: string, yearsExperience: number) {
    const currentYear = new Date().getFullYear();
    const prompt = `Generate a realistic career journey for a ${persona.replace('_', ' ')} with ${yearsExperience} years of experience.
    Current year is ${currentYear}.

    Create a coherent professional journey showing natural career growth:
    - Start with education (graduation year should be ~${currentYear - yearsExperience - 4})
    - Progress through 2-4 jobs with increasing seniority
    - Include realistic company names and roles
    - Show skill development and increasing responsibilities
    - Total years of experience should be approximately ${yearsExperience}

    Focus on ${persona === 'software_engineer' || persona === 'engineer' ? 'full-stack development, cloud technologies, and modern web frameworks' :
      persona === 'product_manager' || persona === 'product' ? 'product strategy, user research, and data-driven decision making' :
      persona === 'ux_designer' || persona === 'design' ? 'user experience, design systems, and prototyping' :
      persona === 'data_scientist' || persona === 'data' ? 'machine learning, statistical analysis, and data pipelines' :
      'infrastructure, DevOps, and reliability engineering'}.`;

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: CareerJourneySchema,
      prompt,
    });

    return object;
  }

  /**
   * Generate meaningful insights using structured LLM output
   */
  async generateInsights(context: string, count: number = 3): Promise<string[]> {
    const InsightsArraySchema = z.object({
      insights: z.array(InsightGenerationSchema).min(count).max(count)
    });

    const prompt = `Based on this professional context:
    ${context}

    Generate ${count} meaningful insights that:
    - Share valuable learnings from this experience
    - Provide actionable advice for others
    - Reflect personal growth and professional wisdom
    - Are written in first person as personal reflections
    - Keep descriptions concise (under 500 characters)
    - Optionally include 1-2 resources per insight (books, article URLs, courses)

    Categories should vary between technical, leadership, growth, and collaboration insights.`;

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: InsightsArraySchema,
      prompt,
    });

    return object.insights.map(insight => insight.description);
  }

  /**
   * Generate job details with projects using structured output
   */
  async generateJobWithProjects(jobContext: any, persona: string) {
    const prompt = `Generate a detailed job experience for:
    Company: ${jobContext.company}
    Role: ${jobContext.role}
    Period: ${jobContext.startDate} to ${jobContext.endDate || 'Present'}
    Field: ${persona.replace('_', ' ')}

    Create realistic:
    - 3-5 projects with:
      * Clear titles and descriptions
      * Appropriate technologies for this role
      * Start/end dates within the job period (YYYY-MM format)
      * Project types (professional/personal/academic/freelance/open-source)
      * All projects should have status: completed
    - 2-3 events (conferences, certifications, recognitions) with:
      * Titles and descriptions
      * Dates in YYYY-MM format within the job period
    - 2-3 insights that are concise learnings from this role`;

    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: NodeWithInsightsSchema,
      prompt,
    });

    return object;
  }



  /**
   * Generate a template project for fallback
   */
  generateProject(persona: string) {
    const projectTypes = {
      engineer: [
        { title: 'Platform Migration', description: 'Led migration to microservices architecture', impact: 'Reduced latency by 40%' },
        { title: 'API Development', description: 'Built RESTful API serving 100K requests/day', impact: 'Improved response time by 60%' },
        { title: 'Performance Optimization', description: 'Optimized database queries and caching', impact: 'Cut load times by 50%' },
      ],
      product: [
        { title: 'Feature Launch', description: 'Launched subscription model', impact: 'Increased revenue by 30%' },
        { title: 'User Research', description: 'Conducted user interviews and A/B tests', impact: 'Improved retention by 25%' },
        { title: 'Roadmap Planning', description: 'Defined product strategy for Q3/Q4', impact: 'Aligned team on priorities' },
      ],
      design: [
        { title: 'Design System', description: 'Created component library and guidelines', impact: 'Reduced design debt by 40%' },
        { title: 'User Flow Redesign', description: 'Reimagined onboarding experience', impact: 'Increased completion by 35%' },
        { title: 'Accessibility Audit', description: 'Improved WCAG compliance', impact: 'Made product accessible to all' },
      ],
      data: [
        { title: 'ML Pipeline', description: 'Built recommendation engine', impact: 'Increased engagement by 45%' },
        { title: 'Data Warehouse', description: 'Migrated to modern data stack', impact: 'Reduced query time by 70%' },
        { title: 'Analytics Dashboard', description: 'Created executive KPI dashboard', impact: 'Enabled data-driven decisions' },
      ],
    };

    const templates = projectTypes[persona as keyof typeof projectTypes] || projectTypes.engineer;
    const project = faker.helpers.arrayElement(templates);

    return {
      title: project.title,
      description: project.description,
      impact: project.impact,
      technologies: faker.helpers.arrayElements(
        persona === 'engineer' ? ['React', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL'] :
        persona === 'product' ? ['Jira', 'Amplitude', 'Figma', 'SQL', 'Looker'] :
        persona === 'design' ? ['Figma', 'Sketch', 'Framer', 'Principle', 'Adobe XD'] :
        ['Python', 'TensorFlow', 'Spark', 'Airflow', 'BigQuery'],
        3
      ),
      projectType: ProjectType.Professional,
      duration_months: faker.number.int({ min: 3, max: 12 })
    };
  }

  /**
   * Generate a template event
   */
  generateEvent() {
    const events = [
      { title: 'AWS Certification', description: 'Achieved AWS Solutions Architect certification', category: 'certification' },
      { title: 'Tech Talk', description: 'Presented on microservices at company tech talk', category: 'achievement' },
      { title: 'Conference Speaker', description: 'Spoke at React Summit about performance', category: 'conference' },
      { title: 'Team Award', description: 'Received excellence award for project delivery', category: 'recognition' },
    ];

    return faker.helpers.arrayElement(events);
  }

  /**
   * Get or create organization
   */
  async getOrCreateOrganization(name: string, type: OrganizationType): Promise<number> {
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

  /**
   * Generate a complete test user with realistic journey
   */
  async generateTestUser(persona: string, options: GenerationOptions) {
    const shortId = faker.string.alphanumeric(6);
    const yearsExperience = faker.number.int({ min: 2, max: 15 });

    // Create user
    const userData = {
      email: `test.${persona}.${shortId}@${TEST_USER_DOMAIN}`,
      password: this.passwordHash,
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      userName: `test_${persona}_${shortId}`,
      interest: faker.helpers.arrayElement(['find-job', 'grow-career', 'change-careers', 'start-startup']),
      hasCompletedOnboarding: true,
    };

    const [user] = await this.db.insert(users).values(userData).returning();

    // Generate career journey
    const journey = await this.generateCareerJourney(persona, yearsExperience);

    // Create education nodes
    for (const edu of journey.education) {
      // Validate education can be root node
      if (!canBeChildOf(TimelineNodeType.Education, null)) {
        console.error('❌ Education cannot be root node');
        continue;
      }

      const orgId = await this.getOrCreateOrganization(edu.school, OrganizationType.EducationalInstitution);

      const eduNode = await this.hierarchyService.createNode(
        {
          type: 'education',
          meta: {
            orgId,
            degree: edu.degree,
            field: edu.field,
            location: faker.location.city(),
            description: edu.description || `Studied ${edu.field}`,
            startDate: edu.startDate,
            endDate: edu.endDate,
          },
        },
        user.id
      );

      // Add education insights
      const eduContext = `Education: ${edu.degree} in ${edu.field} from ${edu.school}`;
      const eduInsights = await this.generateInsights(eduContext, 2);

      for (const insight of eduInsights) {
        await this.hierarchyService.createInsight(
          eduNode.id,
          { description: insight, resources: [] },
          user.id
        );
      }
    }

    // Create job nodes with projects
    for (const job of journey.jobs) {
      // Validate job can be root node
      if (!canBeChildOf(TimelineNodeType.Job, null)) {
        console.error('❌ Job cannot be root node');
        continue;
      }

      const orgId = await this.getOrCreateOrganization(job.company, OrganizationType.Company);

      const jobNode = await this.hierarchyService.createNode(
        {
          type: 'job',
          meta: {
            orgId,
            role: job.role,
            location: job.location || faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
            description: job.description || `${job.role} at ${job.company}`,
            startDate: job.startDate,
            ...(job.endDate && { endDate: job.endDate }),
          },
        },
        user.id
      );

      // Generate structured job details with projects
      const jobDetails = await this.generateJobWithProjects(job, persona);

      // Create projects under this job
      const projects = jobDetails.projects || [];

      for (const project of projects) {
        // Validate project can be child of job
        if (!canBeChildOf(TimelineNodeType.Project, TimelineNodeType.Job)) {
          console.error('❌ Project cannot be child of Job');
          continue;
        }

        const projectNode = await this.hierarchyService.createNode(
          {
            type: 'project',
            parentId: jobNode.id,
            meta: {
              title: project.title,
              description: project.description,
              projectType: project.projectType || ProjectType.Professional,
              status: project.status || ProjectStatus.Completed,
              technologies: project.technologies || [],
              startDate: project.startDate,
              endDate: project.endDate,
            },
          },
          user.id
        );

        // Add project insights
        const projectContext = `Project: ${project.title} - ${project.description}`;
        const projectInsights = await this.generateInsights(projectContext, 2);

        for (const insight of projectInsights) {
          await this.hierarchyService.createInsight(
            projectNode.id,
            { description: insight, resources: [] },
            user.id
          );
        }

        // Add events from structured output if available
        if (jobDetails?.events && jobDetails.events.length > 0 && faker.datatype.boolean({ probability: 0.5 })) {
          const event = jobDetails.events[0];

          // Validate event can be child of project
          if (canBeChildOf(TimelineNodeType.Event, TimelineNodeType.Project)) {
            await this.hierarchyService.createNode(
              {
                type: 'event',
                parentId: projectNode.id,
                meta: {
                  title: event.title,
                  description: event.description,
                  startDate: event.startDate,
                  endDate: event.endDate,
                },
              },
              user.id
            );
          }
        }
      }

      // Add job insights (from structured output or generated)
      const jobInsights = jobDetails.insights?.map(i => i.description) ||
        await this.generateInsights(`${job.role} at ${job.company}: ${job.description || ''}`, 3);

      for (const insight of jobInsights) {
        await this.hierarchyService.createInsight(
          jobNode.id,
          { description: insight, resources: [] },
          user.id
        );
      }
    }

    return user;
  }

  /**
   * Main generation function
   */
  async generate(options: GenerationOptions) {
    this.options = options; // Set the instance options
    await this.initialize();

    this.spinner.start(`Generating ${options.count} realistic test users...`);

    const results = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < options.count; i++) {
      try {
        const persona = options.mixed
          ? faker.helpers.arrayElement(['engineer', 'product', 'design', 'data'])
          : options.persona || 'engineer';

        const user = await this.generateTestUser(persona, options);
        results.push(user);

        this.spinner.text = `Generated ${i + 1}/${options.count} users with realistic journeys...`;

        // Rate limiting for API calls
        if (options.useLLM && (i + 1) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate user ${i}:`, error);
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    this.spinner.succeed(`Successfully generated ${results.length} realistic test users!`);

    if (errors.length > 0) {
      console.error(`\n⚠️  ${errors.length} users failed:`);
      errors.slice(0, 5).forEach(({ index, error }) => {
        console.error(`  - User ${index}: ${error}`);
      });
    }

    return results;
  }
}

/**
 * Cleanup functionality
 */
class TestUserCleaner {
  private db: any;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/lighthouse';
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool);
  }

  async cleanup(confirm: boolean) {
    const spinner = ora('Finding test users...').start();

    // Find test users
    const testUsers = await this.db
      .select()
      .from(users)
      .where(like(users.email, `%@${TEST_USER_DOMAIN}`));

    spinner.succeed(`Found ${testUsers.length} test users`);

    if (testUsers.length === 0) {
      console.log('✅ No test users to clean up.');
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
      return;
    }

    spinner.start('Deleting test users and data...');

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

      await tx.delete(timelineNodes).where(inArray(timelineNodes.userId, userIds));
      await tx.delete(users).where(inArray(users.id, userIds));
    });

    spinner.succeed(`Deleted ${testUsers.length} test users and all data`);
    await this.pool.end();
  }
}

// CLI
const program = new Command();

program
  .name('generate-test-users')
  .description('Generate test users with realistic career journeys using AI')
  .option('-c, --count <number>', 'Number of users to generate', '10')
  .option('-p, --persona <type>', 'Persona type (engineer, product, design, data)')
  .option('-m, --mixed', 'Generate mixed personas', false)
  .action(async (options) => {
    const opts: GenerationOptions = {
      count: parseInt(options.count),
      persona: options.persona,
      mixed: options.mixed || !options.persona,
    };

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is required');
      process.exit(1);
    }

    const generator = new RealisticTestUserGenerator();

    try {
      const users = await generator.generate(opts);

      console.log('\n✨ Realistic test users created!');
      console.log(`📊 Summary:`);
      console.log(`  - Total users: ${users.length}`);
      console.log(`  - Generation mode: AI-powered with structured outputs`);
      console.log(`  - Email pattern: test.*.XXXXXX@${TEST_USER_DOMAIN}`);
      console.log(`  - Password: ${TEST_USER_PASSWORD}`);

      console.log('\n📝 Sample users:');
      users.slice(0, 3).forEach(user => {
        console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`);
      });

      console.log('\n✅ Features:');
      console.log('  - Realistic career progressions');
      console.log('  - Meaningful experience-based insights');
      console.log('  - Automatic vector DB sync');
      console.log('  - Ready for GraphRAG searches');

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
