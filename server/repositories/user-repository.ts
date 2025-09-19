import * as schema from '@shared/schema';
import { users } from '@shared/schema';
import type { InsertUser, User } from '@shared/types';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { IUserRepository, QueryOptions } from './interfaces';

export class UserRepository implements IUserRepository {
  private db: NodePgDatabase<typeof schema>;

  constructor({ database }: { database: NodePgDatabase<typeof schema> }) {
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

  async findByIdWithExperience(
    id: number
  ): Promise<(User & { experienceLine?: string }) | null> {
    const result = await this.db
      .select({
        id: users.id,
        email: users.email,
        password: users.password,
        firstName: users.firstName,
        lastName: users.lastName,
        userName: users.userName,
        interest: users.interest,
        hasCompletedOnboarding: users.hasCompletedOnboarding,
        createdAt: users.createdAt,
        // Subquery to get the most recent experience as a formatted string
        experienceLine: sql<string>`(
          SELECT
            CASE
              WHEN tn.type = 'job' THEN
                CASE
                  WHEN tn.meta->>'title' IS NOT NULL AND tn.meta->>'company' IS NOT NULL THEN
                    CONCAT(tn.meta->>'title', ' at ', tn.meta->>'company')
                  WHEN tn.meta->>'company' IS NOT NULL THEN
                    tn.meta->>'company'
                  WHEN tn.meta->>'title' IS NOT NULL THEN
                    tn.meta->>'title'
                  ELSE NULL
                END
              WHEN tn.type = 'education' THEN
                CASE
                  WHEN tn.meta->>'degree' IS NOT NULL AND tn.meta->>'institution' IS NOT NULL THEN
                    CONCAT(tn.meta->>'degree', ' at ', tn.meta->>'institution')
                  WHEN tn.meta->>'institution' IS NOT NULL THEN
                    tn.meta->>'institution'
                  WHEN tn.meta->>'degree' IS NOT NULL THEN
                    tn.meta->>'degree'
                  ELSE NULL
                END
              WHEN tn.type = 'event' THEN
                tn.meta->>'title'
              ELSE NULL
            END
          FROM timeline_nodes tn
          WHERE tn.user_id = ${id}
          AND tn.type IN ('job', 'education', 'event')
          ORDER BY
            CASE WHEN tn.type = 'job' THEN 1
                 WHEN tn.type = 'education' THEN 2
                 ELSE 3
            END,
            tn.created_at DESC
          LIMIT 1
        )`.as('experienceLine'),
      })
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
    const result = await this.db.insert(users).values(data).returning();

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

  async updateOnboardingStatus(
    id: number,
    hasCompleted: boolean
  ): Promise<boolean> {
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

  async searchUsers(
    query: string
  ): Promise<Array<User & { experienceLine?: string }>> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const searchTerm = query.trim().toLowerCase();

      console.log('UserRepository.searchUsers:', {
        originalQuery: query,
        searchTerm,
        queryType: 'name search with experience',
      });

      // Single query to get users with their most recent experience
      const result = await this.db
        .select({
          id: users.id,
          email: users.email,
          password: users.password,
          firstName: users.firstName,
          lastName: users.lastName,
          userName: users.userName,
          interest: users.interest,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          createdAt: users.createdAt,
          // Subquery to get the most recent experience as a formatted string
          experienceLine: sql<string>`(
            SELECT
              CASE
                WHEN tn.type = 'job' THEN
                  CONCAT(
                    COALESCE(tn.meta->>'title', 'Professional'),
                    CASE
                      WHEN tn.meta->>'company' IS NOT NULL THEN CONCAT(' at ', tn.meta->>'company')
                      WHEN tn.meta->>'organization' IS NOT NULL THEN CONCAT(' at ', tn.meta->>'organization')
                      ELSE ''
                    END
                  )
                WHEN tn.type = 'education' THEN
                  CONCAT(
                    COALESCE(
                      tn.meta->>'degree',
                      tn.meta->>'fieldOfStudy',
                      'Student'
                    ),
                    CASE
                      WHEN tn.meta->>'institution' IS NOT NULL THEN CONCAT(' at ', tn.meta->>'institution')
                      WHEN tn.meta->>'school' IS NOT NULL THEN CONCAT(' at ', tn.meta->>'school')
                      ELSE ''
                    END
                  )
                WHEN tn.type = 'project' THEN
                  CONCAT('Project: ', COALESCE(tn.meta->>'title', tn.meta->>'name', 'Untitled'))
                WHEN tn.type = 'event' THEN
                  CONCAT('Event: ', COALESCE(tn.meta->>'title', tn.meta->>'name', 'Untitled'))
                WHEN tn.type = 'careerTransition' THEN
                  COALESCE(tn.meta->>'description', 'Career Transition')
                ELSE
                  COALESCE(tn.meta->>'title', tn.meta->>'name', 'Professional')
              END
            FROM timeline_nodes tn
            WHERE tn.user_id = users.id
            ORDER BY
              -- First, prioritize current experiences (null endDate)
              CASE WHEN tn.meta->>'endDate' IS NULL THEN 0 ELSE 1 END,
              -- Then sort by endDate (null treated as current date for ongoing)
              COALESCE(
                CASE
                  WHEN tn.meta->>'endDate' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (tn.meta->>'endDate')::date
                  WHEN tn.meta->>'endDate' ~ '^\\d{4}-\\d{2}$' THEN (tn.meta->>'endDate' || '-01')::date
                  WHEN tn.meta->>'endDate' ~ '^\\d{4}$' THEN (tn.meta->>'endDate' || '-01-01')::date
                  ELSE NULL
                END,
                CURRENT_DATE
              ) DESC,
              -- Within same date, prioritize by node type
              CASE
                WHEN tn.type = 'job' THEN 1
                WHEN tn.type = 'education' THEN 2
                ELSE 3
              END,
              -- Finally, by startDate as tiebreaker
              COALESCE(
                CASE
                  WHEN tn.meta->>'startDate' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (tn.meta->>'startDate')::date
                  WHEN tn.meta->>'startDate' ~ '^\\d{4}-\\d{2}$' THEN (tn.meta->>'startDate' || '-01')::date
                  WHEN tn.meta->>'startDate' ~ '^\\d{4}$' THEN (tn.meta->>'startDate' || '-01-01')::date
                  ELSE NULL
                END,
                tn.created_at
              ) DESC
            LIMIT 1
          )`.as('experienceLine'),
        })
        .from(users)
        .where(
          // Search by first name, last name, or full name only (case-insensitive)
          sql`(
            LOWER(${users.firstName}) LIKE ${'%' + searchTerm + '%'} OR
            LOWER(${users.lastName}) LIKE ${'%' + searchTerm + '%'} OR
            LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE ${'%' + searchTerm + '%'}
          )`
        )
        .limit(20); // Limit to 20 results for name searches

      console.log('UserRepository.searchUsers result:', {
        searchTerm,
        resultCount: result.length,
        userIds: result.map((u) => u.id),
      });

      return result as Array<User & { experienceLine?: string }>;
    } catch (error) {
      console.error('Database search error:', error);
      throw new Error(
        `Failed to search users: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
