/**
 * Common Schema Tests
 * Tests for shared schemas used across multiple endpoints
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  apiErrorResponseSchema,
  apiSuccessResponseSchema,
  paginationSchema,
} from '../common.schemas';

describe('apiSuccessResponseSchema', () => {
  it('should validate success response with simple data', () => {
    const stringSchema = apiSuccessResponseSchema(z.string());
    const validData = {
      success: true,
      data: 'Hello, world!',
    };

    const result = stringSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(true);
      expect(result.data.data).toBe('Hello, world!');
    }
  });

  it('should validate success response with complex data', () => {
    const userSchema = z.object({
      id: z.number(),
      name: z.string(),
    });
    const successSchema = apiSuccessResponseSchema(userSchema);

    const validData = {
      success: true,
      data: {
        id: 1,
        name: 'John Doe',
      },
    };

    const result = successSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate success response with array data', () => {
    const arraySchema = apiSuccessResponseSchema(z.array(z.number()));
    const validData = {
      success: true,
      data: [1, 2, 3, 4, 5],
    };

    const result = arraySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject when success is false', () => {
    const stringSchema = apiSuccessResponseSchema(z.string());
    const invalidData = {
      success: false,
      data: 'Hello, world!',
    };

    const result = stringSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject when data does not match schema', () => {
    const numberSchema = apiSuccessResponseSchema(z.number());
    const invalidData = {
      success: true,
      data: 'not a number',
    };

    const result = numberSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject extra fields (strict mode)', () => {
    const stringSchema = apiSuccessResponseSchema(z.string());
    const invalidData = {
      success: true,
      data: 'Hello',
      extraField: 'not allowed',
    };

    const result = stringSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate with null data if schema allows', () => {
    const nullableSchema = apiSuccessResponseSchema(z.string().nullable());
    const validData = {
      success: true,
      data: null,
    };

    const result = nullableSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with nested objects', () => {
    const nestedSchema = apiSuccessResponseSchema(
      z.object({
        user: z.object({
          id: z.number(),
          profile: z.object({
            name: z.string(),
          }),
        }),
      })
    );

    const validData = {
      success: true,
      data: {
        user: {
          id: 1,
          profile: {
            name: 'John',
          },
        },
      },
    };

    const result = nestedSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('apiErrorResponseSchema', () => {
  it('should validate error response with message only', () => {
    const validData = {
      success: false,
      error: {
        message: 'An error occurred',
      },
    };

    const result = apiErrorResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.success).toBe(false);
      expect(result.data.error.message).toBe('An error occurred');
    }
  });

  it('should validate error response with message and code', () => {
    const validData = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
      },
    };

    const result = apiErrorResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should reject when success is true', () => {
    const invalidData = {
      success: true,
      error: {
        message: 'Not really an error',
      },
    };

    const result = apiErrorResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject when message is missing', () => {
    const invalidData = {
      success: false,
      error: {
        code: 'SOME_ERROR',
      },
    };

    const result = apiErrorResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject extra fields in error object (strict mode)', () => {
    const invalidData = {
      success: false,
      error: {
        message: 'Error',
        code: 'ERROR_CODE',
        extraField: 'not allowed',
      },
    };

    const result = apiErrorResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject extra fields in root object (strict mode)', () => {
    const invalidData = {
      success: false,
      error: {
        message: 'Error',
      },
      extraField: 'not allowed',
    };

    const result = apiErrorResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('should validate valid pagination metadata', () => {
    const validData = {
      page: 1,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.totalPages).toBe(5);
      expect(result.data.totalItems).toBe(100);
    }
  });

  it('should validate pagination with zero total pages/items', () => {
    const validData = {
      page: 1,
      pageSize: 20,
      totalPages: 0,
      totalItems: 0,
    };

    const result = paginationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject page zero', () => {
    const invalidData = {
      page: 0,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative page', () => {
    const invalidData = {
      page: -1,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject zero pageSize', () => {
    const invalidData = {
      page: 1,
      pageSize: 0,
      totalPages: 5,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative totalPages', () => {
    const invalidData = {
      page: 1,
      pageSize: 20,
      totalPages: -1,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative totalItems', () => {
    const invalidData = {
      page: 1,
      pageSize: 20,
      totalPages: 5,
      totalItems: -1,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject non-integer page values', () => {
    const invalidData = {
      page: 1.5,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject extra fields (strict mode)', () => {
    const invalidData = {
      page: 1,
      pageSize: 20,
      totalPages: 5,
      totalItems: 100,
      extraField: 'not allowed',
    };

    const result = paginationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should validate large numbers', () => {
    const validData = {
      page: 1000,
      pageSize: 100,
      totalPages: 10000,
      totalItems: 1000000,
    };

    const result = paginationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('Combined Schemas Usage', () => {
  it('should work with success response containing pagination', () => {
    const paginatedResponseSchema = apiSuccessResponseSchema(
      z.object({
        items: z.array(z.string()),
        pagination: paginationSchema,
      })
    );

    const validData = {
      success: true,
      data: {
        items: ['item1', 'item2', 'item3'],
        pagination: {
          page: 1,
          pageSize: 3,
          totalPages: 10,
          totalItems: 30,
        },
      },
    };

    const result = paginatedResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
