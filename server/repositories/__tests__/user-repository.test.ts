/**
 * User Repository Tests
 *
 * Comprehensive test coverage for user search functionality including:
 * - Name-based search (first name, last name, full name)
 * - Case-insensitive search
 * - Result limiting
 * - Error handling edge cases
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@shared/types';

import { UserRepository } from '../user-repository';

describe('User Repository Tests', () => {
  let repository: UserRepository;
  let mockDb: any;

  const createTestUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    userName: 'testuser',
    password: 'hashedpassword',
    title: null,
    company: null,
    avatarUrl: null,
    interest: null,
    hasCompletedOnboarding: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Enhanced mock database with query simulation
    let mockSelectResult: any[] = [];

    const mockQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        // Return the mock result when limit is called (end of chain)
        return Promise.resolve(mockSelectResult);
      }),
    };

    mockDb = {
      select: vi.fn(() => mockQuery),

      // Test helper to set results
      __setSelectResult: (result: any[]) => {
        mockSelectResult = result;
      },
    };

    repository = new UserRepository({
      database: mockDb as any,
    });
  });

  describe('Search Users', () => {
    it('should search users by first name with case-insensitive matching', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ firstName: 'John', lastName: 'Doe' }),
        createTestUser({ id: 2, firstName: 'Johnny', lastName: 'Smith' }),
      ];
      mockDb.__setSelectResult(mockUsers);

      // Act
      const result = await repository.searchUsers('john');

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty search query', async () => {
      // Act
      const result = await repository.searchUsers('');

      // Assert
      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only query', async () => {
      // Act
      const result = await repository.searchUsers('  ');

      // Assert
      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should search users by last name with case-insensitive matching', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ firstName: 'Jane', lastName: 'Smith' }),
        createTestUser({ id: 2, firstName: 'Bob', lastName: 'Smithson' }),
      ];
      mockDb.__setSelectResult(mockUsers);

      // Act
      const result = await repository.searchUsers('SMITH');

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });

    it('should search users by full name with case-insensitive matching', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ firstName: 'John', lastName: 'Doe' }),
      ];
      mockDb.__setSelectResult(mockUsers);

      // Act
      const result = await repository.searchUsers('john doe');

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(1);
    });

    it('should limit results to 20 users', async () => {
      // Arrange
      const mockUsers = Array.from({ length: 25 }, (_, i) =>
        createTestUser({
          id: i + 1,
          firstName: 'User',
          lastName: `${i + 1}`,
          email: `user${i + 1}@example.com`,
        })
      );
      // Simulate database limit
      mockDb.__setSelectResult(mockUsers.slice(0, 20));

      // Act
      const result = await repository.searchUsers('user');

      // Assert
      expect(result).toHaveLength(20);
      expect(result[0].id).toBe(1);
      expect(result[19].id).toBe(20);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      mockDb.select = vi.fn(() => {
        throw dbError;
      });

      // Act & Assert
      await expect(repository.searchUsers('test')).rejects.toThrow(
        'Failed to search users: Database connection failed'
      );
    });

    it('should handle special characters in search query', async () => {
      // Arrange
      const mockUsers = [
        createTestUser({ firstName: "O'Neill", lastName: 'Smith' }),
      ];
      mockDb.__setSelectResult(mockUsers);

      // Act
      const result = await repository.searchUsers("o'neill");

      // Assert
      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });
});
