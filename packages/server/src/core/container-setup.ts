import {
  asClass,
  asFunction,
  asValue,
  AwilixContainer,
  createContainer,
  InjectionMode,
} from 'awilix';

import {
  createDatabaseConnection,
  disposeDatabaseConnection,
} from '../config/database.connection.js';
import { getPoolFromDatabase } from '../config/database.connection.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';
// Controllers
import { AuthController } from '../controllers/auth.controller';
import { DesktopTrackController } from '../controllers/desktop-track.controller';
import { ExperienceMatchesController } from '../controllers/experience-matches.controller';
import { FilesController } from '../controllers/files.controller';
import { HierarchyController } from '../controllers/hierarchy.controller';
import { NodePermissionController } from '../controllers/node-permission.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { PgVectorGraphRAGController } from '../controllers/pgvector-graphrag.controller';
import { SessionController } from '../controllers/session.controller';
import { UpdatesController } from '../controllers/updates.controller';
import { UserFeedbackController } from '../controllers/user-feedback.controller';
import { WorkflowAnalysisController } from '../controllers/workflow-analysis.controller';
import { UserController } from '../controllers/user.controller';
import { UserOnboardingController } from '../controllers/user-onboarding.controller';
// Repositories
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { InsightRepository } from '../repositories/insight-repository';
import { NodePermissionRepository } from '../repositories/node-permission.repository';
import { OrganizationRepository } from '../repositories/organization.repository';
import { PgVectorGraphRAGRepository } from '../repositories/pgvector-graphrag.repository';
import { DatabaseRefreshTokenRepository } from '../repositories/refresh-token.repository';
import { SessionMappingRepository } from '../repositories/session-mapping.repository';
import { StorageQuotaRepository } from '../repositories/storage-quota.repository';
import { UpdatesRepository } from '../repositories/updates.repository';
import { UserFilesRepository } from '../repositories/user-files.repository';
import { UserRepository } from '../repositories/user-repository';
import { WorkflowScreenshotRepository } from '../repositories/workflow-screenshot.repository';
import { EntityEmbeddingRepository } from '../repositories/entity-embedding.repository';
import { ConceptEmbeddingRepository } from '../repositories/concept-embedding.repository';
import { UserFeedbackRepository } from '../repositories/user-feedback.repository';
import { WaitlistRepository } from '../repositories/waitlist.repository';
import { CandidateTimelineFetcher } from '../services/candidate-timeline-fetcher.service';
import { CareerInsightsGeneratorService } from '../services/career-insights-generator.service';
import { ExperienceMatchesService } from '../services/experience-matches.service';
import { ExplanationMergingService } from '../services/explanation-merging.service';
import { GcsUploadService } from '../services/gcs-upload.service';
// Services
import { HierarchyService } from '../services/hierarchy-service';
import { HybridJobApplicationMatchingService } from '../services/hybrid-job-application-matching.service';
import { JobApplicationTrajectoryMatcherService } from '../services/job-application-trajectory-matcher.service';
import { AnchoredAlignmentEngine } from '../services/job-application-trajectory-matcher/anchored-alignment-engine.js';
import { CareerSequenceExtractor } from '../services/job-application-trajectory-matcher/career-sequence-extractor.js';
import { DEFAULT_CONFIG } from '../services/job-application-trajectory-matcher/config.js';
import { TrajectoryScorer } from '../services/job-application-trajectory-matcher/trajectory-scorer.js';
import { JWTService } from '../services/jwt.service';
import { LLMSummaryService } from '../services/llm-summary.service';
import { MultiSourceExtractor } from '../services/multi-source-extractor';
import { NodePermissionService } from '../services/node-permission.service';
import { OpenAIEmbeddingService } from '../services/openai-embedding.service';
import { OrganizationService } from '../services/organization.service';
import { PgVectorGraphRAGService } from '../services/pgvector-graphrag.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { ScoreMergingService } from '../services/score-merging.service';
import { SessionClassifierService } from '../services/session-classifier.service';
import { SessionService } from '../services/session.service';
import { StorageQuotaService } from '../services/storage-quota.service';
import { TransactionManager } from '../services/transaction-manager.service';
import { WorkflowAnalysisService } from '../services/workflow-analysis.service';
import { UpdatesService } from '../services/updates.service';
import { UserService } from '../services/user-service';
import { EntityExtractionService } from '../services/entity-extraction.service';
import { CrossSessionRetrievalService } from '../services/cross-session-retrieval.service';
import { ArangoDBGraphService } from '../services/arangodb-graph.service';
import { HelixGraphService } from '../services/helix-graph.service';
// Hierarchical Workflow Services
import { ToolGeneralizationService } from '../services/tool-generalization.service';
import { ConfidenceScoringService } from '../services/confidence-scoring.service';
import { BlockExtractionService } from '../services/block-extraction.service';
import { BlockCanonicalizationService } from '../services/block-canonicalization.service';
import { BlockLinkingService } from '../services/block-linking.service';
import { StepExtractionService } from '../services/step-extraction.service';
import { HierarchicalTopWorkflowsService } from '../services/hierarchical-top-workflows.service';
import { UserFeedbackService } from '../services/user-feedback.service';
import { WaitlistService } from '../services/waitlist.service';
import { NaturalLanguageQueryService } from '../services/natural-language-query.service';
import { ProgressSnapshotService } from '../services/progress-snapshot.service';
import { InsightAssistantService } from '../services/insight-assistant.service';
import { InsightAssistantController } from '../controllers/insight-assistant.controller';
import { CompanyDocumentsController } from '../controllers/company-documents.controller';
// Persona Services (Insight Assistant persona-based suggestions)
import { PersonaService } from '../services/persona.service';
import { PersonaSuggestionService } from '../services/persona-suggestion.service';
// Insight Generation Multi-Agent System
import { PlatformWorkflowRepository } from '../repositories/platform-workflow.repository';
import { CompanyDocumentRepository } from '../repositories/company-document.repository';
import { InsightGenerationJobRepository } from '../repositories/insight-generation-job.repository';
import { InsightGenerationService } from '../services/insight-generation/insight-generation.service';
import { WorkflowAnonymizerService } from '../services/insight-generation/workflow-anonymizer.service';
import { MemoryService } from '../services/insight-generation/memory.service';
// Company Documents Services (RAG)
import { DocumentParserService } from '../services/document-parser.service';
import { DocumentChunkerService } from '../services/document-chunker.service';
import { CompanyDocumentProcessingService } from '../services/company-document-processing.service';
import { CompanyDocumentSearchService } from '../services/company-document-search.service';
import { UserPreferencesRepository } from '../repositories/user-preferences.repository';
import { PeerPreferencesService } from '../services/peer-preferences.service';
import { PeerInsightsService } from '../services/peer-insights.service';
import { GroupRepository } from '../repositories/group.repository';
import { UserWorkstreamRepository } from '../repositories/user-workstream.repository';
import { GroupService } from '../services/group.service';
import { GroupController } from '../controllers/group.controller';
import { ContextStitchingEndpointService } from '../services/context-stitching-endpoint.service';
import { CONTAINER_TOKENS } from './container-tokens.js';
import { createLLMProvider, getLLMConfig } from './llm-provider.js';
import type { Logger } from './logger.js';
// Interfaces for dependency injection (used for type checking during injection)

/**
 * Application container configuration using Awilix
 * Provides dependency injection with request scoping support for Express.js
 */
export class Container {
  private static rootContainer: AwilixContainer;
  private static isConfigured = false;

  /**
   * Configure application services in Awilix container
   * Sets up dependency injection for the entire application
   */
  static async configure(logger: Logger): Promise<AwilixContainer> {
    if (this.isConfigured && this.rootContainer) {
      return this.rootContainer;
    }

    try {
      // Create root container with PROXY injection mode (uses object destructuring)
      this.rootContainer = createContainer({
        injectionMode: InjectionMode.PROXY,
        strict: true, // Enable strict mode for better error detection
      });

      // Create database connection BEFORE registering it
      // This ensures we have the resolved database instance, not a Promise
      logger.info('🔄 Initializing database connection...');
      const database = await createDatabaseConnection();
      logger.info('✅ Database connection initialized');

      // Initialize Graph Database connection based on GRAPH_DB_PROVIDER
      const graphDbProvider = process.env.GRAPH_DB_PROVIDER || 'arango';
      logger.info(`🔄 Graph DB Provider: ${graphDbProvider}`);

      if (graphDbProvider === 'helix') {
        // Initialize Helix DB connection
        if (process.env.HELIX_URL) {
          logger.info('🔄 Initializing Helix DB connection...');
          logger.info(`   Helix URL: ${process.env.HELIX_URL}`);
          // Helix connection is lazy - initialized when HelixGraphService is used
          logger.info('✅ Helix DB configured (connection will be established on first use)');
        } else {
          logger.warn('⚠️  HELIX_URL not configured - Graph RAG features will be disabled');
        }
      } else {
        // Initialize ArangoDB connection for Graph RAG (legacy)
        if (process.env.ARANGO_URL && process.env.ARANGO_DATABASE) {
          try {
            logger.info('🔄 Initializing ArangoDB connection...');
            await ArangoDBConnection.initialize({
              url: process.env.ARANGO_URL,
              database: process.env.ARANGO_DATABASE,
              username: process.env.ARANGO_USERNAME || 'root',
              password: process.env.ARANGO_PASSWORD || '',
            });
            logger.info('✅ ArangoDB connection initialized');
          } catch (error) {
            logger.warn('⚠️  ArangoDB initialization failed - Graph RAG features will be disabled', error);
          }
        } else {
          logger.info('ℹ️  ArangoDB not configured - Graph RAG features disabled');
        }
      }

      // Register infrastructure dependencies as singletons
      this.rootContainer.register({
        // Database connection - register the resolved instance as a value
        [CONTAINER_TOKENS.DATABASE]: asValue(database),

        [CONTAINER_TOKENS.LOGGER]: asValue(logger),
      });

      // Register TransactionManager early as it's needed by repositories
      this.rootContainer.register({
        [CONTAINER_TOKENS.TRANSACTION_MANAGER]:
          asClass(TransactionManager).singleton(),
      });

      // Register repositories as singletons (shared across requests)
      this.rootContainer.register({
        [CONTAINER_TOKENS.HIERARCHY_REPOSITORY]:
          asClass(HierarchyRepository).singleton(),
        [CONTAINER_TOKENS.INSIGHT_REPOSITORY]:
          asClass(InsightRepository).singleton(),
        // Node permission repositories (interface-based)
        [CONTAINER_TOKENS.NODE_PERMISSION_REPOSITORY]: asClass(
          NodePermissionRepository
        ).singleton(),
        [CONTAINER_TOKENS.ORGANIZATION_REPOSITORY]: asClass(
          OrganizationRepository
        ).singleton(),
        [CONTAINER_TOKENS.USER_REPOSITORY]: asClass(UserRepository).singleton(),
        [CONTAINER_TOKENS.UPDATES_REPOSITORY]:
          asClass(UpdatesRepository).singleton(),

        // JWT repositories
        [CONTAINER_TOKENS.REFRESH_TOKEN_REPOSITORY]: asClass(
          DatabaseRefreshTokenRepository
        ).singleton(),
        // GraphRAG repository - uses database pool directly
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_REPOSITORY]: asFunction(() => {
          const pool = getPoolFromDatabase(database);
          return new PgVectorGraphRAGRepository(pool, database);
        }).singleton(),
        // LIG-217: Storage Quota Repository
        [CONTAINER_TOKENS.STORAGE_QUOTA_REPOSITORY]: asClass(
          StorageQuotaRepository
        ).singleton(),
        // LIG-217: User Files Repository
        [CONTAINER_TOKENS.USER_FILES_REPOSITORY]:
          asClass(UserFilesRepository).singleton(),
        // LIG-247: Session Mapping Repository
        [CONTAINER_TOKENS.SESSION_MAPPING_REPOSITORY]: asClass(
          SessionMappingRepository
        ).singleton(),
        // Workflow Screenshot Repository
        [CONTAINER_TOKENS.WORKFLOW_SCREENSHOT_REPOSITORY]: asFunction(() => {
          const pool = getPoolFromDatabase(database);
          return new WorkflowScreenshotRepository(pool, database);
        }).singleton(),
        // Graph RAG Repositories
        [CONTAINER_TOKENS.ENTITY_EMBEDDING_REPOSITORY]: asFunction(() => {
          const pool = getPoolFromDatabase(database);
          return new EntityEmbeddingRepository(pool, logger, database);
        }).singleton(),
        [CONTAINER_TOKENS.CONCEPT_EMBEDDING_REPOSITORY]: asFunction(() => {
          const pool = getPoolFromDatabase(database);
          return new ConceptEmbeddingRepository(pool, logger, database);
        }).singleton(),
        // User Feedback Repository
        [CONTAINER_TOKENS.USER_FEEDBACK_REPOSITORY]: asClass(
          UserFeedbackRepository
        ).singleton(),
        // Waitlist Repository
        [CONTAINER_TOKENS.WAITLIST_REPOSITORY]: asClass(
          WaitlistRepository
        ).singleton(),
        // Platform Workflow Repository (Insight Generation)
        [CONTAINER_TOKENS.PLATFORM_WORKFLOW_REPOSITORY]: asFunction(() => {
          return new PlatformWorkflowRepository({ db: database, logger });
        }).singleton(),
        // Company Document Repository (RAG document storage)
        [CONTAINER_TOKENS.COMPANY_DOCUMENT_REPOSITORY]: asClass(
          CompanyDocumentRepository
        ).singleton(),
        // Insight Generation Job Repository (persistent job storage)
        [CONTAINER_TOKENS.INSIGHT_GENERATION_JOB_REPOSITORY]: asClass(
          InsightGenerationJobRepository
        ).singleton(),
        // User Preferences Repository (peer insights opt-in)
        [CONTAINER_TOKENS.USER_PREFERENCES_REPOSITORY]: asClass(
          UserPreferencesRepository
        ).singleton(),
        // Group Repository
        [CONTAINER_TOKENS.GROUP_REPOSITORY]: asClass(
          GroupRepository
        ).singleton(),
        // User Workstream Repository (context stitching)
        [CONTAINER_TOKENS.USER_WORKSTREAM_REPOSITORY]: asClass(
          UserWorkstreamRepository
        ).singleton(),
      });

      // Register services as singletons
      this.rootContainer.register({
        [CONTAINER_TOKENS.HIERARCHY_SERVICE]:
          asClass(HierarchyService).singleton(),
        [CONTAINER_TOKENS.MULTI_SOURCE_EXTRACTOR]:
          asClass(MultiSourceExtractor).singleton(),
        // JWT services
        [CONTAINER_TOKENS.JWT_SERVICE]: asClass(JWTService).singleton(),
        [CONTAINER_TOKENS.REFRESH_TOKEN_SERVICE]:
          asClass(RefreshTokenService).singleton(),
        // Node permission services
        [CONTAINER_TOKENS.NODE_PERMISSION_SERVICE]: asClass(
          NodePermissionService
        ).singleton(),
        [CONTAINER_TOKENS.ORGANIZATION_SERVICE]:
          asClass(OrganizationService).singleton(),
        [CONTAINER_TOKENS.USER_SERVICE]: asClass(UserService).singleton(),
        [CONTAINER_TOKENS.UPDATES_SERVICE]: asClass(UpdatesService).singleton(),
        // GraphRAG services
        [CONTAINER_TOKENS.OPENAI_EMBEDDING_SERVICE]: asClass(
          OpenAIEmbeddingService
        ).singleton(),
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_SERVICE]: asClass(
          PgVectorGraphRAGService
        ).singleton(),
        // Experience matches service
        [CONTAINER_TOKENS.EXPERIENCE_MATCHES_SERVICE]: asClass(
          ExperienceMatchesService
        ).singleton(),
        // Transaction manager
        [CONTAINER_TOKENS.TRANSACTION_MANAGER]:
          asClass(TransactionManager).singleton(),
        // LLM provider
        [CONTAINER_TOKENS.LLM_PROVIDER]: asFunction(() => {
          const config = getLLMConfig();
          return createLLMProvider(config);
        }).singleton(),
        // LLM summary service
        [CONTAINER_TOKENS.LLM_SUMMARY_SERVICE]:
          asClass(LLMSummaryService).singleton(),
        // LIG-207: Career Trajectory Matching Components
        [CONTAINER_TOKENS.TRAJECTORY_SCORER]:
          asClass(TrajectoryScorer).singleton(),
        [CONTAINER_TOKENS.ANCHORED_ALIGNMENT_ENGINE]: asFunction(
          ({ trajectoryScorer }) => {
            return new AnchoredAlignmentEngine(
              DEFAULT_CONFIG.gapOpenPenalty,
              DEFAULT_CONFIG.gapExtendPenalty,
              trajectoryScorer
            );
          }
        ).singleton(),
        [CONTAINER_TOKENS.CAREER_SEQUENCE_EXTRACTOR]: asFunction(
          ({ logger }) => {
            return new CareerSequenceExtractor(
              DEFAULT_CONFIG.timeWindowYears,
              logger
            );
          }
        ).singleton(),
        // LIG-207: Career Insights Generator Service
        [CONTAINER_TOKENS.CAREER_INSIGHTS_GENERATOR_SERVICE]: asClass(
          CareerInsightsGeneratorService
        ).singleton(),
        // LIG-207: Career Trajectory Matching Services
        [CONTAINER_TOKENS.JOB_APPLICATION_TRAJECTORY_MATCHER_SERVICE]: asClass(
          JobApplicationTrajectoryMatcherService
        ).singleton(),
        [CONTAINER_TOKENS.CANDIDATE_TIMELINE_FETCHER]: asClass(
          CandidateTimelineFetcher
        ).singleton(),
        [CONTAINER_TOKENS.SCORE_MERGING_SERVICE]:
          asClass(ScoreMergingService).singleton(),
        [CONTAINER_TOKENS.EXPLANATION_MERGING_SERVICE]: asClass(
          ExplanationMergingService
        ).singleton(),
        [CONTAINER_TOKENS.HYBRID_JOB_APPLICATION_MATCHING_SERVICE]: asClass(
          HybridJobApplicationMatchingService
        ).singleton(),
        // LIG-217: File Upload Services (optional - only if GCP credentials configured)
        [CONTAINER_TOKENS.GCS_UPLOAD_SERVICE]:
          process.env.GCP_SERVICE_ACCOUNT_KEY && process.env.GCP_BUCKET_NAME
            ? asClass(GcsUploadService).singleton()
            : asValue(undefined),
        [CONTAINER_TOKENS.STORAGE_QUOTA_SERVICE]:
          asClass(StorageQuotaService).singleton(),
        // LIG-247: Session Services
        [CONTAINER_TOKENS.SESSION_CLASSIFIER_SERVICE]: asClass(
          SessionClassifierService
        ).singleton(),
        [CONTAINER_TOKENS.SESSION_SERVICE]: asClass(SessionService).singleton(),
        // Workflow Analysis Service
        [CONTAINER_TOKENS.WORKFLOW_ANALYSIS_SERVICE]: asClass(
          WorkflowAnalysisService
        ).singleton(),
        // Graph RAG Entity Extraction Service
        [CONTAINER_TOKENS.ENTITY_EXTRACTION_SERVICE]: asClass(
          EntityExtractionService
        ).singleton(),
        // ArangoDB Graph Service
        [CONTAINER_TOKENS.ARANGODB_GRAPH_SERVICE]: asClass(
          ArangoDBGraphService
        ).singleton(),
        // Helix Graph Service
        [CONTAINER_TOKENS.HELIX_GRAPH_SERVICE]: asFunction(({ logger, database, openAIEmbeddingService }) => {
          const pool = getPoolFromDatabase(database);
          return new HelixGraphService({ logger, pool, db: database, embeddingService: openAIEmbeddingService });
        }).singleton(),
        // Generic Graph Service (selected by GRAPH_DB_PROVIDER)
        [CONTAINER_TOKENS.GRAPH_SERVICE]: asFunction(({ arangoDBGraphService, helixGraphService, logger }) => {
          const provider = process.env.GRAPH_DB_PROVIDER || 'arango';
          if (provider === 'helix') {
            logger.info('📊 Using Helix DB for graph operations');
            return helixGraphService;
          }
          logger.info('📊 Using ArangoDB for graph operations');
          return arangoDBGraphService;
        }).singleton(),
        // Cross-Session Retrieval Service
        [CONTAINER_TOKENS.CROSS_SESSION_RETRIEVAL_SERVICE]: asClass(
          CrossSessionRetrievalService
        ).singleton(),
        // Hierarchical Workflow Services
        [CONTAINER_TOKENS.TOOL_GENERALIZATION_SERVICE]: asClass(
          ToolGeneralizationService
        ).singleton(),
        [CONTAINER_TOKENS.CONFIDENCE_SCORING_SERVICE]: asClass(
          ConfidenceScoringService
        ).singleton(),
        [CONTAINER_TOKENS.BLOCK_EXTRACTION_SERVICE]: asClass(
          BlockExtractionService
        ).singleton(),
        [CONTAINER_TOKENS.BLOCK_CANONICALIZATION_SERVICE]: asClass(
          BlockCanonicalizationService
        ).singleton(),
        [CONTAINER_TOKENS.BLOCK_LINKING_SERVICE]: asClass(
          BlockLinkingService
        ).singleton(),
        [CONTAINER_TOKENS.STEP_EXTRACTION_SERVICE]: asClass(
          StepExtractionService
        ).singleton(),
        [CONTAINER_TOKENS.HIERARCHICAL_TOP_WORKFLOWS_SERVICE]: asClass(
          HierarchicalTopWorkflowsService
        ).singleton(),
        // User Feedback Service
        [CONTAINER_TOKENS.USER_FEEDBACK_SERVICE]: asClass(
          UserFeedbackService
        ).singleton(),
        // Waitlist Service
        [CONTAINER_TOKENS.WAITLIST_SERVICE]: asClass(
          WaitlistService
        ).singleton(),
        // Natural Language Query Service (RAG pipeline)
        // Now includes pool for company document vector search
        // Uses generic graphService which respects GRAPH_DB_PROVIDER (helix or arango)
        [CONTAINER_TOKENS.NATURAL_LANGUAGE_QUERY_SERVICE]: asFunction(({
          logger,
          llmProvider,
          openAIEmbeddingService,
          graphService,
          workflowScreenshotRepository,
        }) => {
          const pool = getPoolFromDatabase(database);
          return new NaturalLanguageQueryService({
            logger,
            llmProvider,
            openAIEmbeddingService,
            graphService,
            workflowScreenshotRepository,
            pool,
          });
        }).singleton(),
        // Progress Snapshot Service
        [CONTAINER_TOKENS.PROGRESS_SNAPSHOT_SERVICE]: asClass(
          ProgressSnapshotService
        ).singleton(),
        // Insight Assistant Service
        [CONTAINER_TOKENS.INSIGHT_ASSISTANT_SERVICE]: asClass(
          InsightAssistantService
        ).singleton(),
        // Workflow Anonymizer Service (for platform patterns)
        [CONTAINER_TOKENS.WORKFLOW_ANONYMIZER_SERVICE]: asClass(
          WorkflowAnonymizerService
        ).singleton(),
        // Multi-Agent Insight Generation Service
        // Note: Company docs are now retrieved via NLQ service's searchCompanyDocuments()
        [CONTAINER_TOKENS.INSIGHT_GENERATION_SERVICE]: asFunction(({
          logger,
          llmProvider,
          naturalLanguageQueryService,
          platformWorkflowRepository,
          sessionMappingRepository,
          openAIEmbeddingService,
          insightGenerationJobRepository,
          personaService,
          memoryService,
          graphService,
        }) => {
          return new InsightGenerationService({
            logger,
            llmProvider,
            nlqService: naturalLanguageQueryService,
            platformWorkflowRepository,
            sessionMappingRepository,
            embeddingService: openAIEmbeddingService,
            insightGenerationJobRepository,
            perplexityApiKey: process.env.PERPLEXITY_API_KEY,
            companyDocsEnabled: process.env.COMPANY_DOCS_ENABLED !== 'false', // Default to true
            personaService,
            memoryService,
            graphService,
          });
        }).singleton(),
        // Company Documents Services (RAG document processing)
        [CONTAINER_TOKENS.DOCUMENT_PARSER_SERVICE]: asClass(
          DocumentParserService
        ).singleton(),
        [CONTAINER_TOKENS.DOCUMENT_CHUNKER_SERVICE]: asClass(
          DocumentChunkerService
        ).singleton(),
        [CONTAINER_TOKENS.COMPANY_DOCUMENT_PROCESSING_SERVICE]: asFunction(({
          logger,
          openAIEmbeddingService,
          companyDocumentRepository,
          documentParserService,
          documentChunkerService,
          gcsUploadService,
        }) => {
          const pool = getPoolFromDatabase(database);
          return new CompanyDocumentProcessingService({
            logger,
            embeddingService: openAIEmbeddingService,
            companyDocumentRepository,
            documentParserService,
            documentChunkerService,
            pool,
            downloadDocument: gcsUploadService
              ? (key: string) => gcsUploadService.downloadFile(key)
              : async () => { throw new Error('GCS not configured'); },
          });
        }).singleton(),
        [CONTAINER_TOKENS.COMPANY_DOCUMENT_SEARCH_SERVICE]: asFunction(({
          logger,
          openAIEmbeddingService,
          companyDocumentRepository,
        }) => {
          const pool = getPoolFromDatabase(database);
          return new CompanyDocumentSearchService({
            logger,
            embeddingService: openAIEmbeddingService,
            companyDocumentRepository,
            pool,
          });
        }).singleton(),
        // Persona Services (Insight Assistant persona-based suggestions)
        [CONTAINER_TOKENS.PERSONA_SERVICE]: asFunction(({
          logger,
          hierarchyRepository,
          sessionMappingRepository,
        }) => {
          return new PersonaService({
            hierarchyRepository,
            sessionMappingRepository,
            logger,
          });
        }).singleton(),
        [CONTAINER_TOKENS.PERSONA_SUGGESTION_SERVICE]: asFunction(({
          logger,
          personaService,
          sessionMappingRepository,
        }) => {
          return new PersonaSuggestionService({
            personaService,
            sessionMappingRepository,
            logger,
          });
        }).singleton(),
        // Conversation Memory Service (Mem0 integration for follow-up questions)
        [CONTAINER_TOKENS.MEMORY_SERVICE]: asFunction(({
          logger,
          openAIEmbeddingService,
        }) => {
          return new MemoryService({
            logger,
            embeddingService: openAIEmbeddingService,
            config: {
              enabled: process.env.MEMORY_SERVICE_ENABLED !== 'false',
              openAiApiKey: process.env.OPENAI_API_KEY,
              maxMemoriesToRetrieve: 5,
              minRelevanceScore: 0.7,
            },
          });
        }).singleton(),
        // Peer Insights Services
        [CONTAINER_TOKENS.PEER_PREFERENCES_SERVICE]: asClass(
          PeerPreferencesService
        ).singleton(),
        [CONTAINER_TOKENS.PEER_INSIGHTS_SERVICE]: asClass(
          PeerInsightsService
        ).singleton(),
        // Group Service
        [CONTAINER_TOKENS.GROUP_SERVICE]: asClass(GroupService).singleton(),
        // Context Stitching Endpoint Service (pre-computed stitching)
        [CONTAINER_TOKENS.CONTEXT_STITCHING_ENDPOINT_SERVICE]: asClass(
          ContextStitchingEndpointService
        ).singleton(),
      });

      // Register controllers as transient (new instance per request)
      this.rootContainer.register({
        [CONTAINER_TOKENS.AUTH_CONTROLLER]: asClass(AuthController).transient(),

        [CONTAINER_TOKENS.HIERARCHY_CONTROLLER]:
          asClass(HierarchyController).transient(),
        [CONTAINER_TOKENS.USER_ONBOARDING_CONTROLLER]: asClass(
          UserOnboardingController
        ).transient(),
        // Node permission controllers
        [CONTAINER_TOKENS.NODE_PERMISSION_CONTROLLER]: asClass(
          NodePermissionController
        ).transient(),
        [CONTAINER_TOKENS.USER_CONTROLLER]: asClass(UserController).transient(),
        [CONTAINER_TOKENS.ORGANIZATION_CONTROLLER]: asClass(
          OrganizationController
        ).transient(),
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_CONTROLLER]: asClass(
          PgVectorGraphRAGController
        ).transient(),
        [CONTAINER_TOKENS.EXPERIENCE_MATCHES_CONTROLLER]: asClass(
          ExperienceMatchesController
        ).transient(),
        [CONTAINER_TOKENS.UPDATES_CONTROLLER]:
          asClass(UpdatesController).transient(),
        // LIG-217: File Upload Controller
        [CONTAINER_TOKENS.FILES_CONTROLLER]:
          asClass(FilesController).transient(),
        // LIG-247: Session Controller
        [CONTAINER_TOKENS.SESSION_CONTROLLER]:
          asClass(SessionController).transient(),
        // Desktop App Track Controller
        [CONTAINER_TOKENS.DESKTOP_TRACK_CONTROLLER]: asClass(
          DesktopTrackController
        ).transient(),
        // Workflow Analysis Controller
        [CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER]: asClass(
          WorkflowAnalysisController
        ).transient(),
        // User Feedback Controller
        [CONTAINER_TOKENS.USER_FEEDBACK_CONTROLLER]: asClass(
          UserFeedbackController
        ).transient(),
        // Insight Assistant Controller
        [CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER]: asClass(
          InsightAssistantController
        ).transient(),
        // Company Documents Controller
        [CONTAINER_TOKENS.COMPANY_DOCUMENTS_CONTROLLER]: asClass(
          CompanyDocumentsController
        ).transient(),
        // Group Controller
        [CONTAINER_TOKENS.GROUP_CONTROLLER]: asClass(
          GroupController
        ).transient(),
      });

      this.isConfigured = true;
      logger.info('✅ Awilix container configured successfully');

      return this.rootContainer;
    } catch (error) {
      logger.error(
        '❌ Failed to configure Awilix container:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get the root container instance
   * @throws {Error} If container hasn't been configured
   */
  static getContainer(): AwilixContainer {
    if (!this.rootContainer) {
      throw new Error('Container not configured. Call configure() first.');
    }
    return this.rootContainer;
  }

  /**
   * Create a request-scoped container for per-request dependencies
   * Request scopes inherit all registrations from the root container
   * but can have their own request-specific values
   */
  static createRequestScope(): AwilixContainer {
    return this.getContainer().createScope();
  }

  /**
   * Dispose of container resources (database connections, etc.)
   * This should be called when shutting down the application
   */
  static async dispose(): Promise<void> {
    if (this.rootContainer) {
      // Manually dispose database connection since we're not using the disposer pattern
      try {
        const database = this.rootContainer.resolve(CONTAINER_TOKENS.DATABASE);
        await disposeDatabaseConnection(database);
      } catch (error) {
        // Database might not be registered or already disposed

        console.warn('Could not dispose database connection:', error);
      }

      await this.rootContainer.dispose();
    }
  }

  /**
   * Reset container (mainly for testing)
   * Clears the singleton instance and configuration state
   */
  static reset(): void {
    this.isConfigured = false;

    this.rootContainer = null as any;
  }
}
