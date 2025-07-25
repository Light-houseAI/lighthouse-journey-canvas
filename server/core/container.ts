import { Pool } from '@neondatabase/serverless';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import Database from '@replit/database';

type ServiceKey = string | symbol;
type ServiceFactory<T = any> = (...deps: any[]) => T | Promise<T>;
type ServiceInstance<T = any> = T;

interface ServiceDefinition<T = any> {
  factory: ServiceFactory<T>;
  dependencies: ServiceKey[];
  singleton: boolean;
  instance?: ServiceInstance<T>;
}

export class Container {
  private services = new Map<ServiceKey, ServiceDefinition>();
  private resolving = new Set<ServiceKey>();

  register<T>(
    key: ServiceKey,
    factory: ServiceFactory<T>,
    options: {
      dependencies?: ServiceKey[];
      singleton?: boolean;
    } = {}
  ): this {
    this.services.set(key, {
      factory,
      dependencies: options.dependencies || [],
      singleton: options.singleton ?? true,
    });
    return this;
  }

  async resolve<T>(key: ServiceKey): Promise<T> {
    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected: ${String(key)}`);
    }

    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service not registered: ${String(key)}`);
    }

    if (service.singleton && service.instance) {
      return service.instance;
    }

    this.resolving.add(key);

    try {
      const dependencies = await Promise.all(
        service.dependencies.map(dep => this.resolve(dep))
      );

      const instance = await service.factory(...dependencies);

      if (service.singleton) {
        service.instance = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(key);
    }
  }

  isRegistered(key: ServiceKey): boolean {
    return this.services.has(key);
  }

  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }
}

// Service Keys
export const SERVICE_KEYS = {
  // Infrastructure
  DATABASE: Symbol('DATABASE'),
  REDIS: Symbol('REDIS'),
  LOGGER: Symbol('LOGGER'),
  
  // Repositories
  USER_REPOSITORY: Symbol('USER_REPOSITORY'),
  PROFILE_REPOSITORY: Symbol('PROFILE_REPOSITORY'),
  SKILL_REPOSITORY: Symbol('SKILL_REPOSITORY'),
  
  // Services
  USER_SERVICE: Symbol('USER_SERVICE'),
  PROFILE_SERVICE: Symbol('PROFILE_SERVICE'),
  SKILL_SERVICE: Symbol('SKILL_SERVICE'),
  AI_SERVICE: Symbol('AI_SERVICE'),
  CONTEXT_SERVICE: Symbol('CONTEXT_SERVICE'),
  
  // AI/LLM
  LLM_PROVIDER: Symbol('LLM_PROVIDER'),
  CAREER_AGENT: Symbol('CAREER_AGENT'),
  SKILL_EXTRACTOR: Symbol('SKILL_EXTRACTOR'),
  CONTEXT_MANAGER: Symbol('CONTEXT_MANAGER'),
} as const;

// Global container instance
export const container = new Container();

// Type helpers
export type PgDatabase = NodePgDatabase<any>;
export type RedisClient = Database;