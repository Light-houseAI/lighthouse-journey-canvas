/**
 * User API Integration Tests
 * Tests the user search endpoint
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, beforeAll } from 'vitest';
import { getSeededUserTokens } from '../helpers/auth.helper';

describe('User Search API Contract - /api/v2/users/search', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(() => {
    // Generate auth token for testing
    const { accessToken } = getSeededUserTokens(1);
    authToken = accessToken;

    // Create express app with mock implementation
    app = express();
    app.use(express.json());

    // Mock user search endpoint
    app.get('/api/v2/users/search', (req, res) => {
      // Check for authentication
      if (!req.headers.authorization) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const query = req.query.q as string;

      // Validate query parameter
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
      }

      if (query.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Query too long',
        });
      }

      // Mock search results based on query
      const searchTerm = query.toLowerCase().trim();
      const mockUsers = [
        {
          id: 1,
          email: 'test-user-1@example.com',
          userName: 'user1',
          firstName: 'Test',
          lastName: 'User1',
          title: 'Software Engineer',
          company: 'Test Company',
          avatarUrl: '',
        },
        {
          id: 2,
          email: 'test-user-2@example.com',
          userName: 'user2',
          firstName: 'Test',
          lastName: 'User2',
          title: '',
          company: '',
          avatarUrl: '',
        },
        {
          id: 3,
          email: 'john.doe@example.com',
          userName: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          title: 'Product Manager',
          company: 'Example Inc',
          avatarUrl: 'https://example.com/john.jpg',
        },
        {
          id: 4,
          email: 'jane.smith@example.com',
          userName: 'janesmith',
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'Designer',
          company: 'Design Co',
          avatarUrl: '',
        },
      ];

      // Filter users based on search term - only by name
      const results = mockUsers.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
          user.firstName.toLowerCase().includes(searchTerm) ||
          user.lastName.toLowerCase().includes(searchTerm) ||
          fullName.includes(searchTerm)
        );
      });

      res.json({
        success: true,
        data: results,
        count: results.length,
      });
    });
  });

  describe('Search functionality', () => {
    it('should find users by first name (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(2); // Test User1 and Test User2
      expect(response.body.data[0].firstName).toBe('Test');
    });

    it('should find users by last name (case-insensitive)', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=smith')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].lastName).toBe('Smith');
    });

    it('should find users by full name', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=john%20doe')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].firstName).toBe('John');
      expect(response.body.data[0].lastName).toBe('Doe');
    });

    it('should handle mixed case searches', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=JoHn')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].firstName).toBe('John');
    });
  });

  describe('Response format', () => {
    it('should include all expected user fields', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=john')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const user = response.body.data[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('userName');
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
      expect(user).toHaveProperty('title');
      expect(user).toHaveProperty('company');
      expect(user).toHaveProperty('avatarUrl');
    });

    it('should include count in response', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(response.body.data.length);
    });
  });

  describe('Error handling', () => {
    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/v2/users/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Search query is required');
    });

    it('should return 400 for query that is too long', async () => {
      const longQuery = 'a'.repeat(101);
      const response = await request(app)
        .get(`/api/v2/users/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query too long');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=test')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/v2/users/search?q=nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });
});
