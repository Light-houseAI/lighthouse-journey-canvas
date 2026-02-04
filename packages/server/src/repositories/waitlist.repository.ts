/**
 * WaitlistRepository
 * Database access layer for waitlist and invite code management
 */

import * as schema from '@journey/schema';
import {
  inviteCodes,
  waitlist,
  WaitlistStatus,
} from '@journey/schema';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateWaitlistData {
  email: string;
  jobRole?: string | null;
}

export interface CreateInviteCodeData {
  code: string;
  email: string;
  waitlistId?: number | null;
  expiresAt: Date;
}

export type WaitlistRecord = typeof waitlist.$inferSelect;
export type InviteCodeRecord = typeof inviteCodes.$inferSelect;

// ============================================================================
// REPOSITORY
// ============================================================================

export class WaitlistRepository {
  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
    logger: Logger;
  }) {
    this.database = database;
    this.logger = logger;
  }

  private readonly database: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  // --------------------------------------------------------------------------
  // WAITLIST OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Add a new entry to the waitlist
   */
  async addToWaitlist(data: CreateWaitlistData): Promise<WaitlistRecord> {
    try {
      const [created] = await this.database
        .insert(waitlist)
        .values({
          email: data.email.toLowerCase().trim(),
          jobRole: data.jobRole,
          status: WaitlistStatus.Pending,
        })
        .returning();

      this.logger.info('Added to waitlist', {
        waitlistId: created.id,
        email: created.email,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to add to waitlist', error as Error, { data });
      throw error;
    }
  }

  /**
   * Find waitlist entry by email
   */
  async findByEmail(email: string): Promise<WaitlistRecord | null> {
    try {
      const [entry] = await this.database
        .select()
        .from(waitlist)
        .where(eq(waitlist.email, email.toLowerCase().trim()))
        .limit(1);

      return entry || null;
    } catch (error) {
      this.logger.error('Failed to find waitlist entry by email', error as Error, { email });
      throw error;
    }
  }

  /**
   * Find waitlist entry by ID
   */
  async findById(id: number): Promise<WaitlistRecord | null> {
    try {
      const [entry] = await this.database
        .select()
        .from(waitlist)
        .where(eq(waitlist.id, id))
        .limit(1);

      return entry || null;
    } catch (error) {
      this.logger.error('Failed to find waitlist entry by ID', error as Error, { id });
      throw error;
    }
  }

  /**
   * List all waitlist entries with pagination
   */
  async list(options: {
    limit: number;
    offset: number;
    status?: WaitlistStatus;
  }): Promise<{ entries: WaitlistRecord[]; total: number }> {
    try {
      const conditions = [];
      if (options.status) {
        conditions.push(eq(waitlist.status, options.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const entries = await this.database
        .select()
        .from(waitlist)
        .where(whereClause)
        .orderBy(desc(waitlist.createdAt))
        .limit(options.limit)
        .offset(options.offset);

      const [countResult] = await this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(waitlist)
        .where(whereClause);

      return {
        entries,
        total: countResult?.count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to list waitlist entries', error as Error, { options });
      throw error;
    }
  }

  /**
   * Update waitlist entry status
   */
  async updateStatus(
    id: number,
    status: WaitlistStatus,
    additionalData?: { invitedAt?: Date; registeredAt?: Date }
  ): Promise<WaitlistRecord | null> {
    try {
      const [updated] = await this.database
        .update(waitlist)
        .set({
          status,
          ...additionalData,
        })
        .where(eq(waitlist.id, id))
        .returning();

      return updated || null;
    } catch (error) {
      this.logger.error('Failed to update waitlist status', error as Error, { id, status });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // INVITE CODE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create a new invite code
   */
  async createInviteCode(data: CreateInviteCodeData): Promise<InviteCodeRecord> {
    try {
      const [created] = await this.database
        .insert(inviteCodes)
        .values({
          code: data.code,
          email: data.email.toLowerCase().trim(),
          waitlistId: data.waitlistId,
          expiresAt: data.expiresAt,
        })
        .returning();

      this.logger.info('Created invite code', {
        inviteId: created.id,
        email: created.email,
        waitlistId: created.waitlistId,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create invite code', error as Error, { data });
      throw error;
    }
  }

  /**
   * Find invite code by code string
   */
  async findInviteByCode(code: string): Promise<InviteCodeRecord | null> {
    try {
      const [invite] = await this.database
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.code, code))
        .limit(1);

      return invite || null;
    } catch (error) {
      this.logger.error('Failed to find invite by code', error as Error, { code });
      throw error;
    }
  }

  /**
   * Find valid (unused and not expired) invite code
   */
  async findValidInviteByCode(code: string): Promise<InviteCodeRecord | null> {
    try {
      const [invite] = await this.database
        .select()
        .from(inviteCodes)
        .where(
          and(
            eq(inviteCodes.code, code),
            isNull(inviteCodes.usedAt),
            gt(inviteCodes.expiresAt, new Date())
          )
        )
        .limit(1);

      return invite || null;
    } catch (error) {
      this.logger.error('Failed to find valid invite by code', error as Error, { code });
      throw error;
    }
  }

  /**
   * Mark invite code as used
   */
  async markInviteUsed(code: string): Promise<InviteCodeRecord | null> {
    try {
      const [updated] = await this.database
        .update(inviteCodes)
        .set({
          usedAt: new Date(),
        })
        .where(eq(inviteCodes.code, code))
        .returning();

      return updated || null;
    } catch (error) {
      this.logger.error('Failed to mark invite as used', error as Error, { code });
      throw error;
    }
  }

  /**
   * Get invite codes for a waitlist entry
   */
  async getInviteCodesForWaitlist(waitlistId: number): Promise<InviteCodeRecord[]> {
    try {
      return await this.database
        .select()
        .from(inviteCodes)
        .where(eq(inviteCodes.waitlistId, waitlistId))
        .orderBy(desc(inviteCodes.createdAt));
    } catch (error) {
      this.logger.error('Failed to get invite codes for waitlist', error as Error, { waitlistId });
      throw error;
    }
  }
}
