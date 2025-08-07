/**
 * Base Service Implementation
 * 
 * Abstract implementation of IService<T> providing core business logic patterns
 * and common functionality for all service implementations.
 * 
 * This class handles validation, error transformation, and provides utility methods
 * for concrete services to extend with domain-specific behavior.
 */

import type { IService } from '../core/interfaces/service.interface';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { CreateDTO, UpdateDTO } from '../core/interfaces/dto.interface';
import type { BaseNode } from '../core/interfaces/base-node.interface';
import { z } from 'zod';

/**
 * Service validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Service error types for better error handling
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, public readonly validationErrors?: string[]) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class BusinessRuleError extends ServiceError {
  constructor(message: string) {
    super(message, 'BUSINESS_RULE_ERROR', 422);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Abstract base service implementing core business logic patterns
 * 
 * Provides standardized CRUD operations with validation, error handling,
 * and business rule enforcement. Concrete services extend this class
 * to add domain-specific functionality.
 * 
 * @template T - The entity type that extends BaseNode
 * @template TCreateDTO - The DTO type for create operations
 * @template TUpdateDTO - The DTO type for update operations
 */
export abstract class BaseService<
  T extends BaseNode,
  TCreateDTO extends CreateDTO = CreateDTO,
  TUpdateDTO extends UpdateDTO = UpdateDTO
> implements IService<T, TCreateDTO, TUpdateDTO> {

  constructor(
    protected readonly repository: IRepository<T>,
    protected readonly entityName: string
  ) {}

  /**
   * Retrieve all entities for a specific profile
   */
  async getAll(profileId: number): Promise<T[]> {
    this.validateProfileId(profileId);
    
    try {
      const entities = await this.repository.findAll(profileId);
      return this.postProcessEntities(entities);
    } catch (error) {
      throw this.handleRepositoryError(error, 'retrieve all');
    }
  }

  /**
   * Retrieve a specific entity by ID for a profile
   */
  async getById(profileId: number, id: string): Promise<T> {
    this.validateProfileId(profileId);
    this.validateId(id);
    
    try {
      const entity = await this.repository.findById(profileId, id);
      if (!entity) {
        throw new NotFoundError(this.entityName, id);
      }
      
      return this.postProcessEntity(entity);
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw this.handleRepositoryError(error, 'retrieve');
    }
  }

  /**
   * Create a new entity for a profile
   */
  async create(profileId: number, data: TCreateDTO): Promise<T> {
    this.validateProfileId(profileId);
    
    // Validate input data
    await this.validateCreateData(data);
    
    // Apply business rules for creation
    await this.applyCreateBusinessRules(profileId, data);
    
    try {
      // Transform DTO to entity data
      const entityData = await this.transformCreateData(data);
      
      // Create entity
      const entity = await this.repository.create(profileId, entityData);
      
      // Post-process the created entity
      return this.postProcessEntity(entity);
    } catch (error) {
      throw this.handleRepositoryError(error, 'create');
    }
  }

  /**
   * Update an existing entity for a profile
   */
  async update(profileId: number, id: string, data: TUpdateDTO): Promise<T> {
    this.validateProfileId(profileId);
    this.validateId(id);
    
    // Check if entity exists
    const existingEntity = await this.repository.findById(profileId, id);
    if (!existingEntity) {
      throw new NotFoundError(this.entityName, id);
    }
    
    // Validate update data
    await this.validateUpdateData(data, existingEntity);
    
    // Apply business rules for updates
    await this.applyUpdateBusinessRules(profileId, id, data, existingEntity);
    
    try {
      // Transform DTO to entity data
      const entityUpdates = await this.transformUpdateData(data, existingEntity);
      
      // Add updated timestamp
      const updatesWithTimestamp = {
        ...entityUpdates,
        updatedAt: new Date().toISOString(),
      };
      
      // Update entity
      const updatedEntity = await this.repository.update(profileId, id, updatesWithTimestamp);
      
      if (!updatedEntity) {
        throw new NotFoundError(this.entityName, id);
      }
      
      // Post-process the updated entity
      return this.postProcessEntity(updatedEntity);
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw this.handleRepositoryError(error, 'update');
    }
  }

  /**
   * Delete an entity for a profile
   */
  async delete(profileId: number, id: string): Promise<void> {
    this.validateProfileId(profileId);
    this.validateId(id);
    
    // Check if entity exists and apply delete business rules
    const existingEntity = await this.repository.findById(profileId, id);
    if (!existingEntity) {
      throw new NotFoundError(this.entityName, id);
    }
    
    // Apply business rules for deletion
    await this.applyDeleteBusinessRules(profileId, id, existingEntity);
    
    try {
      const success = await this.repository.delete(profileId, id);
      if (!success) {
        throw new NotFoundError(this.entityName, id);
      }
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      throw this.handleRepositoryError(error, 'delete');
    }
  }

  /**
   * Abstract methods for concrete services to implement
   */

  /**
   * Get the Zod schema for create data validation
   */
  protected abstract getCreateSchema(): z.ZodSchema<any>;

  /**
   * Get the Zod schema for update data validation
   */
  protected abstract getUpdateSchema(): z.ZodSchema<any>;

  /**
   * Transform create DTO to entity data
   */
  protected async transformCreateData(data: TCreateDTO): Promise<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> {
    // Default implementation - concrete services can override
    const now = new Date().toISOString();
    return {
      ...data,
      createdAt: now,
      updatedAt: now,
    } as any;
  }

  /**
   * Transform update DTO to entity data
   */
  protected async transformUpdateData(data: TUpdateDTO, existing: T): Promise<Partial<T>> {
    // Default implementation - concrete services can override
    return data as any;
  }

  /**
   * Post-process entity after retrieval (e.g., calculate derived fields)
   */
  protected postProcessEntity(entity: T): T {
    // Default implementation - concrete services can override
    return entity;
  }

  /**
   * Post-process array of entities after retrieval
   */
  protected postProcessEntities(entities: T[]): T[] {
    return entities.map(entity => this.postProcessEntity(entity));
  }

  /**
   * Apply business rules for create operations
   */
  protected async applyCreateBusinessRules(profileId: number, data: TCreateDTO): Promise<void> {
    // Default implementation - concrete services can override
  }

  /**
   * Apply business rules for update operations
   */
  protected async applyUpdateBusinessRules(
    profileId: number, 
    id: string, 
    data: TUpdateDTO, 
    existing: T
  ): Promise<void> {
    // Default implementation - concrete services can override
  }

  /**
   * Apply business rules for delete operations
   */
  protected async applyDeleteBusinessRules(profileId: number, id: string, existing: T): Promise<void> {
    // Default implementation - concrete services can override
  }

  /**
   * Validation and utility methods
   */

  /**
   * Validate create data using Zod schema
   */
  protected async validateCreateData(data: TCreateDTO): Promise<void> {
    try {
      const schema = this.getCreateSchema();
      schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new ValidationError('Invalid create data', errors);
      }
      throw new ValidationError('Invalid create data');
    }
  }

  /**
   * Validate update data using Zod schema
   */
  protected async validateUpdateData(data: TUpdateDTO, existing: T): Promise<void> {
    try {
      const schema = this.getUpdateSchema();
      schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        throw new ValidationError('Invalid update data', errors);
      }
      throw new ValidationError('Invalid update data');
    }
  }

  /**
   * Validate profile ID
   */
  protected validateProfileId(profileId: number): void {
    if (!Number.isInteger(profileId) || profileId <= 0) {
      throw new ValidationError('Invalid profile ID');
    }
  }

  /**
   * Validate entity ID
   */
  protected validateId(id: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('Invalid entity ID');
    }
  }

  /**
   * Handle repository errors and transform to service errors
   */
  protected handleRepositoryError(error: any, operation: string): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }
    
    // Log the original error for debugging
    console.error(`Repository error during ${operation}:`, error);
    
    return new ServiceError(
      `Failed to ${operation} ${this.entityName.toLowerCase()}`,
      'REPOSITORY_ERROR'
    );
  }

  /**
   * Validate date format (supports YYYY-MM and ISO 8601)
   */
  protected validateDateFormat(date: string): boolean {
    if (!date) return true; // Allow empty dates
    
    // Accept "Present" as a special value for ongoing items
    if (date.toLowerCase() === 'present') return true;
    
    // Support YYYY-MM format (our frontend standard)
    const yearMonthRegex = /^\d{4}-\d{2}$/;
    if (yearMonthRegex.test(date)) return true;
    
    // Also support full ISO 8601 date format for backward compatibility
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
    return isoDateRegex.test(date);
  }

  /**
   * Validate date logic (start date before end date)
   */
  protected validateDateLogic(startDate?: string, endDate?: string): ValidationResult {
    if (!startDate || !endDate) {
      return { valid: true };
    }
    
    // Skip validation if end date is "Present"
    if (endDate.toLowerCase() === 'present') {
      return { valid: true };
    }
    
    try {
      // Handle YYYY-MM format by adding day (use first day of month for comparison)
      const normalizeDate = (dateStr: string) => {
        if (/^\d{4}-\d{2}$/.test(dateStr)) {
          return dateStr + '-01'; // Add first day of month
        }
        return dateStr;
      };
      
      const start = new Date(normalizeDate(startDate));
      const end = new Date(normalizeDate(endDate));
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, errors: ['Invalid date format'] };
      }
      
      if (start > end) {
        return { valid: false, errors: ['Start date must be before end date'] };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, errors: ['Invalid date format'] };
    }
  }

  /**
   * Generate a unique ID for entities
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Extract skills from text using simple keyword extraction
   */
  protected extractSkillsFromText(text: string, existingSkills: string[] = []): string[] {
    if (!text) return existingSkills;
    
    // Simple skill extraction - can be enhanced with NLP
    const skillKeywords = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'python', 'java',
      'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'git', 'sql', 'mongodb',
      'leadership', 'management', 'communication', 'teamwork', 'problem-solving'
    ];
    
    const extractedSkills = skillKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Combine with existing skills and remove duplicates
    return [...new Set([...existingSkills, ...extractedSkills])];
  }

  /**
   * Calculate duration between two dates
   */
  protected calculateDuration(startDate?: string, endDate?: string): string | null {
    if (!startDate) return null;
    
    try {
      // Handle YYYY-MM format by adding day (use first day of month)
      const normalizeDate = (dateStr: string) => {
        if (/^\d{4}-\d{2}$/.test(dateStr)) {
          return dateStr + '-01'; // Add first day of month
        }
        return dateStr;
      };
      
      const start = new Date(normalizeDate(startDate));
      const end = endDate && endDate.toLowerCase() !== 'present' 
        ? new Date(normalizeDate(endDate)) 
        : new Date();
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
      }
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average month
      
      if (diffMonths < 1) return 'Less than 1 month';
      if (diffMonths === 1) return '1 month';
      if (diffMonths < 12) return `${diffMonths} months`;
      
      const years = Math.floor(diffMonths / 12);
      const remainingMonths = diffMonths % 12;
      
      if (remainingMonths === 0) {
        return years === 1 ? '1 year' : `${years} years`;
      } else {
        const yearText = years === 1 ? '1 year' : `${years} years`;
        const monthText = remainingMonths === 1 ? '1 month' : `${remainingMonths} months`;
        return `${yearText} ${monthText}`;
      }
    } catch (error) {
      return null;
    }
  }
}