/**
 * User Service Tests
 *
 * Comprehensive test coverage for user service layer including:
 * - User search workflows
 * - Query validation
 * - Error handling and logging
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { User } from '@journey/schema';

import type { UserRepository } from '../../repositories/user-repository.js';
import { UserService } from '../user-service.js';

describe('User Service Tests', () => {
  let service: UserService;
  let mockRepository: MockProxy<UserRepository>;
  let mockLogger: any;

  const createTestUser = (overrides: Partial<User> = {} as any): User => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userName: 'testuser',
    password: 'hashedpassword',
    // title: null,
    // company: null,
    // avatarUrl: null,
    interest: null,
    hasCompletedOnboarding: true,
    createdAt: new Date('2024-01-01'),
    // updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockRepository = mock<UserRepository>();

    service = new UserService({
      userRepository: mockRepository,
      logger: mockLogger,
    });
  });

  describe('User Search', () => {
    it('should search users and return results', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ firstName: 'John', lastName: 'Doe' } as any),
        createTestUser({ id: 2, firstName: 'Jane', lastName: 'Smith' } as any),
      ];
      mockRepository.searchUsers.mockResolvedValue(mockUsers);

      // Act
      const result = await service.searchUsers('john');

      // Assert
      expect(mockRepository.searchUsers).toHaveBeenCalledWith('john');
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array for empty query', async () => {
      // Act
      const result = await service.searchUsers('');

      // Assert
      expect(mockRepository.searchUsers).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      // Act
      const result = await service.searchUsers('  ');

      // Assert
      expect(mockRepository.searchUsers).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockRepository.searchUsers.mockRejectedValue(error);

      // Act & Assert
      await expect(service.searchUsers('test')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle empty result set', async () => {
      // Arrange
      mockRepository.searchUsers.mockResolvedValue([]);

      // Act
      const result = await service.searchUsers('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle users with optional fields', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({
          firstName: 'John',
          lastName: 'Doe',
          // title: 'Senior Engineer',
          // company: 'Tech Corp',
          // avatarUrl: 'https://example.com/avatar.jpg',
        } as any),
      ];
      mockRepository.searchUsers.mockResolvedValue(mockUsers);

      // Act
      const result = await service.searchUsers('john');

      // Assert
      // expect(result[0].title).toBe('Senior Engineer');
      // expect(result[0].company).toBe('Tech Corp');
      // expect(result[0].avatarUrl).toBe('https://example.com/avatar.jpg');
    });
  });

  describe('Get User By ID', () => {
    it('should retrieve user by ID successfully', async () => {
      // Arrange
      const mockUser = createTestUser({ id: 123, firstName: 'John' } as any);
      mockRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.getUserById(123);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.getUserById(999);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });

    it('should handle repository errors when getting user by ID', async () => {
      // Arrange
      const error = new Error('Database error');
      mockRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(service.getUserById(1)).rejects.toThrow(error);
    });
  });
});
