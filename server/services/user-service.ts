import type { User, Profile, InsertUser } from '@shared/schema';
import type { IUserRepository } from '../repositories/interfaces';
import type { IUserService } from './interfaces';

export class UserService implements IUserService {
  constructor(private userRepository: IUserRepository) {}

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  async getUserWithProfile(id: number): Promise<(User & { profile?: Profile }) | null> {
    return await this.userRepository.findByIdWithProfile(id);
  }

  async createUser(userData: InsertUser): Promise<User> {
    // Validate email doesn't already exist
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return await this.userRepository.create(userData);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    // If updating email, check it's not already taken
    if (updates.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already in use by another user');
      }
    }

    return await this.userRepository.update(id, updates);
  }

  async completeOnboarding(id: number): Promise<boolean> {
    return await this.userRepository.updateOnboardingStatus(id, true);
  }

  async deleteUser(id: number): Promise<boolean> {
    return await this.userRepository.delete(id);
  }
}
