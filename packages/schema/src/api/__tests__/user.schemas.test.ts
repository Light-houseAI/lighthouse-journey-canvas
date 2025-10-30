/**
 * User Schema Tests
 * Tests for user API request and response schemas
 */

import { describe, expect, it } from 'vitest';

import {
  userResponseSchema,
  userSearchRequestSchema,
  userSearchResponseSchema,
  userSearchResultSchema,
  userUpdateRequestSchema,
} from '../user.schemas';

// Constants
const MAX_QUERY_LENGTH = 100;

// Test data factories
const createValidSearchQuery = (overrides: Partial<{ q: string }> = {}) => ({
  q: 'john doe',
  ...overrides,
});

const createValidUserUpdate = (
  overrides: Partial<{
    firstName: string;
    lastName: string;
    userName: string;
    interest: string;
  }> = {}
) => ({
  firstName: 'John',
  lastName: 'Doe',
  userName: 'johndoe',
  interest: 'Software Engineering',
  ...overrides,
});

const createValidUserResponse = (
  overrides: Partial<{
    id: number;
    email: string;
    fullName: string | null;
    profilePictureUrl: string | null;
    createdAt: Date | string;
  }> = {}
) => ({
  id: 1,
  email: 'test@example.com',
  fullName: 'John Doe',
  profilePictureUrl: 'https://example.com/avatar.jpg',
  createdAt: new Date(),
  ...overrides,
});

const createValidSearchResult = (
  overrides: Partial<{
    id: string;
    email: string;
    userName: string;
    firstName: string;
    lastName: string;
    experienceLine: string;
    avatarUrl: string | null;
  }> = {}
) => ({
  id: 'user-123',
  email: 'john@example.com',
  userName: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  experienceLine: 'Software Engineer at TechCorp',
  avatarUrl: 'https://example.com/avatar.jpg',
  ...overrides,
});

describe('User Request Schemas', () => {
  describe('userSearchRequestSchema', () => {
    it('should validate valid search query', () => {
      const result = userSearchRequestSchema.safeParse(
        createValidSearchQuery()
      );
      expect(result.success).toBe(true);
    });

    it('should validate single character query', () => {
      const result = userSearchRequestSchema.safeParse(
        createValidSearchQuery({ q: 'a' })
      );
      expect(result.success).toBe(true);
    });

    it('should reject empty query', () => {
      const result = userSearchRequestSchema.safeParse(
        createValidSearchQuery({ q: '' })
      );
      expect(result.success).toBe(false);
    });

    it('should reject query longer than maximum length', () => {
      const result = userSearchRequestSchema.safeParse(
        createValidSearchQuery({ q: 'a'.repeat(MAX_QUERY_LENGTH + 1) })
      );
      expect(result.success).toBe(false);
    });

    it('should accept query exactly at maximum length', () => {
      const result = userSearchRequestSchema.safeParse(
        createValidSearchQuery({ q: 'a'.repeat(MAX_QUERY_LENGTH) })
      );
      expect(result.success).toBe(true);
    });

    it('should reject missing query', () => {
      const result = userSearchRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('userUpdateRequestSchema', () => {
    it('should validate complete update request', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'Software Engineering',
      };

      const result = userUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate partial update (firstName only)', () => {
      const validData = {
        firstName: 'John',
      };

      const result = userUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate partial update (multiple fields)', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = userUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty update request', () => {
      const validData = {};

      const result = userUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty string for firstName', () => {
      const invalidData = {
        firstName: '',
      };

      const result = userUpdateRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty string for lastName', () => {
      const invalidData = {
        lastName: '',
      };

      const result = userUpdateRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty string for userName', () => {
      const invalidData = {
        userName: '',
      };

      const result = userUpdateRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow empty string for interest', () => {
      const validData = {
        interest: '',
      };

      const result = userUpdateRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});

describe('User Response Schemas', () => {
  describe('userResponseSchema', () => {
    it('should validate complete user response', () => {
      const validData = {
        id: 1,
        email: 'test@example.com',
        fullName: 'John Doe',
        profilePictureUrl: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
      };

      const result = userResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for fullName', () => {
      const validData = {
        id: 1,
        email: 'test@example.com',
        fullName: null,
        profilePictureUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
      };

      const result = userResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for profilePictureUrl', () => {
      const validData = {
        id: 1,
        email: 'test@example.com',
        fullName: 'John Doe',
        profilePictureUrl: null,
        createdAt: new Date(),
      };

      const result = userResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept both string and Date for createdAt', () => {
      const withString = userResponseSchema.safeParse({
        id: 1,
        email: 'test@example.com',
        fullName: null,
        profilePictureUrl: null,
        createdAt: '2024-01-01T00:00:00Z',
      });

      const withDate = userResponseSchema.safeParse({
        id: 1,
        email: 'test@example.com',
        fullName: null,
        profilePictureUrl: null,
        createdAt: new Date(),
      });

      expect(withString.success).toBe(true);
      expect(withDate.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        id: 1,
        email: 'not-an-email',
        fullName: null,
        profilePictureUrl: null,
        createdAt: new Date(),
      };

      const result = userResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const invalidData = {
        id: 1,
        email: 'test@example.com',
        fullName: null,
        profilePictureUrl: null,
        createdAt: new Date(),
        extraField: 'not allowed',
      };

      const result = userResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userSearchResultSchema', () => {
    it('should validate complete search result', () => {
      const validData = {
        id: 'user-123',
        email: 'john@example.com',
        userName: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        experienceLine: 'Software Engineer at TechCorp',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const result = userSearchResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept null for avatarUrl', () => {
      const validData = {
        id: 'user-123',
        email: 'john@example.com',
        userName: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        experienceLine: 'Software Engineer',
        avatarUrl: null,
      };

      const result = userSearchResultSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        id: 'user-123',
        email: 'invalid-email',
        userName: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        experienceLine: 'Engineer',
        avatarUrl: null,
      };

      const result = userSearchResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        id: 'user-123',
        email: 'john@example.com',
      };

      const result = userSearchResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const invalidData = {
        id: 'user-123',
        email: 'john@example.com',
        userName: 'johndoe',
        firstName: 'John',
        lastName: 'Doe',
        experienceLine: 'Engineer',
        avatarUrl: null,
        extraField: 'not allowed',
      };

      const result = userSearchResultSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('userSearchResponseSchema', () => {
    it('should validate search response with results', () => {
      const validData = {
        users: [
          {
            id: 'user-1',
            email: 'john@example.com',
            userName: 'john',
            firstName: 'John',
            lastName: 'Doe',
            experienceLine: 'Engineer',
            avatarUrl: null,
          },
          {
            id: 'user-2',
            email: 'jane@example.com',
            userName: 'jane',
            firstName: 'Jane',
            lastName: 'Smith',
            experienceLine: 'Designer',
            avatarUrl: 'https://example.com/jane.jpg',
          },
        ],
        count: 2,
      };

      const result = userSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate empty search results', () => {
      const validData = {
        users: [],
        count: 0,
      };

      const result = userSearchResponseSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative count', () => {
      const invalidData = {
        users: [],
        count: -1,
      };

      const result = userSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer count', () => {
      const invalidData = {
        users: [],
        count: 1.5,
      };

      const result = userSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject extra fields (strict mode)', () => {
      const invalidData = {
        users: [],
        count: 0,
        extraField: 'not allowed',
      };

      const result = userSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid user in array', () => {
      const invalidData = {
        users: [
          {
            id: 'user-1',
            email: 'invalid-email',
            userName: 'john',
            firstName: 'John',
            lastName: 'Doe',
            experienceLine: 'Engineer',
            avatarUrl: null,
          },
        ],
        count: 1,
      };

      const result = userSearchResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
