/**
 * Event Service Implementation
 * 
 * Handles business logic for event nodes including validation,
 * business rules, and data transformation.
 * 
 * Key business rules:
 * - Required fields: title, eventType
 * - Validate event dates and durations
 * - Role-specific validation
 * - Event URL validation for virtual events
 */

import type { Event } from '../types/node-types';
import type { IRepository } from '../core/interfaces/repository.interface';
import type { INodeService } from '../core/interfaces/service.interface';
import { BaseService, ValidationError, BusinessRuleError } from './base-service';
import { 
  eventCreateSchema, 
  eventUpdateSchema,
  type EventCreateDTO,
  type EventUpdateDTO 
} from '@shared/schema';

/**
 * Event Service
 * 
 * Extends BaseService with event specific business logic and validation.
 * Implements INodeService for date-based operations and event management.
 */
export class EventService 
  extends BaseService<Event, EventCreateDTO, EventUpdateDTO>
  implements INodeService<Event, EventCreateDTO, EventUpdateDTO> {

  constructor(repository: IRepository<Event>) {
    super(repository, 'Event');
  }

  /**
   * Protected methods for schema and transformation
   */
  protected getCreateSchema() {
    return eventCreateSchema;
  }

  protected getUpdateSchema() {
    return eventUpdateSchema;
  }

  protected async transformCreateData(data: EventCreateDTO): Promise<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>> {
    const baseData = await super.transformCreateData(data);
    
    return {
      ...baseData,
      type: 'event' as const,
      eventType: data.eventType || 'conference', // Default event type
      organizer: data.organizer,
      location: data.location,
      attendees: data.attendees,
      role: data.role || 'attendee', // Default role
      eventUrl: data.eventUrl,
      topic: data.topic,
      outcomes: data.outcomes,
    };
  }

  /**
   * Get events by type
   */
  async getByType(
    profileId: number, 
    eventType: 'conference' | 'meetup' | 'workshop' | 'webinar' | 'presentation' | 'networking' | 'competition'
  ): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    const allEvents = await this.getAll(profileId);
    return allEvents.filter(event => event.eventType === eventType);
  }

  /**
   * Get events by role
   */
  async getByRole(
    profileId: number, 
    role: 'attendee' | 'speaker' | 'organizer' | 'sponsor' | 'volunteer'
  ): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    const allEvents = await this.getAll(profileId);
    return allEvents.filter(event => event.role === role);
  }

  /**
   * Get events by organizer
   */
  async getByOrganizer(profileId: number, organizer: string): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    const allEvents = await this.getAll(profileId);
    return allEvents.filter(event => 
      event.organizer && event.organizer.toLowerCase().includes(organizer.toLowerCase())
    );
  }

  /**
   * Get events within a specific date range
   */
  async getByDateRange(profileId: number, startDate: string, endDate: string): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    if (!this.validateDateFormat(startDate) || !this.validateDateFormat(endDate)) {
      throw new ValidationError('Invalid date format');
    }
    
    const allEvents = await this.getAll(profileId);
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    
    return allEvents.filter(event => {
      try {
        const eventStart = event.startDate ? new Date(event.startDate) : null;
        const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
        
        // Check if event overlaps with the range
        if (eventStart && eventStart > rangeEnd) return false; // Started after range
        if (eventEnd && eventEnd < rangeStart) return false; // Ended before range
        
        return true; // Overlaps with range
      } catch {
        return false; // Invalid date format
      }
    });
  }

  /**
   * Get upcoming events
   */
  async getUpcoming(profileId: number): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    const allEvents = await this.getAll(profileId);
    const now = new Date();
    
    return allEvents.filter(event => {
      if (!event.startDate) return false;
      
      try {
        const eventDate = new Date(event.startDate);
        return eventDate > now;
      } catch {
        return false; // Invalid date format
      }
    }).sort((a, b) => {
      const aDate = new Date(a.startDate!);
      const bDate = new Date(b.startDate!);
      return aDate.getTime() - bDate.getTime();
    });
  }

  /**
   * Get events sorted by date (most recent first)
   */
  async getAllSorted(profileId: number): Promise<Event[]> {
    this.validateProfileId(profileId);
    
    const allEvents = await this.getAll(profileId);
    return allEvents.sort((a, b) => {
      const aDate = a.startDate || a.createdAt;
      const bDate = b.startDate || b.createdAt;
      
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  /**
   * Create event with business rule validation
   */
  async create(profileId: number, data: EventCreateDTO): Promise<Event> {
    this.validateCreateData(data);
    
    // Validate business rules
    await this.validateBusinessRules(data);
    
    return super.create(profileId, data);
  }

  /**
   * Update event with validation
   */
  async update(profileId: number, id: string, data: EventUpdateDTO): Promise<Event> {
    this.validateUpdateData(data);
    
    // Get current event for business rule validation
    const currentEvent = await this.getById(profileId, id);
    if (!currentEvent) {
      throw new ValidationError('Event not found');
    }
    
    // Validate business rules for update
    const updatedData = { ...currentEvent, ...data };
    await this.validateBusinessRules(updatedData);
    
    return super.update(profileId, id, data);
  }

  /**
   * Validate event creation data
   */
  protected validateCreateData(data: EventCreateDTO): void {
    try {
      eventCreateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid event data', error.errors);
    }
  }

  /**
   * Validate event update data
   */
  protected validateUpdateData(data: EventUpdateDTO): void {
    try {
      eventUpdateSchema.parse(data);
    } catch (error: any) {
      throw new ValidationError('Invalid event update data', error.errors);
    }
  }

  /**
   * Validate business rules for events
   */
  private async validateBusinessRules(data: EventCreateDTO | (Event & EventUpdateDTO)): Promise<void> {
    // Validate date consistency
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      if (start >= end) {
        throw new BusinessRuleError('Start date must be before end date');
      }
    }
    
    // Validate virtual event requirements
    if (data.eventType === 'webinar' && !data.eventUrl) {
      throw new BusinessRuleError('Webinars must have an event URL');
    }
    
    // Validate role-specific requirements
    if (data.role === 'speaker' && !data.topic) {
      throw new BusinessRuleError('Speaker events should include a topic');
    }
    
    if (data.role === 'organizer' && !data.attendees && data.eventType !== 'webinar') {
      throw new BusinessRuleError('Organized events should include attendee count');
    }
    
    // Validate attendee count for large events
    if (data.attendees && data.attendees > 10000 && data.eventType === 'meetup') {
      throw new BusinessRuleError('Meetups typically have fewer than 10,000 attendees');
    }
  }
}