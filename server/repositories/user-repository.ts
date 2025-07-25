import { eq } from 'drizzle-orm';
import { users, profiles } from '../../shared/schema';
import type { User, Profile, InsertUser } from '../../shared/schema';
import type { IUserRepository, QueryOptions } from './interfaces';
import type { Database } from '../core/container';

export class UserRepository implements IUserRepository {
  constructor(private db: Database) {}

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

  async findByIdWithProfile(id: number): Promise<(User & { profile?: Profile }) | null> {
    const result = await this.db
      .select({
        user: users,
        profile: profiles,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);

    if (!result[0]) return null;

    return {
      ...result[0].user,
      profile: result[0].profile || undefined,
    };
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

  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0;
  }
}