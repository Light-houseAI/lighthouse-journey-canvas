/**
 * Updates Schema Tests
 * Tests for career transition updates API schemas
 */

import { describe, expect, it } from 'vitest';

import { NetworkingType } from '../../enums';
import {
  apiUpdateResponseSchema,
  createUpdateRequestSchema,
  legacyPaginatedUpdatesSchema,
  networkingWizardPayloadSchema,
  paginatedUpdatesSchema,
  paginationQuerySchema,
  updateItemSchema,
  updateUpdateRequestSchema,
} from '../updates.schemas';

// Constants
const MAX_NOTES_LENGTH = 1000;
const MAX_CONTACT_NAME_LENGTH = 100;
const MAX_CHANNEL_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_EVENT_NAME_LENGTH = 100;
const MIN_PAGE = 1;
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

// Test data factories
const createValidUpdateRequest = (
  overrides: Partial<{
    notes?: string;
    meta?: Record<string, any>;
  }> = {}
) => ({
  notes: 'Made good progress this week',
  meta: {
    appliedToJobs: true,
    networked: true,
  },
  ...overrides,
});

const createValidColdOutreachActivity = (
  overrides: Partial<{
    timestamp: string;
    networkingType: typeof NetworkingType.ColdOutreach;
    whom: string[];
    channels: string[];
    exampleOnHow: string;
  }> = {}
) => ({
  timestamp: '2024-01-01T00:00:00Z',
  networkingType: NetworkingType.ColdOutreach,
  whom: ['Tech recruiters', 'Engineering managers'],
  channels: ['LinkedIn', 'Email'],
  exampleOnHow: 'Personalized message highlighting relevant experience',
  ...overrides,
});

const createValidReconnectedActivity = (
  overrides: Partial<{
    timestamp: string;
    networkingType: typeof NetworkingType.ReconnectedWithSomeone;
    contacts: string[];
    notes: string;
  }> = {}
) => ({
  timestamp: '2024-01-01T00:00:00Z',
  networkingType: NetworkingType.ReconnectedWithSomeone,
  contacts: ['Former colleague', 'College friend'],
  notes: 'Caught up over coffee and discussed industry trends',
  ...overrides,
});

const createValidNetworkingEventActivity = (
  overrides: Partial<{
    timestamp: string;
    networkingType: typeof NetworkingType.AttendedNetworkingEvent;
    event: string;
    notes: string;
  }> = {}
) => ({
  timestamp: '2024-01-01T00:00:00Z',
  networkingType: NetworkingType.AttendedNetworkingEvent,
  event: 'Tech Career Fair 2024',
  notes: 'Met several hiring managers and exchanged contacts',
  ...overrides,
});

const createValidInformationalInterviewActivity = (
  overrides: Partial<{
    timestamp: string;
    networkingType: typeof NetworkingType.InformationalInterview;
    contact: string;
    notes: string;
  }> = {}
) => ({
  timestamp: '2024-01-01T00:00:00Z',
  networkingType: NetworkingType.InformationalInterview,
  contact: 'Senior Engineer at TechCorp',
  notes: 'Learned about their team structure and tech stack',
  ...overrides,
});

describe('Updates Request Schemas', () => {
  describe('createUpdateRequestSchema', () => {
    it('should validate valid update with activity flags', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest()
      );
      expect(result.success).toBe(true);
    });

    it('should validate empty update', () => {
      const result = createUpdateRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate update with only meta', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest({ notes: undefined })
      );
      expect(result.success).toBe(true);
    });

    it('should validate update with only notes', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest({ meta: undefined })
      );
      expect(result.success).toBe(true);
    });

    it('should validate all activity flags', () => {
      const result = createUpdateRequestSchema.safeParse({
        meta: {
          appliedToJobs: true,
          updatedResumeOrPortfolio: true,
          networked: true,
          developedSkills: true,
          pendingInterviews: true,
          completedInterviews: true,
          practicedMock: true,
          receivedOffers: true,
          receivedRejections: true,
          possiblyGhosted: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate notes at maximum length', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest({
          notes: 'a'.repeat(MAX_NOTES_LENGTH),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should reject notes exceeding maximum length', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest({
          notes: 'a'.repeat(MAX_NOTES_LENGTH + 1),
        })
      );
      expect(result.success).toBe(false);
    });

    it('should validate empty notes string', () => {
      const result = createUpdateRequestSchema.safeParse(
        createValidUpdateRequest({ notes: '' })
      );
      expect(result.success).toBe(true);
    });

    it('should validate meta with all flags false', () => {
      const result = createUpdateRequestSchema.safeParse({
        meta: {
          appliedToJobs: false,
          networked: false,
          developedSkills: false,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate meta with partial flags', () => {
      const result = createUpdateRequestSchema.safeParse({
        meta: {
          appliedToJobs: true,
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate empty meta object', () => {
      const result = createUpdateRequestSchema.safeParse({
        meta: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateUpdateRequestSchema', () => {
    it('should validate partial update', () => {
      const result = updateUpdateRequestSchema.safeParse({
        notes: 'Updated notes',
      });
      expect(result.success).toBe(true);
    });

    it('should validate empty partial update', () => {
      const result = updateUpdateRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('paginationQuerySchema', () => {
    it('should apply default values', () => {
      const result = paginationQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(DEFAULT_PAGE);
        expect(result.data.limit).toBe(DEFAULT_LIMIT);
      }
    });

    it('should transform string page to number', () => {
      const result = paginationQuerySchema.safeParse({
        page: '5',
        limit: '50',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
        expect(typeof result.data.page).toBe('number');
        expect(typeof result.data.limit).toBe('number');
      }
    });

    it('should validate page at minimum boundary', () => {
      const result = paginationQuerySchema.safeParse({
        page: String(MIN_PAGE),
      });
      expect(result.success).toBe(true);
    });

    it('should reject page below minimum', () => {
      const result = paginationQuerySchema.safeParse({
        page: String(MIN_PAGE - 1),
      });
      expect(result.success).toBe(false);
    });

    it('should validate limit at maximum boundary', () => {
      const result = paginationQuerySchema.safeParse({
        limit: String(MAX_LIMIT),
      });
      expect(result.success).toBe(true);
    });

    it('should reject limit above maximum', () => {
      const result = paginationQuerySchema.safeParse({
        limit: String(MAX_LIMIT + 1),
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero limit', () => {
      const result = paginationQuerySchema.safeParse({
        limit: '0',
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero page', () => {
      const result = paginationQuerySchema.safeParse({
        page: '0',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('networkingWizardPayloadSchema', () => {
    it('should validate cold outreach activity', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidColdOutreachActivity()],
      });
      expect(result.success).toBe(true);
    });

    it('should validate reconnected activity', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidReconnectedActivity()],
      });
      expect(result.success).toBe(true);
    });

    it('should validate networking event activity', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidNetworkingEventActivity()],
      });
      expect(result.success).toBe(true);
    });

    it('should validate informational interview activity', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidInformationalInterviewActivity()],
      });
      expect(result.success).toBe(true);
    });

    it('should validate multiple mixed activities', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidColdOutreachActivity(),
          createValidReconnectedActivity(),
          createValidNetworkingEventActivity(),
          createValidInformationalInterviewActivity(),
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty activities array', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject activity with wrong networkingType', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          {
            timestamp: '2024-01-01T00:00:00Z',
            networkingType: 'invalid-type',
            whom: ['Someone'],
            channels: ['Email'],
            exampleOnHow: 'Some example',
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    // Cold outreach specific tests
    it('should reject cold outreach with empty whom array', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidColdOutreachActivity({ whom: [] })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject cold outreach with empty channels array', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidColdOutreachActivity({ channels: [] })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject cold outreach with whom item exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidColdOutreachActivity({
            whom: ['a'.repeat(MAX_CONTACT_NAME_LENGTH + 1)],
          }),
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject cold outreach with channel exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidColdOutreachActivity({
            channels: ['a'.repeat(MAX_CHANNEL_LENGTH + 1)],
          }),
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject cold outreach with exampleOnHow exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidColdOutreachActivity({
            exampleOnHow: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
          }),
        ],
      });
      expect(result.success).toBe(false);
    });

    // Reconnected activity specific tests
    it('should reject reconnected with empty contacts array', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidReconnectedActivity({ contacts: [] })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject reconnected with notes exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidReconnectedActivity({
            notes: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
          }),
        ],
      });
      expect(result.success).toBe(false);
    });

    // Networking event specific tests
    it('should reject event with empty event name', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [createValidNetworkingEventActivity({ event: '' })],
      });
      expect(result.success).toBe(false);
    });

    it('should reject event with name exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidNetworkingEventActivity({
            event: 'a'.repeat(MAX_EVENT_NAME_LENGTH + 1),
          }),
        ],
      });
      expect(result.success).toBe(false);
    });

    // Informational interview specific tests
    it('should reject interview with empty contact', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidInformationalInterviewActivity({ contact: '' }),
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject interview with contact exceeding max length', () => {
      const result = networkingWizardPayloadSchema.safeParse({
        activities: [
          createValidInformationalInterviewActivity({
            contact: 'a'.repeat(MAX_CONTACT_NAME_LENGTH + 1),
          }),
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Updates Response Schemas', () => {
  describe('updateItemSchema', () => {
    it('should validate valid update item', () => {
      const validData = {
        id: '123',
        nodeId: '456',
        content: 'Update content',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        userId: 1,
      };
      const result = updateItemSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate without optional fields', () => {
      const validData = {
        id: '123',
        nodeId: '456',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      const result = updateItemSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = updateItemSchema.safeParse({
        id: '123',
        // Missing other required fields
      });
      expect(result.success).toBe(false);
    });
  });

  describe('apiUpdateResponseSchema', () => {
    it('should validate valid social update response', () => {
      const validData = {
        id: '123',
        userId: 1,
        actorId: 2,
        actorName: 'John Doe',
        actorProfilePictureUrl: 'https://example.com/profile.jpg',
        type: 'comment',
        targetType: 'post',
        targetId: '456',
        metadata: { text: 'Great post!' },
        createdAt: '2024-01-01T00:00:00Z',
      };
      const result = apiUpdateResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate all update types', () => {
      const types: Array<'comment' | 'like' | 'share' | 'mention'> = [
        'comment',
        'like',
        'share',
        'mention',
      ];

      types.forEach((type) => {
        const result = apiUpdateResponseSchema.safeParse({
          id: '123',
          userId: 1,
          actorId: 2,
          actorName: 'John Doe',
          actorProfilePictureUrl: null,
          type,
          targetType: 'post',
          targetId: '456',
          metadata: null,
          createdAt: '2024-01-01T00:00:00Z',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should validate with null actorProfilePictureUrl', () => {
      const validData = {
        id: '123',
        userId: 1,
        actorId: 2,
        actorName: 'John Doe',
        actorProfilePictureUrl: null,
        type: 'like',
        targetType: 'post',
        targetId: '456',
        metadata: null,
        createdAt: '2024-01-01T00:00:00Z',
      };
      const result = apiUpdateResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with Date createdAt', () => {
      const validData = {
        id: '123',
        userId: 1,
        actorId: 2,
        actorName: 'John Doe',
        actorProfilePictureUrl: null,
        type: 'comment',
        targetType: 'post',
        targetId: '456',
        metadata: null,
        createdAt: new Date(),
      };
      const result = apiUpdateResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
      const result = apiUpdateResponseSchema.safeParse({
        id: '123',
        userId: 1,
        actorId: 2,
        actorName: 'John Doe',
        actorProfilePictureUrl: null,
        type: 'invalid-type',
        targetType: 'post',
        targetId: '456',
        metadata: null,
        createdAt: '2024-01-01T00:00:00Z',
      });
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = apiUpdateResponseSchema.safeParse({
        id: '123',
        userId: 1,
        actorId: 2,
        actorName: 'John Doe',
        actorProfilePictureUrl: null,
        type: 'comment',
        targetType: 'post',
        targetId: '456',
        metadata: null,
        createdAt: '2024-01-01T00:00:00Z',
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('paginatedUpdatesSchema', () => {
    it('should validate valid paginated updates', () => {
      const validData = {
        updates: [
          {
            id: '123',
            userId: 1,
            actorId: 2,
            actorName: 'John Doe',
            actorProfilePictureUrl: null,
            type: 'comment',
            targetType: 'post',
            targetId: '456',
            metadata: null,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 5,
          totalItems: 100,
        },
      };
      const result = paginatedUpdatesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty updates array', () => {
      const validData = {
        updates: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 0,
          totalItems: 0,
        },
      };
      const result = paginatedUpdatesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject extra fields (strict mode)', () => {
      const result = paginatedUpdatesSchema.safeParse({
        updates: [],
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: 0,
          totalItems: 0,
        },
        extraField: 'not allowed',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('legacyPaginatedUpdatesSchema', () => {
    it('should validate valid legacy paginated updates', () => {
      const validData = {
        items: [
          {
            id: '123',
            nodeId: '456',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5,
      };
      const result = legacyPaginatedUpdatesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty items array', () => {
      const validData = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      const result = legacyPaginatedUpdatesSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const result = legacyPaginatedUpdatesSchema.safeParse({
        items: [],
        total: 0,
        // Missing page, limit, totalPages
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-array items', () => {
      const result = legacyPaginatedUpdatesSchema.safeParse({
        items: 'not-an-array',
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
