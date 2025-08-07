/**
 * Dependency Injection Container Configuration
 * 
 * Configures typed-inject DI container for the API revamp project.
 * Provides centralized dependency management following PRD specifications.
 */

import { createInjector, Injector } from 'typed-inject';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { RedisAdapter } from '../adapters/redis-adapter';

/**
 * Service tokens for typed-inject
 * Using symbols to ensure uniqueness and avoid naming collisions
 */
export const SERVICE_TOKENS = {
  // Core Infrastructure
  DATABASE: Symbol('DATABASE'),
  REDIS: Symbol('REDIS'),
  LOGGER: Symbol('LOGGER'),
  CONFIG: Symbol('CONFIG'),
  
  // Core Repository Tokens (MVP - Milestone 1)
  WORK_EXPERIENCE_REPOSITORY: Symbol('WORK_EXPERIENCE_REPOSITORY'),
  EDUCATION_REPOSITORY: Symbol('EDUCATION_REPOSITORY'), 
  PROJECT_REPOSITORY: Symbol('PROJECT_REPOSITORY'),
  
  // Extended Repository Tokens (Future - Milestone 3)
  EVENT_REPOSITORY: Symbol('EVENT_REPOSITORY'),
  ACTION_REPOSITORY: Symbol('ACTION_REPOSITORY'),
  CAREER_TRANSITION_REPOSITORY: Symbol('CAREER_TRANSITION_REPOSITORY'),
  
  // Core Service Tokens (MVP - Milestone 1)
  WORK_EXPERIENCE_SERVICE: Symbol('WORK_EXPERIENCE_SERVICE'),
  EDUCATION_SERVICE: Symbol('EDUCATION_SERVICE'),
  PROJECT_SERVICE: Symbol('PROJECT_SERVICE'),
  
  // Extended Service Tokens (Future - Milestone 3)
  EVENT_SERVICE: Symbol('EVENT_SERVICE'),
  ACTION_SERVICE: Symbol('ACTION_SERVICE'),
  CAREER_TRANSITION_SERVICE: Symbol('CAREER_TRANSITION_SERVICE'),
  
  // Profile and Aggregation Services
  PROFILE_SERVICE: Symbol('PROFILE_SERVICE'),
  PROFILE_AGGREGATION_SERVICE: Symbol('PROFILE_AGGREGATION_SERVICE'),
  
  // Existing Services (Compatibility)
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  SKILL_REPOSITORY: Symbol('SKILL_REPOSITORY'),
  USER_SERVICE: Symbol('USER_SERVICE'),
  SKILL_SERVICE: Symbol('SKILL_SERVICE'),
  AI_SERVICE: Symbol('AI_SERVICE'),
  
  // AI/LLM Services
  LLM_PROVIDER: Symbol('LLM_PROVIDER'),
  CAREER_AGENT: Symbol('CAREER_AGENT'),
  SKILL_EXTRACTOR: Symbol('SKILL_EXTRACTOR'),
  CONTEXT_MANAGER: Symbol('CONTEXT_MANAGER'),
} as const;

/**
 * Type definitions for the injector context
 */
export interface DIContext {
  [SERVICE_TOKENS.DATABASE]: NodePgDatabase<any>;
  [SERVICE_TOKENS.REDIS]: RedisAdapter;
  [SERVICE_TOKENS.LOGGER]: any;
  [SERVICE_TOKENS.CONFIG]: any;
}

/**
 * Create and configure the main DI container
 * 
 * This function sets up the typed-inject injector with all necessary
 * service registrations following the repository and service patterns.
 * 
 * @returns Configured injector instance
 */
export function createDIContainer(): Injector<{}> {
  // Start with empty injector - services will be registered by bootstrap
  const injector = createInjector();
  
  return injector;
}

/**
 * Configure repositories in the DI container
 * 
 * @param injector - The injector to configure
 * @param database - Database connection
 * @returns Injector with repository services registered
 */
export function configureRepositories(
  injector: Injector<any>,
  database: NodePgDatabase<any>
): Injector<any> {
  // Import repository implementations
  const { WorkExperienceRepository } = require('../repositories/work-experience-repository');
  const { EducationRepository } = require('../repositories/education-repository');
  const { ProjectRepository } = require('../repositories/project-repository');
  const { ProfileRepository } = require('../repositories/profile-repository');
  const { UserRepository } = require('../repositories/user-repository');
  const { SkillRepository } = require('../repositories/skill-repository');

  return injector
    .provideValue(SERVICE_TOKENS.DATABASE, database)
    
    // Core Node Repositories (MVP)
    .provideFactory(SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY, 
      [SERVICE_TOKENS.DATABASE], 
      (db: NodePgDatabase<any>) => new WorkExperienceRepository(db))
    
    .provideFactory(SERVICE_TOKENS.EDUCATION_REPOSITORY,
      [SERVICE_TOKENS.DATABASE],
      (db: NodePgDatabase<any>) => new EducationRepository(db))
    
    .provideFactory(SERVICE_TOKENS.PROJECT_REPOSITORY,
      [SERVICE_TOKENS.DATABASE],
      (db: NodePgDatabase<any>) => new ProjectRepository(db))
    
    // Existing repositories for compatibility
    .provideFactory(SERVICE_TOKENS.USER_REPOSITORY,
      [SERVICE_TOKENS.DATABASE],
      (db: NodePgDatabase<any>) => new UserRepository(db))
    
    .provideFactory(SERVICE_TOKENS.SKILL_REPOSITORY,
      [SERVICE_TOKENS.DATABASE],
      (db: NodePgDatabase<any>) => new SkillRepository(db))
    
    // Profile repository injection will be handled separately since it has different dependencies
    .provideFactory(Symbol('PROFILE_REPOSITORY'),
      [SERVICE_TOKENS.DATABASE],
      (db: NodePgDatabase<any>) => new ProfileRepository(db));
}

/**
 * Configure services in the DI container
 * 
 * @param injector - The injector to configure
 * @returns Injector with business services registered
 */
export function configureServices(injector: Injector<any>): Injector<any> {
  // Import service implementations
  const { WorkExperienceService } = require('../services/work-experience-service');
  const { EducationService } = require('../services/education-service');
  const { ProjectService } = require('../services/project-service');
  const { ProfileService } = require('../services/profile-service');
  const { UserService } = require('../services/user-service');
  const { SkillService } = require('../services/skill-service');

  return injector
    // Core Node Services (MVP)
    .provideFactory(SERVICE_TOKENS.WORK_EXPERIENCE_SERVICE,
      [SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY],
      (repository: any) => new WorkExperienceService(repository))
    
    .provideFactory(SERVICE_TOKENS.EDUCATION_SERVICE,
      [SERVICE_TOKENS.EDUCATION_REPOSITORY],
      (repository: any) => new EducationService(repository))
    
    .provideFactory(SERVICE_TOKENS.PROJECT_SERVICE,
      [SERVICE_TOKENS.PROJECT_REPOSITORY],
      (repository: any) => new ProjectService(repository))
    
    // Enhanced Profile Service with aggregation capabilities
    .provideFactory(SERVICE_TOKENS.PROFILE_SERVICE,
      [
        Symbol('PROFILE_REPOSITORY'),
        SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY,
        SERVICE_TOKENS.EDUCATION_REPOSITORY,
        SERVICE_TOKENS.PROJECT_REPOSITORY
      ],
      (profileRepository: any, workExpRepo: any, eduRepo: any, projRepo: any) => 
        new ProfileService(profileRepository, workExpRepo, eduRepo, projRepo))
    
    // Existing services for compatibility
    .provideFactory(SERVICE_TOKENS.USER_SERVICE,
      [SERVICE_TOKENS.USER_REPOSITORY],
      (repository: any) => new UserService(repository))
    
    .provideFactory(SERVICE_TOKENS.SKILL_SERVICE,
      [SERVICE_TOKENS.SKILL_REPOSITORY],
      (repository: any) => new SkillService(repository));
}

/**
 * Configure infrastructure services in the DI container
 * 
 * @param injector - The injector to configure
 * @param redis - Redis connection (optional)
 * @param logger - Logger instance
 * @param config - Configuration object
 * @returns Injector with infrastructure services registered
 */
export function configureInfrastructure(
  injector: Injector<any>,
  options: {
    redis?: RedisAdapter;
    logger?: any;
    config?: any;
  } = {}
): Injector<any> {
  let configuredInjector = injector;
  
  if (options.redis) {
    configuredInjector = configuredInjector.provideValue(SERVICE_TOKENS.REDIS, options.redis);
  }
  
  if (options.logger) {
    configuredInjector = configuredInjector.provideValue(SERVICE_TOKENS.LOGGER, options.logger);
  }
  
  if (options.config) {
    configuredInjector = configuredInjector.provideValue(SERVICE_TOKENS.CONFIG, options.config);
  }
  
  return configuredInjector;
}

/**
 * Create a fully configured DI container with all dependencies
 * 
 * This is the main function used by the application bootstrap process
 * to create a production-ready DI container.
 * 
 * @param dependencies - Required dependencies
 * @returns Fully configured injector
 */
export function createConfiguredDIContainer(dependencies: {
  database: NodePgDatabase<any>;
  redis?: RedisAdapter;
  logger?: any;
  config?: any;
}): Injector<any> {
  let injector = createDIContainer();
  
  // Configure infrastructure
  injector = configureInfrastructure(injector, {
    redis: dependencies.redis,
    logger: dependencies.logger,
    config: dependencies.config,
  });
  
  // Configure repositories
  injector = configureRepositories(injector, dependencies.database);
  
  // Configure services
  injector = configureServices(injector);
  
  return injector;
}

/**
 * Type helper to extract the injector context type
 */
export type DIContainer = ReturnType<typeof createConfiguredDIContainer>;

/**
 * Utility function to check if a service token is registered
 */
export function isServiceRegistered(injector: Injector<any>, token: symbol): boolean {
  try {
    injector.resolve(token);
    return true;
  } catch {
    return false;
  }
}

// Re-export types and utilities from typed-inject for convenience
export { createInjector, Injector } from 'typed-inject';