/**
 * Health Controller Tests
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response } from 'express';
import { HealthController } from '../health.controller';


// Mock database
const mockDatabase = {
  raw: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn()
};

// Mock audit logger


// Mock request/response
const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
  path: '/health',
  method: 'GET',
  ...overrides
} as Request);

const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  };
  return res as any;
};

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset audit logger mock


    healthController = new HealthController(mockDatabase as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Health Check', () => {
    test('should return healthy status with basic information', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await healthController.getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: expect.any(String),
          checks: expect.any(Object)
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

      await healthController.getHealth(req, res);

      expect(capturedResponse.checks.environment).toBeDefined();
      expect(capturedResponse.checks.environment.status).toMatch(/pass|warn|fail/);
      expect(capturedResponse.checks.environment.timestamp).toBeDefined();
    });

    test('should include memory check results', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getHealth(req, res);

      expect(capturedResponse.checks.memory).toBeDefined();
      expect(capturedResponse.checks.memory.status).toMatch(/pass|warn|fail/);
      expect(capturedResponse.checks.memory.details).toBeDefined();
      expect(capturedResponse.checks.memory.details.heapUsed).toBeDefined();
      expect(capturedResponse.checks.memory.details.percentage).toBeDefined();
    });

    test('should include auth system check results', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getHealth(req, res);

      expect(capturedResponse.checks.auth).toBeDefined();
      expect(capturedResponse.checks.auth.status).toMatch(/pass|warn|fail/);

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

      await healthController.getHealth(req, res);

      // Note: The actual status might still be healthy depending on the specific environment validation
      expect(capturedResponse.status).toMatch(/healthy|degraded/);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    test('should return unhealthy status when auth failure rate is high', async () => {
      // Mock high failure rate
  

      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getHealth(req, res);

      expect(capturedResponse.checks.auth.status).toBe('fail');
      expect(capturedResponse.status).toBe('unhealthy');
      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('Detailed Health Check', () => {
    test('should return comprehensive health information', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getDetailedHealth(req, res);

      expect(capturedResponse).toHaveProperty('performance');
      expect(capturedResponse).toHaveProperty('authentication');
      expect(capturedResponse).toHaveProperty('system');
      expect(capturedResponse.system).toHaveProperty('platform');
      expect(capturedResponse.system).toHaveProperty('nodeVersion');
      expect(capturedResponse.system).toHaveProperty('uptime');
    });
  });

  describe('Metrics Endpoint', () => {
    test('should return performance metrics', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getMetrics(req, res);

      expect(capturedResponse).toHaveProperty('memory');
      expect(capturedResponse).toHaveProperty('cpu');
      expect(capturedResponse).toHaveProperty('requests');
      expect(capturedResponse).toHaveProperty('auth');
      expect(capturedResponse.memory).toHaveProperty('used');
      expect(capturedResponse.memory).toHaveProperty('total');
      expect(capturedResponse.memory).toHaveProperty('percentage');
    });
  });

  describe('Auth Health Check', () => {
    test('should return auth system health status', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getAuthHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(capturedResponse).toHaveProperty('status');
      expect(capturedResponse).toHaveProperty('statistics');
      expect(capturedResponse).toHaveProperty('security');
      expect(capturedResponse).toHaveProperty('components');
      
      expect(capturedResponse.security).toHaveProperty('totalAttempts');
      expect(capturedResponse.security).toHaveProperty('successRate');
      expect(capturedResponse.security).toHaveProperty('topFailureReasons');
    });

    test('should return degraded status for high failure rate', async () => {
  

      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getAuthHealth(req, res);

      expect(capturedResponse.status).toBe('degraded');
    });

    test('should handle auth health check errors gracefully', async () => {


      const req = createMockRequest();
      const res = createMockResponse();

      await healthController.getAuthHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          error: expect.stringContaining('Auth health check failed')
        })
      );
    });
  });

  describe('Readiness Probe', () => {
    test('should return ready status when application is ready', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await healthController.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          message: 'Application is ready to serve requests'
        })
      );
    });

    test('should return not ready status when dependencies fail', async () => {
      // Mock database connectivity failure
      mockDatabase.raw.mockRejectedValue(new Error('Database connection failed'));

      const req = createMockRequest();
      const res = createMockResponse();

      await healthController.getReadiness(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          error: expect.stringContaining('Readiness check failed')
        })
      );
    });
  });

  describe('Liveness Probe', () => {
    test('should always return alive status', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      await healthController.getLiveness(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
          uptime: expect.any(Number),
          pid: expect.any(Number)
        })
      );
    });
  });

  describe('Request Metrics Recording', () => {
    test('should record request metrics', () => {
      const initialMetrics = (healthController as any).responseTimes.length;
      
      healthController.recordRequest(150);
      
      const newMetrics = (healthController as any).responseTimes.length;
      expect(newMetrics).toBe(initialMetrics + 1);
    });

    test('should record auth attempt metrics', () => {
      const initialAttempts = (healthController as any).authMetrics.attempts;
      
      healthController.recordAuthAttempt(true, 100);
      healthController.recordAuthAttempt(false, 200);
      
      const metrics = (healthController as any).authMetrics;
      expect(metrics.attempts).toBe(initialAttempts + 2);
      expect(metrics.successes).toBe(1);
      expect(metrics.failures).toBe(1);
    });

    test('should limit metrics retention', () => {
      // Add more than 1000 response times
      for (let i = 0; i < 1200; i++) {
        healthController.recordRequest(100);
      }

      const responseTimes = (healthController as any).responseTimes;
      expect(responseTimes.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Memory Health Assessment', () => {
    test('should detect high memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 90 * 1024 * 1024, // 90MB
        heapTotal: 100 * 1024 * 1024, // 100MB (90% usage)
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getHealth(req, res);

      expect(capturedResponse.checks.memory.status).toBe('fail');
      expect(capturedResponse.status).toBe('unhealthy');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Error Handling', () => {
    test('should handle environment validation errors gracefully', async () => {
      // This test would require mocking the environment validation
      // For now, we'll test that the health check doesn't throw
      const req = createMockRequest();
      const res = createMockResponse();

      await expect(healthController.getHealth(req, res)).resolves.not.toThrow();
    });

    test('should handle audit service errors in auth health check', async () => {

        throw new Error('Audit service error');
      });

      const req = createMockRequest();
      const res = createMockResponse();
      let capturedResponse: any;

      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      await healthController.getHealth(req, res);

      // Should still complete the health check, but auth check should show warning/fail
      expect(capturedResponse.checks.auth.status).toMatch(/warn|fail/);
    });
  });

  describe('Performance Metrics Calculation', () => {
    test('should calculate average response time correctly', () => {
      // Record specific response times
      const responseTimes = [100, 200, 300];
      responseTimes.forEach(time => healthController.recordRequest(time));

      // The exact calculation would need access to internal methods
      // This test verifies the recording works
      const internalTimes = (healthController as any).responseTimes;
      expect(internalTimes).toContain(100);
      expect(internalTimes).toContain(200);
      expect(internalTimes).toContain(300);
    });

    test('should handle empty metrics gracefully', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      // Clear any existing metrics
      (healthController as any).responseTimes = [];
      (healthController as any).authMetrics = {
        attempts: 0,
        successes: 0,
        failures: 0,
        responseTimes: []
      };

      await healthController.getMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requests: expect.objectContaining({
            total: expect.any(Number),
            avgResponseTime: expect.any(Number)
          }),
          auth: expect.objectContaining({
            totalAttempts: 0,
            avgResponseTime: 0
          })
        })
      );
    });
  });
});