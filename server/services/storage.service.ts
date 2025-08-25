import {
  type InsertProfile,
  type Profile,
  profiles,
  type SignUp,
  type User,
  users,
} from '@shared/schema';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface IStorage {
  // Auth methods
  createUser(signUpData: SignUp): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  validatePassword(password: string, hashedPassword: string): Promise<boolean>;
  updateUserInterest(userId: number, interest: string): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  completeOnboarding(userId: number): Promise<User>;

  // Profile methods
  getProfile(id: number): Promise<Profile | undefined>;
  getProfileByUsername(
    userId: number,
    username: string
  ): Promise<Profile | undefined>;
  getProfileByUserId(userId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  getAllProfiles(): Promise<Profile[]>;
  saveProjectMilestones(userId: number, projects: any[]): Promise<void>;
  getProjectMilestones(userId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  private db: NodePgDatabase<any>;

  constructor({ database }: { database: NodePgDatabase<any> }) {
    this.db = database;
  }

  // Auth methods
  async createUser(signUpData: SignUp): Promise<User> {
    const hashedPassword = await bcrypt.hash(signUpData.password, 12);

    const [user] = await this.db
      .insert(users)
      .values({
        email: signUpData.email,
        password: hashedPassword,
      })
      .returning();

    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.userName, username));
    return user || undefined;
  }

  async validatePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async updateUserInterest(userId: number, interest: string): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ interest })
      .where(eq(users.id, userId))
      .returning();

    return user;
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    // Remove fields that shouldn't be updated directly
    const { ...allowedUpdates } = updates;

    const [user] = await this.db
      .update(users)
      .set(allowedUpdates)
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async completeOnboarding(userId: number): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({ hasCompletedOnboarding: true })
      .where(eq(users.id, userId))
      .returning();

    return user;
  }

  // Profile methods
  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, id));
    return profile || undefined;
  }

  async getProfileByUsername(
    userId: number,
    username: string
  ): Promise<Profile | undefined> {
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(and(eq(profiles.username, username), eq(profiles.userId, userId)));
    return profile || undefined;
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const [profile] = await this.db
      .insert(profiles)
      .values(insertProfile)
      .returning();

    return profile;
  }

  async updateProfile(
    profileId: number,
    updates: Partial<Profile>
  ): Promise<Profile | null> {
    const [profile] = await this.db
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
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return profile || undefined;
  }

  async saveProjectMilestones(userId: number, projects: any[]): Promise<void> {
    // Find user's profile and update with projects
    const userProfile = await this.getProfileByUserId(userId);
    if (userProfile) {
      await this.db
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
