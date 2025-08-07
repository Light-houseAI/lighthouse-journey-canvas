/**
 * Job Service Implementation
 * 
 * Handles business logic for job nodes including validation,
 * business rules, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, company, position
 * - Handle ongoing jobs (end date = "Present")
 * - Validate date logic and formats
 * - Extract skills from job descriptions
 * - Prevent overlapping jobs (configurable)
 */

import type { Job } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  jobCreateSchema, 
  jobUpdateSchema,
  type JobCreateDTO,
  type JobUpdateDTO 
} from '@shared/schema';
import { z } from 'zod';

/**
 * Job Service
 * 
 * Extends BaseService with job specific business logic and validation.
 * Implements INodeService for date-based operations.
 */
export class JobService 
  extends BaseService<Job, JobCreateDTO, JobUpdateDTO>
  implements INodeService<Job, JobCreateDTO, JobUpdateDTO> {

  constructor(repository: IRepository<Job>) {
    super(repository, 'Job');
  }

  /**
   * Get jobs within a specific date range
   */
  async getByDateRange(profileId: number, startDate: string, endDate: string): Promise<Job[]> {
    this.validateProfileId(profileId);
    
    if (!this.validateDateFormat(startDate) || !this.validateDateFormat(endDate)) {
      throw new ValidationError('Invalid date format');
    }
    
    const allJobs = await this.getAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allJobs.filter(job => {
      try {
        const jobStart = job.startDate ? new Date(job.startDate) : null;
        const jobEnd = job.endDate && job.endDate.toLowerCase() !== 'present' 
          ? new Date(job.endDate) 
          : null;
        
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
   * Get currently active jobs (where endDate is "Present" or null)
   */
  async getActive(profileId: number): Promise<Job[]> {
    this.validateProfileId(profileId);
    
    const allJobs = await this.getAll(profileId);
    return allJobs.filter(job => 
      !job.endDate || job.endDate.toLowerCase() === 'present'
    );
  }

  /**
   * Get completed jobs (where endDate is set and not "Present")
   */
  async getCompleted(profileId: number): Promise<Job[]> {
    this.validateProfileId(profileId);
    
    const allJobs = await this.getAll(profileId);
    return allJobs.filter(job => 
      job.endDate && job.endDate.toLowerCase() !== 'present'
    );
  }

  /**
   * Validate date fields for logical consistency
   */
  async validateDates(startDate?: string, endDate?: string): Promise<{ valid: boolean; error?: string }> {
    if (startDate && !this.validateDateFormat(startDate)) {
      return { valid: false, error: 'Invalid start date format' };
    }
    
    if (endDate && !this.validateDateFormat(endDate)) {
      return { valid: false, error: 'Invalid end date format' };
    }
    
    const dateLogic = this.validateDateLogic(startDate, endDate);
    if (!dateLogic.valid) {
      return { valid: false, error: dateLogic.errors?.[0] || 'Date validation failed' };
    }
    
    return { valid: true };
  }

  /**
   * Find jobs by company name
   */
  async getByCompany(profileId: number, company: string): Promise<Job[]> {
    this.validateProfileId(profileId);
    
    if (!company || company.trim().length === 0) {
      throw new ValidationError('Company name is required');
    }
    
    const allJobs = await this.getAll(profileId);
    return allJobs.filter(job => 
      job.company.toLowerCase().includes(company.toLowerCase().trim())
    );
  }

  /**
   * Find jobs by employment type
   */
  async getByEmploymentType(
    profileId: number, 
    employmentType: Job['employmentType']
  ): Promise<Job[]> {
    this.validateProfileId(profileId);
    
    if (!employmentType) {
      throw new ValidationError('Employment type is required');
    }
    
    const allJobs = await this.getAll(profileId);
    return allJobs.filter(job => job.employmentType === employmentType);
  }

  /**
   * Get jobs sorted by start date (most recent first)
   */
  async getAllSorted(profileId: number): Promise<Job[]> {
    const jobs = await this.getAll(profileId);
    
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
   * Check for overlapping jobs
   */
  async checkForOverlaps(profileId: number, excludeId?: string): Promise<Job[]> {
    const jobs = await this.getAll(profileId);
    const filteredJobs = excludeId 
      ? jobs.filter(job => job.id !== excludeId)
      : jobs;
    
    const overlaps: Job[] = [];
    
    for (let i = 0; i < filteredJobs.length; i++) {
      for (let j = i + 1; j < filteredJobs.length; j++) {
        if (this.hasDateOverlap(filteredJobs[i], filteredJobs[j])) {
          if (!overlaps.includes(filteredJobs[i])) {
            overlaps.push(filteredJobs[i]);
          }
          if (!overlaps.includes(filteredJobs[j])) {
            overlaps.push(filteredJobs[j]);
          }
        }
      }
    }
    
    return overlaps;
  }

  /**
   * Protected methods for schema and transformation
   */

  protected getCreateSchema(): z.ZodSchema<any> {
    return jobCreateSchema;
  }

  protected getUpdateSchema(): z.ZodSchema<any> {
    return jobUpdateSchema;
  }

  protected async transformCreateData(data: JobCreateDTO): Promise<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>> {
    const baseData = await super.transformCreateData(data);
    
    // Extract skills from description and responsibilities
    const extractedSkills = this.extractSkillsFromJobDescription(
      data.description || '',
      data.responsibilities || [],
      data.technologies || []
    );
    
    return {
      ...baseData,
      type: 'job' as const,
      company: data.company,
      position: data.position || data.title,
      location: data.location,
      responsibilities: data.responsibilities,
      achievements: data.achievements,
      technologies: extractedSkills.technologies,
      teamSize: data.teamSize,
      employmentType: data.employmentType,
      salary: data.salary,
      manager: data.manager,
      industry: data.industry,
    };
  }

  protected async transformUpdateData(data: JobUpdateDTO, existing: Job): Promise<Partial<Job>> {
    const baseData = await super.transformUpdateData(data, existing);
    
    // Extract skills if description or responsibilities are being updated
    if (data.description || data.responsibilities) {
      const extractedSkills = this.extractSkillsFromJobDescription(
        data.description || existing.description || '',
        data.responsibilities || existing.responsibilities || [],
        data.technologies || existing.technologies || []
      );
      
      return {
        ...baseData,
        technologies: extractedSkills.technologies,
      };
    }
    
    return baseData;
  }

  protected postProcessEntity(entity: Job): Job {
    // Calculate duration and add as computed field
    const duration = this.calculateDuration(entity.startDate, entity.endDate);
    
    return {
      ...entity,
      // Add computed fields if needed in the future
    };
  }

  /**
   * Business rule validation for create operations
   */
  protected async applyCreateBusinessRules(profileId: number, data: JobCreateDTO): Promise<void> {
    await super.applyCreateBusinessRules(profileId, data);
    
    // Validate required fields
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    
    // TODO: Temporarily commented out to focus on basic functionality
    // if (!data.company?.trim()) {
    //   throw new ValidationError('Company is required');
    // }
    // 
    // if (!data.position?.trim()) {
    //   throw new ValidationError('Position is required');
    // }
    
    // Validate dates
    const dateValidation = await this.validateDates(data.startDate, data.endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
    
    // Check for overlapping jobs (configurable - can be disabled)
    if (data.startDate) {
      const overlaps = await this.checkForOverlaps(profileId);
      const newJob = {
        startDate: data.startDate,
        endDate: data.endDate,
      } as Job;
      
      const hasOverlap = overlaps.some(job => this.hasDateOverlap(job, newJob));
      if (hasOverlap) {
        // This is a warning rather than an error - users might have legitimate overlaps
        console.warn(`Warning: Job may overlap with existing jobs`);
      }
    }
  }

  /**
   * Business rule validation for update operations
   */
  protected async applyUpdateBusinessRules(
    profileId: number, 
    id: string, 
    data: JobUpdateDTO, 
    existing: Job
  ): Promise<void> {
    await super.applyUpdateBusinessRules(profileId, id, data, existing);
    
    // Validate required fields if they're being updated
    if (data.title !== undefined && !data.title?.trim()) {
      throw new ValidationError('Title cannot be empty');
    }
    
    if (data.company !== undefined && !data.company?.trim()) {
      throw new ValidationError('Company cannot be empty');
    }
    
    if (data.position !== undefined && !data.position?.trim()) {
      throw new ValidationError('Position cannot be empty');
    }
    
    // Validate dates if they're being updated
    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    
    const dateValidation = await this.validateDates(startDate, endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
    
    // Check for overlapping jobs if dates are being updated
    if (data.startDate !== undefined || data.endDate !== undefined) {
      const overlaps = await this.checkForOverlaps(profileId, id);
      const updatedJob = {
        ...existing,
        ...data,
      } as Job;
      
      const hasOverlap = overlaps.some(job => this.hasDateOverlap(job, updatedJob));
      if (hasOverlap) {
        console.warn(`Warning: Updated job may overlap with existing jobs`);
      }
    }
  }

  /**
   * Utility methods
   */

  /**
   * Extract skills from job description and responsibilities
   */
  private extractSkillsFromJobDescription(
    description: string, 
    responsibilities: string[], 
    existingTechnologies: string[]
  ): { technologies: string[] } {
    const allText = [description, ...responsibilities].join(' ');
    const extractedSkills = this.extractSkillsFromText(allText, existingTechnologies);
    
    return {
      technologies: extractedSkills,
    };
  }

  /**
   * Check if two jobs have overlapping dates
   */
  private hasDateOverlap(job1: Job, job2: Job): boolean {
    if (!job1.startDate || !job2.startDate) return false;
    
    try {
      const start1 = new Date(job1.startDate);
      const end1 = job1.endDate && job1.endDate.toLowerCase() !== 'present' 
        ? new Date(job1.endDate) 
        : new Date();
      const start2 = new Date(job2.startDate);
      const end2 = job2.endDate && job2.endDate.toLowerCase() !== 'present' 
        ? new Date(job2.endDate) 
        : new Date();
      
      return start1 <= end2 && start2 <= end1;
    } catch {
      return false;
    }
  }
}