/**
 * Career Transition Repository Implementation
 *
 * Concrete repository for managing career transition nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { careerTransitionCreateSchema, careerTransitionSchema, type CareerTransition } from '@shared/schema';
import { z } from 'zod';
import { nanoid } from 'nanoid';

/**
 * Repository for managing career transition nodes
 *
 * Provides CRUD operations for career transition data stored in profiles.filteredData.careerTransitions
 * with domain-specific validation and business rules.
 */
export class CareerTransitionRepository extends BaseRepository<CareerTransition> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'careerTransitions', 'careerTransition');
  }

  /**
   * Create a new career transition record with validation
   *
   * @param profileId - The profile ID to create the career transition for
   * @param data - Career transition data without ID and timestamps
   * @returns The created career transition with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof careerTransitionSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof careerTransitionSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateCareerTransitionData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing career transition record with validation
   *
   * @param profileId - The profile ID that owns the career transition
   * @param id - The career transition ID to update
   * @param data - Partial career transition data to update
   * @returns The updated career transition or null if not found
   */
  async update(profileId: number, id: string, data: Partial<CareerTransition>): Promise<CareerTransition | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialCareerTransitionData(data);
      return super.update(profileId, id, validatedData);
    }

    return super.update(profileId, id, data);
  }

  public validateCareerTransitionData(
    data: z.infer<typeof careerTransitionCreateSchema>
  ): CareerTransition {
    try {
      const validated = careerTransitionCreateSchema.parse(data);

      const careerTransition: CareerTransition = {
        ...validated,
        type: 'careerTransition',
        id: nanoid(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return careerTransition;
    } catch (error) {
      throw new Error(`Invalid career transition data: ${error}`);
    }
  }

  /**
   * Validate partial career transition data for updates
   */
  private validatePartialCareerTransitionData(data: Partial<z.infer<typeof careerTransitionSchema>>): Partial<z.infer<typeof careerTransitionSchema>> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = careerTransitionSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid career transition update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for career transition nodes
   */
  protected isValidNode(node: any): node is CareerTransition {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional career transition specific validation
    return true; // Basic validation is sufficient for now
  }
}

/**
 * Career transition specific error classes
 */
export class CareerTransitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CareerTransitionValidationError';
  }
}

/**
 * Helper functions for career transition data processing
 */

/**
 * Calculate career transition duration in months
 */
export function calculateCareerTransitionDurationInMonths(startDate?: string, endDate?: string): number | null {
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
 * Format career transition duration for display
 */
export function formatCareerTransitionDuration(startDate?: string, endDate?: string): string {
  const months = calculateCareerTransitionDurationInMonths(startDate, endDate);
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
 * Check if career transition is completed (has end date in past)
 */
export function isCareerTransitionCompleted(careerTransition: CareerTransition): boolean {
  if (!careerTransition.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(careerTransition.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}