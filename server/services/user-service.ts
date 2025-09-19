import type { InsertUser, User } from '@shared/schema';
import bcrypt from 'bcryptjs';

import type { Logger } from '../core/logger';
import type { IUserRepository } from '../repositories/interfaces';
import type {
  OpenAIEmbeddingService,
  PgVectorGraphRAGService,
} from '../types/graphrag.types';
import type { IUserService } from './interfaces';

export class UserService implements IUserService {
  private userRepository: IUserRepository;
  private pgvectorService?: PgVectorGraphRAGService;
  private embeddingService?: OpenAIEmbeddingService;
  private logger?: Logger;

  constructor({
    userRepository,
    pgVectorGraphRAGService,
    openAIEmbeddingService,
    logger,
  }: {
    userRepository: IUserRepository;
    pgVectorGraphRAGService?: PgVectorGraphRAGService;
    openAIEmbeddingService?: OpenAIEmbeddingService;
    logger?: Logger;
  }) {
    this.userRepository = userRepository;
    this.pgvectorService = pgVectorGraphRAGService;
    this.embeddingService = openAIEmbeddingService;
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

    // Sync user profile to pgvector for search functionality
    await this.syncUserToPgvector(user);

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

    if (updated) {
      // Sync updated user profile to pgvector
      await this.syncUserToPgvector(updated);
    }

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

    // Sync updated user profile to pgvector
    await this.syncUserToPgvector(user);

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

  /**
   * Sync user profile to pgvector for search functionality
   * Called automatically after user create/update operations
   */
  private async syncUserToPgvector(user: User): Promise<void> {
    this.logger?.debug('syncUserToPgvector called', {
      userId: user.id,
      hasEmbeddingService: !!this.embeddingService,
      hasPgvectorService: !!this.pgvectorService,
    });

    if (!this.embeddingService || !this.pgvectorService) {
      this.logger?.debug(
        'pgvector services not available, skipping user sync',
        { userId: user.id }
      );
      return;
    }

    try {
      const userText = this.generateUserText(user);
      const embedding = await this.embeddingService.generateEmbedding(userText);

      const chunkResult = await this.pgvectorService.createChunk({
        userId: user.id,
        nodeId: `user-${user.id}`, // Use user-prefixed ID to distinguish from timeline nodes
        chunkText: userText,
        embedding: embedding,
        nodeType: 'user_profile',
        meta: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          interest: user.interest,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          createdAt: user.createdAt,
        },
        tenantId: 'default',
      });

      this.logger?.debug('User synced to pgvector successfully', {
        userId: user.id,
        chunkResult: chunkResult,
        embeddingLength: embedding.length,
        userTextLength: userText.length,
      });
    } catch (error) {
      this.logger?.warn('Failed to sync user to pgvector', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate searchable text representation of user profile
   */
  private generateUserText(user: User): string {
    const parts: string[] = [];

    // Basic profile information
    if (user.firstName) parts.push(`First name: ${user.firstName}`);
    if (user.lastName) parts.push(`Last name: ${user.lastName}`);
    if (user.userName) parts.push(`Username: ${user.userName}`);
    if (user.email) parts.push(`Email: ${user.email}`);

    // Career interest
    if (user.interest) {
      const interestText =
        user.interest === 'grow-career'
          ? 'Growing career and professional development'
          : user.interest.replace(/-/g, ' ');
      parts.push(`Interest: ${interestText}`);
    }

    // Onboarding status
    if (user.hasCompletedOnboarding) {
      parts.push('Completed onboarding and profile setup');
    }

    // Full name for search
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    if (fullName) {
      parts.push(`Full name: ${fullName}`);
    }

    return parts.join('. ');
  }
}
