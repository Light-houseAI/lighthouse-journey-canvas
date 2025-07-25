import type { Profile, Milestone, InsertProfile } from '../../shared/schema';
import type { IProfileRepository } from '../repositories/interfaces';
import type { IProfileService } from './interfaces';

export class ProfileService implements IProfileService {
  constructor(private profileRepository: IProfileRepository) {}

  async getProfileById(id: number): Promise<Profile | null> {
    return await this.profileRepository.findById(id);
  }

  async getProfileByUserId(userId: number): Promise<Profile | null> {
    return await this.profileRepository.findByUserId(userId);
  }

  async getProfileByUsername(username: string): Promise<Profile | null> {
    return await this.profileRepository.findByUsername(username);
  }

  async createProfile(profileData: InsertProfile): Promise<Profile> {
    // Validate username is unique
    const existingProfile = await this.profileRepository.findByUsername(profileData.username);
    if (existingProfile) {
      throw new Error('Username already taken');
    }

    return await this.profileRepository.create(profileData);
  }

  async updateProfile(id: number, updates: Partial<Profile>): Promise<Profile | null> {
    // If updating username, check it's not already taken
    if (updates.username) {
      const existingProfile = await this.profileRepository.findByUsername(updates.username);
      if (existingProfile && existingProfile.id !== id) {
        throw new Error('Username already taken');
      }
    }

    return await this.profileRepository.update(id, updates);
  }

  async addMilestone(profileId: number, milestone: Milestone): Promise<boolean> {
    // Validate milestone has required fields
    if (!milestone.id || !milestone.title || !milestone.type) {
      throw new Error('Milestone must have id, title, and type');
    }

    return await this.profileRepository.addMilestone(profileId, milestone);
  }

  async updateMilestone(
    profileId: number, 
    milestoneId: string, 
    updates: Partial<Milestone>
  ): Promise<boolean> {
    return await this.profileRepository.updateMilestone(profileId, milestoneId, updates);
  }

  async removeMilestone(profileId: number, milestoneId: string): Promise<boolean> {
    return await this.profileRepository.removeMilestone(profileId, milestoneId);
  }

  async getMilestones(profileId: number): Promise<Milestone[]> {
    const profile = await this.profileRepository.findById(profileId);
    return profile?.projects || [];
  }
}