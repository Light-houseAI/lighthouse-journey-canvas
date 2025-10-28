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
// Controllers
import { AuthController } from '../controllers/auth.controller';
import { ExperienceMatchesController } from '../controllers/experience-matches.controller';
import { FilesController } from '../controllers/files.controller';
import { HierarchyController } from '../controllers/hierarchy.controller';
import { NodePermissionController } from '../controllers/node-permission.controller';
import { OrganizationController } from '../controllers/organization.controller';
import { PgVectorGraphRAGController } from '../controllers/pgvector-graphrag.controller';
import { UpdatesController } from '../controllers/updates.controller';
import { UserController } from '../controllers/user.controller';
import { UserOnboardingController } from '../controllers/user-onboarding.controller';
// Repositories
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { InsightRepository } from '../repositories/insight-repository';
import { NodePermissionRepository } from '../repositories/node-permission.repository';
import { OrganizationRepository } from '../repositories/organization.repository';
import { PgVectorGraphRAGRepository } from '../repositories/pgvector-graphrag.repository';
import { DatabaseRefreshTokenRepository } from '../repositories/refresh-token.repository';
import { StorageQuotaRepository } from '../repositories/storage-quota.repository';
import { UpdatesRepository } from '../repositories/updates.repository';
import { UserRepository } from '../repositories/user-repository';
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
import { StorageQuotaService } from '../services/storage-quota.service';
import { TransactionManager } from '../services/transaction-manager.service';
import { UpdatesService } from '../services/updates.service';
import { UserService } from '../services/user-service';
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
        // LIG-217: File Upload Services
        [CONTAINER_TOKENS.GCS_UPLOAD_SERVICE]:
          asClass(GcsUploadService).singleton(),
        [CONTAINER_TOKENS.STORAGE_QUOTA_SERVICE]:
          asClass(StorageQuotaService).singleton(),
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
