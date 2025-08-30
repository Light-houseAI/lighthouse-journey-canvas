/**
 * Dependency Injection Container Tokens
 * 
 * Centralized token definitions for all services registered in the Awilix container.
 * These constants replace magic strings throughout the codebase to improve type safety
 * and maintainability.
 */

/**
 * Infrastructure service tokens
 */
export const INFRASTRUCTURE_TOKENS = {
  DATABASE: 'database',
  LOGGER: 'logger',
} as const;

/**
 * Repository layer tokens
 */
export const REPOSITORY_TOKENS = {
  HIERARCHY_REPOSITORY: 'hierarchyRepository',
  INSIGHT_REPOSITORY: 'insightRepository',
  NODE_PERMISSION_REPOSITORY: 'nodePermissionRepository',
  ORGANIZATION_REPOSITORY: 'organizationRepository',
  USER_REPOSITORY: 'userRepository',
  REFRESH_TOKEN_REPOSITORY: 'refreshTokenRepository',
} as const;

/**
 * Service layer tokens
 */
export const SERVICE_TOKENS = {
  HIERARCHY_SERVICE: 'hierarchyService',
  MULTI_SOURCE_EXTRACTOR: 'multiSourceExtractor',
  AUTH_SERVICE: 'authService',
  JWT_SERVICE: 'jwtService',
  REFRESH_TOKEN_SERVICE: 'refreshTokenService',
  NODE_PERMISSION_SERVICE: 'nodePermissionService',
  ORGANIZATION_SERVICE: 'organizationService',
  USER_SERVICE: 'userService',
} as const;

/**
 * Controller layer tokens
 */
export const CONTROLLER_TOKENS = {
  HIERARCHY_CONTROLLER: 'hierarchyController',
  USER_ONBOARDING_CONTROLLER: 'userOnboardingController',
  NODE_PERMISSION_CONTROLLER: 'nodePermissionController',
  USER_CONTROLLER: 'userController',
  ORGANIZATION_CONTROLLER: 'organizationController',
} as const;

/**
 * All container tokens in a single object for convenience
 */
export const CONTAINER_TOKENS = {
  ...INFRASTRUCTURE_TOKENS,
  ...REPOSITORY_TOKENS,
  ...SERVICE_TOKENS,
  ...CONTROLLER_TOKENS,
} as const;

/**
 * Type definitions for container tokens
 */
export type InfrastructureTokens = typeof INFRASTRUCTURE_TOKENS[keyof typeof INFRASTRUCTURE_TOKENS];
export type RepositoryTokens = typeof REPOSITORY_TOKENS[keyof typeof REPOSITORY_TOKENS];
export type ServiceTokens = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];
export type ControllerTokens = typeof CONTROLLER_TOKENS[keyof typeof CONTROLLER_TOKENS];
export type ContainerTokens = typeof CONTAINER_TOKENS[keyof typeof CONTAINER_TOKENS];

/**
 * Legacy hierarchy tokens (for backward compatibility with symbol-based tokens)
 * @deprecated Use string-based tokens from CONTAINER_TOKENS instead
 */
export const LEGACY_HIERARCHY_TOKENS = {
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