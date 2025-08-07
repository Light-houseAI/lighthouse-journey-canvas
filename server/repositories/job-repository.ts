/**
 * Job Repository Implementation
 * 
 * Concrete repository for managing job nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import type { Job } from '../types/node-types';
import { NodeType } from '../core/interfaces/base-node.interface';
import { jobSchema } from '@shared/schema';

/**
 * Repository for managing job nodes
 * 
 * Provides CRUD operations for job data stored in profiles.filteredData.jobs
 * with domain-specific validation and business rules.
 */
export class JobRepository extends BaseRepository<Job> {
  
  constructor(db: NodePgDatabase<any>) {
    super(db, 'jobs', NodeType.Job);
  }

  /**
   * Create a new job with validation
   * 
   * @param profileId - The profile ID to create the job for
   * @param data - Job data without ID and timestamps
   * @returns The created job with generated ID and timestamps
   */
  async create(profileId: number, data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    // Validate the data using Zod schema (excluding runtime fields)
    const validatedData = this.validateJobData(data);
    
    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing job with validation
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

  /**
   * Find jobs by company name
   * 
   * @param profileId - The profile ID to search within
   * @param company - Company name to search for
   * @returns Jobs matching the company name
   */
  async findByCompany(profileId: number, company: string): Promise<Job[]> {
    const allJobs = await this.findAll(profileId);
    return allJobs.filter(job => 
      job.company.toLowerCase().includes(company.toLowerCase())
    );
  }

  /**
   * Find jobs by employment type
   * 
   * @param profileId - The profile ID to search within
   * @param employmentType - Employment type to filter by
   * @returns Jobs of the specified employment type
   */
  async findByEmploymentType(
    profileId: number, 
    employmentType: 'full-time' | 'part-time' | 'contract' | 'internship' | 'freelance'
  ): Promise<Job[]> {
    const allJobs = await this.findAll(profileId);
    return allJobs.filter(job => job.employmentType === employmentType);
  }

  /**
   * Find current jobs (no end date or end date in future)
   * 
   * @param profileId - The profile ID to search within
   * @returns Currently active jobs
   */
  async findCurrent(profileId: number): Promise<Job[]> {
    const allJobs = await this.findAll(profileId);
    const now = new Date();
    
    return allJobs.filter(job => {
      if (!job.endDate) return true; // No end date means current
      
      try {
        const endDate = new Date(job.endDate);
        return endDate > now; // End date in future means still current
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Find jobs within a date range
   * 
   * @param profileId - The profile ID to search within
   * @param startDate - Start of date range (ISO string)
   * @param endDate - End of date range (ISO string)
   * @returns Jobs that overlap with the date range
   */
  async findByDateRange(profileId: number, startDate: string, endDate: string): Promise<Job[]> {
    const allJobs = await this.findAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allJobs.filter(job => {
      try {
        const jobStart = job.startDate ? new Date(job.startDate) : null;
        const jobEnd = job.endDate ? new Date(job.endDate) : null;
        
        // Check if job overlaps with the range
        if (jobStart && jobStart > rangeEnd) return false; // Started after range
        if (jobEnd && jobEnd < rangeStart) return false; // Ended before range
        
        return true; // Overlaps with range
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get jobs sorted by start date (most recent first)
   * 
   * @param profileId - The profile ID to retrieve jobs for
   * @returns Jobs sorted by start date descending
   */
  async findAllSorted(profileId: number): Promise<Job[]> {
    const jobs = await this.findAll(profileId);
    
    return jobs.sort((a, b) => {
      // Handle cases where startDate might be missing
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1; // a goes to end
      if (!b.startDate) return -1; // b goes to end
      
      try {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateB.getTime() - dateA.getTime(); // Descending order (most recent first)
      } catch {
        return 0; // Invalid dates, keep original order
      }
    });
  }

  /**
   * Validate job data using Zod schema
   */
  private validateJobData(data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Omit<Job, 'id' | 'createdAt' | 'updatedAt'> {
    try {
      // Create a partial schema without the fields we don't have yet
      const createData = {
        ...data,
        id: 'temp-id', // Temporary ID for validation
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const validated = jobSchema.parse(createData);
      
      // Return data without the temporary fields
      const { id, createdAt, updatedAt, ...result } = validated;
      return result;
    } catch (error) {
      throw new Error(`Invalid job data: ${error}`);
    }
  }

  /**
   * Validate partial job data for updates
   */
  private validatePartialJobData(data: Partial<Job>): Partial<Job> {
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
      typeof node.company === 'string' &&
      typeof node.position === 'string' &&
      node.company.trim().length > 0 &&
      node.position.trim().length > 0
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

export class DuplicateJobError extends Error {
  constructor(company: string, position: string) {
    super(`Job already exists: ${position} at ${company}`);
    this.name = 'DuplicateJobError';
  }
}

/**
 * Helper functions for job data processing
 */

/**
 * Calculate duration of job in months
 */
export function calculateDurationInMonths(startDate?: string, endDate?: string): number | null {
  if (!startDate) return null;
  
  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(); // Use current date if no end date
    
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
 * Format work experience duration for display
 */
export function formatDuration(startDate?: string, endDate?: string): string {
  const months = calculateDurationInMonths(startDate, endDate);
  if (months === null) return 'Duration unknown';
  
  if (months === 0) return 'Less than 1 month';
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
 * Check if work experience dates overlap
 */
export function hasDateOverlap(exp1: WorkExperience, exp2: WorkExperience): boolean {
  if (!exp1.startDate || !exp2.startDate) return false;
  
  try {
    const start1 = new Date(exp1.startDate);
    const end1 = exp1.endDate ? new Date(exp1.endDate) : new Date();
    const start2 = new Date(exp2.startDate);
    const end2 = exp2.endDate ? new Date(exp2.endDate) : new Date();
    
    return start1 <= end2 && start2 <= end1;
  } catch {
    return false;
  }
}