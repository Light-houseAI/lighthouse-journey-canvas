/**
 * Response Validation Middleware Test Suite
 *
 * Tests for MappedResponse wrapper that provides fluent validation API:
 * - Wraps data in ApiSuccessResponse format
 * - Validates entire response structure with schemas
 * - Provides type-safe response construction
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MappedResponse } from '../response-validation.middleware';

// Mock the schema package validation
vi.mock('@journey/schema', async () => {
  const actual = await vi.importActual('@journey/schema');
  return {
    ...actual,
    validateResponse: vi.fn((schema, data) => data),
    apiSuccessResponseSchema: vi.fn((dataSchema) => dataSchema),
  };
});

import { apiSuccessResponseSchema, validateResponse } from '@journey/schema';

// Get mocked functions
const mockValidateResponse = vi.mocked(validateResponse);

describe('MappedResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create MappedResponse with data', () => {
      const testData = { id: 1, name: 'Test' };
      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should create MappedResponse with null data', () => {
      const mappedResponse = new MappedResponse(null);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: null,
      });
    });

    it('should create MappedResponse with array data', () => {
      const testData = [1, 2, 3, 4, 5];
      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should create MappedResponse with string data', () => {
      const testData = 'success message';
      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should create MappedResponse with boolean data', () => {
      const mappedResponse = new MappedResponse(true);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: true,
      });
    });

    it('should create MappedResponse with number data', () => {
      const mappedResponse = new MappedResponse(42);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: 42,
      });
    });

    it('should create MappedResponse with complex nested object', () => {
      const testData = {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
        },
      };

      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: testData,
      });
    });
  });

  describe('withSchema', () => {
    it('should validate response with schema', () => {
      const testData = { id: 1, name: 'Test' };
      const dataSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(apiSuccessResponseSchema).toHaveBeenCalledWith(dataSchema);
      expect(validateResponse).toHaveBeenCalledWith(
        dataSchema, // Mocked to return the dataSchema itself
        {
          success: true,
          data: testData,
        },
        {
          schemaName: 'ApiSuccessResponse',
        }
      );
      expect(validated).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should validate response with custom schema name', () => {
      const testData = { id: 1 };
      const dataSchema = z.object({ id: z.number() });

      const mappedResponse = new MappedResponse(testData);
      mappedResponse.withSchema(dataSchema, 'CustomUserResponse');

      expect(validateResponse).toHaveBeenCalledWith(
        dataSchema,
        {
          success: true,
          data: testData,
        },
        {
          schemaName: 'CustomUserResponse',
        }
      );
    });

    it('should validate array data with schema', () => {
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const dataSchema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        })
      );

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should validate null data with nullable schema', () => {
      const testData = null;
      const dataSchema = z.null();

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated).toEqual({
        success: true,
        data: null,
      });
    });

    it('should validate optional data with optional schema', () => {
      const testData = undefined;
      const dataSchema = z.undefined();

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated).toEqual({
        success: true,
        data: undefined,
      });
    });

    it('should validate union types', () => {
      const testData = { type: 'user', id: 1 };
      const dataSchema = z.union([
        z.object({ type: z.literal('user'), id: z.number() }),
        z.object({
          type: z.literal('admin'),
          id: z.number(),
          privileges: z.array(z.string()),
        }),
      ]);

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated.success).toBe(true);
      expect(validated.data).toEqual(testData);
    });

    it('should handle discriminated unions', () => {
      const testData = { kind: 'circle', radius: 10 };
      const dataSchema = z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('circle'), radius: z.number() }),
        z.object({ kind: z.literal('square'), side: z.number() }),
      ]);

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated.success).toBe(true);
      expect(validated.data).toEqual(testData);
    });

    it('should validate with refined schemas', () => {
      const testData = { email: 'test@example.com', age: 25 };
      const dataSchema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated).toEqual({
        success: true,
        data: testData,
      });
    });

    it('should validate with transformed schemas', () => {
      const testData = { count: '42' };
      const dataSchema = z.object({
        count: z.string().transform((val) => parseInt(val, 10)),
      });

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      expect(validated.success).toBe(true);
    });
  });

  describe('unwrap', () => {
    it('should return raw response without validation', () => {
      const testData = { id: 1, name: 'Test' };
      const mappedResponse = new MappedResponse(testData);

      // Clear any previous calls
      mockValidateResponse.mockClear();

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: testData,
      });

      // Verify validation was not called during unwrap
      expect(mockValidateResponse).not.toHaveBeenCalled();
    });

    it('should return response with invalid data when unwrapped', () => {
      const invalidData = { invalid: 'data structure' };
      const mappedResponse = new MappedResponse(invalidData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: invalidData,
      });
    });
  });

  describe('Type Safety', () => {
    it('should preserve generic type information', () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const userData: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mappedResponse = new MappedResponse<User>(userData);
      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data).toEqual(userData);
      expect(unwrapped.data.id).toBe(1);
      expect(unwrapped.data.name).toBe('John Doe');
      expect(unwrapped.data.email).toBe('john@example.com');
    });

    it('should work with array types', () => {
      const items: number[] = [1, 2, 3, 4, 5];

      const mappedResponse = new MappedResponse<number[]>(items);
      const unwrapped = mappedResponse.unwrap();

      expect(Array.isArray(unwrapped.data)).toBe(true);
      expect(unwrapped.data).toEqual(items);
    });

    it('should work with tuple types', () => {
      const tuple: [string, number, boolean] = ['test', 42, true];

      const mappedResponse = new MappedResponse<[string, number, boolean]>(
        tuple
      );
      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data).toEqual(tuple);
    });
  });

  describe('Fluent API Pattern', () => {
    it('should support method chaining', () => {
      const testData = { id: 1, value: 'test' };
      const dataSchema = z.object({
        id: z.number(),
        value: z.string(),
      });

      const mappedResponse = new MappedResponse(testData);

      // Should be able to chain withSchema directly
      const validated = mappedResponse.withSchema(dataSchema, 'TestResponse');

      expect(validated).toBeDefined();
      expect(validated.success).toBe(true);
      expect(validated.data).toEqual(testData);
    });

    it('should work with res.json() pattern', () => {
      // Simulating Express response pattern
      const mockResJson = vi.fn();
      const testData = { message: 'Success' };
      const dataSchema = z.object({ message: z.string() });

      const mappedResponse = new MappedResponse(testData);
      const validated = mappedResponse.withSchema(dataSchema);

      // This is how it would be used in a controller
      mockResJson(validated);

      expect(mockResJson).toHaveBeenCalledWith({
        success: true,
        data: testData,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object', () => {
      const mappedResponse = new MappedResponse({});

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: {},
      });
    });

    it('should handle empty array', () => {
      const mappedResponse = new MappedResponse([]);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: [],
      });
    });

    it('should handle empty string', () => {
      const mappedResponse = new MappedResponse('');

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: '',
      });
    });

    it('should handle zero', () => {
      const mappedResponse = new MappedResponse(0);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: 0,
      });
    });

    it('should handle false', () => {
      const mappedResponse = new MappedResponse(false);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped).toEqual({
        success: true,
        data: false,
      });
    });

    it('should handle deeply nested structures', () => {
      const deepData = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };

      const mappedResponse = new MappedResponse(deepData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data).toEqual(deepData);
      expect(unwrapped.data.level1.level2.level3.level4.value).toBe('deep');
    });

    it('should handle data with special characters', () => {
      const testData = {
        message: 'Test with special chars: !@#$%^&*()',
        unicode: '测试 🚀',
        escape: 'Line1\nLine2\tTabbed',
      };

      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data).toEqual(testData);
    });

    it('should handle Date objects', () => {
      const testData = {
        timestamp: new Date('2023-01-01T00:00:00Z'),
      };

      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data.timestamp).toEqual(testData.timestamp);
    });

    it('should handle BigInt values', () => {
      const testData = {
        largeNumber: BigInt(9007199254740991),
      };

      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data.largeNumber).toEqual(testData.largeNumber);
    });

    it('should handle Map and Set', () => {
      const testData = {
        map: new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ]),
        set: new Set([1, 2, 3]),
      };

      const mappedResponse = new MappedResponse(testData);

      const unwrapped = mappedResponse.unwrap();

      expect(unwrapped.data.map).toEqual(testData.map);
      expect(unwrapped.data.set).toEqual(testData.set);
    });
  });

  describe('Integration with Express', () => {
    it('should work with typical controller response pattern', () => {
      // Typical usage in a controller
      const userData = { id: 1, name: 'John', email: 'john@example.com' };
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
      });

      const response = new MappedResponse(userData).withSchema(
        userSchema,
        'UserResponse'
      );

      expect(response).toEqual({
        success: true,
        data: userData,
      });
    });

    it('should work with list response pattern', () => {
      const users = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ];

      const usersSchema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        })
      );

      const response = new MappedResponse(users).withSchema(
        usersSchema,
        'UsersList'
      );

      expect(response).toEqual({
        success: true,
        data: users,
      });
    });

    it('should work with paginated response pattern', () => {
      const paginatedData = {
        items: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 100,
        },
      };

      const paginatedSchema = z.object({
        items: z.array(z.object({ id: z.number() })),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      });

      const response = new MappedResponse(paginatedData).withSchema(
        paginatedSchema,
        'PaginatedResponse'
      );

      expect(response.success).toBe(true);
      expect(response.data).toEqual(paginatedData);
    });
  });
});
