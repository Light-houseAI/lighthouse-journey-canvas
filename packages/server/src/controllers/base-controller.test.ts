/**
 * Base Controller Unit Tests - TDD Implementation
 */

import { describe, expect, test } from 'vitest';

import { BaseController } from './base-controller';

// Test implementation to access protected methods
class TestController extends BaseController {
  public testValidateId(value: string | undefined, paramName: string) {
    return this.validateId(value, paramName);
  }

  public testParsePagination(query: any) {
    return this.parsePagination(query);
  }

  public testGetAuthenticatedUser(req: any) {
    return this.getAuthenticatedUser(req);
  }

  public testParseSorting(query: any, allowedFields: string[]) {
    return this.parseSorting(query, allowedFields);
  }
}

describe('BaseController', () => {
  test('should validate a valid ID', () => {
    // Arrange
    const controller = new TestController();

    // Act
    const result = controller.testValidateId('123', 'userId');

    // Assert
    expect(result).toBe(123);
  });

  test('should throw ValidationError for undefined ID', () => {
    // Arrange
    const controller = new TestController();

    // Act & Assert
    expect(() => controller.testValidateId(undefined, 'userId')).toThrowError(
      'userId is required'
    );
  });

  test('should throw ValidationError for invalid ID string', () => {
    // Arrange
    const controller = new TestController();

    // Act & Assert
    expect(() => controller.testValidateId('abc', 'userId')).toThrowError(
      'Invalid userId: must be a positive integer'
    );
  });

  test('should parse pagination with default values', () => {
    // Arrange
    const controller = new TestController();
    const query = {};

    // Act
    const result = controller.testParsePagination(query);

    // Assert
    expect(result).toEqual({
      page: 1,
      limit: 10,
      offset: 0,
    });
  });

  test('should parse pagination with custom values', () => {
    // Arrange
    const controller = new TestController();
    const query = { page: '3', limit: '25' };

    // Act
    const result = controller.testParsePagination(query);

    // Assert
    expect(result).toEqual({
      page: 3,
      limit: 25,
      offset: 50, // (3-1) * 25
    });
  });

  test('should handle pagination boundary values', () => {
    // Arrange
    const controller = new TestController();
    const query = { page: '0', limit: '150' }; // Below min page, above max limit

    // Act
    const result = controller.testParsePagination(query);

    // Assert
    expect(result).toEqual({
      page: 1, // Minimum page is 1
      limit: 100, // Maximum limit is 100
      offset: 0,
    });
  });

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

  test('should parse sorting with valid field', () => {
    // Arrange
    const controller = new TestController();
    const query = { sort: 'name', order: 'DESC' };
    const allowedFields = ['name', 'email', 'createdAt'];

    // Act
    const result = controller.testParseSorting(query, allowedFields);

    // Assert
    expect(result).toEqual({
      field: 'name',
      order: 'DESC',
    });
  });

  test('should throw ValidationError for invalid sort field', () => {
    // Arrange
    const controller = new TestController();
    const query = { sort: 'invalidField', order: 'ASC' };
    const allowedFields = ['name', 'email', 'createdAt'];

    // Act & Assert
    expect(() =>
      controller.testParseSorting(query, allowedFields)
    ).toThrowError(
      'Invalid sort field. Allowed fields: name, email, createdAt'
    );
  });
});
