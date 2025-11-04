/**
 * User Test Data Factory
 *
 * Provides factory functions for creating mock user objects in tests.
 * Helps maintain consistency and reduce duplication across test files.
 */

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  userName?: string;
  interest?: string;
  hasCompletedOnboarding?: boolean;
  createdAt?: string;
}

/**
 * Creates a mock user with sensible defaults that can be overridden.
 *
 * @example
 * const user = createMockUser(); // Uses all defaults
 * const customUser = createMockUser({ email: 'custom@example.com', id: 999 });
 */
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userName: 'testuser',
  interest: 'find-job',
  hasCompletedOnboarding: true,
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates multiple mock users with incremental IDs.
 *
 * @example
 * const users = createMockUsers(3); // Creates 3 users with IDs 1, 2, 3
 */
export const createMockUsers = (
  count: number,
  baseOverrides?: Partial<User>
): User[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockUser({
      ...baseOverrides,
      id: index + 1,
      email: `user${index + 1}@example.com`,
      userName: `user${index + 1}`,
    })
  );
};
