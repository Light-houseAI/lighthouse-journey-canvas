import type { InsertUser, User } from '@journey/schema';
import bcrypt from 'bcryptjs';

import type { Logger } from '../core/logger.js';
import type { IUserRepository } from '../repositories/interfaces.js';
import type { IUserService } from './interfaces.js';

export class UserService implements IUserService {
  private userRepository: IUserRepository;
  private logger?: Logger;

  constructor({
    userRepository,
    logger,
  }: {
    userRepository: IUserRepository;
    logger?: Logger;
  }) {
    this.userRepository = userRepository;
    this.logger = logger;
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  async getUserByIdWithExperience(
    id: number
  ): Promise<(User & { experienceLine?: string }) | null> {
    return await this.userRepository.findByIdWithExperience(id);
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
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    const user = await this.userRepository.create(userData);

    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    // If updating email, check it's not already taken
    if (updates.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error('Email already in use by another user');
      }
    }

    const updated = await this.userRepository.update(id, updates);

    return updated;
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

  async searchUsers(query: string): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    // searchUsers now includes experience data in a single query
    return await this.userRepository.searchUsers(query);
  }

  async validatePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
