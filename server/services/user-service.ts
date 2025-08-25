import type { InsertUser, User } from '@shared/schema';
import bcrypt from 'bcryptjs';

import type { IUserRepository } from '../repositories/interfaces';

export class UserService {
  private userRepository: IUserRepository;

  constructor({ userRepository }: { userRepository: IUserRepository }) {
    this.userRepository = userRepository;
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findByUsername(username);
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

  async updateUserInterest(userId: number, interest: string): Promise<User> {
    return await this.userRepository.updateUserInterest(userId, interest);
  }

  async completeOnboarding(id: number): Promise<User> {
    const updated = await this.userRepository.updateOnboardingStatus(id, true);
    if (!updated) {
      throw new Error('Failed to complete onboarding - user not found');
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found after onboarding update');
    }

    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    return await this.userRepository.delete(id);
  }

  async searchUsers(query: string, limit?: number): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return await this.userRepository.searchUsers(query, limit);
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
