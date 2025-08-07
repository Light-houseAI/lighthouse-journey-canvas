/**
 * Event Repository Implementation
 * 
 * Concrete repository for managing event nodes in the profiles.filteredData field.
 * Extends BaseRepository to provide domain-specific validation and business logic.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseRepository } from './base-repository';
import type { Event } from '../types/node-types';
import { NodeType } from '../core/interfaces/base-node.interface';
import { eventSchema } from '@shared/schema';

/**
 * Repository for managing event nodes
 * 
 * Provides CRUD operations for event data stored in profiles.filteredData.events
 * with domain-specific validation and business rules.
 */
export class EventRepository extends BaseRepository<Event> {
  
  constructor(db: NodePgDatabase<any>) {
    super(db, 'events', NodeType.Event);
  }

  /**
   * Create a new event with validation
   * 
   * @param profileId - The profile ID to create the event for
   * @param data - Event data without ID and timestamps
   * @returns The created event with generated ID and timestamps
   */
  async create(profileId: number, data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    // Validate the data using Zod schema (excluding runtime fields)
    const validatedData = this.validateEventData(data);
    
    // Call parent create method with validated data
    return super.create(profileId, validatedData);
  }

  /**
   * Update an existing event with validation
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

  /**
   * Find events by type
   * 
   * @param profileId - The profile ID to search within
   * @param eventType - Event type to filter by
   * @returns Events of the specified type
   */
  async findByType(
    profileId: number, 
    eventType: 'conference' | 'meetup' | 'workshop' | 'webinar' | 'presentation' | 'networking' | 'competition'
  ): Promise<Event[]> {
    const allEvents = await this.findAll(profileId);
    return allEvents.filter(event => event.eventType === eventType);
  }

  /**
   * Find events by role
   * 
   * @param profileId - The profile ID to search within
   * @param role - Role to filter by
   * @returns Events where user had the specified role
   */
  async findByRole(
    profileId: number, 
    role: 'attendee' | 'speaker' | 'organizer' | 'sponsor' | 'volunteer'
  ): Promise<Event[]> {
    const allEvents = await this.findAll(profileId);
    return allEvents.filter(event => event.role === role);
  }

  /**
   * Find events by organizer
   * 
   * @param profileId - The profile ID to search within
   * @param organizer - Organizer name to search for
   * @returns Events organized by the specified organizer
   */
  async findByOrganizer(profileId: number, organizer: string): Promise<Event[]> {
    const allEvents = await this.findAll(profileId);
    return allEvents.filter(event => 
      event.organizer && event.organizer.toLowerCase().includes(organizer.toLowerCase())
    );
  }

  /**
   * Find events by location
   * 
   * @param profileId - The profile ID to search within
   * @param location - Location to search for
   * @returns Events at the specified location
   */
  async findByLocation(profileId: number, location: string): Promise<Event[]> {
    const allEvents = await this.findAll(profileId);
    return allEvents.filter(event => 
      event.location && event.location.toLowerCase().includes(location.toLowerCase())
    );
  }

  /**
   * Validate event data using Zod schema
   * 
   * @param data - Event data to validate
   * @returns Validated event data
   * @throws ValidationError if data is invalid
   */
  private validateEventData(data: any): Omit<Event, 'id' | 'createdAt' | 'updatedAt'> {
    try {
      // Use the event schema but exclude runtime fields
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = eventSchema.shape;
      const validationSchema = eventSchema.omit({ id: true, createdAt: true, updatedAt: true });
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Event validation failed: ${error.message}`);
    }
  }

  /**
   * Validate partial event data for updates
   * 
   * @param data - Partial event data to validate
   * @returns Validated partial event data
   * @throws ValidationError if data is invalid
   */
  private validatePartialEventData(data: Partial<Event>): Partial<Event> {
    try {
      // For partial updates, make all fields optional
      const { id, createdAt, updatedAt, ...schemaWithoutRuntime } = eventSchema.shape;
      const validationSchema = eventSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial();
      
      return validationSchema.parse(data);
    } catch (error: any) {
      throw new Error(`Event validation failed: ${error.message}`);
    }
  }
}