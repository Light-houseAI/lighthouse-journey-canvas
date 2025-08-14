import { users, profiles, type User, type Profile, type InsertUser, type InsertProfile, type SignUp, type SignIn, type Interest } from "@shared/schema";
import { db } from "../config/database.config";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Auth methods
  createUser(signUpData: SignUp): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;
  updateUserInterest(userId: number, interest: string): Promise<User>;
  completeOnboarding(userId: number): Promise<User>;

  // Profile methods
  getProfile(id: number): Promise<Profile | undefined>;
  getProfileByUsername(userId: number, username: string): Promise<Profile | undefined>;
  getProfileByUserId(userId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  getAllProfiles(): Promise<Profile[]>;
  saveProjectMilestones(userId: number, projects: any[]): Promise<void>;
  getProjectMilestones(userId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Auth methods
  async createUser(signUpData: SignUp): Promise<User> {
    const hashedPassword = await bcrypt.hash(signUpData.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        email: signUpData.email,
        password: hashedPassword,
      })
      .returning();

    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async updateUserInterest(userId: number, interest: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ interest })
      .where(eq(users.id, userId))
      .returning();

    return user;
  }

  async completeOnboarding(userId: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ hasCompletedOnboarding: true })
      .where(eq(users.id, userId))
      .returning();

    return user;
  }

  // Profile methods
  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, id));
    return profile || undefined;
  }

  async getProfileByUsername(userId: number, username: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.username, username),eq(profiles.userId, userId)))
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(insertProfile)
      .returning();

    return profile;
  }

  async updateProfile(profileId: number, updates: Partial<Profile>): Promise<Profile | null> {
    const [profile] = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.userId, profileId))
      .returning();

    return profile || null;
  }

  async getAllProfiles(): Promise<Profile[]> {
    return db.select().from(profiles);
  }

  async getProfileByUserId(userId: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile || undefined;
  }

  async saveProjectMilestones(userId: number, projects: any[]): Promise<void> {
    // Find user's profile and update with projects
    const userProfile = await this.getProfileByUserId(userId);
    if (userProfile) {
      await db
        .update(profiles)
        .set({ projects })
        .where(eq(profiles.userId, userProfile.id));
    }
  }

  async getProjectMilestones(userId: number): Promise<any[]> {
    const userProfile = await this.getProfileByUserId(userId);
    if (userProfile && userProfile.projects) {
      return userProfile.projects;
    }
    return [];
  }
}

export const storage = new DatabaseStorage();