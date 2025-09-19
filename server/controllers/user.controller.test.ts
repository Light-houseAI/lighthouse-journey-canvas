/**
 * User Controller API Endpoint Tests
 *
 * Modern test suite using interface-based mocking for user search system.
 * Tests search endpoints, validation, and error handling.
 */

import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { UserService } from '../services/user-service';
import { UserController } from './user.controller';

// Mock request/response
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: '/api/v2/users/search',
    method: 'GET',
    query: {},
    user: { id: 1, email: 'test@example.com' },
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

describe('UserController API Endpoints', () => {
  let controller: UserController;
  let mockUserService: MockProxy<UserService>;
  let mockLogger: any;

  const createTestUser = (overrides: any = {}) => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userName: 'testuser',
    title: 'Engineer',
    company: 'Tech Co',
    avatarUrl: 'https://example.com/avatar.jpg',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.restoreAllMocks();
    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create MockProxy instance for type-safe mocking
    mockUserService = mock<UserService>();

    // Create controller instance with mocks
    controller = new UserController({
      userService: mockUserService,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search Users Endpoint', () => {
    test('should return users for valid search query', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'john' } });
      const res = createMockResponse();
      const mockUsers = [
        createTestUser({ firstName: 'John', lastName: 'Doe' }),
        createTestUser({ id: 2, firstName: 'Johnny', lastName: 'Smith' }),
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith('john');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 1,
            email: 'test@example.com',
            userName: 'testuser',
            firstName: 'John',
            lastName: 'Doe',
            title: 'Engineer',
            company: 'Tech Co',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          {
            id: 2,
            email: 'test@example.com',
            userName: 'testuser',
            firstName: 'Johnny',
            lastName: 'Smith',
            title: 'Engineer',
            company: 'Tech Co',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        ],
        count: 2,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User search performed',
        expect.objectContaining({
          searchQuery: 'john',
          userId: 1,
          resultsCount: 2,
        })
      );
    });

    test('should handle empty optional fields gracefully', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'test' } });
      const res = createMockResponse();
      const mockUsers = [
        {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userName: 'testuser',
          title: null,
          company: null,
          avatarUrl: null,
        },
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);
      let capturedResponse: any;
      res.json.mockImplementation((data) => {
        capturedResponse = data;
        return res;
      });

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(capturedResponse.data[0]).toEqual({
        id: 1,
        email: 'test@example.com',
        userName: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        title: '',
        company: '',
        avatarUrl: '',
      });
    });

    test('should return 400 for missing query parameter', async () => {
      // Arrange
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request parameters',
        details: expect.any(Array),
      });
      expect(mockUserService.searchUsers).not.toHaveBeenCalled();
    });

    test('should return 400 for empty query parameter', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: '' } });
      const res = createMockResponse();

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request parameters',
        details: expect.any(Array),
      });
    });

    test('should return 400 for query that is too long', async () => {
      // Arrange
      const longQuery = 'a'.repeat(101);
      const req = createMockRequest({ query: { q: longQuery } });
      const res = createMockResponse();

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid request parameters',
        details: expect.any(Array),
      });
    });

    test('should return 401 for unauthenticated request', async () => {
      // Arrange
      const req = createMockRequest({
        query: { q: 'test' },
        user: undefined, // No authenticated user
      });
      const res = createMockResponse();

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    test('should handle service errors gracefully', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'test' } });
      const res = createMockResponse();
      const error = new Error('Service unavailable');

      mockUserService.searchUsers.mockRejectedValue(error);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to search users',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error searching users',
        expect.objectContaining({
          query: 'test',
          userId: 1,
          error: 'Service unavailable',
        })
      );
    });

    test('should return empty array for no matches', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'nonexistent' } });
      const res = createMockResponse();

      mockUserService.searchUsers.mockResolvedValue([]);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        count: 0,
      });
    });

    test('should handle special characters in search query', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: "O'Neill" } });
      const res = createMockResponse();
      const mockUsers = [
        createTestUser({ firstName: "O'Neill", lastName: 'Smith' }),
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith("O'Neill");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
        count: 1,
      });
    });
  });
});
