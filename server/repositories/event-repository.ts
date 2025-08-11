/**
 * Event Repository Implementation
 *
 * Concrete repository for managing event nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import { eventCreateSchema, eventSchema, type Event } from '@shared/schema';
import { z } from 'zod';
import { randomUUID } from 'crypto';

/**
 * Repository for managing event nodes
 *
 * Provides CRUD operations for event data stored in profiles.filteredData.events
 * with domain-specific validation and business rules.
 */
export class EventRepository extends BaseRepository<Event> {

  constructor(db: NodePgDatabase<any>) {
    super(db, 'events', 'event');
  }

  /**
   * Create a new event record with validation
   *
   * @param profileId - The profile ID to create the event for
   * @param data - Event data without ID and timestamps
   * @returns The created event with generated ID and timestamps
   */
  async create(
    profileId: number,
    data: Omit<z.infer<typeof eventSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<z.infer<typeof eventSchema>> {
    // Validate the data using Zod schema
    const validatedData = this.validateEventData(data);

    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing event record with validation
   *
   * @param profileId - The profile ID that owns the event
   * @param id - The event ID to update
   * @param data - Partial event data to update
   * @returns The updated event or null if not found
   */
  async update(profileId: number, id: string, data: Partial<Event>): Promise<Event | null> {
    // Validate partial data if provided
    if (Object.keys(data).length > 0) {
      const validatedData = this.validatePartialEventData(data);
      return super.update(profileId, id, validatedData);
    }

    return super.update(profileId, id, data);
  }

  public validateEventData(
    data: z.infer<typeof eventCreateSchema>
  ): Event {
    try {
      const validated = eventCreateSchema.parse(data);

      const event: Event = {
        ...validated,
        type: 'event',
        id: randomUUID(), // Generate unique ID
        createdAt: new Date().toISOString(), // Set creation timestamp
        updatedAt: new Date().toISOString() // Set update timestamp
      };

      return event;
    } catch (error) {
      throw new Error(`Invalid event data: ${error}`);
    }
  }

  /**
   * Validate partial event data for updates
   */
  private validatePartialEventData(data: Partial<z.infer<typeof eventSchema>>): Partial<z.infer<typeof eventSchema>> {
    try {
      // For partial updates, we only validate the provided fields
      const partialSchema = eventSchema.partial();
      return partialSchema.parse(data);
    } catch (error) {
      throw new Error(`Invalid event update data: ${error}`);
    }
  }

  /**
   * Enhanced validation for event nodes
   */
  protected isValidNode(node: any): node is Event {
    if (!super.isValidNode(node)) {
      return false;
    }

    // Additional event specific validation
    return (
      node.location === undefined ||
      (typeof node.location === 'string' && node.location.trim().length > 0)
    );
  }
}

/**
 * Event specific error classes
 */
export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

/**
 * Helper functions for event data processing
 */

/**
 * Calculate event duration in days
 */
export function calculateEventDurationInDays(startDate?: string, endDate?: string): number | null {
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
 * Format event duration for display
 */
export function formatEventDuration(startDate?: string, endDate?: string): string {
  const days = calculateEventDurationInDays(startDate, endDate);
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
 * Check if event is completed (has end date in past)
 */
export function isEventCompleted(event: Event): boolean {
  if (!event.endDate) return false; // No end date means ongoing

  try {
    const endDate = new Date(event.endDate);
    return endDate <= new Date(); // End date in past means completed
  } catch {
    return false; // Invalid date format
  }
}