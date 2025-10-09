/**
 * User Controller API Endpoint Tests
 *
 * Modern test suite using interface-based mocking for user search system.
 * Tests search endpoints, validation, and error handling.
 */

import { AuthenticationError,ValidationError } from '@journey/schema';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { UserService } from '../services/user-service';
import { UserController } from './user.controller.js';

// Mock request/response
const createMockRequest = (overrides: Partial<Request> = {} as any): Request =>
  ({
    path: '/api/v2/users/search',
    method: 'GET',
    query: {} as any,
    user: { id: 1, email: 'test@example.com' } as any,
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

  const createTestUser = (overrides: any = {} as any) => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userName: 'testuser',
    experienceLine: 'Engineer at Tech Co',
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
      const req = createMockRequest({ query: { q: 'john' } as any });
      const res = createMockResponse();
      const mockUsers = [
        createTestUser({ firstName: 'John', lastName: 'Doe' } as any),
        createTestUser({
          id: 2,
          firstName: 'Johnny',
          lastName: 'Smith',
        } as any),
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith('john');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          data: [
            {
              id: 1,
              email: 'test@example.com',
              userName: 'testuser',
              firstName: 'John',
              lastName: 'Doe',
              experienceLine: 'Engineer at Tech Co',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
            {
              id: 2,
              email: 'test@example.com',
              userName: 'testuser',
              firstName: 'Johnny',
              lastName: 'Smith',
              experienceLine: 'Engineer at Tech Co',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          ],
          count: 2,
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User search completed',
        expect.objectContaining({
          query: 'john',
          userId: 1,
          resultsCount: 2,
        })
      );
    });

    test('should handle empty optional fields gracefully', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'test' } as any });
      const res = createMockResponse();
      const mockUsers = [
        {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userName: 'testuser',
          experienceLine: null,
          avatarUrl: null,
        },
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);
      let capturedResponse: any;
      (res.json as any).mockImplementation((data: any) => {
        capturedResponse = data;
        return res;
      });

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(capturedResponse.data.data[0]).toEqual({
        id: 1,
        email: 'test@example.com',
        userName: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        experienceLine: '',
        avatarUrl: '',
      });
    });

    test('should throw ValidationError for missing query parameter', async () => {
      // Arrange
      const req = createMockRequest({ query: {} as any });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.searchUsers(req, res)).rejects.toThrow(ValidationError);
      expect(mockUserService.searchUsers).not.toHaveBeenCalled();
    });

    test('should throw ValidationError for empty query parameter', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: '' } as any });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.searchUsers(req, res)).rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError for query that is too long', async () => {
      // Arrange
      const longQuery = 'a'.repeat(101);
      const req = createMockRequest({ query: { q: longQuery } as any });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.searchUsers(req, res)).rejects.toThrow(ValidationError);
    });

    test('should throw AuthenticationError for unauthenticated request', async () => {
      // Arrange
      const req = createMockRequest({
        query: { q: 'test' } as any,
        user: undefined, // No authenticated user
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.searchUsers(req, res)).rejects.toThrow(AuthenticationError);
    });

    test('should propagate service errors', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'test' } as any });
      const res = createMockResponse();
      const error = new Error('Service unavailable');

      mockUserService.searchUsers.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.searchUsers(req, res)).rejects.toThrow('Service unavailable');
    });

    test('should return empty array for no matches', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: 'nonexistent' } as any });
      const res = createMockResponse();

      mockUserService.searchUsers.mockResolvedValue([]);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          data: [],
          count: 0,
        },
      });
    });

    test('should handle special characters in search query', async () => {
      // Arrange
      const req = createMockRequest({ query: { q: "O'Neill" } as any });
      const res = createMockResponse();
      const mockUsers = [
        createTestUser({ firstName: "O'Neill", lastName: 'Smith' } as any),
      ];

      mockUserService.searchUsers.mockResolvedValue(mockUsers as any);

      // Act
      await controller.searchUsers(req, res);

      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith("O'Neill");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          data: expect.any(Array),
          count: 1,
        },
      });
    });
  });
});
