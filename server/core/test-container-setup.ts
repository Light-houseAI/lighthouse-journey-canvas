/**
 * Test Container Configuration
 * Extends the main container with test-specific implementations
 */

import {
  createContainer,
  asClass,
  asValue,
  AwilixContainer,
  InjectionMode,
} from 'awilix';
import type { Logger } from './logger';

// Interfaces

// Production implementations
import { NodePermissionService } from '../services/node-permission.service';
import { NodePermissionController } from '../controllers/node-permission.controller';
import { HierarchyService } from '../services/hierarchy-service';
import { InMemoryInsightRepository } from '../__tests__/in-memory-repositories/insight.repository.inmemory';
import { OrganizationService } from '../services/organization.service';

// Test implementations
import { InMemoryNodePermissionRepository } from '../__tests__/in-memory-repositories/node-permission.repository.inmemory';
import { InMemoryOrganizationRepository } from '../__tests__/in-memory-repositories/organization.repository.inmemory';
import { InMemoryHierarchyRepository } from '../__tests__/in-memory-repositories/hierarchy.repository.inmemory';
import { MockStorageService } from '../__tests__/mocks/mock-storage.service';

/**
 * Test container for dependency injection in tests
 * Uses in-memory implementations for repositories while keeping production services
 */
export class TestContainer {
  private static container: AwilixContainer;

  /**
   * Configure test container with in-memory repositories
   */
  static configure(logger: Logger): AwilixContainer {
    // Create test container with PROXY injection mode
    this.container = createContainer({
      injectionMode: InjectionMode.PROXY,
      strict: true,
    });

    // Register infrastructure dependencies
    this.container.register({
      logger: asValue(logger),
      database: asValue(null), // Mock database for repositories that need it
    });

    // Register in-memory repositories (implementing interfaces)
    // Note: hierarchyRepository needs to be registered first for dependency injection
    this.container.register({
      hierarchyRepository: asClass(InMemoryHierarchyRepository).singleton(),
      organizationRepository: asClass(
        InMemoryOrganizationRepository
      ).singleton(),
      insightRepository: asClass(InMemoryInsightRepository).singleton(),
      storage: asClass(MockStorageService).singleton(),
    });

    // Register node permission repository with hierarchy repository dependency
    this.container.register({
      nodePermissionRepository: asClass(
        InMemoryNodePermissionRepository
      ).singleton(),
    });

    // Register production services (using injected interfaces)
    this.container.register({
      nodePermissionService: asClass(NodePermissionService).singleton(),
      hierarchyService: asClass(HierarchyService).singleton(),
      organizationService: asClass(OrganizationService).singleton(),
    });

    // Register controllers
    this.container.register({
      nodePermissionController: asClass(NodePermissionController).transient(),
    });

    return this.container;
  }

  /**
   * Get configured test container
   */
  static getContainer(): AwilixContainer {
    if (!this.container) {
      throw new Error('Test container not configured. Call configure() first.');
    }
    return this.container;
  }

  /**
   * Create request scope
   */
  static createRequestScope(): AwilixContainer {
    return this.getContainer().createScope();
  }

  /**
   * Reset test container
   */
  static reset(): void {
    this.container = null as any;
  }
}
