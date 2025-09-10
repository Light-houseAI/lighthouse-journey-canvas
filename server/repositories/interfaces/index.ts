/**
 * Repository interfaces barrel export
 */

import type { InsertUser, User } from '@shared/schema';

// Simple query options interface
export interface QueryOptions {
  limit?: number;
  offset?: number;
}

// Simple user repository interface that matches actual implementation
export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findMany(options?: QueryOptions): Promise<User[]>;
  create(data: InsertUser): Promise<User>;
  update(id: number, data: Partial<User>): Promise<User | null>;
  updateOnboardingStatus(id: number, hasCompleted: boolean): Promise<boolean>;
  updateUserInterest(userId: number, interest: string): Promise<User>;
  delete(id: number): Promise<boolean>;
  searchUsers(query: string): Promise<User[]>; // Updated to match new signature
}

// Re-export other interfaces as needed
export * from './hierarchy.repository.interface';
export * from './insight.repository.interface';
export * from './node-permission.repository.interface';
export * from './organization.repository.interface';
export * from './refresh-token.repository.interface';
