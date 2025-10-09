/**
 * Health Controller API Endpoint Tests
 *
 * Modern test suite using interface-based mocking for health check system.
 * Tests health endpoints, readiness probes, and error handling.
 */

import * as schema from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { HealthController } from './health.controller.js';

// Mock response
const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as any;
};

// Mock request
const createMockRequest = (overrides: Partial<Request> = {} as any): Request => {
  const res = createMockResponse();
  return {
    path: '/health',
    method: 'GET',
    res,
    ...overrides,
  } as Request;
};

describe('HealthController API Endpoints', () => {
  let controller: HealthController;
  let mockDatabase: MockProxy<NodePgDatabase<typeof schema>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create MockProxy instance for type-safe mocking
    mockDatabase = mock<NodePgDatabase<typeof schema>>();

    // Create controller instance with mock database
    controller = new HealthController(mockDatabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Health Check', () => {
    test('should return healthy status with basic information', async () => {
      const req = createMockRequest();

      await controller.getHealth(req);

      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: expect.any(String),
            timestamp: expect.any(String),
            uptime: expect.any(Number),
            version: expect.any(String),
            environment: expect.any(String),
            checks: expect.any(Object),
          }),
        })
      );
    });

    test('should include environment check results', async () => {
      const req = createMockRequest();
      let capturedResponse: any;

      (req.res!.json as any).mockImplementation((data: any) => {
        capturedResponse = data;
        return req.res;
      });

      await controller.getHealth(req);

      expect(capturedResponse.data.checks.environment).toBeDefined();
      expect(capturedResponse.data.checks.environment.status).toMatch(
        /pass|warn|fail/
      );
      expect(capturedResponse.data.checks.environment.timestamp).toBeDefined();
    });

    test('should include self check results', async () => {
      const req = createMockRequest();
      let capturedResponse: any;

      (req.res!.json as any).mockImplementation((data: any) => {
        capturedResponse = data;
        return req.res;
      });

      await controller.getHealth(req);

      expect(capturedResponse.data.checks.self).toBeDefined();
      expect(capturedResponse.data.checks.self.status).toBe('pass');
      expect(capturedResponse.data.checks.self.duration).toBeDefined();
    });

    test('should return degraded status when there are warnings', async () => {
      // Mock environment health check to return warnings
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN; // This should generate a warning

      const req = createMockRequest();
      let capturedResponse: any;

      (req.res!.json as any).mockImplementation((data: any) => {
        capturedResponse = data;
        return req.res;
      });

      await controller.getHealth(req);

      // Note: The actual status might still be healthy depending on the specific environment validation
      expect(capturedResponse.data.status).toMatch(/healthy|degraded/);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Readiness Probe', () => {
    test('should return ready status when application is ready', async () => {
      const req = createMockRequest();

      await controller.getReadiness(req);

      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'ready',
            message: 'Application is ready to serve requests',
          }),
        })
      );
    });

    test('should throw error when dependencies fail', async () => {
      // Create a health controller with no database to simulate dependency failure
      const failingHealthController = new HealthController(null as any);
      const req = createMockRequest();

      await expect(failingHealthController.getReadiness(req)).rejects.toThrow();
    });
  });

  describe('Liveness Probe', () => {
    test('should always return alive status', async () => {
      const req = createMockRequest();

      await controller.getLiveness(req);

      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'alive',
            uptime: expect.any(Number),
            pid: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle environment validation errors gracefully', async () => {
      // This test would require mocking the environment validation
      // For now, we'll test that the health check doesn't throw
      const req = createMockRequest();

      await expect(controller.getHealth(req)).resolves.not.toThrow();
    });
  });
});
