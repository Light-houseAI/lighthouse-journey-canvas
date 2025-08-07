import { pool, db } from '../db';
import { RedisAdapter } from '../adapters/redis-adapter';
import { container, SERVICE_KEYS } from './container';
import { createLLMProvider, getLLMConfig } from './llm-provider';

// Repository imports
import { UserRepository } from '../repositories/user-repository';
import { ProfileRepository } from '../repositories/profile-repository';
import { SkillRepository } from '../repositories/skill-repository';
import { JobRepository } from '../repositories/job-repository';
import { EducationRepository } from '../repositories/education-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { ActionRepository } from '../repositories/action-repository';
import { EventRepository } from '../repositories/event-repository';
import { CareerTransitionRepository } from '../repositories/career-transition-repository';

// Service imports
import { UserService } from '../services/user-service';
import { ProfileService } from '../services/profile-service';
import { AIService } from '../services/ai-service';
import { SkillService } from '../services/skill-service';
import { JobService } from '../services/job-service';
import { EducationService } from '../services/education-service';
import { ProjectService } from '../services/project-service';
import { ActionService } from '../services/action-service';
import { EventService } from '../services/event-service';
import { CareerTransitionService } from '../services/career-transition-service';
import { SkillExtractor } from '../services/ai/skill-extractor';

export async function bootstrapContainer() {
  // Infrastructure
  container.register(SERVICE_KEYS.DATABASE, () => db);

  container.register(SERVICE_KEYS.REDIS, () => {
    return new RedisAdapter();
  });

  container.register(SERVICE_KEYS.LOGGER, () => {
    return {
      info: (message: string, ...args: any[]) => console.log(message, ...args),
      error: (message: string, ...args: any[]) => console.error(message, ...args),
      warn: (message: string, ...args: any[]) => console.warn(message, ...args),
      debug: (message: string, ...args: any[]) => console.debug(message, ...args),
    };
  });

  // LLM Provider
  container.register(SERVICE_KEYS.LLM_PROVIDER, () => {
    const config = getLLMConfig();
    return createLLMProvider(config);
  });

  // Repositories
  container.register(
    SERVICE_KEYS.USER_REPOSITORY,
    (database) => new UserRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.PROFILE_REPOSITORY,
    (database) => new ProfileRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.SKILL_REPOSITORY,
    (database) => new SkillRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.JOB_REPOSITORY,
    (database) => new JobRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.EDUCATION_REPOSITORY,
    (database) => new EducationRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.PROJECT_REPOSITORY,
    (database) => new ProjectRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.ACTION_REPOSITORY,
    (database) => new ActionRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.EVENT_REPOSITORY,
    (database) => new EventRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  container.register(
    SERVICE_KEYS.CAREER_TRANSITION_REPOSITORY,
    (database) => new CareerTransitionRepository(database),
    { dependencies: [SERVICE_KEYS.DATABASE] }
  );

  // Services
  container.register(
    SERVICE_KEYS.USER_SERVICE,
    (userRepository) => new UserService(userRepository),
    { dependencies: [SERVICE_KEYS.USER_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.PROFILE_SERVICE,
    (profileRepository, jobRepo, eduRepo, projRepo, actionRepo, eventRepo, careerTransitionRepo) => 
      new ProfileService(profileRepository, jobRepo, eduRepo, projRepo, actionRepo, eventRepo, careerTransitionRepo),
    { 
      dependencies: [
        SERVICE_KEYS.PROFILE_REPOSITORY,
        SERVICE_KEYS.JOB_REPOSITORY,
        SERVICE_KEYS.EDUCATION_REPOSITORY,
        SERVICE_KEYS.PROJECT_REPOSITORY,
        SERVICE_KEYS.ACTION_REPOSITORY,
        SERVICE_KEYS.EVENT_REPOSITORY,
        SERVICE_KEYS.CAREER_TRANSITION_REPOSITORY
      ] 
    }
  );

  container.register(
    SERVICE_KEYS.AI_SERVICE,
    (llmProvider) => new AIService(llmProvider),
    { dependencies: [SERVICE_KEYS.LLM_PROVIDER] }
  );

  container.register(
    SERVICE_KEYS.SKILL_SERVICE,
    (skillRepository, llmProvider) => new SkillService(skillRepository, llmProvider),
    { dependencies: [SERVICE_KEYS.SKILL_REPOSITORY, SERVICE_KEYS.LLM_PROVIDER] }
  );

  container.register(
    SERVICE_KEYS.JOB_SERVICE,
    (jobRepository) => new JobService(jobRepository),
    { dependencies: [SERVICE_KEYS.JOB_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.EDUCATION_SERVICE,
    (eduRepository) => new EducationService(eduRepository),
    { dependencies: [SERVICE_KEYS.EDUCATION_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.PROJECT_SERVICE,
    (projRepository) => new ProjectService(projRepository),
    { dependencies: [SERVICE_KEYS.PROJECT_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.ACTION_SERVICE,
    (actionRepository) => new ActionService(actionRepository),
    { dependencies: [SERVICE_KEYS.ACTION_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.EVENT_SERVICE,
    (eventRepository) => new EventService(eventRepository),
    { dependencies: [SERVICE_KEYS.EVENT_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.CAREER_TRANSITION_SERVICE,
    (careerTransitionRepository) => new CareerTransitionService(careerTransitionRepository),
    { dependencies: [SERVICE_KEYS.CAREER_TRANSITION_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.SKILL_EXTRACTOR,
    (llmProvider) => new SkillExtractor(llmProvider),
    { dependencies: [SERVICE_KEYS.LLM_PROVIDER] }
  );

  console.log('Dependency injection container bootstrapped successfully');
}

// Helper function to get service instances
export async function getService<T>(key: symbol): Promise<T> {
  return await container.resolve<T>(key);
}

// Type-safe service getters
export const getDatabase = () => getService(SERVICE_KEYS.DATABASE);
export const getRedis = () => getService(SERVICE_KEYS.REDIS);
export const getLogger = () => getService(SERVICE_KEYS.LOGGER);
export const getLLMProvider = () => getService(SERVICE_KEYS.LLM_PROVIDER);
export const getUserService = () => getService(SERVICE_KEYS.USER_SERVICE);
export const getProfileService = () => getService(SERVICE_KEYS.PROFILE_SERVICE);
export const getSkillService = () => getService(SERVICE_KEYS.SKILL_SERVICE);
export const getAIService = () => getService(SERVICE_KEYS.AI_SERVICE);
export const getSkillExtractor = () => getService(SERVICE_KEYS.SKILL_EXTRACTOR);
export const getJobService = () => getService(SERVICE_KEYS.JOB_SERVICE);
export const getEducationService = () => getService(SERVICE_KEYS.EDUCATION_SERVICE);
export const getProjectService = () => getService(SERVICE_KEYS.PROJECT_SERVICE);
