/**
 * User Test Data Factory
 *
 * Provides consistent test data creation for User entities across all tests.
 * Supports partial overrides for test-specific scenarios.
 */

import type { InsertUser, User } from '@journey/schema';

/**
 * Creates a test User with sensible defaults
 * @param overrides - Partial user data to override defaults
 * @returns Complete User object for testing
 */
export const createTestUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userName: 'testuser',
  password: 'hashedpassword',
  interest: null,
  hasCompletedOnboarding: true,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

/**
 * Creates InsertUser data for testing user creation flows
 * @param overrides - Partial insert data to override defaults
 * @returns InsertUser object for repository/service tests
 */
export const createTestInsertUser = (
  overrides: Partial<InsertUser> = {}
): InsertUser => ({
  email: 'new@example.com',
  password: 'password123',
  firstName: 'New',
  lastName: 'User',
  userName: 'newuser',
  interest: null,
  ...overrides,
});

/**
 * Creates multiple test users with unique IDs and emails
 * @param count - Number of users to create
 * @param baseId - Starting ID (defaults to 1)
 * @returns Array of User objects
 */
export const createTestUserBatch = (
  count: number,
  baseId: number = 1
): User[] =>
  Array.from({ length: count }, (_, i) =>
    createTestUser({
      id: baseId + i,
      email: `test${baseId + i}@example.com`,
      userName: `testuser${baseId + i}`,
    })
  );

/**
 * Creates a test user with onboarding completed
 */
export const createOnboardedUser = (overrides: Partial<User> = {}): User =>
  createTestUser({
    firstName: 'Onboarded',
    lastName: 'User',
    userName: 'onboardeduser',
    interest: 'grow-career',
    hasCompletedOnboarding: true,
    ...overrides,
  });

/**
 * Creates a test user without onboarding completed
 */
export const createNewUser = (overrides: Partial<User> = {}): User =>
  createTestUser({
    firstName: null,
    lastName: null,
    userName: null,
    interest: null,
    hasCompletedOnboarding: false,
    ...overrides,
  });
