/**
 * API Type System
 *
 * Centralized Zod schemas and TypeScript types for all API contracts.
 * Provides runtime validation and compile-time type safety.
 *
 * Schemas organized by controller domain for better maintainability.
 */

// Common schemas (used across multiple endpoints)
export * from './common.schemas';
export * from './validation-helpers';

// Controller-specific schemas
export * from './auth.schemas';
export * from './files.schemas';
export * from './graphrag.schemas';
export * from './health.schemas';
export * from './onboarding.schemas';
export * from './organization.schemas';
export * from './permissions.schemas';
export * from './session.schemas';
export * from './timeline.schemas';
export * from './updates.schemas';
export * from './user.schemas';
