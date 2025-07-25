import { eq } from 'drizzle-orm';
import { profiles } from '../../shared/schema';
import type { Profile, InsertProfile, Milestone } from '../../shared/schema';
import type { IProfileRepository, QueryOptions } from './interfaces';
import type { Database } from '../core/container';

export class ProfileRepository implements IProfileRepository {
  constructor(private db: Database) {}

  async findById(id: number): Promise<Profile | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  async findByUserId(userId: number): Promise<Profile | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    return result[0] || null;
  }

  async findByUsername(username: string): Promise<Profile | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.username, username))
      .limit(1);
    
    return result[0] || null;
  }

  async findMany(options: QueryOptions = {}): Promise<Profile[]> {
    let query = this.db.select().from(profiles);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async create(data: InsertProfile): Promise<Profile> {
    const result = await this.db
      .insert(profiles)
      .values(data)
      .returning();
    
    return result[0];
  }

  async update(id: number, data: Partial<Profile>): Promise<Profile | null> {
    const result = await this.db
      .update(profiles)
      .set(data)
      .where(eq(profiles.id, id))
      .returning();
    
    return result[0] || null;
  }

  async updateProjects(profileId: number, projects: Milestone[]): Promise<boolean> {
    const result = await this.db
      .update(profiles)
      .set({ projects })
      .where(eq(profiles.id, profileId))
      .returning();
    
    return result.length > 0;
  }

  async addMilestone(profileId: number, milestone: Milestone): Promise<boolean> {
    const profile = await this.findById(profileId);
    if (!profile) return false;

    const currentProjects = profile.projects || [];
    const updatedProjects = [...currentProjects, milestone];

    return await this.updateProjects(profileId, updatedProjects);
  }

  async removeMilestone(profileId: number, milestoneId: string): Promise<boolean> {
    const profile = await this.findById(profileId);
    if (!profile) return false;

    const currentProjects = profile.projects || [];
    const updatedProjects = currentProjects.filter(m => m.id !== milestoneId);

    return await this.updateProjects(profileId, updatedProjects);
  }

  async updateMilestone(
    profileId: number, 
    milestoneId: string, 
    updates: Partial<Milestone>
  ): Promise<boolean> {
    const profile = await this.findById(profileId);
    if (!profile) return false;

    const currentProjects = profile.projects || [];
    const updatedProjects = currentProjects.map(m => 
      m.id === milestoneId ? { ...m, ...updates } : m
    );

    return await this.updateProjects(profileId, updatedProjects);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(profiles)
      .where(eq(profiles.id, id))
      .returning();
    
    return result.length > 0;
  }
}