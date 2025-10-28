/**
 * Storage Quota Service
 *
 * Manages user storage quotas for file uploads:
 * - Quota retrieval and auto-creation
 * - Quota checking before uploads
 * - Atomic usage updates
 */

import type { StorageQuotaRepository } from '../repositories/storage-quota.repository';

export interface QuotaInfo {
  bytesUsed: number;
  quotaBytes: number;
  bytesAvailable: number;
  percentUsed: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  bytesNeeded?: number;
  bytesAvailable?: number;
}

export class StorageQuotaService {
  private readonly storageQuotaRepository: StorageQuotaRepository;

  constructor({
    storageQuotaRepository,
  }: {
    storageQuotaRepository: StorageQuotaRepository;
  }) {
    this.storageQuotaRepository = storageQuotaRepository;
  }

  /**
   * Get quota information for user
   * Auto-creates quota record if it doesn't exist
   */
  async getQuota(userId: number): Promise<QuotaInfo> {
    const quota = await this.storageQuotaRepository.getOrCreate(userId);

    const bytesAvailable = Math.max(0, quota.quotaBytes - quota.bytesUsed);
    const percentUsed =
      quota.quotaBytes > 0
        ? Math.round((quota.bytesUsed / quota.quotaBytes) * 100 * 100) / 100
        : 0;

    return {
      bytesUsed: quota.bytesUsed,
      quotaBytes: quota.quotaBytes,
      bytesAvailable,
      percentUsed,
    };
  }

  /**
   * Check if user has sufficient quota for file upload
   */
  async checkQuota(
    userId: number,
    fileSize: number
  ): Promise<QuotaCheckResult> {
    const quota = await this.getQuota(userId);

    if (fileSize > quota.bytesAvailable) {
      return {
        allowed: false,
        reason: 'Insufficient storage quota',
        bytesNeeded: fileSize,
        bytesAvailable: quota.bytesAvailable,
      };
    }

    return { allowed: true };
  }

  /**
   * Update storage usage atomically
   * @param userId - User ID
   * @param bytesChange - Bytes to add (positive) or remove (negative)
   */
  async updateUsage(userId: number, bytesChange: number): Promise<QuotaInfo> {
    const quota = await this.storageQuotaRepository.updateUsage(
      userId,
      bytesChange
    );

    const bytesAvailable = Math.max(0, quota.quotaBytes - quota.bytesUsed);
    const percentUsed =
      quota.quotaBytes > 0
        ? Math.round((quota.bytesUsed / quota.quotaBytes) * 100 * 100) / 100
        : 0;

    return {
      bytesUsed: quota.bytesUsed,
      quotaBytes: quota.quotaBytes,
      bytesAvailable,
      percentUsed,
    };
  }
}
