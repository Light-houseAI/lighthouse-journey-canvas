import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { Container } from '../../src/core/container-setup';
import {
  authenticateSeededUser,
  type TestAuthSession,
} from '../helpers/auth.helper';

let app: Application;
let authSession: TestAuthSession;

interface OrganizationSearchResponse {
  success: boolean;
  data: {
    organizations: Array<{
      id: number;
      name: string;
      type: string;
      metadata: Record<string, any>;
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

describe('Organizations API', () => {
  beforeAll(async () => {
    app = await createApp();
    authSession = await authenticateSeededUser(app);
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('GET /api/organizations/search', () => {
    it('should search organizations by name', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ q: 'TechCorp' })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const body = response.body as OrganizationSearchResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.organizations)).toBe(true);
      expect(typeof body.data.pagination).toBe('object');
      expect(body.data.pagination.page).toBeDefined();
      expect(body.data.pagination.limit).toBeDefined();
      expect(body.data.pagination.total).toBeDefined();
    });

    it('should return fuzzy matches for partial company names', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ q: 'tech' })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const body = response.body as OrganizationSearchResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.organizations)).toBe(true);
      
      // Should include organizations with 'tech' in the name
      const hasMatchingOrg = body.data.organizations.some(org => 
        org.name.toLowerCase().includes('tech')
      );
      expect(hasMatchingOrg).toBe(true);
    });

    it('should handle empty search query', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ q: '' })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const body = response.body as OrganizationSearchResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.organizations)).toBe(true);
      expect(body.data.organizations.length).toBe(0);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ 
          q: 'company',
          page: '2',
          limit: '5'
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(200);

      const body = response.body as OrganizationSearchResponse;
      expect(body.success).toBe(true);
      expect(body.data.pagination.page).toBe(2);
      expect(body.data.pagination.limit).toBe(5);
    });

    it('should return 400 for invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ 
          q: 'test',
          page: 'invalid',
          limit: '0'
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/organizations/search')
        .query({ q: 'test' })
        .expect(401);

      const body = response.body as ErrorResponse;
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should create new organization when not found', async () => {
      const uniqueCompanyName = `NewCompany${Date.now()}`;
      
      const response = await request(app)
        .post('/api/organizations')
        .send({
          name: uniqueCompanyName,
          type: 'Company'
        })
        .set('Authorization', `Bearer ${authSession.accessToken}`)
        .expect(201);

      const body = response.body;
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(uniqueCompanyName);
      expect(body.data.type).toBe('Company');
    });
  });
});