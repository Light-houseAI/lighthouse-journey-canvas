import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';

let app: Application;

describe('Health Check Endpoints', () => {
  beforeAll(async () => {
    // Create the app (logging automatically silenced in test environment)
    app = await createApp();
  });

  afterAll(async () => {
    // Cleanup container
    await Container.dispose();
  });
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });

    it('should respond within 100ms', async () => {
      const start = Date.now();

      await request(app).get('/api/health').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should include database health check', async () => {
      const response = await request(app).get('/api/health').expect(200);

      const body = response.body;

      if (body.checks) {
        expect(body.checks).toHaveProperty('database');
        expect(body.checks.database).toHaveProperty('status');
        expect(['pass', 'fail']).toContain(body.checks.database.status);

        if (body.checks.database.status === 'pass') {
          expect(body.checks.database).toHaveProperty('responseTime');
          expect(typeof body.checks.database.responseTime).toBe('number');
        }
      }
    });
  });

  describe('GET /live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/api/live')
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body).toHaveProperty('status', 'alive');
    });

    it('should respond very quickly (under 50ms)', async () => {
      const start = Date.now();

      await request(app).get('/api/live').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/api/ready')
        .expect(200)
        .expect('Content-Type', /json/);

      const body = response.body;

      expect(body).toHaveProperty('status', 'ready');
    });

    it('should respond quickly (under 200ms)', async () => {
      const start = Date.now();

      await request(app).get('/api/ready').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });
});
