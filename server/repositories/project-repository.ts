/**
 * Project Repository Implementation
 *
 * Concrete repository for managing project nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { projectCreateSchema, projectSchema, type Project } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Repository for managing project nodes
 *
 * Provides CRUD operations for project data stored in profiles.filteredData.projects
 * with domain-specific validation and business rules.
 */
export class ProjectRepository extends BaseRepository<Project> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'projects', 'project');
  }

  /**
   * Create a new project record with validation
   *
   * @param profileId - The profile ID to create the project for
   * @param data - Project data without ID and timestamps
   * @returns The created project with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof projectSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof projectSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateProjectData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing project record with validation
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

  public validateProjectData(
    data: z.infer<typeof projectCreateSchema>
  ): Project {
    try {
      const validated = projectCreateSchema.parse(data);

      const project: Project = {
        ...validated,
        type: 'project',
        id: randomUUID(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return project;
    } catch (error) {
      throw new Error(`Invalid project data: ${error}`);
    }
  }

  /**
   * Validate partial project data for updates
   */
  private validatePartialProjectData(data: Partial<z.infer<typeof projectSchema>>): Partial<z.infer<typeof projectSchema>> {
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
      node.technologies === undefined ||
      (Array.isArray(node.technologies) && node.technologies.every((tech: any) => typeof tech === 'string'))
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

  if (days < 1) return 'Less than 1 day';
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
 * Check if project is completed (has end date in past)
 */
export function isProjectCompleted(project: Project): boolean {
  if (!project.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(project.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}