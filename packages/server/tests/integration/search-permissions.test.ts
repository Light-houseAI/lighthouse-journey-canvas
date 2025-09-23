/**
 * Integration tests for search API permission filtering (LIG-179)
 *
 * Ensures that search APIs respect node permissions similar to the profile page.
 * Tests that users can only see nodes they have permission to access.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { testDb, testUsers, testNodes, setupTestData, cleanupTestData } from '../fixtures/test-data';

describe('Search API Permission Filtering', () => {
  let authTokenUser1: string;
  let authTokenUser2: string;
  let privateNodeId: string;
  let publicNodeId: string;
  let sharedNodeId: string;

  beforeAll(async () => {
    // Setup test database and data
    await setupTestData();

    // Create test users
    const user1 = await testUsers.createUser({
      email: 'user1@test.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    });

    const user2 = await testUsers.createUser({
      email: 'user2@test.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Smith'
    });

    // Login to get auth tokens
    const loginRes1 = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'user1@test.com', password: 'password123' });
    authTokenUser1 = loginRes1.body.data.token;

    const loginRes2 = await request(app)
      .post('/api/v2/auth/login')
      .send({ email: 'user2@test.com', password: 'password123' });
    authTokenUser2 = loginRes2.body.data.token;

    // Create nodes with different permission levels
    // User1's private node
    const privateNode = await testNodes.createNode(user1.id, {
      type: 'job',
      meta: {
        company: 'Private Company',
        role: 'Software Engineer',
        description: 'Working on confidential projects'
      }
    });
    privateNodeId = privateNode.id;

    // User1's public node
    const publicNode = await testNodes.createNode(user1.id, {
      type: 'job',
      meta: {
        company: 'Public Company',
        role: 'Senior Developer',
        description: 'Open source contributions'
      }
    });
    publicNodeId = publicNode.id;
    await testNodes.setNodePermission(publicNodeId, 'public', 'view');

    // User1's node shared with User2
    const sharedNode = await testNodes.createNode(user1.id, {
      type: 'education',
      meta: {
        institution: 'MIT',
        degree: 'Computer Science',
        description: 'Advanced AI research'
      }
    });
    sharedNodeId = sharedNode.id;
    await testNodes.setNodePermission(sharedNodeId, user2.id, 'view');
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GraphRAG Search Permissions', () => {
    it('should only return nodes the requesting user has permission to view', async () => {
      // User2 searches for nodes
      const response = await request(app)
        .post('/api/v2/graphrag/search')
        .set('Authorization', `Bearer ${authTokenUser2}`)
        .send({
          query: 'software engineer developer',
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const profiles = response.body.data.profiles;
      const allNodes = profiles.flatMap(p => p.matchedNodes);
      const nodeIds = allNodes.map(n => n.id);

      // User2 should NOT see User1's private node
      expect(nodeIds).not.toContain(privateNodeId);

      // User2 SHOULD see the public node
      expect(nodeIds).toContain(publicNodeId);

      // User2 SHOULD see the shared node
      expect(nodeIds).toContain(sharedNodeId);
    });

    it('should allow users to see all their own nodes', async () => {
      // User1 searches for their own nodes
      const response = await request(app)
        .post('/api/v2/graphrag/search')
        .set('Authorization', `Bearer ${authTokenUser1}`)
        .send({
          query: 'software engineer developer MIT',
          limit: 10
        });

      expect(response.status).toBe(200);

      const profiles = response.body.data.profiles;
      const allNodes = profiles.flatMap(p => p.matchedNodes);
      const nodeIds = allNodes.map(n => n.id);

      // User1 should see all their own nodes
      expect(nodeIds).toContain(privateNodeId);
      expect(nodeIds).toContain(publicNodeId);
      expect(nodeIds).toContain(sharedNodeId);
    });
  });

  describe('Experience Matches Permissions', () => {
    it('should enforce permissions when fetching experience matches', async () => {
      // User2 tries to get matches for User1's private node - should fail
      const privateResponse = await request(app)
        .get(`/api/v2/experience/${privateNodeId}/matches`)
        .set('Authorization', `Bearer ${authTokenUser2}`);

      expect(privateResponse.status).toBe(404);
      expect(privateResponse.body.success).toBe(false);
      expect(privateResponse.body.error.code).toBe('NODE_NOT_FOUND');

      // User2 tries to get matches for the shared node - should succeed
      const sharedResponse = await request(app)
        .get(`/api/v2/experience/${sharedNodeId}/matches`)
        .set('Authorization', `Bearer ${authTokenUser2}`);

      expect(sharedResponse.status).toBe(200);
      expect(sharedResponse.body.success).toBe(true);
    });

    it('should filter matched nodes based on permissions', async () => {
      // Create a current experience for User2
      const user2CurrentJob = await testNodes.createNode(user2.id, {
        type: 'job',
        meta: {
          company: 'Tech Corp',
          role: 'Lead Engineer',
          description: 'Leading engineering team',
          current: true
        }
      });

      // User2 gets matches for their current job
      const response = await request(app)
        .get(`/api/v2/experience/${user2CurrentJob.id}/matches`)
        .set('Authorization', `Bearer ${authTokenUser2}`);

      expect(response.status).toBe(200);

      if (response.body.data.profiles.length > 0) {
        const matchedNodes = response.body.data.profiles.flatMap(p => p.matchedNodes);
        const nodeIds = matchedNodes.map(n => n.id);

        // Should not include User1's private nodes
        expect(nodeIds).not.toContain(privateNodeId);

        // May include public or shared nodes
        // (depends on whether they match the search query)
      }
    });
  });

  describe('User Search Permissions', () => {
    it('should return users but respect node visibility in profiles', async () => {
      // User search doesn't filter users, but profile data should respect permissions
      const response = await request(app)
        .get('/api/v2/users/search?q=john')
        .set('Authorization', `Bearer ${authTokenUser2}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // User search returns basic user info (no node filtering at this level)
      const users = response.body.data;
      const johnDoe = users.find(u => u.email === 'user1@test.com');

      if (johnDoe) {
        // experienceLine should only show public/shared experience
        expect(johnDoe.experienceLine).toBeDefined();
        // Should not contain private company info
        expect(johnDoe.experienceLine).not.toContain('Private Company');
      }
    });
  });
});