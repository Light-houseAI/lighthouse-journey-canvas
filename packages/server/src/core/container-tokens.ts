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
  PGVECTOR_GRAPHRAG_REPOSITORY: 'pgVectorGraphRAGRepository',
  UPDATES_REPOSITORY: 'updatesRepository',
  // LIG-217: Storage Quota Repository
  STORAGE_QUOTA_REPOSITORY: 'storageQuotaRepository',
  // LIG-217: User Files Repository
  USER_FILES_REPOSITORY: 'userFilesRepository',
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
  PGVECTOR_GRAPHRAG_SERVICE: 'pgVectorGraphRAGService',
  OPENAI_EMBEDDING_SERVICE: 'openAIEmbeddingService',
  LLM_PROVIDER: 'llmProvider',
  LLM_SUMMARY_SERVICE: 'llmSummaryService',
  EXPERIENCE_MATCHES_SERVICE: 'experienceMatchesService',
  TRANSACTION_MANAGER: 'transactionManager',
  UPDATES_SERVICE: 'updatesService',
  // LIG-207: Career Trajectory Matching Services
  JOB_APPLICATION_TRAJECTORY_MATCHER_SERVICE:
    'jobApplicationTrajectoryMatcherService',
  CANDIDATE_TIMELINE_FETCHER: 'candidateTimelineFetcher',
  SCORE_MERGING_SERVICE: 'scoreMergingService',
  EXPLANATION_MERGING_SERVICE: 'explanationMergingService',
  HYBRID_JOB_APPLICATION_MATCHING_SERVICE:
    'hybridJobApplicationMatchingService',
  // LIG-207: Trajectory Matching Components
  ANCHORED_ALIGNMENT_ENGINE: 'anchoredAlignmentEngine',
  CAREER_SEQUENCE_EXTRACTOR: 'careerSequenceExtractor',
  TRAJECTORY_SCORER: 'trajectoryScorer',
  // LIG-207: Career Insights Generator
  CAREER_INSIGHTS_GENERATOR_SERVICE: 'careerInsightsGeneratorService',
  // LIG-217: File Upload Services
  GCS_UPLOAD_SERVICE: 'gcsUploadService',
  STORAGE_QUOTA_SERVICE: 'storageQuotaService',
} as const;

/**
 * Controller layer tokens
 */
export const CONTROLLER_TOKENS = {
  AUTH_CONTROLLER: 'authController',

  HIERARCHY_CONTROLLER: 'hierarchyController',
  ONBOARDING_CONTROLLER: 'onboardingController',
  USER_ONBOARDING_CONTROLLER: 'userOnboardingController',
  NODE_PERMISSION_CONTROLLER: 'nodePermissionController',
  USER_CONTROLLER: 'userController',
  ORGANIZATION_CONTROLLER: 'organizationController',
  PGVECTOR_GRAPHRAG_CONTROLLER: 'pgVectorGraphRAGController',
  EXPERIENCE_MATCHES_CONTROLLER: 'experienceMatchesController',
  UPDATES_CONTROLLER: 'updatesController',
  // LIG-217: File Upload Controller
  FILES_CONTROLLER: 'filesController',
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
export type InfrastructureTokens =
  (typeof INFRASTRUCTURE_TOKENS)[keyof typeof INFRASTRUCTURE_TOKENS];
export type RepositoryTokens =
  (typeof REPOSITORY_TOKENS)[keyof typeof REPOSITORY_TOKENS];
export type ServiceTokens =
  (typeof SERVICE_TOKENS)[keyof typeof SERVICE_TOKENS];
export type ControllerTokens =
  (typeof CONTROLLER_TOKENS)[keyof typeof CONTROLLER_TOKENS];
export type ContainerTokens =
  (typeof CONTAINER_TOKENS)[keyof typeof CONTAINER_TOKENS];

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
