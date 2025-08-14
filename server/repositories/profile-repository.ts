import { eq } from 'drizzle-orm';
import { profiles } from '@shared/schema';
import type { Profile, InsertProfile, Milestone } from '@shared/schema';
import type { IProfileRepository, QueryOptions } from './interfaces';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { AnyNode } from '../types/node-types';
import type { BaseNode } from '../core/interfaces/base-node.interface';

export class ProfileRepository implements IProfileRepository {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: number): Promise<Profile | null> {
    const result = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, id))
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
      .where(eq(profiles.userId, id))
      .returning();

    return result[0] || null;
  }

  async updateProjects(profileId: number, projects: Milestone[]): Promise<boolean> {
    const result = await this.db
      .update(profiles)
      .set({ projects })
      .where(eq(profiles.userId, profileId))
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
      .where(eq(profiles.userId, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Get all nodes from filteredData aggregated into a single array
   *
   * @param profileId - The profile ID to get nodes for
   * @returns All nodes from all categories in filteredData
   */
  async getAllNodes(profileId: number): Promise<BaseNode[]> {
    const profile = await this.findById(profileId);
    if (!profile?.filteredData) {
      return [];
    }

    const allNodes: BaseNode[] = [];

    // Aggregate all node types from filteredData
    if (Array.isArray(profile.filteredData.workExperiences)) {
      allNodes.push(...profile.filteredData.workExperiences);
    }
    if (Array.isArray(profile.filteredData.education)) {
      allNodes.push(...profile.filteredData.education);
    }
    if (Array.isArray(profile.filteredData.projects)) {
      allNodes.push(...profile.filteredData.projects);
    }
    if (Array.isArray(profile.filteredData.events)) {
      allNodes.push(...profile.filteredData.events);
    }
    if (Array.isArray(profile.filteredData.actions)) {
      allNodes.push(...profile.filteredData.actions);
    }
    if (Array.isArray(profile.filteredData.careerTransitions)) {
      allNodes.push(...profile.filteredData.careerTransitions);
    }

    return allNodes;
  }

  /**
   * Get filteredData for a profile
   *
   * @param profileId - The profile ID to get filteredData for
   * @returns The filteredData object or null if profile not found
   */
  async getFilteredData(profileId: number): Promise<any | null> {
    const profile = await this.findById(profileId);
    return profile?.filteredData || null;
  }

  /**
   * Update filteredData for a profile
   *
   * @param profileId - The profile ID to update
   * @param filteredData - The new filteredData object
   * @returns The updated profile or null if not found
   */
  async updateFilteredData(profileId: number, filteredData: any): Promise<Profile | null> {
    const result = await this.db
      .update(profiles)
      .set({ filteredData })
      .where(eq(profiles.userId, profileId))
      .returning();

    return result[0] || null;
  }

  /**
   * Initialize filteredData structure if it doesn't exist
   *
   * @param profileId - The profile ID to initialize
   * @returns The updated profile or null if not found
   */
  async initializeFilteredData(profileId: number): Promise<Profile | null> {
    const profile = await this.findById(profileId);
    if (!profile) {
      return null;
    }

    // Only initialize if filteredData is null or undefined
    if (!profile.filteredData) {
      const initialFilteredData = {
        workExperiences: [],
        education: [],
        projects: [],
        events: [],
        actions: [],
        careerTransitions: [],
      };

      return await this.updateFilteredData(profileId, initialFilteredData);
    }

    return profile;
  }

  /**
   * Get nodes count by type for a profile
   *
   * @param profileId - The profile ID to analyze
   * @returns Object with counts for each node type
   */
  async getNodesCount(profileId: number): Promise<{
    workExperiences: number;
    education: number;
    projects: number;
    events: number;
    actions: number;
    careerTransitions: number;
    total: number;
  }> {
    const profile = await this.findById(profileId);

    const counts = {
      workExperiences: 0,
      education: 0,
      projects: 0,
      events: 0,
      actions: 0,
      careerTransitions: 0,
      total: 0,
    };

    if (profile?.filteredData) {
      counts.workExperiences = Array.isArray(profile.filteredData.workExperiences)
        ? profile.filteredData.workExperiences.length : 0;
      counts.education = Array.isArray(profile.filteredData.education)
        ? profile.filteredData.education.length : 0;
      counts.projects = Array.isArray(profile.filteredData.projects)
        ? profile.filteredData.projects.length : 0;
      counts.events = Array.isArray(profile.filteredData.events)
        ? profile.filteredData.events.length : 0;
      counts.actions = Array.isArray(profile.filteredData.actions)
        ? profile.filteredData.actions.length : 0;
      counts.careerTransitions = Array.isArray(profile.filteredData.careerTransitions)
        ? profile.filteredData.careerTransitions.length : 0;

      counts.total = counts.workExperiences + counts.education + counts.projects +
                     counts.events + counts.actions + counts.careerTransitions;
    }

    return counts;
  }

  /**
   * Clear all nodes from filteredData for a profile
   *
   * @param profileId - The profile ID to clear
   * @returns The updated profile or null if not found
   */
  async clearFilteredData(profileId: number): Promise<Profile | null> {
    const clearedFilteredData = {
      workExperiences: [],
      education: [],
      projects: [],
      events: [],
      actions: [],
      careerTransitions: [],
    };

    return await this.updateFilteredData(profileId, clearedFilteredData);
  }

  /**
   * Check if profile has any nodes in filteredData
   *
   * @param profileId - The profile ID to check
   * @returns True if profile has any nodes, false otherwise
   */
  async hasAnyNodes(profileId: number): Promise<boolean> {
    const counts = await this.getNodesCount(profileId);
    return counts.total > 0;
  }
}
