/**
 * WaitlistService
 * Business logic for waitlist and invite code management
 */

import { WaitlistStatus } from '@journey/schema';
import { nanoid } from 'nanoid';

import type { Logger } from '../core/logger.js';
import type {
  InviteCodeRecord,
  WaitlistRecord,
  WaitlistRepository,
} from '../repositories/waitlist.repository.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AddToWaitlistResult {
  success: boolean;
  entry?: WaitlistRecord;
  alreadyExists?: boolean;
  message: string;
}

export interface ValidateInviteResult {
  valid: boolean;
  email?: string;
  expired?: boolean;
  alreadyUsed?: boolean;
  message: string;
}

export interface GenerateInviteResult {
  success: boolean;
  inviteCode?: InviteCodeRecord;
  message: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class WaitlistService {
  private readonly waitlistRepository: WaitlistRepository;
  private readonly logger: Logger;

  constructor({
    waitlistRepository,
    logger,
  }: {
    waitlistRepository: WaitlistRepository;
    logger: Logger;
  }) {
    this.waitlistRepository = waitlistRepository;
    this.logger = logger;
  }

  // --------------------------------------------------------------------------
  // WAITLIST OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Add a new entry to the waitlist
   * Handles duplicate emails gracefully
   */
  async addToWaitlist(
    email: string,
    jobRole?: string
  ): Promise<AddToWaitlistResult> {
    try {
      // Check if already on waitlist
      const existing = await this.waitlistRepository.findByEmail(email);
      if (existing) {
        this.logger.info('Email already on waitlist', { email });
        return {
          success: true,
          entry: existing,
          alreadyExists: true,
          message: "You're already on the list!",
        };
      }

      // Add to waitlist
      const entry = await this.waitlistRepository.addToWaitlist({
        email,
        jobRole,
      });

      return {
        success: true,
        entry,
        alreadyExists: false,
        message: "You're on the list! We'll be in touch soon.",
      };
    } catch (error) {
      this.logger.error('Failed to add to waitlist', error as Error, { email });
      throw error;
    }
  }

  /**
   * Get waitlist entry by email
   */
  async getByEmail(email: string): Promise<WaitlistRecord | null> {
    return this.waitlistRepository.findByEmail(email);
  }

  /**
   * Get waitlist entry by ID
   */
  async getById(id: number): Promise<WaitlistRecord | null> {
    return this.waitlistRepository.findById(id);
  }

  /**
   * List waitlist entries with pagination
   */
  async listWaitlist(options: {
    limit?: number;
    offset?: number;
    status?: WaitlistStatus;
  }): Promise<{ entries: WaitlistRecord[]; total: number }> {
    return this.waitlistRepository.list({
      limit: options.limit || 50,
      offset: options.offset || 0,
      status: options.status,
    });
  }

  // --------------------------------------------------------------------------
  // INVITE CODE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Generate an invite code for a waitlist entry
   * @param waitlistId - ID of the waitlist entry
   * @param expiryDays - Number of days until the code expires (default: 7)
   */
  async generateInviteCode(
    waitlistId: number,
    expiryDays: number = 7
  ): Promise<GenerateInviteResult> {
    try {
      // Get waitlist entry
      const entry = await this.waitlistRepository.findById(waitlistId);
      if (!entry) {
        return {
          success: false,
          message: 'Waitlist entry not found',
        };
      }

      // Generate secure code (21 characters - URL-safe)
      const code = nanoid(21);

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      // Create invite code
      const inviteCode = await this.waitlistRepository.createInviteCode({
        code,
        email: entry.email,
        waitlistId: entry.id,
        expiresAt,
      });

      // Update waitlist status to invited
      await this.waitlistRepository.updateStatus(waitlistId, WaitlistStatus.Invited, {
        invitedAt: new Date(),
      });

      this.logger.info('Generated invite code', {
        waitlistId,
        email: entry.email,
        expiresAt,
      });

      return {
        success: true,
        inviteCode,
        message: 'Invite code generated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to generate invite code', error as Error, { waitlistId });
      throw error;
    }
  }

  /**
   * Validate an invite code
   */
  async validateInviteCode(code: string): Promise<ValidateInviteResult> {
    try {
      // Find invite code
      const invite = await this.waitlistRepository.findInviteByCode(code);

      if (!invite) {
        return {
          valid: false,
          message: 'Invalid invite code',
        };
      }

      // Check if already used
      if (invite.usedAt) {
        return {
          valid: false,
          email: invite.email,
          alreadyUsed: true,
          message: 'This invite code has already been used',
        };
      }

      // Check if expired
      if (new Date() > invite.expiresAt) {
        return {
          valid: false,
          email: invite.email,
          expired: true,
          message: 'This invite code has expired',
        };
      }

      return {
        valid: true,
        email: invite.email,
        message: 'Valid invite code',
      };
    } catch (error) {
      this.logger.error('Failed to validate invite code', error as Error, { code });
      throw error;
    }
  }

  /**
   * Use an invite code (mark as used and update waitlist status)
   */
  async useInviteCode(code: string): Promise<boolean> {
    try {
      // Validate first
      const validation = await this.validateInviteCode(code);
      if (!validation.valid) {
        return false;
      }

      // Get invite to find waitlist entry
      const invite = await this.waitlistRepository.findInviteByCode(code);
      if (!invite) {
        return false;
      }

      // Mark as used
      await this.waitlistRepository.markInviteUsed(code);

      // Update waitlist status if linked
      if (invite.waitlistId) {
        await this.waitlistRepository.updateStatus(
          invite.waitlistId,
          WaitlistStatus.Registered,
          { registeredAt: new Date() }
        );
      }

      this.logger.info('Invite code used', { code, email: invite.email });

      return true;
    } catch (error) {
      this.logger.error('Failed to use invite code', error as Error, { code });
      throw error;
    }
  }

  /**
   * Get valid invite code for signup
   * Returns the invite if valid, null otherwise
   */
  async getValidInvite(code: string): Promise<InviteCodeRecord | null> {
    return this.waitlistRepository.findValidInviteByCode(code);
  }
}
