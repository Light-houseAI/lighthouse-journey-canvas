/**
 * Base Controller Unit Tests
 *
 * Tests the simplified BaseController that now only provides
 * authentication helper functionality.
 */

import { describe, expect, test } from 'vitest';

import { BaseController } from '../base-controller';

// Test implementation to access protected methods
class TestController extends BaseController {
  public testGetAuthenticatedUser(req: any) {
    return this.getAuthenticatedUser(req);
  }
}

describe('BaseController', () => {
  test('should get authenticated user from request', () => {
    // Arrange
    const controller = new TestController();
    const req = { user: { id: 42 } };

    // Act
    const result = controller.testGetAuthenticatedUser(req);

    // Assert
    expect(result).toEqual({ id: 42 });
  });

  test('should throw AuthenticationError for missing user', () => {
    // Arrange
    const controller = new TestController();
    const req = {};

    // Act & Assert
    expect(() => controller.testGetAuthenticatedUser(req)).toThrowError(
      'User authentication required'
    );
  });

  test('should throw AuthenticationError for user without ID', () => {
    // Arrange
    const controller = new TestController();
    const req = { user: {} };

    // Act & Assert
    expect(() => controller.testGetAuthenticatedUser(req)).toThrowError(
      'User authentication required'
    );
  });
});
