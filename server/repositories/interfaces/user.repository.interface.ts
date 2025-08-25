/**
 * User Repository Interface
 * Contract for user database operations following modern request/response pattern
 */

import type { User } from '@shared/schema';

/**
 * Request types for user repository operations
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  interest?: string;
  hasCompletedOnboarding?: boolean;
}

export interface UpdateUserRequest {
  id: number;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  interest?: string;
  hasCompletedOnboarding?: boolean;
}

export interface SearchUsersRequest {
  query: string;
  limit?: number;
  offset?: number;
}

/**
 * User Repository Interface
 * Contract for user database operations following modern request/response pattern
 */
export interface IUserRepository {
  /**
   * Create a new user with validation
   */
  createUser(request: CreateUserRequest): Promise<User>;

  /**
   * Get user by ID
   */
  findById(id: number): Promise<User | null>;

  /**
   * Get user by email address
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Get user by username
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Update an existing user
   */
  updateUser(request: UpdateUserRequest): Promise<User | null>;

  /**
   * Update user's onboarding completion status
   */
  updateOnboardingStatus(id: number, hasCompleted: boolean): Promise<boolean>;

  /**
   * Update user's interest field
   */
  updateUserInterest(userId: number, interest: string): Promise<User>;

  /**
   * Search users by query string
   */
  searchUsers(request: SearchUsersRequest): Promise<User[]>;

  /**
   * Delete a user by ID
   */
  deleteUser(id: number): Promise<boolean>;
}