/**
 * Education Service Implementation
 * 
 * Handles business logic for education nodes including validation,
 * academic business rules, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, institution
 * - Handle ongoing education (end date = "Present")
 * - Validate date logic and formats
 * - Extract skills from academic projects and coursework
 * - Validate GPA ranges and academic levels
 */

import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  educationCreateSchema, 
  educationUpdateSchema,
  type Education,
  type EducationCreateDTO,
  type EducationUpdateDTO 
} from '@shared/schema';
import { z } from 'zod';

/**
 * Education Service
 * 
 * Extends BaseService with education-specific business logic and validation.
 * Implements INodeService for date-based operations.
 */
export class EducationService 
  extends BaseService<Education, EducationCreateDTO, EducationUpdateDTO>
  implements INodeService<Education, EducationCreateDTO, EducationUpdateDTO> {

  constructor(repository: IRepository<Education>) {
    super(repository, 'Education');
  }

  /**
   * Get education entries within a specific date range
   */
  async getByDateRange(profileId: number, startDate: string, endDate: string): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    if (!this.validateDateFormat(startDate) || !this.validateDateFormat(endDate)) {
      throw new ValidationError('Invalid date format');
    }
    
    const allEducation = await this.getAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allEducation.filter(edu => {
      try {
        const eduStart = edu.startDate ? new Date(edu.startDate) : null;
        const eduEnd = edu.endDate && edu.endDate.toLowerCase() !== 'present' 
          ? new Date(edu.endDate) 
          : null;
        
        // Check if education overlaps with the range
        if (eduStart && eduStart > rangeEnd) return false; // Started after range
        if (eduEnd && eduEnd < rangeStart) return false; // Ended before range
        
        return true; // Overlaps with range
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get currently active education (where endDate is "Present" or null)
   */
  async getActive(profileId: number): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    const allEducation = await this.getAll(profileId);
    return allEducation.filter(edu => 
      !edu.endDate || edu.endDate.toLowerCase() === 'present'
    );
  }

  /**
   * Get completed education (where endDate is set and not "Present")
   */
  async getCompleted(profileId: number): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    const allEducation = await this.getAll(profileId);
    return allEducation.filter(edu => 
      edu.endDate && edu.endDate.toLowerCase() !== 'present'
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
   * Find education by institution name
   */
  async getByInstitution(profileId: number, institution: string): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    if (!institution || institution.trim().length === 0) {
      throw new ValidationError('Institution name is required');
    }
    
    const allEducation = await this.getAll(profileId);
    return allEducation.filter(edu => 
      edu.institution.toLowerCase().includes(institution.toLowerCase().trim())
    );
  }

  /**
   * Find education by education level (deprecated - level field not available in current schema)
   */
  async getByLevel(
    profileId: number, 
    level: string
  ): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    // Note: level field is not available in the current Education schema
    // This method returns empty array for backward compatibility
    console.warn('getByLevel is deprecated: level field not available in Education schema');
    return [];
  }

  /**
   * Find education by degree type
   */
  async getByDegree(profileId: number, degree: string): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    if (!degree || degree.trim().length === 0) {
      throw new ValidationError('Degree is required');
    }
    
    const allEducation = await this.getAll(profileId);
    return allEducation.filter(edu => 
      edu.degree?.toLowerCase().includes(degree.toLowerCase().trim())
    );
  }

  /**
   * Find education by field of study
   */
  async getByField(profileId: number, field: string): Promise<Education[]> {
    this.validateProfileId(profileId);
    
    if (!field || field.trim().length === 0) {
      throw new ValidationError('Field of study is required');
    }
    
    const allEducation = await this.getAll(profileId);
    return allEducation.filter(edu => 
      edu.field?.toLowerCase().includes(field.toLowerCase().trim())
    );
  }

  /**
   * Get education entries sorted by start date (most recent first)
   */
  async getAllSorted(profileId: number): Promise<Education[]> {
    const education = await this.getAll(profileId);
    
    return education.sort((a, b) => {
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
   * Get education statistics
   */
  async getEducationStats(profileId: number): Promise<{
    totalEducation: number;
    byInstitution: Record<string, number>;
    byDegree: Record<string, number>;
    activeEducation: number;
    completedEducation: number;
  }> {
    const allEducation = await this.getAll(profileId);
    const active = await this.getActive(profileId);
    const completed = await this.getCompleted(profileId);
    
    // Count by institution
    const byInstitution: Record<string, number> = {};
    allEducation.forEach(edu => {
      if (edu.institution) {
        byInstitution[edu.institution] = (byInstitution[edu.institution] || 0) + 1;
      }
    });
    
    // Count by degree
    const byDegree: Record<string, number> = {};
    allEducation.forEach(edu => {
      if (edu.degree) {
        byDegree[edu.degree] = (byDegree[edu.degree] || 0) + 1;
      }
    });
    
    return {
      totalEducation: allEducation.length,
      byInstitution,
      byDegree,
      activeEducation: active.length,
      completedEducation: completed.length,
    };
  }

  /**
   * Protected methods for schema and transformation
   */

  protected getCreateSchema(): z.ZodSchema<any> {
    return educationCreateSchema;
  }

  protected getUpdateSchema(): z.ZodSchema<any> {
    return educationUpdateSchema;
  }

  protected async transformCreateData(data: EducationCreateDTO): Promise<Omit<Education, 'id' | 'createdAt' | 'updatedAt'>> {
    const baseData = await super.transformCreateData(data);
    
    return {
      ...baseData,
      type: 'education' as const,
      // Note: Only fields available in the new Education schema
      institution: undefined, // Will be extracted from title if needed
      degree: undefined,
      field: undefined, 
      location: undefined,
      projects: [],
      events: [],
      actions: [],
    };
  }

  protected async transformUpdateData(data: EducationUpdateDTO, existing: Education): Promise<Partial<Education>> {
    const baseData = await super.transformUpdateData(data, existing);
    
    // Note: Current Education schema is simplified
    // Skills extraction could be added in future enhancement
    
    return baseData;
  }

  protected postProcessEntity(entity: Education): Education {
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
  protected async applyCreateBusinessRules(profileId: number, data: EducationCreateDTO): Promise<void> {
    await super.applyCreateBusinessRules(profileId, data);
    
    // Validate required fields
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    
    // Validate dates
    const dateValidation = await this.validateDates(data.startDate, data.endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
  }

  /**
   * Business rule validation for update operations
   */
  protected async applyUpdateBusinessRules(
    profileId: number, 
    id: string, 
    data: EducationUpdateDTO, 
    existing: Education
  ): Promise<void> {
    await super.applyUpdateBusinessRules(profileId, id, data, existing);
    
    // Validate required fields if they're being updated
    if (data.title !== undefined && !data.title?.trim()) {
      throw new ValidationError('Title cannot be empty');
    }
    
    // Validate dates if they're being updated
    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    
    const dateValidation = await this.validateDates(startDate, endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
  }

  /**
   * Utility methods
   */

  /**
   * Note: Advanced academic content processing methods have been simplified
   * as the current Education schema focuses on basic fields only.
   * Skills extraction and academic-specific validation can be added
   * in future enhancements when the schema is expanded.
   */

  /**
   * Helper methods for managing nested child arrays
   */

  /**
   * Add a project to an education's projects array
   */
  async addProject(profileId: number, educationId: string, projectData: any): Promise<Education> {
    this.validateProfileId(profileId);
    this.validateId(educationId);

    const education = await this.getById(profileId, educationId);
    const newProject = {
      id: `project-${Date.now()}`,
      type: 'project' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...projectData
    };

    const updatedProjects = [...(education.projects || []), newProject];
    return this.update(profileId, educationId, { projects: updatedProjects } as EducationUpdateDTO);
  }

  /**
   * Add an event to an education's events array
   */
  async addEvent(profileId: number, educationId: string, eventData: any): Promise<Education> {
    this.validateProfileId(profileId);
    this.validateId(educationId);

    const education = await this.getById(profileId, educationId);
    const newEvent = {
      id: `event-${Date.now()}`,
      type: 'event' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...eventData
    };

    const updatedEvents = [...(education.events || []), newEvent];
    return this.update(profileId, educationId, { events: updatedEvents } as EducationUpdateDTO);
  }

  /**
   * Add an action to an education's actions array
   */
  async addAction(profileId: number, educationId: string, actionData: any): Promise<Education> {
    this.validateProfileId(profileId);
    this.validateId(educationId);

    const education = await this.getById(profileId, educationId);
    const newAction = {
      id: `action-${Date.now()}`,
      type: 'action' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...actionData
    };

    const updatedActions = [...(education.actions || []), newAction];
    return this.update(profileId, educationId, { actions: updatedActions } as EducationUpdateDTO);
  }

  /**
   * Get all projects for an education
   */
  async getProjects(profileId: number, educationId: string): Promise<any[]> {
    const education = await this.getById(profileId, educationId);
    return education.projects || [];
  }

  /**
   * Get all events for an education
   */
  async getEvents(profileId: number, educationId: string): Promise<any[]> {
    const education = await this.getById(profileId, educationId);
    return education.events || [];
  }

  /**
   * Get all actions for an education
   */
  async getActions(profileId: number, educationId: string): Promise<any[]> {
    const education = await this.getById(profileId, educationId);
    return education.actions || [];
  }
}