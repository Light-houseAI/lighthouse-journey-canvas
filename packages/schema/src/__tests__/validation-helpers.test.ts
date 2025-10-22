/**
 * Validation Helpers Tests
 *
 * Tests for validateResponse() and error tracking functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  formatValidationErrors,
  validateRequest,
  validateResponse,
  type ValidationErrorContext,
} from '../api/validation-helpers';

describe('formatValidationErrors', () => {
  it('should format simple validation errors', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = schema.safeParse({ name: 123, age: 'invalid' });
    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result.error);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        field: 'name',
        message: expect.stringContaining('string'),
      });
      expect(errors[1]).toMatchObject({
        field: 'age',
        message: expect.stringContaining('number'),
      });
    }
  });

  it('should format nested validation errors', () => {
    const schema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });

    const result = schema.safeParse({ user: { email: 'invalid' } });
    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result.error);
      expect(errors[0].field).toBe('user.email');
    }
  });

  it('should format array validation errors with bracket notation', () => {
    const schema = z.object({
      items: z.array(z.number()),
    });

    const result = schema.safeParse({ items: [1, 'invalid', 3] });
    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatValidationErrors(result.error);
      expect(errors[0].field).toBe('items[1]');
    }
  });
});

describe('validateRequest', () => {
  it('should return validated data on success', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 'test' };

    const result = validateRequest(schema, data);
    expect(result).toEqual(data);
  });

  it('should throw formatted error on validation failure', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 123 };

    expect(() => validateRequest(schema, data)).toThrow(
      /Validation failed.*name/
    );
  });
});

describe('validateResponse', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should return validated data on success', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 'test' };

    const result = validateResponse(schema, data);
    expect(result).toEqual(data);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should always throw on validation failure', () => {
    process.env.NODE_ENV = 'production';
    const schema = z.object({ name: z.string() });
    const data = { name: 123 };

    expect(() => validateResponse(schema, data)).toThrow(
      /Response validation failed/
    );
  });

  it('should log structured error context on failure', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 123 };

    try {
      validateResponse(schema, data, { schemaName: 'TestSchema' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Response Validation Failed]',
      expect.objectContaining({
        schema: 'TestSchema',
        errorCount: 1,
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: expect.any(String),
          }),
        ]),
        environment: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });

  it('should call onError callback when provided', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 123 };
    const onError = vi.fn();

    try {
      validateResponse(schema, data, { onError });
    } catch {
      // Expected to throw
    }

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining<ValidationErrorContext>({
        timestamp: expect.any(String),
        environment: expect.any(String),
        errorCount: 1,
        errors: expect.any(Array),
        sampleData: expect.any(String),
      })
    );
  });

  it('should truncate large data for privacy', () => {
    const schema = z.object({ data: z.number() }); // Expect number, will fail
    const largeData = { data: 'x'.repeat(300) }; // Provide string - invalid!
    const onError = vi.fn();

    try {
      validateResponse(schema, largeData, { onError });
    } catch {
      // Expected to throw
    }

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleData: expect.stringMatching(/\.\.\./),
      })
    );

    const context = onError.mock.calls[0][0] as ValidationErrorContext;
    expect(context.sampleData?.length).toBeLessThanOrEqual(203); // 200 + '...'
  });

  it('should include schema name in error context', () => {
    const schema = z.object({ name: z.string() });
    const data = { name: 123 };

    try {
      validateResponse(schema, data, { schemaName: 'UserSchema' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        schema: 'UserSchema',
      })
    );
  });

  it('should handle non-serializable data gracefully', () => {
    const schema = z.object({ fn: z.function() });
    const circular: any = {};
    circular.self = circular;
    const onError = vi.fn();

    try {
      validateResponse(schema, circular, { onError });
    } catch {
      // Expected to throw
    }

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleData: '[Unable to serialize data]',
      })
    );
  });
});
