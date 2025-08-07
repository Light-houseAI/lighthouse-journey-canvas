/**
 * Project Repository Implementation
 * 
 * Concrete repository for managing project nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import type { Project } from '../types/node-types';
import { NodeType } from '../core/interfaces/base-node.interface';
import { projectSchema } from '@shared/schema';

/**
 * Repository for managing project nodes
 * 
 * Provides CRUD operations for project data stored in profiles.filteredData.projects
 * with domain-specific validation and business rules.
 */
export class ProjectRepository extends BaseRepository<Project> {
  
  constructor(db: NodePgDatabase<any>) {
    super(db, 'projects', NodeType.Project);
  }

  /**
   * Create a new project with validation
   * 
   * @param profileId - The profile ID to create the project for
   * @param data - Project data without ID and timestamps
   * @returns The created project with generated ID and timestamps
   */
  async create(profileId: number, data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    // Validate the data using Zod schema
    const validatedData = this.validateProjectData(data);
    
    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing project with validation
   * 
   * @param profileId - The profile ID that owns the project
   * @param id - The project ID to update
   * @param data - Partial project data to update
   * @returns The updated project or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Project>): Promise<Project | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialProjectData(data);
      return super.update(profileId, id, validatedData);
    }
    
    return super.update(profileId, id, data);
  }

  /**
   * Find projects by status
   * 
   * @param profileId - The profile ID to search within
   * @param status - Project status to filter by
   * @returns Projects with the specified status
   */
  async findByStatus(
    profileId: number, 
    status: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  ): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => project.status === status);
  }

  /**
   * Find projects by technology
   * 
   * @param profileId - The profile ID to search within
   * @param technology - Technology to search for
   * @returns Projects that use the specified technology
   */
  async findByTechnology(profileId: number, technology: string): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => 
      project.technologies?.some(tech => 
        tech.toLowerCase().includes(technology.toLowerCase())
      )
    );
  }

  /**
   * Find projects by type
   * 
   * @param profileId - The profile ID to search within
   * @param projectType - Project type to filter by
   * @returns Projects of the specified type
   */
  async findByType(
    profileId: number, 
    projectType: 'personal' | 'professional' | 'academic' | 'freelance' | 'open-source'
  ): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => project.projectType === projectType);
  }

  /**
   * Find active projects (planning or in-progress status)
   * 
   * @param profileId - The profile ID to search within
   * @returns Currently active projects
   */
  async findActive(profileId: number): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => 
      project.status === 'planning' || project.status === 'in-progress'
    );
  }

  /**
   * Find completed projects
   * 
   * @param profileId - The profile ID to search within
   * @returns Completed projects
   */
  async findCompleted(profileId: number): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => project.status === 'completed');
  }

  /**
   * Find projects with repository URL
   * 
   * @param profileId - The profile ID to search within
   * @returns Projects that have a repository URL
   */
  async findWithRepository(profileId: number): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => 
      project.repositoryUrl && project.repositoryUrl.trim().length > 0
    );
  }

  /**
   * Find projects with live URL
   * 
   * @param profileId - The profile ID to search within
   * @returns Projects that have a live URL
   */
  async findWithLiveUrl(profileId: number): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => 
      project.liveUrl && project.liveUrl.trim().length > 0
    );
  }

  /**
   * Find projects within a date range
   * 
   * @param profileId - The profile ID to search within
   * @param startDate - Start of date range (ISO string)
   * @param endDate - End of date range (ISO string)
   * @returns Projects that overlap with the date range
   */
  async findByDateRange(profileId: number, startDate: string, endDate: string): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allProjects.filter(project => {
      try {
        const projectStart = project.startDate ? new Date(project.startDate) : null;
        const projectEnd = project.endDate ? new Date(project.endDate) : null;
        
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
   * Get projects sorted by start date (most recent first)
   * 
   * @param profileId - The profile ID to retrieve projects for
   * @returns Projects sorted by start date descending
   */
  async findAllSorted(profileId: number): Promise<Project[]> {
    const projects = await this.findAll(profileId);
    
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
   * Find projects by client or organization
   * 
   * @param profileId - The profile ID to search within
   * @param organization - Organization name to search for
   * @returns Projects for the specified organization
   */
  async findByOrganization(profileId: number, organization: string): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => 
      project.clientOrganization?.toLowerCase().includes(organization.toLowerCase())
    );
  }

  /**
   * Get projects by team size range
   * 
   * @param profileId - The profile ID to search within
   * @param minSize - Minimum team size
   * @param maxSize - Maximum team size
   * @returns Projects within the team size range
   */
  async findByTeamSizeRange(profileId: number, minSize?: number, maxSize?: number): Promise<Project[]> {
    const allProjects = await this.findAll(profileId);
    return allProjects.filter(project => {
      if (!project.teamSize) return false;
      if (minSize !== undefined && project.teamSize < minSize) return false;
      if (maxSize !== undefined && project.teamSize > maxSize) return false;
      return true;
    });
  }

  /**
   * Get technology usage statistics
   * 
   * @param profileId - The profile ID to analyze
   * @returns Object mapping technologies to usage count
   */
  async getTechnologyStats(profileId: number): Promise<Record<string, number>> {
    const allProjects = await this.findAll(profileId);
    const techStats: Record<string, number> = {};
    
    allProjects.forEach(project => {
      if (project.technologies) {
        project.technologies.forEach(tech => {
          const normalizedTech = tech.toLowerCase();
          techStats[normalizedTech] = (techStats[normalizedTech] || 0) + 1;
        });
      }
    });
    
    return techStats;
  }

  /**
   * Validate project data using Zod schema
   */
  private validateProjectData(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Omit<Project, 'id' | 'createdAt' | 'updatedAt'> {
    try {
      // Create a complete object for validation
      const createData = {
        ...data,
        id: 'temp-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const validated = projectSchema.parse(createData);
      
      // Return data without the temporary fields
      const { id, createdAt, updatedAt, ...result } = validated;
      return result;
    } catch (error) {
      throw new Error(`Invalid project data: ${error}`);
    }
  }

  /**
   * Validate partial project data for updates
   */
  private validatePartialProjectData(data: Partial<Project>): Partial<Project> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = projectSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid project update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for project nodes
   */
  protected isValidNode(node: any): node is Project {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional project specific validation
    return (
      typeof node.status === 'string' &&
      ['planning', 'in-progress', 'completed', 'on-hold', 'cancelled'].includes(node.status)
    );
  }
}

/**
 * Project specific error classes
 */
export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

/**
 * Helper functions for project data processing
 */

/**
 * Calculate project duration in days
 */
export function calculateProjectDurationInDays(startDate?: string, endDate?: string): number | null {
  if (!startDate) return null;
  
  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return null;
    }
    
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return null;
  }
}

/**
 * Format project duration for display
 */
export function formatProjectDuration(startDate?: string, endDate?: string): string {
  const days = calculateProjectDurationInDays(startDate, endDate);
  if (days === null) return 'Duration unknown';
  
  if (days === 0) return 'Less than 1 day';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) return `${Math.floor(days / 7)} weeks`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  if (remainingDays === 0) {
    return years === 1 ? '1 year' : `${years} years`;
  } else {
    const yearText = years === 1 ? '1 year' : `${years} years`;
    return `${yearText} ${Math.floor(remainingDays / 30)} months`;
  }
}

/**
 * Get project status color for UI
 */
export function getProjectStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'planning': '#FFA500',    // Orange
    'in-progress': '#4169E1', // Royal Blue
    'completed': '#32CD32',   // Lime Green
    'on-hold': '#FFD700',     // Gold
    'cancelled': '#DC143C',   // Crimson
  };
  
  return statusColors[status] || '#808080'; // Default gray
}

/**
 * Check if project is currently active
 */
export function isProjectActive(project: Project): boolean {
  return project.status === 'planning' || project.status === 'in-progress';
}

/**
 * Get project complexity score based on various factors
 */
export function calculateProjectComplexity(project: Project): number {
  let complexity = 0;
  
  // Base complexity
  complexity += 1;
  
  // Team size factor
  if (project.teamSize) {
    if (project.teamSize > 10) complexity += 3;
    else if (project.teamSize > 5) complexity += 2;
    else if (project.teamSize > 1) complexity += 1;
  }
  
  // Technology count factor
  if (project.technologies) {
    complexity += Math.min(project.technologies.length * 0.5, 3);
  }
  
  // Features factor
  if (project.keyFeatures) {
    complexity += Math.min(project.keyFeatures.length * 0.3, 2);
  }
  
  // Challenges factor
  if (project.challenges) {
    complexity += Math.min(project.challenges.length * 0.4, 2);
  }
  
  // Budget factor (higher budget usually means more complex)
  if (project.budget && project.budget > 100000) {
    complexity += 2;
  } else if (project.budget && project.budget > 50000) {
    complexity += 1;
  }
  
  return Math.min(complexity, 10); // Cap at 10
}