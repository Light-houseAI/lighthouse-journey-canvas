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
  // LIG-247: Session Mapping Repository
  SESSION_MAPPING_REPOSITORY: 'sessionMappingRepository',
  // Workflow Screenshot Repository
  WORKFLOW_SCREENSHOT_REPOSITORY: 'workflowScreenshotRepository',
  // Graph RAG Repositories
  ENTITY_EMBEDDING_REPOSITORY: 'entityEmbeddingRepository',
  CONCEPT_EMBEDDING_REPOSITORY: 'conceptEmbeddingRepository',
  // User Feedback Repository
  USER_FEEDBACK_REPOSITORY: 'userFeedbackRepository',
  // Waitlist Repository
  WAITLIST_REPOSITORY: 'waitlistRepository',
  // Platform Workflow Repository (Insight Generation)
  PLATFORM_WORKFLOW_REPOSITORY: 'platformWorkflowRepository',
  // Company Documents Repository (RAG document storage)
  COMPANY_DOCUMENT_REPOSITORY: 'companyDocumentRepository',
  // Insight Generation Job Repository (persistent job storage)
  INSIGHT_GENERATION_JOB_REPOSITORY: 'insightGenerationJobRepository',
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
  // LIG-247: Session Services
  SESSION_CLASSIFIER_SERVICE: 'sessionClassifierService',
  SESSION_SERVICE: 'sessionService',
  // Workflow Analysis Service
  WORKFLOW_ANALYSIS_SERVICE: 'workflowAnalysisService',
  // Graph RAG Entity Extraction Service
  ENTITY_EXTRACTION_SERVICE: 'entityExtractionService',
  // Graph RAG Cross-Session Retrieval Service
  CROSS_SESSION_RETRIEVAL_SERVICE: 'crossSessionRetrievalService',
  // ArangoDB Graph Service
  ARANGODB_GRAPH_SERVICE: 'arangoDBGraphService',
  // Helix Graph Service
  HELIX_GRAPH_SERVICE: 'helixGraphService',
  // Generic Graph Service (selected by GRAPH_DB_PROVIDER env var)
  GRAPH_SERVICE: 'graphService',
  // Hierarchical Workflow Services
  TOOL_GENERALIZATION_SERVICE: 'toolGeneralizationService',
  CONFIDENCE_SCORING_SERVICE: 'confidenceScoringService',
  BLOCK_EXTRACTION_SERVICE: 'blockExtractionService',
  BLOCK_CANONICALIZATION_SERVICE: 'blockCanonicalizationService',
  BLOCK_LINKING_SERVICE: 'blockLinkingService',
  STEP_EXTRACTION_SERVICE: 'stepExtractionService',
  HIERARCHICAL_TOP_WORKFLOWS_SERVICE: 'hierarchicalTopWorkflowsService',
  // User Feedback Service
  USER_FEEDBACK_SERVICE: 'userFeedbackService',
  // Waitlist Service
  WAITLIST_SERVICE: 'waitlistService',
  // Natural Language Query Service
  NATURAL_LANGUAGE_QUERY_SERVICE: 'naturalLanguageQueryService',
  // Progress Snapshot Service
  PROGRESS_SNAPSHOT_SERVICE: 'progressSnapshotService',
  // Insight Assistant Service
  INSIGHT_ASSISTANT_SERVICE: 'insightAssistantService',
  // Multi-Agent Insight Generation Service
  INSIGHT_GENERATION_SERVICE: 'insightGenerationService',
  // Workflow Anonymizer Service
  WORKFLOW_ANONYMIZER_SERVICE: 'workflowAnonymizerService',
  // Company Documents Services (RAG document processing)
  DOCUMENT_PARSER_SERVICE: 'documentParserService',
  DOCUMENT_CHUNKER_SERVICE: 'documentChunkerService',
  COMPANY_DOCUMENT_PROCESSING_SERVICE: 'companyDocumentProcessingService',
  COMPANY_DOCUMENT_SEARCH_SERVICE: 'companyDocumentSearchService',
  // Persona Services (Insight Assistant persona-based suggestions)
  PERSONA_SERVICE: 'personaService',
  PERSONA_SUGGESTION_SERVICE: 'personaSuggestionService',
  // Conversation Memory Service (Mem0 integration for follow-up questions)
  MEMORY_SERVICE: 'memoryService',
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
  // LIG-247: Session Controller
  SESSION_CONTROLLER: 'sessionController',
  // Desktop App Track Controller
  DESKTOP_TRACK_CONTROLLER: 'desktopTrackController',
  // Workflow Analysis Controller
  WORKFLOW_ANALYSIS_CONTROLLER: 'workflowAnalysisController',
  // User Feedback Controller
  USER_FEEDBACK_CONTROLLER: 'userFeedbackController',
  // Insight Assistant Controller
  INSIGHT_ASSISTANT_CONTROLLER: 'insightAssistantController',
  // Company Documents Controller
  COMPANY_DOCUMENTS_CONTROLLER: 'companyDocumentsController',
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
