import type { InsertUser, User } from '@shared/types';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { IUserRepository, QueryOptions } from './interfaces';

export class UserRepository implements IUserRepository {
  private db: NodePgDatabase<any>;

  constructor({ database }: { database: NodePgDatabase<any> }) {
    this.db = database;
  }

  async findById(id: number): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.userName, username))
      .limit(1);

    return result[0] || null;
  }

  async findMany(options: QueryOptions = {}): Promise<User[]> {
    let query = this.db.select().from(users);

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async create(data: InsertUser): Promise<User> {
    const result = await this.db
      .insert(users)
      .values(data)
      .returning();

    return result[0];
  }

  async update(id: number, data: Partial<User>): Promise<User | null> {
    const result = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();

    return result[0] || null;
  }

  async updateOnboardingStatus(id: number, hasCompleted: boolean): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({ hasCompletedOnboarding: hasCompleted })
      .where(eq(users.id, id))
      .returning();

    return result.length > 0;
  }

  async updateUserInterest(userId: number, interest: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({ interest })
      .where(eq(users.id, userId))
      .returning();

    if (!result[0]) {
      throw new Error('User not found or failed to update interest');
    }

    return result[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    return result.length > 0;
  }

  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const searchTerm = `%${query.trim().toLowerCase()}%`;

      const result = await this.db
        .select()
        .from(users)
        .where(
          // Search by email or username (case-insensitive)
          // Using sql template with proper parameterization
          sql`(LOWER(${users.email}) LIKE ${searchTerm}) OR (LOWER(${users.userName}) LIKE ${searchTerm})`
        )
        .limit(limit);

      return result;
    } catch (error) {
      console.error('Database search error:', error);
      throw new Error(`Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
