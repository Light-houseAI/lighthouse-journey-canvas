/**
 * Health Check Schema Tests
 * Tests for health monitoring endpoint schemas
 */

import { describe, expect, it } from 'vitest';

import {
  healthCheckResponseSchema,
  livenessSchema,
  readinessSchema,
} from '../health.schemas';

describe('healthCheckResponseSchema', () => {
  it('should validate minimal health check response', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate complete health check response', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 12345.678,
      version: '1.0.0',
      environment: 'production',
      service: 'api-server',
      pid: 1234,
      stats: {
        memoryUsage: 123456,
        cpuUsage: 45.5,
      },
      checks: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
      },
      features: {
        featureA: true,
        featureB: false,
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with degraded status', () => {
    const validData = {
      status: 'degraded',
      timestamp: '2024-01-01T00:00:00Z',
      checks: {
        database: { status: 'slow' },
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with unhealthy status', () => {
    const validData = {
      status: 'unhealthy',
      timestamp: '2024-01-01T00:00:00Z',
      checks: {
        database: { status: 'down', error: 'Connection refused' },
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalidData = {
      status: 'invalid-status',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = healthCheckResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalidData = {
      status: 'healthy',
    };

    const result = healthCheckResponseSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow complex nested stats', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      stats: {
        memory: {
          used: 123456,
          total: 1000000,
          percentage: 12.3,
        },
        requests: {
          total: 12345,
          perSecond: 100,
        },
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should allow complex nested checks', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      checks: {
        database: {
          status: 'ok',
          responseTime: 15,
          connections: 10,
        },
        cache: {
          status: 'ok',
          hitRate: 95.5,
        },
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should allow complex nested features', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      features: {
        experimental: {
          featureA: true,
          featureB: false,
        },
        beta: {
          featureC: 'enabled',
        },
      },
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('readinessSchema', () => {
  it('should validate ready status', () => {
    const validData = {
      status: 'ready',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = readinessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate not ready status', () => {
    const validData = {
      status: 'not ready',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = readinessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with message', () => {
    const validData = {
      status: 'ready',
      timestamp: '2024-01-01T00:00:00Z',
      message: 'All systems operational',
    };

    const result = readinessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with error', () => {
    const validData = {
      status: 'not ready',
      timestamp: '2024-01-01T00:00:00Z',
      error: 'Database connection failed',
    };

    const result = readinessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with both message and error', () => {
    const validData = {
      status: 'not ready',
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Service starting up',
      error: 'Warming up cache',
    };

    const result = readinessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalidData = {
      status: 'maybe ready',
      timestamp: '2024-01-01T00:00:00Z',
    };

    const result = readinessSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing timestamp', () => {
    const invalidData = {
      status: 'ready',
    };

    const result = readinessSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('livenessSchema', () => {
  it('should validate complete liveness response', () => {
    const validData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 12345.678,
      pid: 1234,
    };

    const result = livenessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject status other than alive', () => {
    const invalidData = {
      status: 'dead',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 12345,
      pid: 1234,
    };

    const result = livenessSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing uptime', () => {
    const invalidData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      pid: 1234,
    };

    const result = livenessSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing pid', () => {
    const invalidData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 12345,
    };

    const result = livenessSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should accept floating point uptime', () => {
    const validData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 12345.123456,
      pid: 1234,
    };

    const result = livenessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept zero uptime (just started)', () => {
    const validData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 0,
      pid: 1,
    };

    const result = livenessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('Edge Cases', () => {
  it('should handle very large uptime values', () => {
    const validData = {
      status: 'alive',
      timestamp: '2024-01-01T00:00:00Z',
      uptime: 9999999999,
      pid: 1234,
    };

    const result = livenessSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should handle empty stats object', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      stats: {},
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should handle empty checks object', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      checks: {},
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should handle empty features object', () => {
    const validData = {
      status: 'healthy',
      timestamp: '2024-01-01T00:00:00Z',
      features: {},
    };

    const result = healthCheckResponseSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
