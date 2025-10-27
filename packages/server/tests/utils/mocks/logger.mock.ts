/**
 * Mock Logger Helper
 *
 * Provides a consistent mock logger implementation for all tests.
 * Eliminates duplication of mock logger creation across 30+ test files.
 */

import { vi } from 'vitest';

/**
 * Logger interface matching the application's logger contract
 */
export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

/**
 * Creates a mock logger with spy functions for all log levels
 * @returns Mock logger with vitest spy functions
 */
export const createMockLogger = (): Logger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});
