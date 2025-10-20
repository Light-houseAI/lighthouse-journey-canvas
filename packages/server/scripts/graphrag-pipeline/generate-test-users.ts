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
import OpenAI from 'openai';
import Instructor from '@instructor-ai/instructor';
import { z } from 'zod';
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
  EventType,
  ApplicationStatus,
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

const EducationGenerationSchema = z.object({
  school: z.string().describe('Name of the educational institution'),
  degree: z.string().describe('Degree type (e.g., Bachelor of Science, Master of Arts)'),
  field: z.string().nullable().describe('Field of study (e.g., Computer Science, Business Administration)'),
  location: z.string().nullable().describe('Campus location'),
  description: z.string().nullable().describe('Description of studies, research focus, or achievements'),
  startDate: z.string().describe('Start date in YYYY-MM format'),
  endDate: z.string().nullable().describe('Graduation date in YYYY-MM format'),
});

const JobGenerationSchema = z.object({
  company: z.string().describe('Company name'),
  role: z.string().describe('Job title or position'),
  location: z.string().nullable().describe('Job location (city, state)'),
  description: z.string().nullable().describe('Brief description of role and responsibilities'),
  startDate: z.string().describe('Start date in YYYY-MM format'),
  endDate: z.string().nullable().describe('End date in YYYY-MM format, omit if current'),
});

// Projects - make all optional fields nullable
const ProjectGenerationSchema = z.object({
  title: z.string().describe('Project name or title'),
  description: z.string().nullable().describe('What the project accomplished, its goals and impact'),
  technologies: z.array(z.string()).default([]).describe('Technologies, tools, and frameworks used'),
  projectType: z.nativeEnum(ProjectType).nullable().describe('Type of project (personal/professional/academic/freelance/open-source)'),
  startDate: z.string().nullable().describe('Project start date in YYYY-MM format'),
  endDate: z.string().nullable().describe('Project end date in YYYY-MM format'),
  status: z.nativeEnum(ProjectStatus).nullable().describe('Current status of the project'),
});

// Events - make all optional fields nullable
const EventGenerationSchema = z.object({
  title: z.string().describe('Event or achievement title'),
  description: z.string().nullable().describe('Description of the event, achievement, certification, or conference'),
  eventType: z.nativeEnum(EventType).default(EventType.Other).describe('Type of event. MUST be one of: interview, networking, conference, workshop, job-application, or other. For certifications use "other".'),
  startDate: z.string().describe('Event date in YYYY-MM format (required)'),
  endDate: z.string().optional().describe('End date in YYYY-MM format (for multi-day events). Omit this field entirely for single-day events.'),
});

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

// ============================================================================
// COHORT GENERATION FOR TRAJECTORY MATCHING
// ============================================================================

/**
 * Company pools organized by theme for cohort generation
 * Each cohort will share 1-2 companies from the same pool
 */
const COMPANY_POOLS = {
  FAANG: ['Google', 'Meta', 'Amazon', 'Apple', 'Netflix'],
  UNICORNS: ['TechStart', 'InnovateLabs', 'GrowthTech', 'ScaleAI'],
  CONSULTING: ['DataPioneer', 'CloudFirst', 'NextGen Systems'],
  HEALTHCARE: ['InnovateLabs', 'DataPioneer'],
  FINTECH: ['CloudFirst', 'GrowthTech'],
  EDTECH: ['TechStart', 'ScaleAI'],
};

/**
 * Career transition types for trajectory matching
 */
interface CareerTransition {
  type: 'completed' | 'in-progress';
  fromRole: string;
  toRole: string;
  applicationStatus?: ApplicationStatus; // For in-progress transitions
}

/**
 * Cohort template for generating matchable test users
 */
interface CohortTemplate {
  id: string;
  poolKey: keyof typeof COMPANY_POOLS;
  roleFamily: 'engineer' | 'product' | 'design' | 'data';
  userCount: number;
  transition?: CareerTransition; // Optional career transition
}

/**
 * Pre-defined cohort templates
 * Total: 28 users across 7 cohorts (20 regular + 8 career transition)
 */
const COHORT_TEMPLATES: CohortTemplate[] = [
  // 1 completed transition - BOTH users in same pool for matching
  {
    id: 'transition-swe-to-pm-completed',
    poolKey: 'FAANG',
    roleFamily: 'engineer',
    userCount: 1,
    transition: { type: 'completed', fromRole: 'Senior Software Engineer', toRole: 'Staff Engineer', applicationStatus: ApplicationStatus.OfferAccepted },
  },
  // 1 in-progress transition - SAME pool as completed for matching
  {
    id: 'transition-swe-to-staff-inprogress',
    poolKey: 'FAANG',
    roleFamily: 'engineer',
    userCount: 1,
    transition: { type: 'in-progress', fromRole: 'Senior Software Engineer', toRole: 'Staff Engineer', applicationStatus: ApplicationStatus.OnsiteInterview },
  },
];

/**
 * Cohort context passed during user generation
 */
interface CohortContext {
  cohortId: string;
  sharedCompanies: string[];
  isFirstUser: boolean; // First user gets only 1 shared company
  transition?: CareerTransition; // Optional career transition data
}

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
  enableCohorts?: boolean; // Enable cohort-based generation
}

class RealisticTestUserGenerator {
  private container: AwilixContainer;
  private hierarchyService: HierarchyService;
  private db: any;
  private organizationCache: Map<string, number> = new Map();
  private passwordHash: string = '';
  private spinner = ora();
  private options: GenerationOptions = { count: 0, mixed: false };
  private client: ReturnType<typeof Instructor>;

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

    // Initialize Instructor client with OpenAI
    this.client = Instructor({
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      mode: 'TOOLS',
    });

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
  async generateCareerJourney(
    persona: string,
    yearsExperience: number,
    cohortContext?: CohortContext
  ) {
    const currentYear = new Date().getFullYear();

    // Build company constraint for cohort mode
    const companyConstraint = cohortContext
      ? `\n\nIMPORTANT COHORT REQUIREMENT:
      - This user MUST have worked at these companies: ${cohortContext.sharedCompanies.join(' and/or ')}
      - Include ${cohortContext.isFirstUser ? 'at least 1' : '1-2'} of these companies in the job history
      - Place these companies in the middle-to-late career positions (not the first job)
      - Other companies can be added for variety, but the shared companies are mandatory`
      : '';

    const prompt = `Generate a realistic career journey for a ${persona.replace('_', ' ')} with ${yearsExperience} years of experience.
    Current year is ${currentYear}.

    Create a coherent professional journey showing natural career growth:
    - Start with education (graduation year should be ~${currentYear - yearsExperience - 4})
    - Progress through 2-4 jobs with increasing seniority
    - Include realistic company names and roles
    - Show skill development and increasing responsibilities
    - Total years of experience should be approximately ${yearsExperience}${companyConstraint}

    Focus on ${persona === 'software_engineer' || persona === 'engineer' ? 'full-stack development, cloud technologies, and modern web frameworks' :
      persona === 'product_manager' || persona === 'product' ? 'product strategy, user research, and data-driven decision making' :
      persona === 'ux_designer' || persona === 'design' ? 'user experience, design systems, and prototyping' :
      persona === 'data_scientist' || persona === 'data' ? 'machine learning, statistical analysis, and data pipelines' :
      'infrastructure, DevOps, and reliability engineering'}.`;

    const journey = await this.client.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates realistic career journey data.' },
        { role: 'user', content: prompt },
      ],
      response_model: {
        schema: CareerJourneySchema,
        name: 'CareerJourney',
      },
      max_retries: 3,
    });

    return journey;
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
    - CRITICAL: Keep descriptions VERY concise - MAX 400 characters (strict limit)
    - Optionally include 1-2 resources per insight (books, article URLs, courses)

    Categories should vary between technical, leadership, growth, and collaboration insights.

    IMPORTANT: Each description MUST be under 400 characters. Be concise.`;

    const result = await this.client.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates concise professional insights.' },
        { role: 'user', content: prompt },
      ],
      response_model: {
        schema: InsightsArraySchema,
        name: 'Insights',
      },
      max_retries: 3,
    });

    return result.insights.map(insight => insight.description);
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
      * REQUIRED: eventType (one of: interview, networking, conference, workshop, job-application, other)
    - 2-3 insights that are concise learnings from this role`;

    const jobDetails = await this.client.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates realistic job project details.' },
        { role: 'user', content: prompt },
      ],
      response_model: {
        schema: NodeWithInsightsSchema,
        name: 'JobDetails',
      },
      max_retries: 3,
    });

    return jobDetails;
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
   * Generate persona-specific interview notes
   */
  private generateInterviewNotes(
    persona: string,
    stage: ApplicationStatus,
    role: string
  ): string {
    const templates: Record<string, Record<ApplicationStatus, string[]>> = {
      engineer: {
        [ApplicationStatus.Applied]: [
          'Submitted application with portfolio showcasing distributed systems projects',
          'Tailored resume to highlight scalability and performance work',
        ],
        [ApplicationStatus.RecruiterScreen]: [
          'Discussed technical background and interest in system architecture',
          'Reviewed compensation expectations and team structure',
        ],
        [ApplicationStatus.PhoneInterview]: [
          'Discussed system design experience with distributed systems',
          'Reviewed coding approach for scalability challenges',
          'Talked about debugging production incidents and on-call experience',
        ],
        [ApplicationStatus.TechnicalInterview]: [
          'Whiteboarded microservices architecture design for high-traffic API',
          'Live coding: implement distributed rate limiter with Redis',
          'Deep dive into database optimization and indexing strategies',
        ],
        [ApplicationStatus.OnsiteInterview]: [
          'Algorithm round: solved graph traversal and dynamic programming problems',
          'System design: designed Twitter-like feed at scale with caching strategy',
          'Behavioral: discussed conflict resolution in code reviews and technical leadership',
        ],
        [ApplicationStatus.FinalInterview]: [
          'Met with engineering director to discuss technical vision and team culture',
          'Aligned on expectations for technical leadership and mentorship',
        ],
        [ApplicationStatus.Offer]: [
          'Received offer with competitive compensation and equity package',
        ],
        [ApplicationStatus.OfferAccepted]: [],
        [ApplicationStatus.OfferDeclined]: [],
        [ApplicationStatus.Rejected]: [],
        [ApplicationStatus.Withdrawn]: [],
        [ApplicationStatus.Ghosted]: [],
      },
      product: {
        [ApplicationStatus.Applied]: [
          'Applied with case studies demonstrating product-market fit improvements',
          'Highlighted experience with data-driven product decisions',
        ],
        [ApplicationStatus.RecruiterScreen]: [
          'Discussed product philosophy and approach to user research',
          'Reviewed experience with cross-functional team collaboration',
        ],
        [ApplicationStatus.PhoneInterview]: [
          'Discussed product strategy for marketplace growth and retention',
          'Walked through approach to user research and customer insights',
          'Explained prioritization frameworks (RICE, impact/effort matrix)',
        ],
        [ApplicationStatus.TechnicalInterview]: [
          'Product case: improve retention for subscription service with data analysis',
          'Analyzed user funnel data and proposed A/B test experiments',
          'Discussed go-to-market strategy for new feature launch',
        ],
        [ApplicationStatus.OnsiteInterview]: [
          'Product sense: designed feature for gig economy platform with user personas',
          'Analytics round: analyzed A/B test results and defined success metrics',
          'Leadership round: discussed managing cross-functional teams and stakeholders',
        ],
        [ApplicationStatus.FinalInterview]: [
          'Met with VP Product to align on product vision and roadmap priorities',
          'Discussed approach to balancing user needs with business objectives',
        ],
        [ApplicationStatus.Offer]: [
          'Received offer with strong product ownership and team leadership opportunities',
        ],
        [ApplicationStatus.OfferAccepted]: [],
        [ApplicationStatus.OfferDeclined]: [],
        [ApplicationStatus.Rejected]: [],
        [ApplicationStatus.Withdrawn]: [],
        [ApplicationStatus.Ghosted]: [],
      },
      design: {
        [ApplicationStatus.Applied]: [
          'Submitted portfolio showcasing end-to-end product design work',
          'Highlighted design system contributions and user research projects',
        ],
        [ApplicationStatus.RecruiterScreen]: [
          'Portfolio review: discussed design process and collaboration approach',
          'Reviewed experience with design systems and component libraries',
        ],
        [ApplicationStatus.PhoneInterview]: [
          'Portfolio review: discussed design system contributions and accessibility work',
          'Walked through user-centered design process and research methods',
          'Presented case study on mobile app redesign with measurable impact',
        ],
        [ApplicationStatus.TechnicalInterview]: [
          'Design challenge: redesigned checkout flow for e-commerce with focus on conversion',
          'Presented prototypes in Figma and explained design rationale',
          'Discussed accessibility standards (WCAG) and inclusive design implementation',
        ],
        [ApplicationStatus.OnsiteInterview]: [
          'Product design: designed social feature for health app with user journey mapping',
          'Design critique: reviewed and improved existing UI with specific recommendations',
          'Cross-functional collab: discussed working with engineers on design constraints',
        ],
        [ApplicationStatus.FinalInterview]: [
          'Met with design director to discuss design culture and mentorship approach',
          'Aligned on vision for design system evolution and team growth',
        ],
        [ApplicationStatus.Offer]: [
          'Received offer with opportunity to lead design system initiatives',
        ],
        [ApplicationStatus.OfferAccepted]: [],
        [ApplicationStatus.OfferDeclined]: [],
        [ApplicationStatus.Rejected]: [],
        [ApplicationStatus.Withdrawn]: [],
        [ApplicationStatus.Ghosted]: [],
      },
      data: {
        [ApplicationStatus.Applied]: [
          'Applied with portfolio of ML projects and published research',
          'Highlighted experience with production ML systems and model deployment',
        ],
        [ApplicationStatus.RecruiterScreen]: [
          'Discussed experience with ML infrastructure and model lifecycle',
          'Reviewed technical skills in Python, TensorFlow, and data pipelines',
        ],
        [ApplicationStatus.PhoneInterview]: [
          'Discussed ML pipeline architecture and model monitoring approaches',
          'Reviewed experience with A/B testing and causal inference',
          'Walked through approach to feature engineering and model selection',
        ],
        [ApplicationStatus.TechnicalInterview]: [
          'ML case study: designed recommendation system with collaborative filtering',
          'Coding round: implement gradient descent and evaluate model performance',
          'Deep dive into statistical methods and experimental design',
        ],
        [ApplicationStatus.OnsiteInterview]: [
          'ML system design: built fraud detection pipeline with real-time scoring',
          'Algorithms: solved optimization problems and explained trade-offs',
          'Behavioral: discussed cross-functional work with product and engineering',
        ],
        [ApplicationStatus.FinalInterview]: [
          'Met with data science lead to discuss technical roadmap and research priorities',
          'Aligned on approach to model governance and ethical AI practices',
        ],
        [ApplicationStatus.Offer]: [
          'Received offer with focus on ML infrastructure and research opportunities',
        ],
        [ApplicationStatus.OfferAccepted]: [],
        [ApplicationStatus.OfferDeclined]: [],
        [ApplicationStatus.Rejected]: [],
        [ApplicationStatus.Withdrawn]: [],
        [ApplicationStatus.Ghosted]: [],
      },
    };

    const personaTemplates = templates[persona] || templates.engineer;
    const stageNotes = personaTemplates[stage] || ['Discussed role expectations and team fit'];
    return faker.helpers.arrayElement(stageNotes);
  }

  /**
   * Generate Updates records for career transition stages
   */
  private async createStageUpdates(
    transitionNodeId: string,
    persona: string,
    transitionType: 'completed' | 'in-progress',
    currentStatus: ApplicationStatus,
    userId: number
  ) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Define stage progression with activity flags
    const stageProgression = [
      {
        status: ApplicationStatus.Applied,
        monthOffset: -5,
        activities: {
          appliedToJobs: true,
          updatedResumeOrPortfolio: true,
        },
        notes: `Applied to ${persona === 'engineer' ? 'engineering' : persona === 'product' ? 'product management' : persona === 'design' ? 'design' : 'data science'} roles. Tailored resume to highlight relevant experience.`,
      },
      {
        status: ApplicationStatus.RecruiterScreen,
        monthOffset: -4,
        activities: {
          networked: true,
          developedSkills: true,
        },
        notes: 'Recruiter phone screen completed. Discussed career goals and compensation expectations.',
      },
      {
        status: ApplicationStatus.PhoneInterview,
        monthOffset: -3,
        activities: {
          pendingInterviews: true,
          practicedMock: true,
        },
        notes: 'Phone interview scheduled. Practicing behavioral questions and technical concepts.',
      },
      {
        status: ApplicationStatus.TechnicalInterview,
        monthOffset: -2,
        activities: {
          completedInterviews: true,
          developedSkills: true,
        },
        notes: 'Completed technical interview. Felt good about system design discussion.',
      },
      {
        status: ApplicationStatus.OnsiteInterview,
        monthOffset: -1,
        activities: {
          completedInterviews: true,
          pendingInterviews: false,
        },
        notes: 'Full-day onsite completed. Met with 5 interviewers across technical and behavioral rounds.',
      },
      {
        status: ApplicationStatus.FinalInterview,
        monthOffset: 0,
        activities: {
          completedInterviews: true,
          receivedOffers: transitionType === 'completed',
        },
        notes:
          transitionType === 'completed'
            ? 'Final interview with leadership. Received positive feedback and offer.'
            : 'Final round with hiring manager. Awaiting decision.',
      },
    ];

    // For completed transitions, create all stages
    // For in-progress, create stages up to current status
    const statusValues = Object.values(ApplicationStatus);
    const currentStatusIndex = statusValues.indexOf(currentStatus);

    const relevantStages =
      transitionType === 'completed'
        ? stageProgression
        : stageProgression.filter((stage) => {
            const stageIndex = statusValues.indexOf(stage.status);
            return stageIndex <= currentStatusIndex;
          });

    for (const stage of relevantStages) {
      const stageMonth = currentMonth + stage.monthOffset;
      const stageYear = stageMonth <= 0 ? currentYear - 1 : currentYear;
      const adjustedMonth = stageMonth <= 0 ? 12 + stageMonth : stageMonth;

      // Create Update record with stage timestamps
      await this.db.insert(updates).values({
        nodeId: transitionNodeId,
        notes: stage.notes,
        meta: stage.activities,
        stageStartedAt: new Date(
          `${stageYear}-${String(adjustedMonth).padStart(2, '0')}-01`
        ),
        ...(stage === relevantStages[relevantStages.length - 1] &&
          transitionType === 'completed' && {
            stageEndedAt: new Date(
              `${stageYear}-${String(adjustedMonth).padStart(2, '0')}-28`
            ),
          }),
      });
    }
  }

  /**
   * Generate job application events with persona-specific details
   * Creates ONE event per company with current status, tracking progression via Updates
   */
  private async createJobApplicationEvents(
    transitionNodeId: string,
    persona: string,
    targetCompany: string,
    targetRole: string,
    transitionType: 'completed' | 'in-progress',
    currentStatus: ApplicationStatus,
    userId: number
  ) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Determine final status for the application
    const finalStatus =
      transitionType === 'completed'
        ? ApplicationStatus.OfferAccepted
        : currentStatus;

    // Build comprehensive description with all interview stages
    const allStages = [
      ApplicationStatus.Applied,
      ApplicationStatus.RecruiterScreen,
      ApplicationStatus.PhoneInterview,
      ApplicationStatus.TechnicalInterview,
      ApplicationStatus.OnsiteInterview,
      ApplicationStatus.FinalInterview,
    ];

    const statusValues = Object.values(ApplicationStatus);
    const finalStatusIndex = statusValues.indexOf(finalStatus);

    const completedStages = allStages.filter((stage) => {
      const stageIndex = statusValues.indexOf(stage);
      return stageIndex <= finalStatusIndex;
    });

    // Generate notes for completed stages
    const stageNotes = completedStages
      .map((stage) => {
        const note = this.generateInterviewNotes(persona, stage, targetRole);
        const stageName =
          stage === ApplicationStatus.Applied
            ? 'Applied'
            : stage === ApplicationStatus.RecruiterScreen
            ? 'Recruiter Screen'
            : stage === ApplicationStatus.PhoneInterview
            ? 'Phone Interview'
            : stage === ApplicationStatus.TechnicalInterview
            ? 'Technical Interview'
            : stage === ApplicationStatus.OnsiteInterview
            ? 'Onsite Interview'
            : 'Final Interview';
        return `${stageName}: ${note}`;
      })
      .join('\n\n');

    const description =
      transitionType === 'completed'
        ? `${stageNotes}\n\nOffer: Received and accepted offer for ${targetRole} at ${targetCompany}`
        : `${stageNotes}\n\nCurrent Status: ${finalStatus}`;

    // Create ONE job application event with current/final status
    await this.hierarchyService.createNode(
      {
        type: 'event',
        parentId: transitionNodeId,
        meta: {
          title: `${targetCompany} - ${targetRole}`,
          description,
          eventType: EventType.JobApplication,
          applicationStatus: finalStatus,
          company: targetCompany,
          jobTitle: targetRole,
          applicationDate: `${currentYear - 1}-${String(currentMonth).padStart(2, '0')}-01`,
          startDate: `${currentYear - 1}-${String(currentMonth).padStart(2, '0')}`,
        },
      },
      userId
    );
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
  async generateTestUser(
    persona: string,
    options: GenerationOptions,
    cohortContext?: CohortContext
  ) {
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

    // Generate career journey (with cohort context if provided)
    const journey = await this.generateCareerJourney(persona, yearsExperience, cohortContext);

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
                  eventType: event.eventType,
                  startDate: event.startDate,
                  ...(event.endDate && { endDate: event.endDate }),
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

    // Create career transition nodes if transition data is provided
    if (cohortContext?.transition) {
      const transition = cohortContext.transition;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Create CareerTransition node
      const transitionNode = await this.hierarchyService.createNode(
        {
          type: 'careerTransition',
          meta: {
            title: `Career Transition: ${transition.fromRole} → ${transition.toRole}`,
            description: `Transitioning from ${transition.fromRole} to ${transition.toRole}`,
            startDate: `${currentYear - 1}-${String(currentMonth).padStart(2, '0')}`,
            ...(transition.type === 'completed' && {
              endDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
            }),
          },
        },
        user.id
      );

      // Add transition insights
      const transitionContext = `Career transition from ${transition.fromRole} to ${transition.toRole}`;
      const transitionInsights = await this.generateInsights(transitionContext, 2);
      for (const insight of transitionInsights) {
        await this.hierarchyService.createInsight(
          transitionNode.id,
          { description: insight, resources: [] },
          user.id
        );
      }

      // Determine target company and application status
      const targetCompany =
        cohortContext.sharedCompanies.length > 0
          ? cohortContext.sharedCompanies[0]
          : faker.helpers.arrayElement(['Google', 'Meta', 'Amazon', 'Apple']);

      const targetRole = transition.toRole;
      const currentStatus =
        transition.applicationStatus || ApplicationStatus.OfferAccepted;

      // Create Updates records with stage activity flags
      await this.createStageUpdates(
        transitionNode.id,
        persona,
        transition.type,
        currentStatus,
        user.id
      );

      // Create job application events with persona-specific interview notes
      await this.createJobApplicationEvents(
        transitionNode.id,
        persona,
        targetCompany,
        targetRole,
        transition.type,
        currentStatus,
        user.id
      );
    }

    return user;
  }

  /**
   * Build cohort-based user generation plan
   */
  private buildCohortPlan(): Array<{
    persona: string;
    cohortContext: CohortContext;
  }> {
    const plan: Array<any> = [];

    for (const cohort of COHORT_TEMPLATES) {
      const companyPool = COMPANY_POOLS[cohort.poolKey];

      // Select 2 shared companies from the pool
      const sharedCompanies = faker.helpers.arrayElements(companyPool, 2);

      for (let userIndex = 0; userIndex < cohort.userCount; userIndex++) {
        // First user gets only 1 shared company (for partial match testing)
        const isFirstUser = userIndex === 0;
        const cohortContext: CohortContext = {
          cohortId: cohort.id,
          sharedCompanies: isFirstUser ? [sharedCompanies[0]] : sharedCompanies,
          isFirstUser,
          transition: cohort.transition, // Pass transition data if present
        };

        plan.push({
          persona: cohort.roleFamily,
          cohortContext,
        });
      }
    }

    return plan;
  }

  /**
   * Build random user generation plan
   */
  private buildRandomPlan(count: number, mixed: boolean, persona?: string): Array<{
    persona: string;
  }> {
    return Array.from({ length: count }, () => ({
      persona: mixed
        ? faker.helpers.arrayElement(['engineer', 'product', 'design', 'data'])
        : persona || 'engineer',
    }));
  }

  /**
   * Main generation function
   */
  async generate(options: GenerationOptions) {
    this.options = options; // Set the instance options

    // Initialize if not already done
    if (!this.client) {
      await this.initialize();
    }

    // Build generation plan based on mode
    const plan = options.enableCohorts
      ? this.buildCohortPlan()
      : this.buildRandomPlan(options.count, options.mixed, options.persona);

    const totalUsers = plan.length;
    const mode = options.enableCohorts ? 'cohort-based' : 'random';

    this.spinner.start(`Generating ${totalUsers} ${mode} test users...`);

    const results = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < plan.length; i++) {
      try {
        const { persona, cohortContext } = plan[i];

        const user = await this.generateTestUser(persona, options, cohortContext);
        results.push(user);

        const progress = cohortContext
          ? `[${cohortContext.cohortId}] ${i + 1}/${totalUsers}`
          : `${i + 1}/${totalUsers}`;

        this.spinner.text = `Generated ${progress} users with realistic journeys...`;

        // Rate limiting for API calls
        if ((i + 1) % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to generate user ${i}:`, error);
        errors.push({ index: i, error: error instanceof Error ? error.message : String(error) });
      }
    }

    this.spinner.succeed(`Successfully generated ${results.length} ${mode} test users!`);

    if (errors.length > 0) {
      console.error(`\n⚠️  ${errors.length} users failed:`);
      errors.slice(0, 5).forEach(({ index, error }) => {
        console.error(`  - User ${index}: ${error}`);
      });
    }

    // Print cohort summary if in cohort mode
    if (options.enableCohorts) {
      console.log('\n📦 Cohort Summary:');
      COHORT_TEMPLATES.forEach(cohort => {
        const companies = COMPANY_POOLS[cohort.poolKey].slice(0, 2).join(', ');
        console.log(`  - ${cohort.id}: ${cohort.userCount} ${cohort.roleFamily}s (shared: ${companies})`);
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
  .option('--cohort', 'Generate matchable cohorts (20 users in 6 cohorts)', false)
  .action(async (options) => {
    const opts: GenerationOptions = {
      count: parseInt(options.count),
      persona: options.persona,
      mixed: options.mixed || !options.persona,
      enableCohorts: options.cohort,
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
