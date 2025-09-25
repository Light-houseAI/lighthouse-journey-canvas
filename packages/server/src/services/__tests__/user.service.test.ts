/**
 * User Service Tests
 *
 * Comprehensive test coverage for user service layer including:
 * - User search workflows
 * - Query validation
 * - Error handling and logging
 */

import type { InsertUser, User } from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

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

  describe('User Profile Persistence (LIG-185)', () => {
    describe('completeOnboarding', () => {
      it('should complete onboarding and return user with saved profile data', async () => {
        const savedUser = createTestUser({
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          interest: 'grow-career',
          hasCompletedOnboarding: true,
        } as any);

        mockRepository.updateOnboardingStatus.mockResolvedValue(savedUser);
        mockRepository.findById.mockResolvedValue(savedUser);

        const result = await service.completeOnboarding(1);

        expect(mockRepository.updateOnboardingStatus).toHaveBeenCalledWith(
          1,
          true
        );
        expect(mockRepository.findById).toHaveBeenCalledWith(1);
        expect(result).toEqual(savedUser);
        expect(result.hasCompletedOnboarding).toBe(true);
        expect(result.firstName).toBe('John');
        expect(result.lastName).toBe('Doe');
        expect(result.interest).toBe('grow-career');
      });

      it('should throw error when onboarding update fails', async () => {
        mockRepository.updateOnboardingStatus.mockResolvedValue(null);

        await expect(service.completeOnboarding(1)).rejects.toThrow(
          'Failed to complete onboarding - user not found'
        );
        expect(mockRepository.findById).not.toHaveBeenCalled();
      });

      it('should throw error when user not found after onboarding update', async () => {
        const updatedUser = createTestUser({
          hasCompletedOnboarding: true,
        } as any);
        mockRepository.updateOnboardingStatus.mockResolvedValue(updatedUser);
        mockRepository.findById.mockResolvedValue(null);

        await expect(service.completeOnboarding(1)).rejects.toThrow(
          'User not found after onboarding update'
        );
      });
    });

    describe('updateUser', () => {
      it('should update user profile and persist data correctly', async () => {
        // Arrange
        const updates = {
          firstName: 'Jane',
          lastName: 'Smith',
          interest: 'grow-career',
        };
        const updatedUser = createTestUser({ ...updates } as any);
        mockRepository.update.mockResolvedValue(updatedUser);

        // Act
        const result = await service.updateUser(1, updates);

        // Assert
        expect(mockRepository.update).toHaveBeenCalledWith(1, updates);
        expect(result).toEqual(updatedUser);
        expect(result?.firstName).toBe('Jane');
        expect(result?.lastName).toBe('Smith');
        expect(result?.interest).toBe('grow-career');
      });

      it('should return null when user to update not found', async () => {
        // Arrange
        mockRepository.update.mockResolvedValue(null);

        // Act
        const result = await service.updateUser(999, { firstName: 'Test' });

        // Assert
        expect(result).toBeNull();
      });

      it('should throw error when updating email to existing one', async () => {
        // Arrange
        const existingUser = createTestUser({
          id: 2,
          email: 'existing@example.com',
        } as any);
        mockRepository.findByEmail.mockResolvedValue(existingUser);

        // Act & Assert
        await expect(
          service.updateUser(1, { email: 'existing@example.com' })
        ).rejects.toThrow('Email already in use by another user');
      });
    });

    describe('createUser', () => {
      it('should create user with profile data', async () => {
        const userData: InsertUser = {
          email: 'new@example.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          userName: 'newuser',
          interest: 'grow-career',
        };
        const createdUser = createTestUser(userData as any);

        mockRepository.findByEmail.mockResolvedValue(null);
        mockRepository.create.mockResolvedValue(createdUser);

        const result = await service.createUser(userData);

        expect(mockRepository.findByEmail).toHaveBeenCalledWith(userData.email);
        expect(mockRepository.create).toHaveBeenCalled();
        expect(result.firstName).toBe('New');
        expect(result.lastName).toBe('User');
        expect(result.interest).toBe('grow-career');
      });

      it('should throw error when creating user with existing email', async () => {
        const existingUser = createTestUser();
        mockRepository.findByEmail.mockResolvedValue(existingUser);

        await expect(
          service.createUser({
            email: 'test@example.com',
            password: 'password',
            firstName: 'Test',
            lastName: 'User',
            userName: 'testuser',
            interest: null,
          })
        ).rejects.toThrow('User with this email already exists');
      });
    });
  });
});
