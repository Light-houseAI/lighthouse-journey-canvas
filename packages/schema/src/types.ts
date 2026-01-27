import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { interestSchema, usernameInputSchema } from './api/onboarding.schemas';
import {
  ApplicationStatus,
  EventType,
  InterviewStage,
  InterviewStatus,
  OrganizationType,
  OrgMemberRole,
  OutreachMethod,
  PermissionAction,
  PolicyEffect,
  ProjectStatus,
  ProjectType,
  SubjectType,
  TimelineNodeType,
  VisibilityLevel,
} from './enums';
import {
  graphragChunks,
  graphragEdges,
  nodeInsights,
  nodePolicies,
  organizations,
  orgMembers,
  timelineNodes,
  updates,
  users,
  userStorageUsage,
} from './schema';

// ============================================================================
// USER VALIDATION SCHEMAS
// ============================================================================

// Drizzle schema for user insertion
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  hasCompletedOnboarding: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;

// User Storage Usage Schemas
export const insertUserStorageUsageSchema = createInsertSchema(
  userStorageUsage
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserStorageUsageSchema =
  createSelectSchema(userStorageUsage);

export type InsertUserStorageUsage = z.infer<
  typeof insertUserStorageUsageSchema
>;
export type SelectUserStorageUsage = z.infer<
  typeof selectUserStorageUsageSchema
>;

// usernameInputSchema moved to api/onboarding.schemas.ts

// Username validation schema for settings page
export const userNameUpdateSchema = z.object({
  userName: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and dashes'
    )
    .refine(
      (val) => !val.startsWith('-') && !val.endsWith('-'),
      'Username cannot start or end with a dash'
    )
    .optional(),
});

// Name validation schemas
export const firstNameUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name must be at least 1 character long')
    .max(50, 'First name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\\s'-]+$/,
      'First name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .optional(),
});

export const lastNameUpdateSchema = z.object({
  lastName: z
    .string()
    .min(1, 'Last name must be at least 1 character long')
    .max(50, 'Last name must be less than 50 characters')
    .regex(
      /^[a-zA-Z\\s'-]+$/,
      'Last name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .optional(),
});

// Profile update schema
export const profileUpdateSchema = z.object({
  firstName: firstNameUpdateSchema.shape.firstName,
  lastName: lastNameUpdateSchema.shape.lastName,
  userName: userNameUpdateSchema.shape.userName,
  interest: z.string().optional(),
});

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
});

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// interestSchema moved to api/onboarding.schemas.ts
// ============================================================================
// PROFILE DATA TYPES (Legacy - used for onboarding transformation)
// ============================================================================

// Profile experience interface for onboarding data transformation
export interface ProfileExperience {
  title: string | { name: string };
  company: string;
  location?: string;
  start?: string;
  end?: string;
  current?: boolean;
  description?: string;
  responsibilities?: string[];
  type?: string;
  projects?: any[];
}

// Profile education interface for onboarding data transformation
export interface ProfileEducation {
  school: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
}

// Complete profile data interface for onboarding data transformation
export interface ProfileData {
  name: string;
  headline?: string;
  location?: string;
  about?: string;
  avatarUrl?: string;
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
}

// insertProfileSchema moved to api/onboarding.schemas.ts

// ============================================================================
// TIMELINE NODE VALIDATION SCHEMAS
// ============================================================================

// Node Type Enum Schema
export const nodeTypeSchema = z.nativeEnum(TimelineNodeType);

// Base Node Schema
export const baseNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Parent Node Reference Schema
export const parentNodeReferenceSchema = z
  .object({
    id: z.string().uuid(),
    type: nodeTypeSchema,
    title: z.string(),
  })
  .strict();

// Project Schema
export const projectSchema = baseNodeSchema.extend({
  type: z.literal('project'),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

// Action Schema (Future Implementation)
export const actionSchema = baseNodeSchema.extend({
  type: z.literal('action'),
  projects: z.array(projectSchema).optional(),
});

// Event Schema (Future Implementation)
export const eventSchema = baseNodeSchema.extend({
  type: z.literal('event'),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Career Transition Schema (Future Implementation)
export const careerTransitionSchema = baseNodeSchema.extend({
  type: z.literal('careerTransition'),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Job Schema
export const jobSchema = baseNodeSchema.extend({
  type: z.literal('job'),
  company: z.string().optional(),
  position: z.string().optional(),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Education Schema
export const educationSchema = baseNodeSchema.extend({
  type: z.literal('education'),
  institution: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  location: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  events: z.array(eventSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// Union schema for any node type
export const anyNodeSchema = z.discriminatedUnion('type', [
  jobSchema,
  educationSchema,
  projectSchema,
  eventSchema,
  actionSchema,
  careerTransitionSchema,
]);

// Create DTO Schemas (for API requests) - separate schemas for each node type
export const jobCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const educationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .optional(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .optional(),
});

export const projectCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

export const eventCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.nativeEnum(EventType),
  // Interview-specific fields go in meta
  company: z.string().optional(),
  role: z.string().optional(),
  stage: z.nativeEnum(InterviewStage).optional(),
  status: z.nativeEnum(InterviewStatus).optional(),
  scheduledAt: z.string().datetime().optional(),
  outcomeAt: z.string().datetime().optional(),
  contact: z.string().optional(),
  medium: z.string().optional(),
  notes: z.string().optional(),
});

export const actionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  category: z.string().optional(),
  impact: z.string().optional(),
  verification: z.string().optional(),
});

export const careerTransitionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

// Update Schemas - separate schemas for each node type
export const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const educationUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const projectNodeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z
    .enum(['personal', 'professional', 'academic', 'freelance', 'open-source'])
    .optional(),
});

export const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  eventType: z.nativeEnum(EventType).optional(),
  // Interview-specific fields go in meta
  company: z.string().optional(),
  role: z.string().optional(),
  stage: z.nativeEnum(InterviewStage).optional(),
  status: z.nativeEnum(InterviewStatus).optional(),
  scheduledAt: z.string().datetime().optional(),
  outcomeAt: z.string().datetime().optional(),
  contact: z.string().optional(),
  medium: z.string().optional(),
  notes: z.string().optional(),
});

export const actionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

export const careerTransitionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
  endDate: z
    .string()
    .refine(
      (val) => !val || /^\\d{4}-\\d{2}$/.test(val),
      'Date must be in YYYY-MM format or empty'
    )
    .nullish(),
});

// ============================================================================
// NODE METADATA VALIDATION SCHEMAS
// ============================================================================

// Type-specific metadata validation schemas
export const jobMetaSchema = z
  .object({
    // orgId is optional for auto-created nodes from session push
    // User can fill this in later when they review the node
    orgId: z
      .number()
      .int()
      .positive('Organization ID must be positive when provided')
      .optional()
      .describe('ID of the organization/company (optional for auto-created nodes)'),
    role: z
      .string()
      .min(1, 'Role is required')
      .describe('Job title or position'),
    location: z.string().optional().describe('Job location (city, state)'),
    description: z
      .string()
      .optional()
      .describe('Brief description of role and responsibilities'),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Start date in YYYY-MM format'),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('End date in YYYY-MM format, omit if current'),
  })
  .passthrough(); // Allow additional fields for work track metadata (chapters, etc.)

export const educationMetaSchema = z
  .object({
    orgId: z
      .number()
      .int()
      .positive('Organization ID is required')
      .describe('ID of the educational institution'),
    degree: z
      .string()
      .min(1, 'Degree is required')
      .describe('Degree type (e.g., Bachelor of Science, Master of Arts)'),
    field: z
      .string()
      .optional()
      .describe(
        'Field of study (e.g., Computer Science, Business Administration)'
      ),
    location: z.string().optional().describe('Campus location'),
    description: z
      .string()
      .optional()
      .describe('Description of studies, research focus, or achievements'),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Start date in YYYY-MM format'),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Graduation date in YYYY-MM format'),
  })
  .passthrough(); // Allow additional fields for work track metadata

export const projectMetaSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .describe('Project name or title'),
    description: z
      .string()
      .optional()
      .describe('What the project accomplished, its goals and impact'),
    technologies: z
      .array(z.string())
      .default([])
      .optional()
      .describe('Technologies, tools, and frameworks used'),
    projectType: z
      .nativeEnum(ProjectType)
      .optional()
      .describe(
        'Type of project (personal/professional/academic/freelance/open-source)'
      ),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Project start date in YYYY-MM format'),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Project end date in YYYY-MM format'),
    status: z
      .nativeEnum(ProjectStatus)
      .optional()
      .describe('Current status of the project'),
  })
  .passthrough(); // Allow additional fields for work track metadata (chapters, workTrackCategory, etc.)

export const eventMetaSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required')
      .describe('Event or achievement title'),
    description: z
      .string()
      .optional()
      .describe(
        'Description of the event, achievement, certification, or conference'
      ),
    eventType: z.nativeEnum(EventType).describe('Type of event'),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('Event date in YYYY-MM format'),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional()
      .describe('End date in YYYY-MM format (for multi-day events)'),
    // Interview-specific fields (when eventType is 'interview')
    company: z
      .string()
      .optional()
      .describe('Company name for interview events'),
    role: z.string().optional().describe('Role/position for interview events'),
    stage: z.nativeEnum(InterviewStage).optional().describe('Interview stage'),
    status: z
      .nativeEnum(InterviewStatus)
      .optional()
      .describe('Interview status'),
    scheduledAt: z
      .string()
      .datetime()
      .optional()
      .describe('Scheduled date/time for interview'),
    outcomeAt: z
      .string()
      .datetime()
      .optional()
      .describe('Outcome date/time for interview'),
    contact: z.string().optional().describe('Contact person for interview'),
    medium: z
      .string()
      .optional()
      .describe('Interview medium (remote, onsite, phone, video)'),
    notes: z.string().optional().describe('Additional notes for the event'),
    // Job application-specific fields (when eventType is 'job-application')
    companyId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Organization ID for normalized company data'),
    jobTitle: z.string().optional().describe('Job title for application'),
    applicationDate: z
      .string()
      .optional()
      .describe('Application date in YYYY-MM-DD format'),
    jobPostingUrl: z.string().url().optional().describe('URL to job posting'),
    applicationStatus: z
      .nativeEnum(ApplicationStatus)
      .optional()
      .describe('Current status of job application'),
    outreachMethod: z
      .nativeEnum(OutreachMethod)
      .optional()
      .describe('Method used to apply'),
    interviewContext: z
      .string()
      .optional()
      .describe('Context or notes about interviews'),
    llmInterviewContext: z
      .string()
      .optional()
      .describe('LLM-generated interview context and insights'),
    todosByStatus: z
      .record(z.array(z.unknown()))
      .optional()
      .describe('Todo items grouped by application status'),
    summariesByStatus: z
      .record(z.string())
      .optional()
      .describe('Summary text for each application status'),
    statusData: z
      .record(
        z.object({
          llmSummary: z.string().optional(),
        })
      )
      .optional()
      .describe('LLM-generated summaries and metadata per application status'),
  })
  .strict();

export const actionMetaSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional(),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional(),
  })
  .strict();

/**
 * Work Track metadata schema - for goal-oriented work tracks created from desktop app.
 * These represent active work streams (e.g., "Building MVP", "Sales Pipeline")
 * distinct from job history (Job type).
 */
export const workMetaSchema = z
  .object({
    name: z.string().min(1, 'Name is required').describe('Work track name'),
    label: z.string().optional().describe('Display label for the work track'),
    company: z.string().optional().describe('Associated company or context'),
    jobTitle: z.string().optional().describe('Associated job title'),
    dateStarted: z.string().optional().describe('When the work track started'),
    description: z.string().optional().describe('Description of the work track'),
    video: z
      .object({
        hasVideo: z.boolean().default(false),
      })
      .optional()
      .describe('Video recording settings'),
    screenRecordingPermissionRequested: z
      .boolean()
      .optional()
      .describe('Whether screen recording permission was requested'),
    selectedApps: z
      .object({
        desktop: z.array(z.any()).default([]),
        browser: z.array(z.any()).default([]),
      })
      .optional()
      .describe('Apps selected for tracking'),
    createdAt: z.number().optional().describe('Creation timestamp'),
  })
  .passthrough(); // Allow additional fields for extensibility

// Application materials schemas

// Constants for application material types
export const LINKEDIN_TYPE = 'Linkedin' as const;

export const editHistoryEntrySchema = z.object({
  editedAt: z.string().datetime(),
  notes: z
    .string()
    .min(1, 'Notes are required')
    .max(500, 'Notes must be less than 500 characters'),
  editedBy: z.string().min(1, 'User ID is required'),
});

export const resumeVersionSchema = z.object({
  url: z.string().optional().nullable(), // Generated on-demand from storageKey
  filename: z.string().optional(),
  storageKey: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().positive().optional(),
  lastUpdated: z.string().datetime(),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
  editHistorySummary: z
    .string()
    .max(500, 'Summary must be less than 500 characters')
    .optional(),
  editHistory: z
    .array(editHistoryEntrySchema)
    .max(100, 'Maximum 100 edit history entries'),
});

export const resumeEntrySchema = z.object({
  type: z
    .string()
    .min(1, 'Resume type is required')
    .max(50, 'Resume type must be less than 50 characters'),
  resumeVersion: resumeVersionSchema,
});

export const applicationMaterialsSchema = z.object({
  items: z
    .array(resumeEntrySchema)
    .max(11, 'Maximum 10 resumes + 1 LinkedIn profile allowed'),
  summary: z
    .string()
    .max(500, 'Summary must be less than 500 characters')
    .optional(),
});

// Brand Building schemas
export const brandPlatformSchema = z.enum(['LinkedIn', 'X']);

export const brandScreenshotSchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().regex(/^image\//),
  sizeBytes: z.number().int().positive().max(5242880), // 5MB max
  notes: z.string().max(500).optional(),
});

export const brandActivitySchema = z.object({
  platform: brandPlatformSchema,
  profileUrl: z.string().url(),
  screenshots: z.array(brandScreenshotSchema).min(1).max(5),
  notes: z.string().max(500).optional(), // Profile-level notes
  timestamp: z.string().datetime(),
});

export const brandBuildingDataSchema = z.object({
  activities: z.record(brandPlatformSchema, z.array(brandActivitySchema)),
  overallSummary: z.string().optional(),
  summaries: z.record(brandPlatformSchema, z.string()).optional(),
  keyPoints: z.record(brandPlatformSchema, z.array(z.string())).optional(),
});

export const networkingDataSchema = z.object({
  activities: z.record(z.string(), z.array(z.any())), // Activities grouped by networking type
  overallSummary: z.string().optional(), // LLM-generated overall summary
  summaries: z.record(z.string(), z.string()).optional(), // LLM summaries by networking type
  keyPoints: z.record(z.string(), z.array(z.string())).optional(), // LLM key points by networking type
});

// Inferred types for application materials
export type EditHistoryEntry = z.infer<typeof editHistoryEntrySchema>;
export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
export type ResumeEntry = z.infer<typeof resumeEntrySchema>;
export type ApplicationMaterials = z.infer<typeof applicationMaterialsSchema>;

// Inferred types for brand building
export type BrandPlatform = z.infer<typeof brandPlatformSchema>;
export type BrandScreenshot = z.infer<typeof brandScreenshotSchema>;
export type BrandActivity = z.infer<typeof brandActivitySchema>;
export type BrandBuildingData = z.infer<typeof brandBuildingDataSchema>;

// Inferred types for networking data
export type NetworkingData = z.infer<typeof networkingDataSchema>;

// Helper type for LinkedIn profile (type === LINKEDIN_TYPE)
export type LinkedInProfile = ResumeEntry & { type: typeof LINKEDIN_TYPE };

export const careerTransitionMetaSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    startDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional(),
    endDate: z
      .string()
      .refine(
        (val) => !val || /^\d{4}-\d{2}$/.test(val),
        'Date must be in YYYY-MM format'
      )
      .optional(),
    applicationMaterials: applicationMaterialsSchema.optional(),
    networkingData: networkingDataSchema.optional(),
    brandBuildingData: brandBuildingDataSchema.optional(),
  })
  .strict();

// Unified metadata validation with superRefine approach
export const nodeMetaSchema = z
  .object({
    type: nodeTypeSchema,
    meta: z.record(z.unknown()).default({}),
  })
  .superRefine((data, ctx) => {
    try {
      switch (data.type) {
        case TimelineNodeType.Job:
          jobMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.Education:
          educationMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.Project:
          projectMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.Event:
          eventMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.Action:
          actionMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.Work:
          workMetaSchema.parse(data.meta);
          break;
        case TimelineNodeType.CareerTransition:
          careerTransitionMetaSchema.parse(data.meta);
          break;
        default:
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unsupported node type: ${data.type}`,
          });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['meta', ...issue.path],
            message: issue.message,
          });
        });
      }
    }
  });

// Inferred types from meta schemas
export type JobMeta = z.infer<typeof jobMetaSchema>;
export type EducationMeta = z.infer<typeof educationMetaSchema>;
export type ProjectMeta = z.infer<typeof projectMetaSchema>;
export type EventMeta = z.infer<typeof eventMetaSchema>;
export type ActionMeta = z.infer<typeof actionMetaSchema>;
export type WorkMeta = z.infer<typeof workMetaSchema>;
export type CareerTransitionMeta = z.infer<typeof careerTransitionMetaSchema>;

// Discriminated union of all meta types
export type TimelineNodeMeta =
  | JobMeta
  | EducationMeta
  | ProjectMeta
  | EventMeta
  | ActionMeta
  | WorkMeta
  | CareerTransitionMeta;

// Zod schemas for timeline nodes
export const createTimelineNodeSchema = z.object({
  type: z.nativeEnum(TimelineNodeType),
  parentId: z.string().uuid().optional(),
  meta: z.record(z.unknown()).default({}),
});

export const updateTimelineNodeSchema = z.object({
  meta: z.record(z.unknown()).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const moveTimelineNodeSchema = z.object({
  newParentId: z.string().uuid().nullable(),
});

// ============================================================================
// INSIGHTS VALIDATION SCHEMAS
// ============================================================================

// Validation schemas for insights
export const insightCreateSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description too long'),
  resources: z
    .array(z.string())
    .max(10, 'Maximum 10 resources allowed')
    .default([]),
});

export const insightUpdateSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description too long')
    .optional(),
  resources: z
    .array(z.string())
    .max(10, 'Maximum 10 resources allowed')
    .optional(),
});

// ============================================================================
// PERMISSIONS VALIDATION SCHEMAS
// ============================================================================

// Zod validation schemas
export const organizationCreateSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
  type: z.nativeEnum(OrganizationType),
  metadata: z.record(z.unknown()).default({}),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.nativeEnum(OrganizationType).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const orgMemberCreateSchema = z.object({
  userId: z.number().int().positive(),
  role: z.nativeEnum(OrgMemberRole).default(OrgMemberRole.Member),
});

export const orgMemberUpdateSchema = z.object({
  role: z.nativeEnum(OrgMemberRole),
});

export const nodePolicyCreateSchema = z.object({
  nodeId: z.string().uuid().optional(), // Optional for backward compatibility
  level: z.nativeEnum(VisibilityLevel),
  action: z.nativeEnum(PermissionAction).default(PermissionAction.View),
  subjectType: z.nativeEnum(SubjectType),
  subjectId: z.number().int().positive().optional(),
  effect: z.nativeEnum(PolicyEffect).default(PolicyEffect.Allow),
  expiresAt: z.string().datetime().optional(),
});

export const nodePolicyUpdateSchema = z.object({
  level: z.nativeEnum(VisibilityLevel).optional(),
  action: z.nativeEnum(PermissionAction).optional(),
  effect: z.nativeEnum(PolicyEffect).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const setNodePermissionsSchema = z.object({
  policies: z
    .array(nodePolicyCreateSchema)
    .max(100, 'Maximum 100 policies per request'),
});

export const accessCheckSchema = z.object({
  userId: z.number().int().positive().nullable(),
  nodeId: z.string().uuid(),
  action: z.nativeEnum(PermissionAction).default(PermissionAction.View),
  level: z.nativeEnum(VisibilityLevel).default(VisibilityLevel.Overview),
});

// ============================================================================
// TYPESCRIPT TYPE EXPORTS
// ============================================================================

// User types
export type UsernameInput = z.infer<typeof usernameInputSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type SignUp = z.infer<typeof signUpSchema>;
export type SignIn = z.infer<typeof signInSchema>;
export type Interest = z.infer<typeof interestSchema>;
export type User = typeof users.$inferSelect;

// Timeline Node types
export type NodeType = z.infer<typeof nodeTypeSchema>;
export type BaseNode = z.infer<typeof baseNodeSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Action = z.infer<typeof actionSchema>;
export type CareerTransition = z.infer<typeof careerTransitionSchema>;
export type AnyNode = z.infer<typeof anyNodeSchema>;
export type ParentNodeReference = z.infer<typeof parentNodeReferenceSchema>;

// Create/Update DTO types
export type JobCreateDTO = z.infer<typeof jobCreateSchema>;
export type JobUpdateDTO = z.infer<typeof jobUpdateSchema>;
export type EducationCreateDTO = z.infer<typeof educationCreateSchema>;
export type EducationUpdateDTO = z.infer<typeof educationUpdateSchema>;
export type ProjectCreateDTO = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateDTO = z.infer<typeof projectNodeUpdateSchema>;
export type EventCreateDTO = z.infer<typeof eventCreateSchema>;
export type EventUpdateDTO = z.infer<typeof eventUpdateSchema>;
export type ActionCreateDTO = z.infer<typeof actionCreateSchema>;
export type ActionUpdateDTO = z.infer<typeof actionUpdateSchema>;
export type CareerTransitionCreateDTO = z.infer<
  typeof careerTransitionCreateSchema
>;
export type CareerTransitionUpdateDTO = z.infer<
  typeof careerTransitionUpdateSchema
>;

// Timeline node database types
export type TimelineNode = typeof timelineNodes.$inferSelect;
export type CreateTimelineNodeDTO = z.infer<typeof createTimelineNodeSchema>;
export type UpdateTimelineNodeDTO = z.infer<typeof updateTimelineNodeSchema>;
export type MoveTimelineNodeDTO = z.infer<typeof moveTimelineNodeSchema>;

// Insights types
export type NodeInsight = typeof nodeInsights.$inferSelect;
export type InsightCreateDTO = z.infer<typeof insightCreateSchema>;
export type InsightUpdateDTO = z.infer<typeof insightUpdateSchema>;

// Organization and Permission types
export type Organization = typeof organizations.$inferSelect;
export type OrganizationCreateDTO = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdateDTO = z.infer<typeof organizationUpdateSchema>;

export type OrgMember = typeof orgMembers.$inferSelect;
export type OrgMemberCreateDTO = z.infer<typeof orgMemberCreateSchema>;
export type OrgMemberUpdateDTO = z.infer<typeof orgMemberUpdateSchema>;

export type NodePolicy = typeof nodePolicies.$inferSelect;
export type NodePolicyCreateDTO = z.infer<typeof nodePolicyCreateSchema>;
export type NodePolicyUpdateDTO = z.infer<typeof nodePolicyUpdateSchema>;
export type SetNodePermissionsDTO = z.infer<typeof setNodePermissionsSchema>;
export type AccessCheckDTO = z.infer<typeof accessCheckSchema>;

// Permission response interfaces
export interface NodeAccessLevel {
  canView: boolean;
  canEdit: boolean;
  visibilityLevel: VisibilityLevel | null;
}

export interface NodeWithPermissions {
  id: string;
  overview: {
    id: string;
    type: TimelineNodeType;
    title: string;
    startDate?: string;
    endDate?: string;
    org?: {
      id: number;
      name: string;
      type: string;
    };
  };
  full?: {
    description?: string;
    meta: Record<string, any>;
    parentId?: string;
    children?: NodeWithPermissions[];
  };
  accessLevel: VisibilityLevel;
  canEdit: boolean;
  permissions?: {
    canShare: boolean;
    policies: NodePolicy[];
  };
}

export interface EffectivePermissions {
  public?: VisibilityLevel;
  organizations: Array<{ orgId: number; level: VisibilityLevel }>;
  users: Array<{ userId: number; level: VisibilityLevel }>;
}

// Enhanced TimelineNode interface that includes permission metadata
export interface TimelineNodeWithPermissions extends TimelineNode {
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    accessLevel: VisibilityLevel;
    shouldShowMatches: boolean;
  };
}

// Permission presets for common use cases
export const PermissionPresets = {
  PRIVATE: [], // No policies = owner only

  PUBLIC_OVERVIEW: [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
  ],

  PUBLIC_FULL: [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
    {
      level: VisibilityLevel.Full,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
  ],

  ORG_VIEWABLE: (orgId: number) => [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Organization,
      subjectId: orgId,
      effect: PolicyEffect.Allow,
    },
    {
      level: VisibilityLevel.Full,
      action: PermissionAction.View,
      subjectType: SubjectType.Organization,
      subjectId: orgId,
      effect: PolicyEffect.Allow,
    },
  ],
} as const;

export interface RefreshTokenRecord {
  tokenId: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// EXPERIENCE MATCHES SYSTEM (LIG-179)
// ============================================================================

// Experience match data returned by the backend API
export interface ExperienceMatchData {
  nodeId: string;
  userId: number;
  matchCount: number;
  matches: MatchSummary[];
  searchQuery: string;
  similarityThreshold: number;
  lastUpdated: string;
  cacheTTL: number;
}

// Summary of a matched profile or opportunity
export interface MatchSummary {
  id: string;
  name: string;
  title: string;
  company?: string;
  score: number;
  matchType: 'profile' | 'opportunity';
  previewText?: string;
}

// Props for the ViewMatchesButton component
export interface ViewMatchesButtonProps {
  node: TimelineNode;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'icon';
  className?: string;
  onNavigate?: (query: string) => void;
}

// Internal state for the ViewMatchesButton component
export interface ViewMatchesButtonState {
  isLoading: boolean;
  isVisible: boolean;
  matchCount: number;
  matches: MatchSummary[];
  error?: string;
  lastFetched?: number;
}

// Request parameters for experience matches API
export interface GetExperienceMatchesParams {
  nodeId: string;
}

export interface GetExperienceMatchesQuery {
  forceRefresh?: boolean;
}

// API response schema for experience matches
export interface ExperienceMatchesResponse {
  success: boolean;
  data?: ExperienceMatchData;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Experience matches validation schemas
export const experienceMatchDataSchema = z.object({
  nodeId: z.string().uuid(),
  userId: z.number().positive(),
  matchCount: z.number().min(0).max(100),
  matches: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100),
        title: z.string().max(200),
        company: z.string().max(100).optional(),
        score: z.number().min(0).max(1),
        matchType: z.enum(['profile', 'opportunity']),
        previewText: z.string().max(200).optional(),
      })
    )
    .max(3),
  searchQuery: z.string().min(1).max(500),
  similarityThreshold: z.number().min(0).max(1),
  lastUpdated: z.string().datetime(),
  cacheTTL: z.number().positive(),
});

export const matchSummarySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  title: z.string().max(200),
  company: z.string().max(100).optional(),
  score: z.number().min(0).max(1),
  matchType: z.enum(['profile', 'opportunity']),
  previewText: z.string().max(200).optional(),
});

// Current experience detection utility function type
export type IsCurrentExperienceFunction = (node: TimelineNode) => boolean;

// ============================================================================
// UPDATE VALIDATION SCHEMAS
// ============================================================================

// Drizzle schemas for updates
export const insertUpdateSchema = createInsertSchema(updates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isDeleted: true,
  renderedText: true,
});

export const selectUpdateSchema = createSelectSchema(updates);

// API request/response types
export interface CreateUpdateRequest {
  // Notes field (table column)
  notes?: string;
  // All activity flags in meta (JSON column)
  meta?: {
    appliedToJobs?: boolean;
    updatedResumeOrPortfolio?: boolean;
    networked?: boolean;
    developedSkills?: boolean;
    pendingInterviews?: boolean;
    completedInterviews?: boolean;
    practicedMock?: boolean;
    receivedOffers?: boolean;
    receivedRejections?: boolean;
    possiblyGhosted?: boolean;
  };
  // LIG-207: Stage timestamps for career transition tracking
  stageStartedAt?: string; // ISO timestamp
  stageEndedAt?: string; // ISO timestamp
}

export type UpdateUpdateRequest = Partial<CreateUpdateRequest>;

// Database entity types
export type Update = typeof updates.$inferSelect;

// API response types
export interface UpdateResponse {
  id: string;
  nodeId: string;
  // Notes
  notes?: string;
  // Meta contains all activity flags
  meta: {
    appliedToJobs?: boolean;
    updatedResumeOrPortfolio?: boolean;
    networked?: boolean;
    developedSkills?: boolean;
    pendingInterviews?: boolean;
    completedInterviews?: boolean;
    practicedMock?: boolean;
    receivedOffers?: boolean;
    receivedRejections?: boolean;
    possiblyGhosted?: boolean;
  };
  renderedText?: string;
  // LIG-207: Stage timestamps for career transition tracking
  stageStartedAt?: string; // ISO timestamp
  stageEndedAt?: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface UpdatesListResponse {
  updates: UpdateResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// GRAPHRAG TYPES
// ============================================================================

// Database types (inferred from Drizzle schema)
export type GraphRAGChunk = typeof graphragChunks.$inferSelect;
export type InsertGraphRAGChunk = typeof graphragChunks.$inferInsert;
export type GraphRAGEdge = typeof graphragEdges.$inferSelect;
export type InsertGraphRAGEdge = typeof graphragEdges.$inferInsert;

// Extended chunk type with query results
export interface GraphRAGChunkWithScore extends GraphRAGChunk {
  similarity?: number;
  final_score?: number;
}

// Graph expansion result
export interface GraphExpansionResult {
  chunk_id: string;
  best_seed_sim: number;
  best_path_w: number;
  graph_aware_score: number;
}

// Service layer types
export interface GraphRAGSearchOptions {
  limit: number;
  tenantId?: string;
  requestingUserId?: number;
  since?: Date;
  excludeUserId?: number;
}

export interface ScoringWeights {
  vectorSimilarity: number;
  graphDistance: number;
  recency: number;
}

export interface CreateChunkData {
  userId: number;
  nodeId?: string;
  chunkText: string;
  embedding: Float32Array;
  nodeType?: string;
  meta?: Record<string, any>;
  tenantId?: string;
}

export interface CreateEdgeData {
  srcChunkId: number;
  dstChunkId: number;
  relType: 'parent_child' | 'same_user' | 'similar_role' | 'same_company';
  weight?: number;
  directed?: boolean;
  tenantId?: string;
}

// ============================================================================
// STANDARD API RESPONSE TYPES
// ============================================================================

// Validation schemas moved to:
// - api/updates.schemas.ts (createUpdateRequestSchema, updateUpdateRequestSchema, paginationQuerySchema)
// - api/organization.schemas.ts (organizationSearchQuerySchema)

// ============================================================================
// PERSONA SYSTEM TYPES (User Focus Areas)
// ============================================================================

import {
  PersonaType,
  LearningType,
  PersonalProjectType,
  JobSearchType,
  PERSONA_TYPE_LABELS,
  PERSONA_TYPE_ICONS,
} from './enums.js';

/**
 * Work persona context - derived from 'work' type nodes
 * Data sourced from Desktop UI work-details.html
 */
export interface WorkPersonaContext {
  /** Company name (required in Desktop UI) */
  company: string;
  /** Job title */
  jobTitle?: string;
  /** When the role started */
  dateStarted?: string;
  /** Primary tools used in this role */
  primaryTools?: string[];
  /** Current active projects/initiatives */
  currentProjects?: string[];
}

/**
 * Personal project persona context - derived from 'personal_project' type nodes
 * Data sourced from Desktop UI personal-project-details.html
 */
export interface PersonalProjectPersonaContext {
  /** Project name (required in Desktop UI) */
  projectName: string;
  /** Type of project (passion-project, personal-interest, just-for-fun, other) */
  projectType?: PersonalProjectType;
  /** Topics/areas the project covers */
  topics?: string[];
  /** Goals for the project */
  goals?: string[];
  /** Technologies being used */
  technologies?: string[];
  /** Current project status */
  status?: 'planning' | 'active' | 'completed';
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Job search persona context - derived from 'job_search' type nodes
 * Data sourced from Desktop UI job-search-details.html
 */
export interface JobSearchPersonaContext {
  /** Target role (required in Desktop UI) */
  targetRole: string;
  /** Type of job search (first-job, career-transition, new-opportunities, other) */
  jobSearchType?: JobSearchType;
  /** Companies of interest */
  targetCompanies?: string[];
  /** Current applications */
  applications?: Array<{
    company: string;
    role: string;
    status: string;
  }>;
  /** Current interview stages */
  interviewStages?: Array<{
    company: string;
    stage: string;
  }>;
  /** Preferred locations */
  preferredLocations?: string[];
}

/**
 * Learning persona context - derived from 'learning' type nodes
 * Data sourced from Desktop UI learning-details.html
 */
export interface LearningPersonaContext {
  /** Type of learning (university, certification, self-study) */
  learningType: LearningType;
  /** When the learning started */
  dateStarted?: string;
  // University-specific fields
  /** School name (for university type) */
  school?: string;
  /** Area of study (for university type) */
  areaOfStudy?: string;
  // Certification-specific fields
  /** Provider name (for certification type) */
  provider?: string;
  /** Course name (for certification type) */
  courseName?: string;
  // Self-study-specific fields
  /** Learning focus (for self-study type) */
  learningFocus?: string;
  /** Resources being used (for self-study type) */
  resources?: string;
  // Common fields
  /** Skills being developed */
  skillsBeingDeveloped?: string[];
  /** Current progress (0-100) */
  currentProgress?: number;
}

/**
 * Union type for all persona contexts
 */
export type PersonaContext =
  | WorkPersonaContext
  | PersonalProjectPersonaContext
  | JobSearchPersonaContext
  | LearningPersonaContext;

/**
 * Derived persona - computed from timeline nodes (not stored separately)
 */
export interface DerivedPersona {
  /** Persona type */
  type: PersonaType;
  /** Source timeline node ID */
  nodeId: string;
  /** Human-readable display name (e.g., "Software Engineer at Acme Corp") */
  displayName: string;
  /** Whether the persona is currently active */
  isActive: boolean;
  /** Last activity timestamp for this persona */
  lastActivityAt: Date | null;
  /** Type-specific context details from node meta */
  context: PersonaContext;
}

/**
 * Persona-based suggestion for the Insight Assistant
 */
export interface PersonaSuggestion {
  /** Unique identifier for the suggestion */
  id: string;
  /** Persona type this suggestion is for */
  personaType: PersonaType;
  /** Display name of the persona */
  personaDisplayName: string;
  /** Source node ID */
  nodeId: string;
  /** The actual query to send when clicked */
  suggestedQuery: string;
  /** Short label for the button */
  buttonLabel: string;
  /** Why this suggestion was generated */
  reasoning: string;
  /** Priority for ordering (higher = more important) */
  priority: number;
}

/**
 * API request for getting persona suggestions
 */
export interface GetPersonaSuggestionsRequest {
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Specific persona types to include (defaults to all) */
  personaTypes?: PersonaType[];
}

/**
 * API response for persona suggestions
 */
export interface GetPersonaSuggestionsResponse {
  suggestions: PersonaSuggestion[];
  /** Active personas for the user */
  activePersonas: Array<{
    type: PersonaType;
    displayName: string;
    nodeId: string;
    isActive: boolean;
  }>;
}

/**
 * Validation schema for persona suggestions request
 * Note: Uses coerce for limit since query params come as strings
 */
export const getPersonaSuggestionsRequestSchema = z.object({
  limit: z.coerce.number().min(1).max(10).optional().default(10),
  personaTypes: z.array(z.nativeEnum(PersonaType)).optional(),
});

/**
 * Noise filter configuration for insight generation
 */
export interface NoiseFilterConfig {
  /** Apps to filter out (e.g., Slack, Discord, Teams) */
  noiseApps: string[];
  /** Patterns to identify noise in step descriptions */
  noisePatterns: RegExp[];
  /** Minimum duration (seconds) below which brief context switches are filtered */
  minDurationThreshold: number;
  /** Whether noise filtering is enabled */
  enabled: boolean;
}

/**
 * Result of noise analysis on sessions
 */
export interface NoiseAnalysisResult {
  /** Total number of steps before filtering */
  totalSteps: number;
  /** Number of steps identified as noise */
  noiseSteps: number;
  /** Percentage of noise (0-100) */
  noisePercentage: number;
  /** Breakdown of noise by app */
  noiseByApp: Record<string, number>;
  /** Whether the session has high noise (>30%) */
  isHighNoise: boolean;
}

// Re-export persona enums for convenience
export {
  PersonaType,
  LearningType,
  PersonalProjectType,
  JobSearchType,
  PERSONA_TYPE_LABELS,
  PERSONA_TYPE_ICONS,
};
