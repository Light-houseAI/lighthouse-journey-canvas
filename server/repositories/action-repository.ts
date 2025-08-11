/**
 * Action Repository Implementation
 *
 * Concrete repository for managing action nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { actionCreateSchema, actionSchema, type Action } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Repository for managing action nodes
 *
 * Provides CRUD operations for action data stored in profiles.filteredData.actions
 * with domain-specific validation and business rules.
 */
export class ActionRepository extends BaseRepository<Action> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'actions', 'action');
  }

  /**
   * Create a new action record with validation
   *
   * @param profileId - The profile ID to create the action for
   * @param data - Action data without ID and timestamps
   * @returns The created action with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof actionSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof actionSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateActionData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing action record with validation
   *
   * @param profileId - The profile ID that owns the action
   * @param id - The action ID to update
   * @param data - Partial action data to update
   * @returns The updated action or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Action>): Promise<Action | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialActionData(data);
      return super.update(profileId, id, validatedData);
    }

    return super.update(profileId, id, data);
  }

  public validateActionData(
    data: z.infer<typeof actionCreateSchema>
  ): Action {
    try {
      const validated = actionCreateSchema.parse(data);

      const action: Action = {
        ...validated,
        type: 'action',
        id: randomUUID(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return action;
    } catch (error) {
      throw new Error(`Invalid action data: ${error}`);
    }
  }

  /**
   * Validate partial action data for updates
   */
  private validatePartialActionData(data: Partial<z.infer<typeof actionSchema>>): Partial<z.infer<typeof actionSchema>> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = actionSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid action update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for action nodes
   */
  protected isValidNode(node: any): node is Action {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional action specific validation
    return (
      node.category === undefined ||
      (typeof node.category === 'string' && node.category.trim().length > 0)
    );
  }
}

/**
 * Action specific error classes
 */
export class ActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionValidationError';
  }
}

/**
 * Helper functions for action data processing
 */

/**
 * Calculate action duration in days
 */
export function calculateActionDurationInDays(startDate?: string, endDate?: string): number | null {
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
 * Format action duration for display
 */
export function formatActionDuration(startDate?: string, endDate?: string): string {
  const days = calculateActionDurationInDays(startDate, endDate);
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
 * Check if action is completed (has end date in past)
 */
export function isActionCompleted(action: Action): boolean {
  if (!action.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(action.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}