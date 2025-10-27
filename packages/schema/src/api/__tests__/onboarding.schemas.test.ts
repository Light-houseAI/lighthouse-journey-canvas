/**
 * Onboarding Schema Validation Tests
 * Tests validation rules for onboarding schemas
 */

import { describe, expect, it } from 'vitest';

import { usernameInputSchema } from '../onboarding.schemas';

describe('Onboarding Schemas', () => {
  describe('usernameInputSchema', () => {
    it('should reject usernames shorter than 3 characters', () => {
      // Arrange
      const shortUsernames = [
        { username: 'a' },
        { username: 'ab' },
        { username: '' },
      ];

      // Act & Assert
      shortUsernames.forEach((input) => {
        const result = usernameInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 3');
        }
      });
    });

    it('should accept usernames of 3+ characters', () => {
      // Arrange
      const validUsernames = [
        { username: 'abc' },
        { username: 'test' },
        { username: 'user123' },
        { username: 'test-user_123' },
      ];

      // Act & Assert
      validUsernames.forEach((input) => {
        const result = usernameInputSchema.safeParse(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.username).toBe(input.username);
        }
      });
    });

    it('should reject usernames with invalid characters', () => {
      // Arrange
      const invalidUsernames = [
        { username: 'user@123' },
        { username: 'user name' },
        { username: 'user.name' },
      ];

      // Act & Assert
      invalidUsernames.forEach((input) => {
        const result = usernameInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'letters, numbers, hyphens, and underscores'
          );
        }
      });
    });
  });
});
