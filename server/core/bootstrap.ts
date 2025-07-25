import { pool, db } from '../db';
import Database from '@replit/database';
import { container, SERVICE_KEYS } from './container';
import { createLLMProvider, getLLMConfig } from './llm-provider';

// Repository imports
import { UserRepository } from '../repositories/user-repository';
import { ProfileRepository } from '../repositories/profile-repository';
import { SkillRepository } from '../repositories/skill-repository';

// Service imports
import { UserService } from '../services/user-service';
import { ProfileService } from '../services/profile-service';
import { AIService } from '../services/ai-service';
import { SkillService } from '../services/skill-service';
import { SkillExtractor } from '../services/ai/skill-extractor';

export async function bootstrapContainer() {
  // Infrastructure
  container.register(SERVICE_KEYS.DATABASE, () => db);

  container.register(SERVICE_KEYS.REDIS, () => {
    return new Database();
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

  // Services
  container.register(
    SERVICE_KEYS.USER_SERVICE,
    (userRepository) => new UserService(userRepository),
    { dependencies: [SERVICE_KEYS.USER_REPOSITORY] }
  );

  container.register(
    SERVICE_KEYS.PROFILE_SERVICE,
    (profileRepository) => new ProfileService(profileRepository),
    { dependencies: [SERVICE_KEYS.PROFILE_REPOSITORY] }
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
