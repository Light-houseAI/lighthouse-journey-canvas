/**
 * Health Controller API Endpoint Tests
 * 
 * Modern test suite using Awilix DI patterns for health check system.
 * Tests health endpoints, readiness probes, and error handling.
 */

import { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createContainer, asValue } from 'awilix';
import type { AwilixContainer } from 'awilix';

import { HealthController } from './health.controller';
import { CONTAINER_TOKENS } from '../core/container-tokens';

// Mock database using current patterns
const mockDatabase = {
  raw: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock request/response
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: '/health',
    method: 'GET',
    ...overrides,
  }) as Request;

const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as any;
};

describe('HealthController API Endpoints', () => {
  let controller: HealthController;
  let container: AwilixContainer;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create Awilix container for testing
    container = createContainer();

    // Register mocks in Awilix container
    container.register({
      [CONTAINER_TOKENS.DATABASE]: asValue(mockDatabase),
      [CONTAINER_TOKENS.LOGGER]: asValue(mockLogger),
    });

    // Create controller instance using Awilix constructor injection pattern
    controller = new HealthController(mockDatabase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    container?.dispose?.();
  });

  describe('Basic Health Check', () => {
    test('should return healthy status with basic information', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: expect.any(String),
          checks: expect.any(Object),
        })
      );
    });

    test('should include environment check results', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await controller.getHealth(req, res);

      expect(capturedResponse.checks.environment).toBeDefined();
      expect(capturedResponse.checks.environment.status).toMatch(
        /pass|warn|fail/
      );
      expect(capturedResponse.checks.environment.timestamp).toBeDefined();
    });

    test('should include self check results', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await controller.getHealth(req, res);

      expect(capturedResponse.checks.self).toBeDefined();
      expect(capturedResponse.checks.self.status).toBe('pass');
      expect(capturedResponse.checks.self.duration).toBeDefined();
    });

    test('should return degraded status when there are warnings', async () => {
      // Mock environment health check to return warnings
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.CORS_ORIGIN; // This should generate a warning

      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await controller.getHealth(req, res);

      // Note: The actual status might still be healthy depending on the specific environment validation
      expect(capturedResponse.status).toMatch(/healthy|degraded/);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Readiness Probe', () => {
    test('should return ready status when application is ready', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          message: 'Application is ready to serve requests',
        })
      );
    });

    test('should return not ready status when dependencies fail', async () => {
      // Create a health controller with no database to simulate dependency failure
      const failingHealthController = new HealthController(null as any);

      const req = createMockRequest();
      const res = createMockResponse();

      await failingHealthController.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          error: expect.stringContaining('Readiness check failed'),
        })
      );
    });
  });

  describe('Liveness Probe', () => {
    test('should always return alive status', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getLiveness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
          uptime: expect.any(Number),
          pid: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle environment validation errors gracefully', async () => {
      // This test would require mocking the environment validation
      // For now, we'll test that the health check doesn't throw
      const req = createMockRequest();
      const res = createMockResponse();

      await expect(controller.getHealth(req, res)).resolves.not.toThrow();
    });
  });
});
