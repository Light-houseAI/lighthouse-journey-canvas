import { pgTable, text, serial, json, timestamp, boolean } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Profile data structure
export const profileExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  description: z.string().optional(),
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
