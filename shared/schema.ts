import { pgTable, text, serial, json, timestamp, boolean, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
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
