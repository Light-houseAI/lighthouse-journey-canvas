/**
 * Job Repository Implementation
 *
 * Concrete repository for managing job nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { jobCreateSchema, jobSchema, type Job } from '@shared/schema';
import { z } from 'zod';
import { nanoid } from 'nanoid';

/**
 * Repository for managing job nodes
 *
 * Provides CRUD operations for job data stored in profiles.filteredData.jobs
 * with domain-specific validation and business rules.
 */
export class JobRepository extends BaseRepository<Job> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'jobs', 'job');
  }

  /**
   * Create a new job record with validation
   *
   * @param profileId - The profile ID to create the job for
   * @param data - Job data without ID and timestamps
   * @returns The created job with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof jobSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof jobSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateJobData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing job record with validation
   *
   * @param profileId - The profile ID that owns the job
   * @param id - The job ID to update
   * @param data - Partial job data to update
   * @returns The updated job or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Job>): Promise<Job | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialJobData(data);
      return super.update(profileId, id, validatedData);
    }

    return super.update(profileId, id, data);
  }

  public validateJobData(
    data: z.infer<typeof jobCreateSchema>
  ): Job {
    try {
      const validated = jobCreateSchema.parse(data);

      const job: Job = {
        ...validated,
        type: 'job',
        id: nanoid(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return job;
    } catch (error) {
      throw new Error(`Invalid job data: ${error}`);
    }
  }

  /**
   * Validate partial job data for updates
   */
  private validatePartialJobData(data: Partial<z.infer<typeof jobSchema>>): Partial<z.infer<typeof jobSchema>> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = jobSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid job update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for job nodes
   */
  protected isValidNode(node: any): node is Job {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional job specific validation
    return (
      node.company === undefined ||
      (typeof node.company === 'string' && node.company.trim().length > 0)
    );
  }
}

/**
 * Job specific error classes
 */
export class JobValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JobValidationError';
  }
}

/**
 * Helper functions for job data processing
 */

/**
 * Calculate duration of job in months
 */
export function calculateJobDurationInMonths(startDate?: string, endDate?: string): number | null {
  if (!startDate) return null;

  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null;
    }

    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  } catch {
    return null;
  }
}

/**
 * Format job duration for display
 */
export function formatJobDuration(startDate?: string, endDate?: string): string {
  const months = calculateJobDurationInMonths(startDate, endDate);
  if (months === null) return 'Duration unknown';

  if (months < 1) return 'Less than 1 month';
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (remainingMonths === 0) {
    return years === 1 ? '1 year' : `${years} years`;
  } else {
    const yearText = years === 1 ? '1 year' : `${years} years`;
    const monthText = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
    return `${yearText} ${monthText}`;
  }
}

/**
 * Check if job is completed (has end date in past)
 */
export function isJobCompleted(job: Job): boolean {
  if (!job.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(job.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}