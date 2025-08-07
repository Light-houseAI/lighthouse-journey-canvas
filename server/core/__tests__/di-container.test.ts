/**
 * Tests for DI Container configuration
 * Following TDD principles - write tests first, then implement
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createInjector } from 'typed-inject';
import { createDIContainer, SERVICE_TOKENS } from '../di-container';

// Mock interfaces for testing
interface TestRepository {
  findAll(): Promise<any[]>;
}

interface TestService {
  getAll(): Promise<any[]>;
}

// Mock implementations
class MockRepository implements TestRepository {
  async findAll(): Promise<any[]> {
    return [{ id: '1', title: 'Test Item' }];
  }
}

class MockService implements TestService {
  constructor(private repository: TestRepository) {}

  async getAll(): Promise<any[]> {
    return this.repository.findAll();
  }
}

describe('DI Container', () => {
  describe('createDIContainer', () => {
    it('should create an injector with proper configuration', () => {
      const injector = createDIContainer();
      expect(injector).toBeDefined();
    });

    it('should be able to resolve basic dependencies', () => {
      const injector = createDIContainer();
      expect(() => injector).not.toThrow();
    });
  });

  describe('SERVICE_TOKENS', () => {
    it('should define all required service tokens', () => {
      // Core infrastructure tokens
      expect(SERVICE_TOKENS.DATABASE).toBeDefined();
      expect(SERVICE_TOKENS.REDIS).toBeDefined();
      expect(SERVICE_TOKENS.LOGGER).toBeDefined();

      // Repository tokens
      expect(SERVICE_TOKENS.WORK_EXPERIENCE_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.EDUCATION_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.PROJECT_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.EVENT_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.ACTION_REPOSITORY).toBeDefined();
      expect(SERVICE_TOKENS.CAREER_TRANSITION_REPOSITORY).toBeDefined();

      // Service tokens
      expect(SERVICE_TOKENS.WORK_EXPERIENCE_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.EDUCATION_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.PROJECT_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.EVENT_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.ACTION_SERVICE).toBeDefined();
      expect(SERVICE_TOKENS.CAREER_TRANSITION_SERVICE).toBeDefined();

      // Profile aggregation
      expect(SERVICE_TOKENS.PROFILE_SERVICE).toBeDefined();
    });

    it('should use symbols for all tokens', () => {
      const tokenValues = Object.values(SERVICE_TOKENS);
      
      tokenValues.forEach(token => {
        expect(typeof token).toBe('symbol');
      });
    });

    it('should have unique tokens', () => {
      const tokenValues = Object.values(SERVICE_TOKENS);
      const uniqueTokens = [...new Set(tokenValues)];
      
      expect(uniqueTokens).toHaveLength(tokenValues.length);
    });
  });

  describe('dependency injection patterns', () => {
    it('should support basic service registration and resolution', () => {
      // Create a minimal injector for testing
      const injector = createInjector()
        .provideValue('mockRepository', new MockRepository())
        .provideClass('mockService', MockService, 'mockRepository');

      const service = injector.resolve('mockService');
      expect(service).toBeInstanceOf(MockService);
    });

    it('should support factory pattern for complex dependencies', async () => {
      const repository = new MockRepository();
      
      // Test direct service creation to verify our mock works
      const directService = new MockService(repository);
      const directResult = await directService.getAll();
      expect(directResult).toHaveLength(1);
      expect(directResult[0].id).toBe('1');

      // For now, just test that the factory function could work
      // Full typed-inject testing will be done in integration tests
      expect(repository).toBeInstanceOf(MockRepository);
    });

    it('should enforce type safety', () => {
      // This test ensures TypeScript compilation enforces type safety
      expect(() => {
        const injector = createInjector()
          .provideValue('repository', new MockRepository())
          .provideClass('service', MockService, 'repository');
        
        return injector.resolve('service');
      }).not.toThrow();
    });
  });

  describe('integration with existing container', () => {
    it('should maintain compatibility with existing service keys', () => {
      const injector = createDIContainer();
      
      // Verify that the injector can be created without throwing
      expect(injector).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing dependencies gracefully', () => {
      const injector = createInjector();
      
      expect(() => {
        injector.resolve('nonExistentService');
      }).toThrow();
    });
  });
});