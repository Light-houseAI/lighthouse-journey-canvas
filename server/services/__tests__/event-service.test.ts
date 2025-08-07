/**
 * EventService Tests
 * 
 * Comprehensive unit tests for EventService business logic
 * with mocked repository dependencies.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { EventService } from '../event-service';
import type { Event, EventCreateDTO, EventUpdateDTO } from '@shared/schema';
import type { IRepository } from '../../core/interfaces/repository.interface';
import { ValidationError, NotFoundError } from '../base-service';

// Mock repository
const mockRepository: IRepository<Event> = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('EventService', () => {
  let service: EventService;
  const mockProfileId = 1;

  beforeEach(() => {
    service = new EventService(mockRepository);
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all events for a profile', async () => {
      const mockEvents: Event[] = [
        {
          id: 'event-1',
          type: 'event' as const,
          title: 'React Conference 2024',
          eventType: 'conference',
          role: 'speaker',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      (mockRepository.findAll as MockedFunction<any>).mockResolvedValue(mockEvents);

      const result = await service.getAll(mockProfileId);

      expect(result).toEqual(mockEvents);
      expect(mockRepository.findAll).toHaveBeenCalledWith(mockProfileId);
    });

    it('should throw validation error for invalid profile ID', async () => {
      await expect(service.getAll(-1)).rejects.toThrow(ValidationError);
      await expect(service.getAll(0)).rejects.toThrow(ValidationError);
      await expect(service.getAll(1.5)).rejects.toThrow(ValidationError);
    });
  });

  describe('getById', () => {
    it('should return event by ID', async () => {
      const mockEvent: Event = {
        id: 'event-1',
        type: 'event' as const,
        title: 'React Conference 2024',
        eventType: 'conference',
        role: 'speaker',
        topic: 'Advanced React Patterns',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(mockEvent);

      const result = await service.getById(mockProfileId, 'event-1');

      expect(result).toEqual(mockEvent);
      expect(mockRepository.findById).toHaveBeenCalledWith(mockProfileId, 'event-1');
    });

    it('should throw NotFoundError when event does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.getById(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const validCreateData: EventCreateDTO = {
      title: 'React Conference 2024',
      eventType: 'conference',
      description: 'Annual React developers conference',
      startDate: '2024-03-15',
      endDate: '2024-03-17',
      location: 'San Francisco, CA',
      role: 'speaker',
      topic: 'Advanced React Patterns',
    };

    it('should create a new event successfully', async () => {
      const createdEvent: Event = {
        id: 'event-new',
        type: 'event' as const,
        ...validCreateData,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.create as MockedFunction<any>).mockResolvedValue(createdEvent);

      const result = await service.create(mockProfileId, validCreateData);

      expect(result).toEqual(createdEvent);
      expect(mockRepository.create).toHaveBeenCalledWith(
        mockProfileId,
        expect.objectContaining({
          type: 'event' as const,
          title: validCreateData.title,
          eventType: validCreateData.eventType,
        })
      );
    });

    it('should throw validation error for missing required fields', async () => {
      const invalidData = { ...validCreateData, title: '' };
      await expect(service.create(mockProfileId, invalidData)).rejects.toThrow(ValidationError);

      const invalidData2 = { ...validCreateData, eventType: undefined };
      await expect(service.create(mockProfileId, invalidData2 as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    const existingEvent: Event = {
      id: 'event-1',
      type: 'event' as const,
      title: 'React Conference 2024',
      eventType: 'conference',
      role: 'speaker',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const validUpdateData: EventUpdateDTO = {
      title: 'React Conference 2024 - Advanced Track',
      description: 'Updated event details',
      topic: 'State Management with Context API',
    };

    beforeEach(() => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingEvent);
    });

    it('should update event successfully', async () => {
      const updatedEvent = {
        ...existingEvent,
        ...validUpdateData,
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      (mockRepository.update as MockedFunction<any>).mockResolvedValue(updatedEvent);

      const result = await service.update(mockProfileId, 'event-1', validUpdateData);

      expect(result).toEqual(updatedEvent);
      expect(mockRepository.update).toHaveBeenCalledWith(
        mockProfileId,
        'event-1',
        expect.objectContaining({
          ...validUpdateData,
          updatedAt: expect.any(String),
        })
      );
    });

    it('should throw NotFoundError when event does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.update(mockProfileId, 'nonexistent', validUpdateData))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    const existingEvent: Event = {
      id: 'event-1',
      type: 'event' as const,
      title: 'React Conference 2024',
      eventType: 'conference',
      role: 'speaker',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    it('should delete event successfully', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(existingEvent);
      (mockRepository.delete as MockedFunction<any>).mockResolvedValue(true);

      await service.delete(mockProfileId, 'event-1');

      expect(mockRepository.delete).toHaveBeenCalledWith(mockProfileId, 'event-1');
    });

    it('should throw NotFoundError when event does not exist', async () => {
      (mockRepository.findById as MockedFunction<any>).mockResolvedValue(null);

      await expect(service.delete(mockProfileId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});