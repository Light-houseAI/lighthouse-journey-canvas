/**
 * EventRepository Unit Tests
 * 
 * Comprehensive tests for EventRepository class covering:
 * - CRUD operations for event nodes
 * - Event-specific queries (conferences, meetups, presentations)
 * - Date-based filtering and validation
 * - Event type categorization
 * - Location and organizer filtering
 * - Attendance and participation tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { EventRepository, calculateEventDuration, formatEventType, isUpcomingEvent } from '../event-repository';
import type { Event } from '../../types/node-types';
import { NodeType } from '../../core/interfaces/base-node.interface';

// Mock database setup
function createMockDatabase() {
  let queryResult: any[] = [];

  const mockQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    then: (resolve: any) => resolve(queryResult),
  };

  const mockDb = {
    select: vi.fn(() => mockQuery),
    update: vi.fn(() => mockQuery),
    __setQueryResult: (result: any[]) => {
      queryResult = result;
    },
    __setUpdateResult: (result: any[]) => {
      mockQuery.returning.mockResolvedValue(result);
    },
  } as any;

  return mockDb;
}

describe('EventRepository', () => {
  let mockDb: any;
  let repository: EventRepository;

  const sampleEvents: Event[] = [
    {
      id: 'event-1',
      type: NodeType.Event,
      title: 'React Conference 2024',
      description: 'Annual React developers conference with latest updates and best practices',
      startDate: '2024-03-15',
      endDate: '2024-03-17',
      location: 'San Francisco, CA',
      venue: 'Moscone Center',
      organizer: 'React Team',
      eventType: 'conference',
      attendanceType: 'in-person',
      role: 'speaker',
      topics: ['React 18', 'Server Components', 'Performance Optimization'],
      skills: ['React', 'JavaScript', 'Public Speaking'],
      outcomes: ['Delivered talk on Server Components', 'Networked with 200+ developers'],
      resources: ['https://slides.com/react-talk', 'https://github.com/demo-repo'],
      isAttended: true,
      registrationDate: '2024-01-15',
      createdAt: '2024-01-15T00:00:00Z',
      updatedAt: '2024-03-17T00:00:00Z',
    },
    {
      id: 'event-2',
      type: NodeType.Event,
      title: 'Local JavaScript Meetup',
      description: 'Monthly JavaScript developers meetup',
      startDate: '2024-02-20',
      endDate: '2024-02-20',
      location: 'Seattle, WA',
      venue: 'Tech Hub Seattle',
      organizer: 'Seattle JS Community',
      eventType: 'meetup',
      attendanceType: 'in-person',
      role: 'attendee',
      topics: ['Node.js', 'Express', 'API Development'],
      skills: ['Node.js', 'Networking'],
      isAttended: true,
      createdAt: '2024-02-10T00:00:00Z',
      updatedAt: '2024-02-20T00:00:00Z',
    },
    {
      id: 'event-3',
      type: NodeType.Event,
      title: 'Web Development Workshop',
      description: 'Hands-on workshop for building modern web applications',
      startDate: '2024-05-10',
      endDate: '2024-05-12',
      location: 'Online',
      organizer: 'Web Dev Academy',
      eventType: 'workshop',
      attendanceType: 'virtual',
      role: 'participant',
      topics: ['Vue.js', 'Nuxt.js', 'Full-stack Development'],
      skills: ['Vue.js', 'Nuxt.js', 'Problem Solving'],
      certificateEarned: true,
      certificateUrl: 'https://certificates.com/webdev-cert-123',
      isAttended: false, // Future event
      registrationDate: '2024-04-01',
      createdAt: '2024-04-01T00:00:00Z',
      updatedAt: '2024-04-01T00:00:00Z',
    },
    {
      id: 'event-4',
      type: NodeType.Event,
      title: 'Tech Industry Panel Discussion',
      description: 'Panel discussion on future of technology and careers',
      startDate: '2024-01-25',
      endDate: '2024-01-25',
      location: 'Austin, TX',
      venue: 'Austin Convention Center',
      organizer: 'Tech Austin',
      eventType: 'panel',
      attendanceType: 'hybrid',
      role: 'panelist',
      topics: ['Career Development', 'Tech Trends', 'Industry Insights'],
      skills: ['Public Speaking', 'Industry Knowledge', 'Communication'],
      outcomes: ['Shared career insights with 500+ attendees'],
      isAttended: true,
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-25T00:00:00Z',
    },
  ];

  const mockProfile = {
    id: 1,
    userId: 1,
    username: 'testuser',
    filteredData: {
      workExperiences: [],
      education: [],
      projects: [],
      events: sampleEvents,
      actions: [],
      careerTransitions: [],
    },
    rawData: {},
    projects: [],
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new EventRepository(mockDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('domain-specific queries', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findByEventType', () => {
      it('should find events by type', async () => {
        const result = await repository.findByEventType(1, 'conference');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('React Conference 2024');
        expect(result[0].eventType).toBe('conference');
      });

      it('should find meetup events', async () => {
        const result = await repository.findByEventType(1, 'meetup');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Local JavaScript Meetup');
        expect(result[0].eventType).toBe('meetup');
      });

      it('should return empty array for non-existent event type', async () => {
        const result = await repository.findByEventType(1, 'hackathon');

        expect(result).toHaveLength(0);
      });
    });

    describe('findByRole', () => {
      it('should find events where user was a speaker', async () => {
        const result = await repository.findByRole(1, 'speaker');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('React Conference 2024');
        expect(result[0].role).toBe('speaker');
      });

      it('should find events where user was a panelist', async () => {
        const result = await repository.findByRole(1, 'panelist');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Tech Industry Panel Discussion');
        expect(result[0].role).toBe('panelist');
      });

      it('should find events where user was an attendee', async () => {
        const result = await repository.findByRole(1, 'attendee');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Local JavaScript Meetup');
      });
    });

    describe('findByAttendanceType', () => {
      it('should find in-person events', async () => {
        const result = await repository.findByAttendanceType(1, 'in-person');

        expect(result).toHaveLength(2);
        expect(result.every(event => event.attendanceType === 'in-person')).toBe(true);
      });

      it('should find virtual events', async () => {
        const result = await repository.findByAttendanceType(1, 'virtual');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Web Development Workshop');
        expect(result[0].location).toBe('Online');
      });

      it('should find hybrid events', async () => {
        const result = await repository.findByAttendanceType(1, 'hybrid');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Tech Industry Panel Discussion');
      });
    });

    describe('findByLocation', () => {
      it('should find events by location', async () => {
        const result = await repository.findByLocation(1, 'San Francisco, CA');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('React Conference 2024');
        expect(result[0].location).toBe('San Francisco, CA');
      });

      it('should perform case-insensitive location search', async () => {
        const result = await repository.findByLocation(1, 'san francisco');

        expect(result).toHaveLength(1);
        expect(result[0].location).toBe('San Francisco, CA');
      });

      it('should find partial location matches', async () => {
        const result = await repository.findByLocation(1, 'Seattle');

        expect(result).toHaveLength(1);
        expect(result[0].location).toBe('Seattle, WA');
      });
    });

    describe('findByOrganizer', () => {
      it('should find events by organizer', async () => {
        const result = await repository.findByOrganizer(1, 'React Team');

        expect(result).toHaveLength(1);
        expect(result[0].organizer).toBe('React Team');
      });

      it('should perform case-insensitive organizer search', async () => {
        const result = await repository.findByOrganizer(1, 'react team');

        expect(result).toHaveLength(1);
        expect(result[0].organizer).toBe('React Team');
      });
    });

    describe('findAttended', () => {
      it('should find events that were attended', async () => {
        const result = await repository.findAttended(1);

        expect(result).toHaveLength(3); // All except the future workshop
        expect(result.every(event => event.isAttended)).toBe(true);
      });
    });

    describe('findUpcoming', () => {
      it('should find upcoming events', async () => {
        const result = await repository.findUpcoming(1);

        expect(result).toHaveLength(1); // Only the future workshop
        expect(result[0].title).toBe('Web Development Workshop');
        expect(result[0].isAttended).toBe(false);
      });
    });

    describe('findByTopic', () => {
      it('should find events by topic', async () => {
        const result = await repository.findByTopic(1, 'React');

        expect(result).toHaveLength(1);
        expect(result[0].topics).toContain('React 18');
      });

      it('should find events with Node.js topic', async () => {
        const result = await repository.findByTopic(1, 'Node.js');

        expect(result).toHaveLength(1);
        expect(result[0].topics).toContain('Node.js');
      });
    });

    describe('findWithCertificates', () => {
      it('should find events with certificates earned', async () => {
        const result = await repository.findWithCertificates(1);

        expect(result).toHaveLength(1);
        expect(result[0].certificateEarned).toBe(true);
        expect(result[0].certificateUrl).toBeDefined();
      });
    });

    describe('findByDateRange', () => {
      it('should find events within date range', async () => {
        const result = await repository.findByDateRange(1, '2024-03-01', '2024-03-31');

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('React Conference 2024');
      });

      it('should find multiple events in broader range', async () => {
        const result = await repository.findByDateRange(1, '2024-01-01', '2024-04-30');

        expect(result).toHaveLength(3); // All events except the May workshop
      });
    });

    describe('findAllSorted', () => {
      it('should return events sorted by start date (most recent first)', async () => {
        const result = await repository.findAllSorted(1);

        expect(result).toHaveLength(4);
        expect(result[0].title).toBe('Web Development Workshop'); // 2024-05-10
        expect(result[1].title).toBe('React Conference 2024'); // 2024-03-15
        expect(result[2].title).toBe('Local JavaScript Meetup'); // 2024-02-20
        expect(result[3].title).toBe('Tech Industry Panel Discussion'); // 2024-01-25
      });
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
      mockDb.__setUpdateResult([mockProfile]);
    });

    describe('create', () => {
      it('should create event with valid data', async () => {
        const validData = {
          type: NodeType.Event,
          title: 'GraphQL Workshop',
          description: 'Learning GraphQL basics',
          startDate: '2024-06-15',
          endDate: '2024-06-15',
          location: 'New York, NY',
          organizer: 'GraphQL Foundation',
          eventType: 'workshop' as const,
          attendanceType: 'in-person' as const,
          role: 'participant' as const,
        };

        const result = await repository.create(1, validData);

        expect(result).toBeDefined();
        expect(result.title).toBe('GraphQL Workshop');
        expect(result.eventType).toBe('workshop');
      });

      it('should throw error with invalid event data', async () => {
        const invalidData = {
          type: NodeType.Event,
          title: '',  // Empty title
          organizer: 'Test Organizer',
        } as any;

        await expect(repository.create(1, invalidData))
          .rejects.toThrow('Invalid event data');
      });

      it('should validate event type enum', async () => {
        const invalidEventTypeData = {
          type: NodeType.Event,
          title: 'Test Event',
          organizer: 'Test Organizer',
          eventType: 'invalid-type', // Invalid event type
        } as any;

        await expect(repository.create(1, invalidEventTypeData))
          .rejects.toThrow('Invalid event data');
      });

      it('should validate attendance type enum', async () => {
        const invalidAttendanceData = {
          type: NodeType.Event,
          title: 'Test Event',
          organizer: 'Test Organizer',
          eventType: 'conference',
          attendanceType: 'invalid-attendance', // Invalid attendance type
        } as any;

        await expect(repository.create(1, invalidAttendanceData))
          .rejects.toThrow('Invalid event data');
      });
    });

    describe('update', () => {
      it('should update event with valid partial data', async () => {
        const updates = {
          description: 'Updated event description',
          outcomes: ['New outcome achieved'],
          isAttended: true,
        };

        const result = await repository.update(1, 'event-1', updates);

        expect(result).not.toBeNull();
      });

      it('should handle empty updates', async () => {
        const result = await repository.update(1, 'event-1', {});

        expect(result).not.toBeNull();
      });
    });

    describe('isValidNode', () => {
      it('should validate event nodes correctly', () => {
        const validNode = {
          id: 'test-id',
          type: NodeType.Event,
          title: 'Test Event',
          organizer: 'Test Organizer',
          eventType: 'conference',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        const invalidNode = {
          id: 'test-id',
          type: NodeType.Event,
          title: '', // Empty title
          organizer: 'Test Organizer',
          eventType: 'conference',
        };

        expect(repository['isValidNode'](validNode)).toBe(true);
        expect(repository['isValidNode'](invalidNode)).toBe(false);
      });
    });
  });

  describe('utility functions', () => {
    describe('calculateEventDuration', () => {
      it('should calculate single-day event duration', () => {
        const duration = calculateEventDuration('2024-03-15', '2024-03-15');

        expect(duration).toBe(1); // Single day
      });

      it('should calculate multi-day event duration', () => {
        const duration = calculateEventDuration('2024-03-15', '2024-03-17');

        expect(duration).toBe(3); // Three days
      });

      it('should return null for invalid dates', () => {
        const duration = calculateEventDuration('invalid-date', '2024-03-17');

        expect(duration).toBeNull();
      });

      it('should return 1 for events with no end date', () => {
        const duration = calculateEventDuration('2024-03-15');

        expect(duration).toBe(1); // Assume single day
      });
    });

    describe('formatEventType', () => {
      it('should format event types correctly', () => {
        expect(formatEventType('conference')).toBe('Conference');
        expect(formatEventType('meetup')).toBe('Meetup');
        expect(formatEventType('workshop')).toBe('Workshop');
        expect(formatEventType('webinar')).toBe('Webinar');
        expect(formatEventType('panel')).toBe('Panel Discussion');
        expect(formatEventType('hackathon')).toBe('Hackathon');
      });

      it('should handle unknown event types', () => {
        expect(formatEventType('unknown')).toBe('Other');
        expect(formatEventType(undefined)).toBe('Event');
      });
    });

    describe('isUpcomingEvent', () => {
      it('should identify upcoming events', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 10);

        const upcoming = isUpcomingEvent(futureDate.toISOString());
        expect(upcoming).toBe(true);
      });

      it('should identify past events', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 10);

        const upcoming = isUpcomingEvent(pastDate.toISOString());
        expect(upcoming).toBe(false);
      });

      it('should handle invalid dates', () => {
        const upcoming = isUpcomingEvent('invalid-date');
        expect(upcoming).toBe(false);
      });
    });
  });

  describe('skills and outcomes tracking', () => {
    beforeEach(() => {
      mockDb.__setQueryResult([mockProfile]);
    });

    describe('findBySkill', () => {
      it('should find events by skill gained', async () => {
        const result = await repository.findBySkill(1, 'React');

        expect(result).toHaveLength(1);
        expect(result[0].skills).toContain('React');
      });

      it('should find events by public speaking skill', async () => {
        const result = await repository.findBySkill(1, 'Public Speaking');

        expect(result).toHaveLength(2); // React conference and panel discussion
        expect(result.every(event => event.skills?.includes('Public Speaking'))).toBe(true);
      });
    });

    describe('findWithOutcomes', () => {
      it('should find events with recorded outcomes', async () => {
        const result = await repository.findWithOutcomes(1);

        expect(result).toHaveLength(2); // React conference and panel discussion
        expect(result.every(event => event.outcomes && event.outcomes.length > 0)).toBe(true);
      });
    });

    describe('getSkillsFromEvents', () => {
      it('should extract unique skills from all events', async () => {
        const skills = await repository.getSkillsFromEvents(1);

        expect(skills).toContain('React');
        expect(skills).toContain('JavaScript');
        expect(skills).toContain('Public Speaking');
        expect(skills).toContain('Node.js');
        expect(skills).toContain('Vue.js');
        expect(skills).toContain('Networking');
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const errorQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: () => {
          throw new Error('Database connection failed');
        },
      };
      mockDb.select = vi.fn(() => errorQuery);

      await expect(repository.findByEventType(1, 'conference'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle malformed event data', async () => {
      const malformedProfile = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          events: null, // Malformed data
        },
      };
      
      mockDb.__setQueryResult([malformedProfile]);

      const result = await repository.findAll(1);
      expect(result).toEqual([]);
    });
  });

  describe('performance and pagination', () => {
    beforeEach(() => {
      // Create a large number of events for performance testing
      const manyEvents = Array.from({ length: 100 }, (_, i) => ({
        ...sampleEvents[0],
        id: `event-${i}`,
        title: `Event ${i}`,
      }));

      const profileWithManyEvents = {
        ...mockProfile,
        filteredData: {
          ...mockProfile.filteredData,
          events: manyEvents,
        },
      };

      mockDb.__setQueryResult([profileWithManyEvents]);
    });

    describe('findAllPaginated', () => {
      it('should support pagination', async () => {
        const result = await repository.findAllPaginated(1, 1, 10);

        expect(result.data).toHaveLength(10);
        expect(result.total).toBe(100);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
        expect(result.totalPages).toBe(10);
      });

      it('should handle last page correctly', async () => {
        const result = await repository.findAllPaginated(1, 10, 10);

        expect(result.data).toHaveLength(10);
        expect(result.page).toBe(10);
        expect(result.hasNext).toBe(false);
        expect(result.hasPrev).toBe(true);
      });
    });
  });
});

// Export utility functions for testing
export { calculateEventDuration, formatEventType, isUpcomingEvent };