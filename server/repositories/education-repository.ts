/**
 * Education Repository Implementation
 *
 * Concrete repository for managing education nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { educationCreateSchema, educationSchema, type Education } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Repository for managing education nodes
 *
 * Provides CRUD operations for education data stored in profiles.filteredData.education
 * with domain-specific validation and business rules.
 */
export class EducationRepository extends BaseRepository<Education> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'education', 'education');
  }

  /**
   * Create a new education record with validation
   *
   * @param profileId - The profile ID to create the education for
   * @param data - Education data without ID and timestamps
   * @returns The created education with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof educationSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof educationSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateEducationData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing education record with validation
   *
   * @param profileId - The profile ID that owns the education
   * @param id - The education ID to update
   * @param data - Partial education data to update
   * @returns The updated education or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Education>): Promise<Education | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialEducationData(data);
      return super.update(profileId, id, validatedData);
    }

    return super.update(profileId, id, data);
  }

  public validateEducationData(
    data: z.infer<typeof educationCreateSchema>
  ): Education {
    try {
      const validated = educationCreateSchema.parse(data);

      const education: Education = {
        ...validated,
        type: 'education',
        id: randomUUID(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return education;
    } catch (error) {
      throw new Error(`Invalid education data: ${error}`);
    }
  }

  /**
   * Validate partial education data for updates
   */
  private validatePartialEducationData(data: Partial<z.infer<typeof educationSchema>>): Partial<z.infer<typeof educationSchema>> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = educationSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid education update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for education nodes
   */
  protected isValidNode(node: any): node is Education {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional education specific validation
    return (
      node.institution === undefined ||
      (typeof node.institution === 'string' && node.institution.trim().length > 0)
    );
  }
}

/**
 * Education specific error classes
 */
export class EducationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EducationValidationError';
  }
}

/**
 * Helper functions for education data processing
 */

/**
 * Calculate GPA category based on value
 */
export function getGpaCategory(gpa?: number): string | null {
  if (gpa === undefined || gpa === null) return null;

  if (gpa >= 3.7) return 'Summa Cum Laude';
  if (gpa >= 3.5) return 'Magna Cum Laude';
  if (gpa >= 3.3) return 'Cum Laude';
  if (gpa >= 3.0) return 'Good Standing';
  if (gpa >= 2.0) return 'Satisfactory';

  return 'Below Average';
}

/**
 * Format education duration for display
 */
export function formatEducationDuration(startDate?: string, endDate?: string): string {
  if (!startDate) return 'Duration unknown';

  try {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();

    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Duration unknown';
    }

    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

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
  } catch {
    return 'Duration unknown';
  }
}

/**
 * Check if education is completed (has end date in past)
 */
export function isEducationCompleted(education: Education): boolean {
  if (!education.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(education.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}

/**
 * Get education level rank for sorting (higher number = higher level)
 */
export function getEducationLevelRank(level?: string): number {
  const levelRanks: Record<string, number> = {
    'high-school': 1,
    'certification': 2,
    'bootcamp': 3,
    'associates': 4,
    'bachelors': 5,
    'masters': 6,
    'doctorate': 7,
  };

  return level ? levelRanks[level] || 0 : 0;
}
