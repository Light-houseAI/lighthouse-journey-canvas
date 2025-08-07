/**
 * Project Service Implementation
 * 
 * Handles business logic for project nodes including validation,
 * project lifecycle management, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, status
 * - Handle project status transitions and validation
 * - Validate date logic and URL formats
 * - Manage technology stacks and project types
 * - Calculate project metrics and outcomes
 */

import type { Project } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  projectCreateSchema, 
  projectNodeUpdateSchema,
  type ProjectCreateDTO,
  type ProjectUpdateDTO 
} from '@shared/schema';
import { z } from 'zod';

/**
 * Project Service
 * 
 * Extends BaseService with project-specific business logic and validation.
 * Implements INodeService for date-based operations.
 */
export class ProjectService 
  extends BaseService<Project, ProjectCreateDTO, ProjectUpdateDTO>
  implements INodeService<Project, ProjectCreateDTO, ProjectUpdateDTO> {

  constructor(repository: IRepository<Project>) {
    super(repository, 'Project');
  }

  /**
   * Get projects within a specific date range
   */
  async getByDateRange(profileId: number, startDate: string, endDate: string): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    if (!this.validateDateFormat(startDate) || !this.validateDateFormat(endDate)) {
      throw new ValidationError('Invalid date format');
    }
    
    const allProjects = await this.getAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allProjects.filter(project => {
      try {
        const projectStart = project.startDate ? new Date(project.startDate) : null;
        const projectEnd = project.endDate && project.endDate.toLowerCase() !== 'present' 
          ? new Date(project.endDate) 
          : null;
        
        // Check if project overlaps with the range
        if (projectStart && projectStart > rangeEnd) return false; // Started after range
        if (projectEnd && projectEnd < rangeStart) return false; // Ended before range
        
        return true; // Overlaps with range
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get currently active projects (in-progress or planning status)
   */
  async getActive(profileId: number): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => 
      project.status === 'in-progress' || project.status === 'planning'
    );
  }

  /**
   * Get completed projects
   */
  async getCompleted(profileId: number): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => project.status === 'completed');
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
   * Find projects by status
   */
  async getByStatus(profileId: number, status: Project['status']): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    if (!status) {
      throw new ValidationError('Project status is required');
    }
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => project.status === status);
  }

  /**
   * Find projects by project type
   */
  async getByProjectType(
    profileId: number, 
    projectType: Project['projectType']
  ): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    if (!projectType) {
      throw new ValidationError('Project type is required');
    }
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => project.projectType === projectType);
  }

  /**
   * Find projects by technology
   */
  async getByTechnology(profileId: number, technology: string): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    if (!technology || technology.trim().length === 0) {
      throw new ValidationError('Technology name is required');
    }
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => 
      project.technologies?.some(tech => 
        tech.toLowerCase().includes(technology.toLowerCase().trim())
      )
    );
  }

  /**
   * Find projects by client organization
   */
  async getByClient(profileId: number, client: string): Promise<Project[]> {
    this.validateProfileId(profileId);
    
    if (!client || client.trim().length === 0) {
      throw new ValidationError('Client organization is required');
    }
    
    const allProjects = await this.getAll(profileId);
    return allProjects.filter(project => 
      project.clientOrganization?.toLowerCase().includes(client.toLowerCase().trim())
    );
  }

  /**
   * Get projects sorted by start date (most recent first)
   */
  async getAllSorted(profileId: number): Promise<Project[]> {
    const projects = await this.getAll(profileId);
    
    return projects.sort((a, b) => {
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
   * Update project status with validation
   */
  async updateStatus(profileId: number, id: string, newStatus: Project['status']): Promise<Project> {
    this.validateProfileId(profileId);
    this.validateId(id);
    
    const project = await this.getById(profileId, id);
    
    // Validate status transition
    this.validateStatusTransition(project.status, newStatus);
    
    // Apply status change business rules
    const updateData: Partial<Project> = { status: newStatus };
    
    // Set end date when completing a project
    if (newStatus === 'completed' && !project.endDate) {
      updateData.endDate = new Date().toISOString();
    }
    
    // Clear end date when reactivating a project
    if ((newStatus === 'in-progress' || newStatus === 'planning') && 
        project.status === 'completed') {
      updateData.endDate = undefined;
    }
    
    return this.update(profileId, id, updateData as ProjectUpdateDTO);
  }

  /**
   * Get project statistics
   */
  async getProjectStats(profileId: number): Promise<{
    totalProjects: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    topTechnologies: Array<{ name: string; count: number }>;
    averageTeamSize: number | null;
    activeProjects: number;
    completedProjects: number;
  }> {
    const allProjects = await this.getAll(profileId);
    const active = await this.getActive(profileId);
    const completed = await this.getCompleted(profileId);
    
    // Count by status
    const byStatus: Record<string, number> = {};
    allProjects.forEach(project => {
      byStatus[project.status] = (byStatus[project.status] || 0) + 1;
    });
    
    // Count by type
    const byType: Record<string, number> = {};
    allProjects.forEach(project => {
      if (project.projectType) {
        byType[project.projectType] = (byType[project.projectType] || 0) + 1;
      }
    });
    
    // Count technologies
    const technologyCount: Record<string, number> = {};
    allProjects.forEach(project => {
      project.technologies?.forEach(tech => {
        technologyCount[tech] = (technologyCount[tech] || 0) + 1;
      });
    });
    
    const topTechnologies = Object.entries(technologyCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    // Calculate average team size
    const teamSizeEntries = allProjects.filter(project => project.teamSize && project.teamSize > 0);
    const averageTeamSize = teamSizeEntries.length > 0 
      ? teamSizeEntries.reduce((sum, project) => sum + (project.teamSize || 0), 0) / teamSizeEntries.length
      : null;
    
    return {
      totalProjects: allProjects.length,
      byStatus,
      byType,
      topTechnologies,
      averageTeamSize,
      activeProjects: active.length,
      completedProjects: completed.length,
    };
  }

  /**
   * Protected methods for schema and transformation
   */

  protected getCreateSchema(): z.ZodSchema<any> {
    return projectCreateSchema;
  }

  protected getUpdateSchema(): z.ZodSchema<any> {
    return projectNodeUpdateSchema;
  }

  protected async transformCreateData(data: ProjectCreateDTO): Promise<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> {
    const baseData = await super.transformCreateData(data);
    
    // Extract additional technologies from description and key features
    const extractedTechnologies = this.extractTechnologiesFromProjectContent(
      data.description || '',
      data.keyFeatures || [],
      data.technologies || []
    );
    
    return {
      ...baseData,
      type: 'project' as const,
      status: data.status,
      technologies: extractedTechnologies,
      repositoryUrl: data.repositoryUrl,
      liveUrl: data.liveUrl,
      role: data.role,
      teamSize: data.teamSize,
      keyFeatures: data.keyFeatures,
      challenges: data.challenges,
      outcomes: data.outcomes,
      clientOrganization: data.clientOrganization,
      budget: data.budget,
      projectType: data.projectType,
    };
  }

  protected async transformUpdateData(data: ProjectUpdateDTO, existing: Project): Promise<Partial<Project>> {
    const baseData = await super.transformUpdateData(data, existing);
    
    // Extract additional technologies if project content is being updated
    if (data.description || data.keyFeatures || data.technologies) {
      const extractedTechnologies = this.extractTechnologiesFromProjectContent(
        data.description || existing.description || '',
        data.keyFeatures || existing.keyFeatures || [],
        data.technologies || existing.technologies || []
      );
      
      return {
        ...baseData,
        technologies: extractedTechnologies,
      };
    }
    
    return baseData;
  }

  protected postProcessEntity(entity: Project): Project {
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
  protected async applyCreateBusinessRules(profileId: number, data: ProjectCreateDTO): Promise<void> {
    await super.applyCreateBusinessRules(profileId, data);
    
    // Validate required fields
    if (!data.title?.trim()) {
      throw new ValidationError('Title is required');
    }
    
    // TODO: Temporarily commented out to focus on basic functionality
    // if (!data.status) {
    //   throw new ValidationError('Project status is required');
    // }
    
    // Validate URLs if provided
    if (data.repositoryUrl) {
      this.validateURL(data.repositoryUrl, 'Repository URL');
    }
    
    if (data.liveUrl) {
      this.validateURL(data.liveUrl, 'Live URL');
    }
    
    // Validate dates
    const dateValidation = await this.validateDates(data.startDate, data.endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
    
    // Validate status-date consistency
    this.validateStatusDateConsistency(data.status, data.startDate, data.endDate);
    
    // Validate team size
    if (data.teamSize !== undefined && data.teamSize < 1) {
      throw new ValidationError('Team size must be at least 1');
    }
    
    // Validate budget
    if (data.budget !== undefined && data.budget < 0) {
      throw new ValidationError('Budget cannot be negative');
    }
  }

  /**
   * Business rule validation for update operations
   */
  protected async applyUpdateBusinessRules(
    profileId: number, 
    id: string, 
    data: ProjectUpdateDTO, 
    existing: Project
  ): Promise<void> {
    await super.applyUpdateBusinessRules(profileId, id, data, existing);
    
    // Validate required fields if they're being updated
    if (data.title !== undefined && !data.title?.trim()) {
      throw new ValidationError('Title cannot be empty');
    }
    
    // Validate URLs if being updated
    if (data.repositoryUrl !== undefined && data.repositoryUrl) {
      this.validateURL(data.repositoryUrl, 'Repository URL');
    }
    
    if (data.liveUrl !== undefined && data.liveUrl) {
      this.validateURL(data.liveUrl, 'Live URL');
    }
    
    // Validate dates if they're being updated
    const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
    const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
    
    const dateValidation = await this.validateDates(startDate, endDate);
    if (!dateValidation.valid) {
      throw new ValidationError(dateValidation.error || 'Invalid date logic');
    }
    
    // Validate status transition if status is being updated
    if (data.status !== undefined && data.status !== existing.status) {
      this.validateStatusTransition(existing.status, data.status);
    }
    
    // Validate status-date consistency
    const status = data.status !== undefined ? data.status : existing.status;
    this.validateStatusDateConsistency(status, startDate, endDate);
    
    // Validate team size
    if (data.teamSize !== undefined && data.teamSize < 1) {
      throw new ValidationError('Team size must be at least 1');
    }
    
    // Validate budget
    if (data.budget !== undefined && data.budget < 0) {
      throw new ValidationError('Budget cannot be negative');
    }
  }

  /**
   * Utility methods
   */

  /**
   * Extract technologies from project content
   */
  private extractTechnologiesFromProjectContent(
    description: string,
    keyFeatures: string[],
    existingTechnologies: string[]
  ): string[] {
    const allText = [description, ...keyFeatures].join(' ');
    const extractedSkills = this.extractSkillsFromText(allText, existingTechnologies);
    
    return extractedSkills;
  }

  /**
   * Validate URL format
   */
  private validateURL(url: string, fieldName: string): void {
    if (url.trim() === '') return; // Allow empty strings
    
    try {
      new URL(url);
    } catch {
      throw new ValidationError(`${fieldName} must be a valid URL`);
    }
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: Project['status'], newStatus: Project['status']): void {
    // Define allowed transitions
    const allowedTransitions: Record<Project['status'], Project['status'][]> = {
      'planning': ['in-progress', 'on-hold', 'cancelled'],
      'in-progress': ['completed', 'on-hold', 'cancelled'],
      'completed': ['in-progress'], // Can reopen completed projects
      'on-hold': ['in-progress', 'cancelled'],
      'cancelled': ['planning'], // Can restart cancelled projects
    };
    
    const allowed = allowedTransitions[currentStatus] || [];
    
    if (!allowed.includes(newStatus)) {
      throw new BusinessRuleError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'`
      );
    }
  }

  /**
   * Validate status and date consistency
   */
  private validateStatusDateConsistency(
    status: Project['status'], 
    startDate?: string, 
    endDate?: string
  ): void {
    // Completed projects should have an end date
    if (status === 'completed' && !endDate) {
      // This is a warning rather than an error - we'll set it automatically
      console.warn('Completed project should have an end date');
    }
    
    // In-progress projects shouldn't have an end date (unless it's "Present")
    if (status === 'in-progress' && endDate && endDate.toLowerCase() !== 'present') {
      throw new ValidationError('In-progress projects should not have a past end date');
    }
    
    // Planning projects typically shouldn't have started yet
    if (status === 'planning' && startDate) {
      const start = new Date(startDate);
      const now = new Date();
      
      if (start < now) {
        console.warn('Planning project has a start date in the past');
      }
    }
  }
}