/**
 * Common Error Classes
 * Provides standardized error handling across all services and controllers
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