/**
 * Base Service Classes and Error Types
 * Provides common error handling and base functionality for all services
 */

/**
 * Custom error for validation failures
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error for business rule violations
 */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Custom error for resource not found scenarios
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Base service class with common functionality
 */
export abstract class BaseService {
  /**
   * Validate that a value is not null or undefined
   */
  protected validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  /**
   * Validate that a string is not empty
   */
  protected validateNotEmpty(value: string, fieldName: string): void {
    this.validateRequired(value, fieldName);
    if (typeof value === 'string' && value.trim().length === 0) {
      throw new ValidationError(`${fieldName} cannot be empty`);
    }
  }

  /**
   * Validate that a number is positive
   */
  protected validatePositive(value: number, fieldName: string): void {
    this.validateRequired(value, fieldName);
    if (typeof value !== 'number' || value <= 0) {
      throw new ValidationError(`${fieldName} must be a positive number`);
    }
  }

  /**
   * Validate that a value exists, throw NotFoundError if not
   */
  protected assertExists<T>(value: T | null | undefined, resourceName: string): T {
    if (value === null || value === undefined) {
      throw new NotFoundError(`${resourceName} not found`);
    }
    return value;
  }
}