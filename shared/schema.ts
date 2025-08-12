import { pgTable, text, serial, json, timestamp, boolean, real, integer, pgEnum, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { title } from "process";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  interest: text("interest"),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  username: text("username").notNull(),
  rawData: json("raw_data").$type<ProfileData>().notNull(),
  filteredData: json("filtered_data").$type<ProfileData>().notNull(),
  projects: json("projects").$type<Milestone[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// New skills table in PostgreSQL
export const userSkills = pgTable("user_skills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  level: text("level"),
  confidence: real("confidence").notNull(),
  source: text("source").notNull(),
  context: text("context"),
  keywords: text("keywords").default('[]'),
  firstMentioned: timestamp("first_mentioned").notNull().defaultNow(),
  lastMentioned: timestamp("last_mentioned").notNull().defaultNow(),
  mentionCount: integer("mention_count").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Profile data structure - nested hierarchy
export const projectUpdateSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  description: z.string(), // Work - What piece of work has taken most attention (required)
  skills: z.array(z.string()).default([]),
  achievements: z.string().optional(),
  challenges: z.string().optional(),
  impact: z.string().optional(),
  // WDRL Framework fields
  decisions: z.string().optional(), // Decision - Key decisions/actions to move work forward
  results: z.string().optional(), // Result - Measurable result/evidence of impact
  learnings: z.string().optional(), // Learning - Feedback/personal takeaways from experience
});

export const experienceProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  technologies: z.array(z.string()).default([]).optional(),
  updates: z.array(projectUpdateSchema).default([]).optional(),
});

export const profileExperienceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  company: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
  projects: z.array(experienceProjectSchema).default([]).optional(), // Projects within this experience
});

export const profileEducationSchema = z.object({
  school: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const profileDataSchema = z.object({
  name: z.string(),
  headline: z.string().optional(),
  location: z.string().optional(),
  about: z.string().optional(),
  avatarUrl: z.string().optional(),
  experiences: z.array(profileExperienceSchema).default([]),
  education: z.array(profileEducationSchema).default([]),
  skills: z.array(z.string()).default([]),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
});

export const usernameInputSchema = z.object({
  username: z.string().min(1, "Username is required").regex(/^[a-zA-Z0-9-_]+$/, "Username can only contain letters, numbers, hyphens, and underscores"),
});

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const interestSchema = z.object({
  interest: z.enum(["find-job", "grow-career", "change-careers", "start-startup"], {
    errorMap: () => ({ message: "Please select your interest" })
  }),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  hasCompletedOnboarding: true,
});

// Skill schemas
export const skillSchema = z.object({
  name: z.string(),
  category: z.enum(['technical', 'soft', 'domain', 'language', 'certification']),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  context: z.string().optional(),
  keywords: z.array(z.string()).default([]),
});

export const insertSkillSchema = createInsertSchema(userSkills).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Enhanced milestone schema for journey visualization
export const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['education', 'job', 'transition', 'skill', 'event', 'project', 'update']),
  date: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  duration: z.string().optional(),
  description: z.string(), // Work - What piece of work has taken most attention (required)
  skills: z.array(z.string()).default([]),
  organization: z.string().optional(),
  // Enhanced project details
  objectives: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  impact: z.string().optional(),
  challenges: z.string().optional(),
  teamSize: z.number().optional(),
  budget: z.string().optional(),
  outcomes: z.array(z.string()).default([]),
  lessonsLearned: z.string().optional(),
  isSubMilestone: z.boolean().default(false),
  parentId: z.string().optional(),
  // WDRL Framework fields
  decisions: z.string().optional(), // Decision - Key decisions/actions to move work forward
  results: z.string().optional(), // Result - Measurable result/evidence of impact
  learnings: z.string().optional(), // Learning - Feedback/personal takeaways from experience
});

export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ExperienceProject = z.infer<typeof experienceProjectSchema>;
export type ProfileExperience = z.infer<typeof profileExperienceSchema>;
export type ProfileEducation = z.infer<typeof profileEducationSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UsernameInput = z.infer<typeof usernameInputSchema>;
export type SignUp = z.infer<typeof signUpSchema>;
export type SignIn = z.infer<typeof signInSchema>;
export type Interest = z.infer<typeof interestSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type UserSkill = typeof userSkills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;

// ============================================================================
// NEW NODE TYPE SCHEMAS (API Revamp - PRD Implementation)
// ============================================================================

// Define a TypeScript enum for node types
export enum TimelineNodeType {
  Job = 'job',
  Education = 'education',
  Project = 'project',
  Event = 'event',
  Action = 'action',
  CareerTransition = 'careerTransition'
}

// Node Type Enum Schema
// Use the enum values in zod schemas
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
export const parentNodeReferenceSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string(),
}).strict();

export type ParentNodeReference = z.infer<typeof parentNodeReferenceSchema>;

// Project Schema
export const projectSchema = baseNodeSchema.extend({
  type: z.literal('project'),
  technologies: z.array(z.string()).optional(),
  projectType: z.enum(['personal', 'professional', 'academic', 'freelance', 'open-source']).optional(),

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
  actions: z.array(actionSchema).optional()
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
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

export const educationCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').optional(),
});

export const projectCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z.enum(['personal', 'professional', 'academic', 'freelance', 'open-source']).optional(),

});

export const eventCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),

});

export const actionCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  category: z.string().optional(),
  impact: z.string().optional(),
  verification: z.string().optional(),

});

export const careerTransitionCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

// Update Schemas - separate schemas for each node type
export const jobUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

export const educationUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

export const projectNodeUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  technologies: z.array(z.string()).optional(),
  projectType: z.enum(['personal', 'professional', 'academic', 'freelance', 'open-source']).optional(),

});

export const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  eventType: z.string().optional(),
  location: z.string().optional(),
  organizer: z.string().optional(),

});

export const actionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

export const careerTransitionUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format or empty').nullish(),
});

// Export TypeScript types from schemas
export type NodeType = z.infer<typeof nodeTypeSchema>;
export type BaseNode = z.infer<typeof baseNodeSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Action = z.infer<typeof actionSchema>;
export type CareerTransition = z.infer<typeof careerTransitionSchema>;
export type AnyNode = z.infer<typeof anyNodeSchema>;

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
export type CareerTransitionCreateDTO = z.infer<typeof careerTransitionCreateSchema>;
export type CareerTransitionUpdateDTO = z.infer<typeof careerTransitionUpdateSchema>;

// Hierarchical Timeline System Schema
export const timelineNodeTypeEnum = pgEnum('timeline_node_type', Object.values(TimelineNodeType) as [string, ...string[]]);

export const timelineNodes: any = pgTable("timeline_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: timelineNodeTypeEnum("type").notNull(),
  parentId: uuid("parent_id").references(() => timelineNodes.id, { onDelete: 'set null' }),
  meta: json("meta").$type<Record<string, any>>().notNull().default({}),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

// Hierarchy validation rules (adapted from PRD requirements)
export const HIERARCHY_RULES: Record<TimelineNodeType, TimelineNodeType[]> = {
  [TimelineNodeType.CareerTransition]: [TimelineNodeType.Action, TimelineNodeType.Event, TimelineNodeType.Project],
  [TimelineNodeType.Job]: [TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action],
  [TimelineNodeType.Education]: [TimelineNodeType.Project, TimelineNodeType.Event, TimelineNodeType.Action],
  [TimelineNodeType.Action]: [TimelineNodeType.Project],
  [TimelineNodeType.Event]: [TimelineNodeType.Project, TimelineNodeType.Action],
  [TimelineNodeType.Project]: [] // Leaf nodes
};

// Type-specific metadata validation schemas
export const jobMetaSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  location: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
}).strict();

export const educationMetaSchema = z.object({
  institution: z.string().min(1, 'Institution is required'),
  degree: z.string().min(1, 'Degree is required'),
  field: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional()
}).strict();

export enum ProjectType {
  Personal = 'personal',
  Professional = 'professional',
  Academic = 'academic',
  Freelance = 'freelance',
  OpenSource = 'open-source'
}

export enum ProjectStatus {
  Planning = 'planning',
  Active = 'active',
  Completed = 'completed'
}

export const projectMetaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  technologies: z.array(z.string()).default([]).optional(),
  projectType: z.nativeEnum(ProjectType).optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
}).strict();

export const eventMetaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
}).strict();

export const actionMetaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
}).strict();

export const careerTransitionMetaSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
  endDate: z.string().refine((val) => !val || /^\d{4}-\d{2}$/.test(val), 'Date must be in YYYY-MM format').optional(),
}).strict();

// Unified metadata validation with superRefine approach

export const nodeMetaSchema = z.object({
  type: nodeTypeSchema,
  meta: z.record(z.unknown()).default({})
}).superRefine((data, ctx) => {
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
      case TimelineNodeType.CareerTransition:
        careerTransitionMetaSchema.parse(data.meta);
        break;
      default:
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported node type: ${data.type}`
        });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.issues.forEach(issue => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['meta', ...issue.path],
          message: issue.message
        });
      });
    }
  }
});

// Zod schemas for timeline nodes
export const createTimelineNodeSchema = z.object({
  type: z.nativeEnum(TimelineNodeType),
  parentId: z.string().uuid().optional(),
  meta: z.record(z.unknown()).default({})
});

export const updateTimelineNodeSchema = z.object({
  meta: z.record(z.unknown()).optional()
});

export const moveTimelineNodeSchema = z.object({
  newParentId: z.string().uuid().nullable()
});

// TypeScript types for timeline nodes
export type TimelineNode = typeof timelineNodes.$inferSelect;
export type CreateTimelineNodeDTO = z.infer<typeof createTimelineNodeSchema>;
export type UpdateTimelineNodeDTO = z.infer<typeof updateTimelineNodeSchema>;
export type MoveTimelineNodeDTO = z.infer<typeof moveTimelineNodeSchema>;
