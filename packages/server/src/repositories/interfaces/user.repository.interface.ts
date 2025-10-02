/**
 * User Repository Interface
 * Contract for user database operations following modern request/response pattern
 */

import type { InsertUser,User } from '@journey/schema';

/**
 * User Repository Interface
 * Contract for user database operations
 */
export interface IUserRepository {
  /**
   * Get user by ID
   */
  findById(id: number): Promise<User | null>;

  /**
   * Get user by ID with experience line
   */
  findByIdWithExperience(
    id: number
  ): Promise<(User & { experienceLine?: string }) | null>;

  /**
   * Get user by email address
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Get user by username
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Get multiple users with optional pagination
   */
  findMany(options?: { limit?: number; offset?: number }): Promise<User[]>;

  /**
   * Create a new user
   */
  create(data: InsertUser): Promise<User>;

  /**
   * Update an existing user
   */
  update(id: number, data: Partial<User>): Promise<User | null>;

  /**
   * Update user's onboarding completion status
   */
  updateOnboardingStatus(id: number, hasCompleted: boolean): Promise<boolean>;

  /**
   * Update user's interest field
   */
  updateUserInterest(userId: number, interest: string): Promise<User>;

  /**
   * Delete a user by ID
   */
  delete(id: number): Promise<boolean>;

  /**
   * Search users by query string (returns users with experience lines)
   */
  searchUsers(
    query: string
  ): Promise<Array<User & { experienceLine?: string }>>;
}
