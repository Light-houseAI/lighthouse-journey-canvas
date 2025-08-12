/**
 * Dependency Injection Tokens for Hierarchy System
 * 
 * Centralized token definitions to avoid circular imports.
 * These symbols are used throughout the hierarchy system for dependency injection.
 */

// Integration with existing Lighthouse container symbols
export const HIERARCHY_TOKENS = {
  // Infrastructure
  DATABASE: Symbol.for('DATABASE'),
  LOGGER: Symbol.for('LOGGER'),
  
  // Hierarchy-specific tokens
  HIERARCHY_REPOSITORY: Symbol.for('HIERARCHY_REPOSITORY'),
  INSIGHT_REPOSITORY: Symbol.for('INSIGHT_REPOSITORY'),
  HIERARCHY_SERVICE: Symbol.for('HIERARCHY_SERVICE'),
  VALIDATION_SERVICE: Symbol.for('VALIDATION_SERVICE'),
  CYCLE_DETECTION_SERVICE: Symbol.for('CYCLE_DETECTION_SERVICE'),
  HIERARCHY_CONTROLLER: Symbol.for('HIERARCHY_CONTROLLER'),
} as const;

export type HierarchyTokens = typeof HIERARCHY_TOKENS;